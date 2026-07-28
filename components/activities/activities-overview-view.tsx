"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  activityToWorkout,
  getStepsGoal,
  listActivities,
  listSteps,
  type RunningSession,
  type StepsEntry,
  type Workout,
} from "@/lib/api";
import { ActivitiesCombinedChart } from "@/components/activities/activities-combined-chart";
import {
  EffortReadout,
  Instrument,
  MileageBars,
  PaceSparkline,
  SplitDonut,
  StepsBars,
} from "@/components/activities/overview/instruments";
import { deriveOverviewStats, formatHm } from "@/lib/activities-overview-stats";
import { formatPaceValue } from "@/lib/distance-unit-context";
import { isoDate, parseLocalDate, rangeSinceIso } from "@/lib/steps-stats";

// Fetch budget for the cursor form (the "all" timeframe, which has no
// since/until window). 100 is the API's hard page cap; when hit the
// combined chart surfaces a truncation note. Windowed timeframes use
// /activities range mode instead (uncapped server-side).
const ACTIVITIES_LIMIT = 100;
const KM_PER_MILE = 1.609344;

/**
 * Overview sub-view — the Activities page's default. The instrument-panel
 * composition (DX `instrument-panel`, Strava "your stats"): a compact KPI
 * row over a tight grid of small framed charts — graphs first, numbers
 * second. It answers "how's my training going?" across all modalities
 * before a user drills into the Workouts / Running / Steps tabs.
 *
 * Owns its own parallel fetches (workouts + running sessions + steps +
 * steps goal), refetched on mount and on `days` change. Every number and
 * series is derived client-side over the fetched window by
 * `deriveOverviewStats`; no aggregation endpoint is assumed.
 */
