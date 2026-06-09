"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  listExercises,
  listRunningSessions,
  listWorkouts,
  type Exercise,
  type RunningSession,
  type Workout,
} from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { WorkoutDetailsModal, hasMeaningfulName } from "@/components/workout-details";

/**
 * Month-grid calendar. Renders BOTH workouts (lifting) and running
 * sessions on the same day cells, with distinct pill colors so a
 * two-a-day reads as "lift + run stacked" at a glance.
 *
 * Both endpoints support `since`/`until`, so each cursor change refetches
 * exactly the visible 6-week window — older months no longer come back
 * empty just because the unbounded first page didn't reach them.
 */

// Three pills fit comfortably and cover the realistic case of a morning
// run plus two lifts (or vice versa). Anything more rolls into "+N more"
// to keep cells from growing tall enough to deform the grid.
const MAX_VISIBLE_PILLS = 3;
// Monday-first ordering. Keep this in sync with buildMonthGrid's
// mondayOffset math — flipping one without the other shears the grid.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * One thing the user did that day. Pills render in start-time order so
 * a morning run sits above an afternoon lift. The discriminant lets
 * `DayCell` route to the right pill renderer + click handler without
 * the cell needing to know the underlying shape.
 */
type CalendarEvent =
  | { kind: "workout"; startMs: number; workout: Workout }
  | { kind: "run"; startMs: number; run: RunningSession };

