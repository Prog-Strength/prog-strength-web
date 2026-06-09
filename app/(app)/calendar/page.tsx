"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
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
import { DayDigest } from "@/components/calendar/day-digest";
import { DayCell } from "@/components/calendar/day-cell";
import {
  WeeklyChip,
  WeeklyOverviewColumn,
  type WeeklyStat,
} from "@/components/calendar/weekly-overview";
import type { CalendarEvent } from "@/components/calendar/types";

/**
 * Month-grid calendar. Renders BOTH workouts (lifting) and running
 * sessions on the same day cells, with distinct pill colors so a
 * two-a-day reads as "lift + run stacked" at a glance.
 *
 * Both endpoints support `since`/`until`, so each cursor change refetches
 * exactly the visible 6-week window — older months no longer come back
 * empty just because the unbounded first page didn't reach them.
 */

// Monday-first ordering. Keep this in sync with buildMonthGrid's
// mondayOffset math — flipping one without the other shears the grid.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const router = useRouter();
  const { formatDistance, formatPace, unitLabel } = useDistanceUnit();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [runs, setRuns] = useState<RunningSession[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Cursor identifies which month we're viewing. year + 0-indexed month
  // — using a `Date` directly would carry day/time noise we'd have to
  // strip on every prev/next.
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  // The day whose digest panel is shown below the grid. Seeds to today so
  // the panel reads as the user's "now" on first paint.
  const [selected, setSelected] = useState<string>(() => localDateKey(new Date()));
  // id of the activity whose digest banner should auto-expand (set when a
  // pill is clicked); cleared whenever the selected day changes.
  const [autoExpandId, setAutoExpandId] = useState<string | null>(null);

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

  // Changing months re-anchors the selection to the first of the newly
  // cursored month and clears any auto-expand: a digest left open for a
  // day that's no longer in view would be confusing. We deliberately skip
  // the very first run so the initial load keeps the today-seeded
  // selection (re-anchoring on mount would snap "today" to the 1st).
  const cursorMounted = useRef(false);
  useEffect(() => {
    if (!cursorMounted.current) {
      cursorMounted.current = true;
      return;
    }
    setSelected(localDateKey(new Date(cursor.year, cursor.month, 1)));
    setAutoExpandId(null);
  }, [cursor]);

  // The digest panel below the grid. Pill/cell clicks scroll it into view
  // so the read-out is visible without the user hunting for it.
  const digestRef = useRef<HTMLDivElement>(null);

  const selectDay = (key: string) => {
    setSelected(key);
    setAutoExpandId(null);
    // defer so the digest has re-rendered for the new day before scrolling
    requestAnimationFrame(() =>
      digestRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };
  const selectDayAndExpand = (key: string, activityId: string) => {
    setSelected(key);
    setAutoExpandId(activityId);
    requestAnimationFrame(() =>
      digestRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };

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

  // Per-week rollups for the weekly overview column (md+) and the inline
  // chips (<md). Walks the 42-day grid in chunks of seven so each entry
  // lines up with a calendar row, then sums every workout/run whose local
  // date falls inside that week. Lift time only counts workouts with an
  // ended_at (same honesty rule as monthStats); runs always carry a
  // duration.
  const weeklyStats = useMemo<WeeklyStat[]>(() => {
    const weeks: WeeklyStat[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      const keys = new Set(weekDays.map(localDateKey));
      let activities = 0,
        liftMinutes = 0,
        runMeters = 0,
        runMinutes = 0;
      for (const w of workouts ?? []) {
        const key = localDateKey(new Date(w.performed_at));
        if (!keys.has(key)) continue;
        activities += 1;
        if (w.ended_at) {
          const ms = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
          if (ms > 0) liftMinutes += Math.round(ms / 60000);
        }
      }
      for (const r of runs ?? []) {
        const key = localDateKey(new Date(r.start_time));
        if (!keys.has(key)) continue;
        activities += 1;
        runMinutes += Math.round(r.duration_seconds / 60);
        runMeters += r.distance_meters;
      }
      weeks.push({ weekStart: weekDays[0], activities, liftMinutes, runMeters, runMinutes });
    }
    return weeks;
  }, [days, workouts, runs]);

  // Running-quality stats for the cursor month: average pace and longest
  // run. Filtered to runs whose LOCAL date is in the cursor month (same
  // style as monthStats). avgPace is computed from aggregate distance +
  // duration — not an average of per-run paces — so longer runs weight
  // it correctly. Pace is seconds-per-KILOMETER; formatPace converts to
  // the display unit.
  const monthRunningStats = useMemo(() => {
    let totalDurationSec = 0;
    let totalDistanceMeters = 0;
    let longestRunMeters = 0;
    let hasRuns = false;
    if (runs) {
      for (const r of runs) {
        const d = new Date(r.start_time);
        if (d.getFullYear() !== cursor.year || d.getMonth() !== cursor.month) continue;
        hasRuns = true;
        totalDurationSec += r.duration_seconds;
        totalDistanceMeters += r.distance_meters;
        if (r.distance_meters > longestRunMeters) longestRunMeters = r.distance_meters;
      }
    }
    const avgPaceSecPerKm =
      totalDistanceMeters > 0 ? totalDurationSec / (totalDistanceMeters / 1000) : null;
    return { avgPaceSecPerKm, longestRunMeters, hasRuns };
  }, [runs, cursor]);

  // The selected day as a Date, for the digest header + banner formatting.
  const selectedDate = useMemo(() => dateFromKey(selected), [selected]);

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
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Six month-level stat tiles. Lift Time and Activities show
              today's existing signals; Run Time, Run Distance, Avg Pace,
              and Longest Run surface running data so the calendar isn't
              workout-biased. 2-up on narrow screens, 3-up from md, 6-up
              from lg so the grid below doesn't fight for vertical space on
              a phone. */}
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
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
            {/* Avg Pace and Longest Run only make sense when the month has
                runs. Rather than show "—", they're ALWAYS rendered and
                hidden when there are no runs, so paging between a run month
                and a run-less month doesn't shift the row. The `contents`
                wrapper keeps the tile a direct grid child when visible;
                `hidden` drops it from layout otherwise. */}
            <div className={monthRunningStats.hasRuns ? "contents" : "hidden"}>
              <StatTile
                value={`${formatPace(monthRunningStats.avgPaceSecPerKm)} /${unitLabel}`}
                label="Avg Pace"
              />
            </div>
            <div className={monthRunningStats.hasRuns ? "contents" : "hidden"}>
              <StatTile
                value={`${formatDistance(monthRunningStats.longestRunMeters)} ${unitLabel}`}
                label="Longest Run"
              />
            </div>
            <StatTile
              value={monthStats.activities.toString()}
              label={monthStats.activities === 1 ? "Activity" : "Activities"}
            />
          </div>

          {/* Grid + weekly column sit side-by-side at md+; the column
              stacks below (as inline chips) on narrow screens. */}
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex-1">
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

              {/* One grid, rendered week-by-week so each row can be preceded
                  by a full-width WeeklyChip on small screens. The chip is a
                  `col-span-7 md:hidden` grid child, so at md+ it drops out of
                  layout entirely and the grid is a clean 6×7 of day cells. */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 6 }).map((_, w) => (
                  <Fragment key={`week-${w}`}>
                    <div className="col-span-7 md:hidden">
                      <WeeklyChip
                        week={weeklyStats[w]}
                        isCurrent={weekContainsToday(weeklyStats[w], todayKey)}
                      />
                    </div>
                    {days.slice(w * 7, w * 7 + 7).map((day) => {
                      const inMonth = day.getMonth() === cursor.month;
                      const key = localDateKey(day);
                      const dayEvents = eventsByDate.get(key) ?? [];
                      const isToday = key === todayKey;
                      const isSelected = key === selected;
                      return (
                        <DayCell
                          key={key}
                          day={day}
                          inMonth={inMonth}
                          isToday={isToday}
                          isSelected={isSelected}
                          events={dayEvents}
                          onSelectDay={() => selectDay(key)}
                          onSelectWorkout={(id) => selectDayAndExpand(key, id)}
                          onSelectRun={(id) => selectDayAndExpand(key, id)}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
            <WeeklyOverviewColumn weeks={weeklyStats} todayKey={todayKey} />
          </div>

          {/* Expanded read-out of the selected day. Wrapped in a ref so
              pill/cell clicks can scroll it into view after the new day
              has rendered. */}
          <div ref={digestRef}>
            <DayDigest
              date={selectedDate}
              events={eventsByDate.get(selected) ?? []}
              exerciseMap={exerciseMap}
              autoExpandId={autoExpandId}
              onNavigateWorkout={(id) => router.push(`/workouts/${id}`)}
              onNavigateRun={(id) => router.push(`/running/${id}`)}
            />
          </div>
        </div>
      </div>
    </main>
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
 * Single info tile shown above the calendar grid. Six of these sit in a
 * row (Lift Time, Run Time, Run Distance, Avg Pace, Longest Run,
 * Activities). Value is rendered large and prominent; label is small
 * uppercase muted text so it reads as metadata, not as primary content.
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
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * True when `todayKey` matches any of the seven local-date keys starting
 * at the week's first day. Mirrors WeeklyOverviewColumn's current-week
 * detection so the inline chips light up the same week the side column
 * does. Defends against an undefined `week` (the grid is always six full
 * weeks, but a guard keeps this honest if that ever changes).
 */
function weekContainsToday(week: WeeklyStat | undefined, todayKey: string): boolean {
  if (!week) return false;
  for (let i = 0; i < 7; i++) {
    const d = new Date(
      week.weekStart.getFullYear(),
      week.weekStart.getMonth(),
      week.weekStart.getDate() + i,
    );
    if (localDateKey(d) === todayKey) return true;
  }
  return false;
}

/**
 * Inverse of `localDateKey`: parse a `YYYY-M-D` local key back into a
 * Date at local midnight. The month is 0-indexed in the key (it came
 * from getMonth()), so it's fed straight into the Date constructor.
 */
function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m, d);
}

/**
 * Total month duration as `Xh Ym`, `Xh`, or `Ym`. Zero shows as "0h"
 * rather than blank so the tile doesn't look like a loading state.
 * Minutes are dropped when the hour total cleanly divides — `4h` reads
 * cleaner than `4h 0m` for a stat tile.
 */
export function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return "0h";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
