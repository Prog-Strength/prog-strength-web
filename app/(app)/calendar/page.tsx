"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  getCalendarConnection,
  listExercises,
  listPlannedWorkouts,
  listRunningSessions,
  listSteps,
  listWorkouts,
  resyncPlannedWorkout,
  type Exercise,
  type PlannedWorkout,
  type RunningSession,
  type StepsEntry,
  type Workout,
} from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useActiveWorkoutSession } from "@/lib/active-workout-session";
import { plannedToDraftExercises } from "@/lib/workout-draft";
import { DayDigest } from "@/components/calendar/day-digest";
import { DayCell } from "@/components/calendar/day-cell";
import { buildEventsByDate, localDateKey } from "@/components/calendar/merge-events";
import { WeekColumn, type WeeklyStat } from "@/components/calendar/weekly-overview";
import { isTrainedDay, monthConsistencyCopy } from "@/components/calendar/derivations";
import { useProfile } from "@/lib/profile-context";
import { PlannedWorkoutModal } from "@/components/planned-workout-modal";

/**
 * Month-grid calendar. Renders BOTH workouts (lifting) and running
 * sessions on the same day cells, with distinct pill colors so a
 * two-a-day reads as "lift + run stacked" at a glance.
 *
 * Both endpoints support `since`/`until`, so each cursor change refetches
 * exactly the visible window (the 4–6 whole weeks intersecting the month)
 * — older months no longer come back empty just because the unbounded
 * first page didn't reach them.
 */