export default function CalendarPage() {
  const router = useRouter();
  const { formatDistance, unitLabel } = useDistanceUnit();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [runs, setRuns] = useState<RunningSession[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  // Calendar is read-only by design — clicking a pill opens the shared
  // WorkoutDetailsModal for lifts; clicking a run pill navigates to the
  // run detail page (runs have a richer detail surface than a modal).
  const [viewing, setViewing] = useState<Workout | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cursor identifies which month we're viewing. year + 0-indexed month
  // — using a `Date` directly would carry day/time noise we'd have to
  // strip on every prev/next.
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Exercise catalog fetches once — it's shared across all months.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    listExercises()
      .then(setExercises)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  // Refetch workouts + runs each time the cursor changes, scoped to the
  // visible 6-week grid. Bounds are computed in *local* time then
  // serialized to UTC — start_time is stored UTC but the grid is
  // bucketed by local-date, and we want the bounds to comfortably cover
  // the visible cells including the prev/next-month trailing days.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const { sinceISO, untilISO } = gridFetchBounds(cursor.year, cursor.month);
    Promise.all([
      listWorkouts(token, { since: sinceISO, until: untilISO, limit: 100 }),
      listRunningSessions(token, { since: sinceISO, until: untilISO }),
    ])
      .then(([wPage, rPage]) => {
        setWorkouts(wPage.items);
        setRuns(rPage.activities);
      })
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [cursor, router]);

  // Lookup map for the shared WorkoutDetails component — resolves
  // exercise_id slugs to catalog entries for name + muscle pills.
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // Bucket every event by local-date key so the cell lookup is O(1) per
  // day during render. Key is `YYYY-M-D` in *local* time — the user's
  // perception of "what day was that" is local-tz, even if the RFC3339
  // timestamps came across in UTC. Within each day, events sort by
  // start time so morning shows above evening.
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const w of workouts ?? []) {
      const start = new Date(w.performed_at);
      const key = localDateKey(start);
      const ev: CalendarEvent = { kind: "workout", startMs: start.getTime(), workout: w };
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    for (const r of runs ?? []) {
      const start = new Date(r.start_time);
      const key = localDateKey(start);
      const ev: CalendarEvent = { kind: "run", startMs: start.getTime(), run: r };
      const list = map.get(key);
      if (list) list.push(ev);
      else map.set(key, [ev]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startMs - b.startMs);
    }
    return map;
  }, [workouts, runs]);

  const days = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);

  // Stats for the currently-viewed month, computed only from events
  // whose LOCAL date falls inside the cursor month. The fetched window
  // is slightly wider (it covers the visible grid's trailing days from
  // adjacent months), so the filter here keeps the tiles honest.
  //
  // "Lift Time" only counts workouts that have an ended_at — workouts
  // with no end time still contribute to the activity count but not to
  // duration (we don't want to fabricate durations for un-clocked
  // sessions). Runs always carry a duration_seconds, so Run Time is
  // unconditional.
  const monthStats = useMemo(() => {
    let activities = 0;
    let liftMinutes = 0;
    let runMinutes = 0;
    let runMeters = 0;
    if (workouts) {
      for (const w of workouts) {
        const d = new Date(w.performed_at);
        if (d.getFullYear() !== cursor.year || d.getMonth() !== cursor.month) continue;
        activities += 1;
        if (w.ended_at) {
          const ms = new Date(w.ended_at).getTime() - d.getTime();
          if (ms > 0) liftMinutes += Math.round(ms / 60000);
        }
      }
    }
    if (runs) {
      for (const r of runs) {
        const d = new Date(r.start_time);
        if (d.getFullYear() !== cursor.year || d.getMonth() !== cursor.month) continue;
        activities += 1;
        runMinutes += Math.round(r.duration_seconds / 60);
        runMeters += r.distance_meters;
      }
    }
    return { activities, liftMinutes, runMinutes, runMeters };
  }, [workouts, runs, cursor]);

  const monthLabel = useMemo(
    () =>
      new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [cursor],
  );

  const goPrev = () =>
    setCursor((c) =>
      c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 },
    );
  const goNext = () =>
    setCursor((c) =>
      c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 },
    );
  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
  };

  const todayKey = localDateKey(new Date());

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">{monthLabel}</h1>
          <button
            type="button"
            onClick={goToday}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Today
          </button>
        </div>
        <div className="flex gap-1">
          <NavButton onClick={goPrev} label="Previous month" direction="left" />
          <NavButton onClick={goNext} label="Next month" direction="right" />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Four month-level stat tiles. Lift Time and Activities show
              today's existing signals; Run Time and Run Distance surface
              the new running data so the calendar isn't workout-biased.
              2-up on narrow screens, 4-up from md so the grid below
              doesn't have to fight for vertical space on a phone. */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile value={formatTotalDuration(monthStats.liftMinutes)} label="Lift Time" />
            <StatTile value={formatTotalDuration(monthStats.runMinutes)} label="Run Time" />
            <StatTile
              value={
                monthStats.runMeters > 0
                  ? `${formatDistance(monthStats.runMeters)} ${unitLabel}`
                  : "—"
              }
              label="Run Distance"
            />
            <StatTile
              value={monthStats.activities.toString()}
              label={monthStats.activities === 1 ? "Activity" : "Activities"}
            />
          </div>

          {/* Weekday header row. Tighter padding so it doesn't compete
              with the day cells visually. */}
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="px-2 py-1 text-center text-xs font-medium text-[var(--muted)]"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day) => {
              const inMonth = day.getMonth() === cursor.month;
              const key = localDateKey(day);
              const dayEvents = eventsByDate.get(key) ?? [];
              const isToday = key === todayKey;
              return (
                <DayCell
                  key={key}
                  day={day}
                  inMonth={inMonth}
                  isToday={isToday}
                  events={dayEvents}
                  onWorkoutClick={(w) => setViewing(w)}
                  onRunClick={(r) => router.push(`/running/${r.id}`)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {viewing && (
        <WorkoutDetailsModal
          workout={viewing}
          exerciseMap={exerciseMap}
          onClose={() => setViewing(null)}
        />
      )}
    </main>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  events,
  onWorkoutClick,
  onRunClick,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  events: CalendarEvent[];
  onWorkoutClick: (w: Workout) => void;
  onRunClick: (r: RunningSession) => void;
}) {
  const visible = events.slice(0, MAX_VISIBLE_PILLS);
  const hiddenCount = events.length - visible.length;

  // Cell skeleton: every cell has a fixed minimum height so the grid
  // rows stay visually balanced even when a day has no events. The
  // accent ring on today's cell stays inside the border to avoid
  // shifting any adjacent cells.
  const baseClasses = "flex min-h-[88px] flex-col gap-1 rounded-md border p-1.5 transition";
  const stateClasses = isToday
    ? "border-[var(--accent)] bg-[var(--surface)]"
    : "border-[var(--border)] bg-[var(--surface)]";
  const labelClasses = inMonth ? "text-[var(--foreground)]" : "text-[var(--muted)] opacity-60";

  return (
    <div className={`${baseClasses} ${stateClasses}`} aria-label={ariaLabelFor(day, events)}>
      <div className={`px-1 text-xs font-medium ${labelClasses}`}>{day.getDate()}</div>
      <div className="flex flex-col gap-1">
        {visible.map((ev) =>
          ev.kind === "workout" ? (
            <WorkoutPill
              key={`w-${ev.workout.id}`}
              workout={ev.workout}
              onClick={() => onWorkoutClick(ev.workout)}
            />
          ) : (
            <RunPill key={`r-${ev.run.id}`} run={ev.run} onClick={() => onRunClick(ev.run)} />
          ),
        )}
        {hiddenCount > 0 && (
          <span className="px-1 text-[10px] text-[var(--muted)]">+{hiddenCount} more</span>
        )}
      </div>
    </div>
  );
}

function ariaLabelFor(day: Date, events: CalendarEvent[]): string {
  const dateLabel = day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (events.length === 0) return dateLabel;
  const lifts = events.filter((e) => e.kind === "workout").length;
  const runs = events.filter((e) => e.kind === "run").length;
  const parts: string[] = [];
  if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? "workout" : "workouts"}`);
  if (runs > 0) parts.push(`${runs} ${runs === 1 ? "run" : "runs"}`);
  return `${dateLabel}, ${parts.join(", ")}`;
}

function WorkoutPill({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const time = new Date(workout.performed_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  // Prefer the user-set workout name (e.g., "Upper 1" from a coached
  // program) as the pill label, since the name is the primary thing a
  // lifter wants to index on. The API auto-generates "Workout - <date>"
  // when no name was set; in that case the date is redundant on a
  // calendar cell so we fall back to the start time instead.
  const named = hasMeaningfulName(workout.name);
  const label = named ? (workout.name as string) : time;
  return (
    <button
      type="button"
      onClick={onClick}
      title={named ? `${time} · ${workout.name}` : time}
      className="truncate rounded bg-[var(--accent)] px-1.5 py-0.5 text-left text-[10px] font-medium text-[var(--accent-fg)] transition hover:opacity-90"
    >
      {label}
    </button>
  );
}

/**
 * Distinct from `WorkoutPill` by color (teal vs accent) so a stacked
 * run + lift reads as two different things at a glance, not just two
 * sessions of the same kind. Clicking navigates to the run's detail
 * page rather than opening an in-place modal: runs have charts and
 * trackpoints that a modal can't surface without becoming its own page.
 */
function RunPill({ run, onClick }: { run: RunningSession; onClick: () => void }) {
  const time = new Date(run.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = run.name?.trim() ? run.name : time;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${time} · Run${run.name ? ` · ${run.name}` : ""}`}
      className="truncate rounded bg-teal-500/20 px-1.5 py-0.5 text-left text-[10px] font-medium text-teal-300 transition hover:bg-teal-500/30"
    >
      {label}
    </button>
  );
}