export function ActivitiesOverviewView({
  days,
  distanceUnit,
}: {
  days: number | null;
  distanceUnit: "mi" | "km";
}) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [sessions, setSessions] = useState<RunningSession[] | null>(null);
  const [steps, setSteps] = useState<StepsEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parallel fetch on mount + on `days` change. since/until derive from
  // the window (`days`); both omitted for "all". A 401 on either call
  // bounces to login; other failures render the inline panel.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    // One calendar-day-aligned window for every fetch, so the workout/run
    // window matches the steps window and the derivation's `days`-calendar-day
    // span exactly (no out-of-window rows leaking into the KPI rollups).
    // `rangeSinceIso` is the same inclusive-start helper the Steps tab uses.
    const stepsSince = days !== null ? rangeSinceIso(days) : undefined;
    const stepsUntil = days !== null ? isoDate(new Date()) : undefined;
    // Workouts/running filter on RFC3339 timestamps: anchor `since` to local
    // midnight of that same inclusive start day.
    const since = stepsSince ? parseLocalDate(stepsSince).toISOString() : undefined;
    const until = days !== null ? new Date().toISOString() : undefined;

    // Reset to the loading state so a window change shows "Loading…"
    // rather than stale aggregates from the prior window.
    setWorkouts(null);
    setSessions(null);
    setSteps(null);
    // ONE unified fetch covers every activity type (stage 3): windowed
    // timeframes use the uncapped range form; "all" uses the cursor form
    // with the page cap. Items partition by activity_type — strength rows
    // adapt onto the legacy Workout shape (their exercises + PR events
    // ride along in `details`), everything else is the endurance view the
    // run instruments consume. The steps-goal fetch is kept to preserve
    // the tab's load orchestration even though the instrument panel no
    // longer surfaces a goal-% readout.
    Promise.all([
      since
        ? listActivities(token, { since, until })
        : listActivities(token, { limit: ACTIVITIES_LIMIT }),
      listSteps(token, { since: stepsSince, until: stepsUntil }),
      getStepsGoal(token),
    ])
      .then(([ap, stp]) => {
        setError(null);
        setWorkouts(
          ap.activities
            .filter((a) => a.activity_type === "strength_training")
            .map(activityToWorkout),
        );
        setSessions(ap.activities.filter((a) => a.activity_type !== "strength_training"));
        setSteps(stp.steps);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(msg || "Failed to load activity");
      });
  }, [router, days]);

  // The whole instrument panel derives from one rollup over the fetched
  // window. Memoized on the fetched arrays so chart-local re-renders don't
  // recompute; "today" is a real Date taken at derivation time.
  const stats = useMemo(
    () => deriveOverviewStats({ workouts, sessions, steps, days, now: new Date() }),
    [workouts, sessions, steps, days],
  );

  // All fetches resolve together (Promise.all), so any being null means
  // the panel is still loading.
  const loading = workouts === null || sessions === null || steps === null;
  // Only the "all" timeframe's cursor fetch can truncate (range mode is
  // uncapped); the cap now spans every type, so compare the combined count.
  const truncated =
    days === null && (workouts?.length ?? 0) + (sessions?.length ?? 0) >= ACTIVITIES_LIMIT;

  // Avg run pace is derived in sec/mi; honor the active unit on display.
  const avgPaceLabel = formatPaceValue(
    stats.avgRunPaceSecPerMi == null ? null : stats.avgRunPaceSecPerMi / KM_PER_MILE,
    distanceUnit,
  );
  const paceUnit = distanceUnit === "mi" ? "/mi" : "/km";
  // No runs at all → no pace/mileage instruments (don't leave empty frames).
  const hasRuns = stats.headline.runCount > 0;
  const hasSteps = stats.stepsSeries.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {!error && loading && <p className="text-sm text-[var(--muted)]">Loading activity…</p>}

      {!error && !loading && (
        <>
          {/* Minimal KPI row — the headline numbers demoted to a compact
              strip so the charts lead. The accent appears exactly once: the
              consistency (days-active + streak) readout. */}
          <div className="grid grid-cols-2 gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 sm:grid-cols-4">
            <Kpi label="Total time" value={formatHm(stats.headline.totalActiveSeconds)} />
            <Kpi
              label="Sessions"
              value={String(stats.headline.sessionCount)}
              sub={`${stats.headline.workoutCount} workouts · ${stats.headline.runCount} runs`}
            />
            <Kpi label="Avg run pace" value={avgPaceLabel} sub={paceUnit} />
            <Kpi
              label="Days active"
              value={`${stats.consistency.daysActive} / ${stats.consistency.totalDays}`}
              sub={
                stats.consistency.currentStreak > 0
                  ? `${stats.consistency.currentStreak}-day streak`
                  : `longest ${stats.consistency.longestStreak}d`
              }
              accent
            />
          </div>

          {/* The grid of small framed instruments — charts as the hero. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Carried-over dual Lifting/Running weekly line (recharts). */}
            <Instrument title="Weekly activity" sub="lift / run" className="lg:col-span-2">
              <ActivitiesCombinedChart
                workouts={workouts}
                sessions={sessions}
                days={days}
                truncated={truncated}
                fetchLimit={ACTIVITIES_LIMIT}
              />
            </Instrument>

            <Instrument title="Time split" sub="lift vs run">
              <SplitDonut split={stats.disciplineSplit} />
            </Instrument>

            {hasRuns && (
              <Instrument title="Avg pace" sub={`per week · ${paceUnit}`}>
                <PaceSparkline
                  weekly={stats.weekly}
                  bestPaceSecPerMi={stats.bestPaceSecPerMi}
                  distanceUnit={distanceUnit}
                />
              </Instrument>
            )}

            {hasRuns && (
              <Instrument title="Mileage" sub={`per week · ${distanceUnit}`}>
                <MileageBars weekly={stats.weekly} distanceUnit={distanceUnit} />
              </Instrument>
            )}

            {hasRuns && (
              <Instrument title="Effort" sub="HR · elevation">
                <EffortReadout effort={stats.effort} distanceUnit={distanceUnit} />
              </Instrument>
            )}

            {/* Steps instrument is hidden entirely when the window has no
                step entries (today's view already gates on this). */}
            {hasSteps && (
              <Instrument title="Daily steps" sub="trend">
                <StepsBars series={stats.stepsSeries} />
              </Instrument>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** One compact KPI in the headline strip. The accent is reserved for the
 * single emphasised readout (the consistency value). */
function Kpi({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p
        className={`text-lg font-semibold tabular-nums tracking-[-0.03em] ${
          accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </p>
      {sub && <p className="mt-0.5 text-[11px] tabular-nums text-[var(--muted)]">{sub}</p>}
    </div>
  );
}