// Monday-first ordering. Keep this in sync with buildMonthGrid's
// mondayOffset math — flipping one without the other shears the grid.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const router = useRouter();
  const { formatDistance, formatPace, unitLabel } = useDistanceUnit();
  const { start } = useActiveWorkoutSession();
  const { profile } = useProfile();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [runs, setRuns] = useState<RunningSession[] | null>(null);
  const [steps, setSteps] = useState<StepsEntry[] | null>(null);
  const [planned, setPlanned] = useState<PlannedWorkout[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Whether the user has a live Google Calendar connection — gates the
  // "Sync to Google Calendar" checkbox in the planning modal. Fetched once.
  const [calendarConnected, setCalendarConnected] = useState(false);
  // When set, the create/edit planning modal is open; null is the plan
  // being edited (a fresh plan when the modal is open with `editing` null).
  const [planningOpen, setPlanningOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<PlannedWorkout | null>(null);
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
    // Calendar connection drives whether the planning modal offers a
    // "Sync to Google Calendar" checkbox. Best-effort — a failure here
    // just leaves the checkbox hidden, so we don't surface it as an error.
    getCalendarConnection(token)
      .then((conn) => setCalendarConnected(conn.status === "connected"))
      .catch(() => setCalendarConnected(false));
  }, [router]);

  // Refetch workouts + runs each time the cursor changes, scoped to the
  // visible 6-week grid. Bounds are computed in *local* time then
  // serialized to UTC — start_time is stored UTC but the grid is
  // bucketed by local-date, and we want the bounds to comfortably cover
  // the visible cells including the prev/next-month trailing days.
  const loadWindow = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const { sinceISO, untilISO } = gridFetchBounds(cursor.year, cursor.month);
    // Steps are keyed by calendar date (YYYY-MM-DD), so they use the
    // visible grid's first/last day directly rather than the UTC instant
    // bounds the timed activities use.
    const grid = buildMonthGrid(cursor.year, cursor.month);
    const stepsSince = isoDateKey(grid[0]);
    const stepsUntil = isoDateKey(grid[grid.length - 1]);
    Promise.all([
      listWorkouts(token, { since: sinceISO, until: untilISO, limit: 100 }),
      listRunningSessions(token, { since: sinceISO, until: untilISO }),
      listSteps(token, { since: stepsSince, until: stepsUntil }),
      listPlannedWorkouts(token, { since: sinceISO, until: untilISO }),
    ])
      .then(([wPage, rPage, sPage, pList]) => {
        setWorkouts(wPage.items);
        setRuns(rPage.activities);
        setSteps(sPage.steps);
        setPlanned(pList);
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

  useEffect(() => {
    loadWindow();
  }, [loadWindow]);

  // Changing months re-anchors the selection to the first of the newly
  // cursored month: a digest left open for a day that's no longer in view
  // would be confusing. We deliberately skip the very first run so the
  // initial load keeps the today-seeded selection (re-anchoring on mount
  // would snap "today" to the 1st).
  const cursorMounted = useRef(false);
  useEffect(() => {
    if (!cursorMounted.current) {
      cursorMounted.current = true;
      return;
    }
    setSelected(localDateKey(new Date(cursor.year, cursor.month, 1)));
  }, [cursor]);

  // The digest panel below the grid. Pill/cell clicks scroll it into view
  // so the read-out is visible without the user hunting for it.
  const digestRef = useRef<HTMLDivElement>(null);

  const selectDay = (key: string) => {
    setSelected(key);
    // defer so the digest has re-rendered for the new day before scrolling
    requestAnimationFrame(() =>
      digestRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
    );
  };

  // Re-attempt a failed Google push, then refresh the window so the
  // pill's sync indicator reflects the new status.
  const resyncPlan = useCallback(
    async (id: string) => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        await resyncPlannedWorkout(token, id);
        loadWindow();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Resync failed");
      }
    },
    [router, loadWindow],
  );

  // Open the planning modal for a brand-new plan (seeded to the selected
  // day, opens in edit mode) or on an existing plan (opens read-only; the
  // modal's own pencil leads to edit).
  const openNewPlan = () => {
    setEditingPlan(null);
    setPlanningOpen(true);
  };
  const openViewPlan = (plan: PlannedWorkout) => {
    setEditingPlan(plan);
    setPlanningOpen(true);
  };
  const closePlanning = () => {
    setPlanningOpen(false);
    setEditingPlan(null);
  };

  // A grid planned pill opens the read-only modal for that plan directly,
  // selecting its day as a side effect (the modal is the detail surface).
  const openPlannedForDay = (key: string, plan: PlannedWorkout) => {
    setSelected(key);
    openViewPlan(plan);
  };

  // Begin a live workout prefilled from a planned lift, carrying the plan id
  // so the saved workout links back to the plan. Closes the modal and hands
  // off to the live page.
  const startPlannedWorkout = (plan: PlannedWorkout) => {
    start({
      name: plan.name ?? undefined,
      exercises: plannedToDraftExercises(plan),
      plannedWorkoutId: plan.id,
    });
    closePlanning();
    router.push("/workout/live");
  };

  // Lookup map for the shared WorkoutDetails component — resolves
  // exercise_id slugs to catalog entries for name + muscle pills.
  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  // Bucket every event by local-date key so the cell lookup is O(1) per
  // day during render (see buildEventsByDate). A completed planned session
  // and the logged session that fulfilled it collapse into one
  // `completed-planned` event when they share a local day, so a
  // planned-ahead workout doesn't read as two near-identical entries once
  // it's done.
  const eventsByDate = useMemo(
    () => buildEventsByDate(workouts ?? [], runs ?? [], planned ?? []),
    [workouts, runs, planned],
  );

  // Per-day step totals keyed by the API's YYYY-MM-DD date, for the digest.
  const stepsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of steps ?? []) map.set(s.date, s.steps);
    return map;
  }, [steps]);

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

  // Per-week rollups for the slim "Week" rollup column (the 8th grid column).
  // Walks the grid in chunks of seven so each entry lines up with a calendar
  // row, then sums every workout/run whose local date falls inside that week.
  // Lift time only counts workouts with an ended_at (same honesty rule as
  // monthStats); runs always carry a duration.
  const weeklyStats = useMemo<WeeklyStat[]>(() => {
    const weeks: WeeklyStat[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const weekDays = days.slice(i, i + 7);
      const keys = new Set(weekDays.map(localDateKey));
      // Steps join by their YYYY-MM-DD string, so this week needs the
      // matching zero-padded key set.
      const isoKeys = new Set(weekDays.map(isoDateKey));
      let activities = 0,
        liftMinutes = 0,
        runMeters = 0,
        weekSteps = 0;
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
        runMeters += r.distance_meters;
      }
      for (const s of steps ?? []) {
        if (isoKeys.has(s.date)) weekSteps += s.steps;
      }
      const dayMarks = weekDays.map((d) => ({
        inMonth: d.getMonth() === cursor.month,
        trained: isTrainedDay(eventsByDate.get(localDateKey(d)) ?? []),
      }));
      weeks.push({
        weekStart: weekDays[0],
        activities,
        liftMinutes,
        runMeters,
        steps: weekSteps,
        days: dayMarks,
      });
    }
    return weeks;
  }, [days, workouts, runs, steps, eventsByDate, cursor.month]);

  // Distinct in-month days carrying a done event — the header's consistency
  // line. Weeks partition the grid, so summing per-week trained
  // in-month days counts each day once.
  const monthTrainedDays = useMemo(
    () =>
      weeklyStats.reduce((sum, w) => sum + w.days.filter((d) => d.inMonth && d.trained).length, 0),
    [weeklyStats],
  );

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
      {/* Demoted header: the month-switching chrome is gone from the hero —
          navigation lives in the quiet inline stepper above the grid. The
          header keeps only the coaching greeting and the two reachable
          actions (Today + the violet Plan a workout). */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <p className="text-sm text-[var(--muted)]">
          {monthConsistencyCopy(profile?.display_name ?? null, monthTrainedDays)}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--foreground)]"
          >
            Today
          </button>
          <button
            type="button"
            onClick={openNewPlan}
            className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-90"
          >
            Plan a workout
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-6xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {/* Inline month stepper — the demoted, calendar-native replacement
              for the old header chevron bar: the month label flanked by quiet
              prev/next chevrons in a single pill, sitting above the grid out
              of the hero position. */}
          <div className="mb-4 flex items-center">
            <div className="inline-flex items-center gap-0.5 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5">
              <StepperChevron onClick={goPrev} label="Previous month" direction="left" />
              <span className="min-w-[8.5rem] px-1 text-center text-sm font-semibold tracking-tight">
                {monthLabel}
              </span>
              <StepperChevron onClick={goNext} label="Next month" direction="right" />
            </div>
          </div>

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

          {/* Single bordered month grid in the true-month-grid vocabulary:
              a weekday header row over seven day columns plus a slim 8th
              "Week" rollup column (repeat(7, 1fr) 84px). One row per visible
              week, ruled with a top hairline so it reads as a real calendar.
              The grid is month-bounded (4–6 weeks; see buildMonthGrid), so it
              stops where the month stops — adjacent-month days appear only as
              greyed cells inside the boundary rows. */}
          <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div
              className="grid border-b border-[var(--border)] bg-[var(--surface-2)]/40"
              style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr)) 84px" }}
            >
              {WEEKDAYS.map((d) => (
                <div
                  key={d}
                  className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]"
                >
                  {d}
                </div>
              ))}
              <div className="border-l border-[var(--border)] px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                Week
              </div>
            </div>
            {Array.from({ length: days.length / 7 }).map((_, w) => (
              <div
                key={`week-${w}`}
                className="grid border-t border-[var(--border)] first:border-t-0"
                style={{ gridTemplateColumns: "repeat(7, minmax(0,1fr)) 84px" }}
              >
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
                      onNavigateWorkout={(id) => router.push(`/workouts/${id}`)}
                      onNavigateRun={(id) => router.push(`/running/${id}`)}
                      onOpenPlanned={(plan) => openPlannedForDay(key, plan)}
                    />
                  );
                })}
                <WeekColumn
                  week={weeklyStats[w]}
                  isCurrent={weekContainsToday(weeklyStats[w], todayKey)}
                />
              </div>
            ))}
          </div>

          {/* Expanded read-out of the selected day. Wrapped in a ref so
              pill/cell clicks can scroll it into view after the new day
              has rendered. */}
          <div ref={digestRef}>
            <DayDigest
              date={selectedDate}
              events={eventsByDate.get(selected) ?? []}
              steps={stepsByDate.get(isoDateKey(selectedDate)) ?? null}
              exerciseMap={exerciseMap}
              onNavigateWorkout={(id) => router.push(`/workouts/${id}`)}
              onNavigateRun={(id) => router.push(`/running/${id}`)}
              onPlanWorkout={openNewPlan}
              onOpenPlanned={openViewPlan}
              onResyncPlanned={resyncPlan}
              onNavigateSession={(kind, id) =>
                router.push(kind === "activity" ? `/running/${id}` : `/workouts/${id}`)
              }
            />
          </div>
        </div>
      </div>

      {planningOpen && (
        <PlannedWorkoutModal
          // Remount when the targeted plan changes so the modal re-seeds its
          // view/edit state (a stale draft must never carry across plans).
          key={editingPlan?.id ?? "new"}
          plan={editingPlan}
          catalog={exercises}
          calendarConnected={calendarConnected}
          // Seed a new plan's date to the day the user is looking at, so
          // "Plan a workout" from a selected day lands on that day.
          defaultDate={editingPlan ? undefined : selectedDate}
          onClose={closePlanning}
          // Refresh the calendar window but keep the modal open — it returns
          // to its read-only view of the saved plan.
          onSaved={() => loadWindow()}
          onStartWorkout={startPlannedWorkout}
        />
      )}
    </main>
  );
}