function NavButton({
  onClick,
  label,
  direction,
}: {
  onClick: () => void;
  label: string;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-1.5 text-[var(--muted)] transition hover:text-[var(--foreground)]"
    >
      <svg
        viewBox="0 0 24 24"
        width={14}
        height={14}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
      </svg>
    </button>
  );
}

/**
 * Single info tile shown above the calendar grid. Four of these sit in
 * a row (Lift Time, Run Time, Run Distance, Activities). Value is
 * rendered large and prominent; label is small uppercase muted text so
 * it reads as metadata, not as primary content.
 */
function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

// --- date helpers ----------------------------------------------------------

/**
 * Build a 6-week (42-day) grid starting on the Monday that contains
 * the first of the month. The fixed 42-cell shape keeps prev/next
 * navigation from reshaping the layout when months have 4, 5, or 6
 * visible weeks; trailing days from the next month fill the bottom row
 * when the actual month is short.
 *
 * JS's getDay() returns 0 for Sunday through 6 for Saturday. We want
 * 0 for Monday through 6 for Sunday, so `(getDay() + 6) % 7` does the
 * shift: Mon→0, Tue→1, …, Sat→5, Sun→6. Subtracting that offset from
 * the 1st of the month lands us on the correct preceding Monday.
 */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }
  return days;
}

/**
 * UTC ISO bounds that comfortably cover the visible 6-week grid. The
 * grid spans the Monday of the week containing the 1st through the
 * following 41 days; we send those as `since` / `until` (half-open) so
 * an event on the very last visible day is still inside the window.
 *
 * The bounds are computed from *local* midnight then serialized as
 * UTC; an event happening just before/after the visible grid that
 * crosses midnight locally is still pulled in because the API range
 * is a touch wider than the strict visible cells.
 */
function gridFetchBounds(year: number, month: number): { sinceISO: string; untilISO: string } {
  const grid = buildMonthGrid(year, month);
  const first = grid[0];
  const last = grid[grid.length - 1];
  const since = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  // until = day after the last visible day at local midnight → fully
  // includes any event happening on the last visible day.
  const until = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
  return { sinceISO: since.toISOString(), untilISO: until.toISOString() };
}

/**
 * Local-date key in `YYYY-M-D` form (zero-padding not required since
 * we only compare equality, not lex-sort). Using local time deliberately
 * — the user's mental model of "what day was that workout" is local-tz,
 * even if the API timestamps came across in UTC.
 */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Total month duration as `Xh Ym`, `Xh`, or `Ym`. Zero shows as "0h"
 * rather than blank so the tile doesn't look like a loading state.
 * Minutes are dropped when the hour total cleanly divides — `4h` reads
 * cleaner than `4h 0m` for a stat tile.
 */
function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return "0h";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