/**
 * A quiet chevron button inside the inline month-stepper pill. Ghost styling
 * (no border of its own — the pill carries the border) so the stepper reads
 * as one calm control rather than the old floating chevron utility bar.
 */
function StepperChevron({
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
      className="rounded-full p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
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
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/40 px-3 py-2.5">
      <p className="text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </p>
    </div>
  );
}

// --- date helpers ----------------------------------------------------------

/**
 * Build a month-bounded grid of WHOLE weeks (Monday-first) that contains
 * only the weeks intersecting the given month — 4 to 6 rows, always a
 * multiple of seven days. The first week starts on the Monday on/before
 * the 1st and the last week ends on the Sunday on/after the month's last
 * day. Adjacent-month days still appear, but ONLY as boundary cells in
 * the first/last rows; there are never phantom whole rows made entirely
 * of next-month days (which a fixed 42-cell shape would emit for short
 * months).
 *
 * JS's getDay() returns 0 for Sunday through 6 for Saturday. We want
 * 0 for Monday through 6 for Sunday, so `(getDay() + 6) % 7` does the
 * shift: Mon→0, Tue→1, …, Sat→5, Sun→6. Subtracting that offset from
 * the 1st of the month lands us on the correct preceding Monday;
 * `(6 - sundayShift)` adds the trailing days that complete the final
 * week, where sundayShift is the last day's Monday-first index.
 */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  // Sunday on/after the month's last day: walk from the last day forward
  // to the end of its week. (month + 1, day 0) is the last day of `month`,
  // and adding the remaining days of its week — measured back in `month`'s
  // own day numbering — lands on the closing Sunday (rolling into the next
  // month as needed).
  const lastOfMonth = new Date(year, month + 1, 0);
  const lastMondayIdx = (lastOfMonth.getDay() + 6) % 7;
  const end = new Date(year, month, lastOfMonth.getDate() + (6 - lastMondayIdx));
  const days: Date[] = [];
  for (let d = start; d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    days.push(d);
  }
  return days;
}

/**
 * UTC ISO bounds that comfortably cover the visible grid. The grid spans
 * the Monday of the week containing the 1st through the Sunday of the
 * week containing the last day (4–6 whole weeks); we send the first and
 * last visible day as `since` / `until` (half-open) so an event on the
 * very last visible day is still inside the window.
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
 * Local-date key in zero-padded `YYYY-MM-DD` form — the calendar-date
 * format the steps API uses for its `date` field. Distinct from
 * localDateKey (which is `YYYY-M-D` and only used for equality checks);
 * this one must match the API's string exactly to join steps to days.
 */
function isoDateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * True when `todayKey` matches any of the seven local-date keys starting
 * at the week's first day. Drives the stronger-hairline emphasis on the
 * current week's rollup column. Defends against an undefined `week` (the grid is a
 * variable run of 4–6 whole weeks, so a guard keeps this honest at the
 * row-count boundaries).
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
