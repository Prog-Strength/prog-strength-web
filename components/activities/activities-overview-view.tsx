"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { listRunningSessions, listWorkouts, type RunningSession, type Workout } from "@/lib/api";
import { StatTile } from "@/components/stat-tile";
import { ActivitiesCombinedChart } from "@/components/activities/activities-combined-chart";
import { formatHours } from "@/lib/chart-format";
import { formatDistanceValue } from "@/lib/distance-unit-context";
import { workoutVolume } from "@/lib/workout-volume";

// Workouts cap at the API's hard limit of 100; when hit the combined
// chart surfaces a truncation note. Running uses /activities range mode
// instead (uncapped server-side), so no equivalent SESSIONS_LIMIT here.
const WORKOUTS_LIMIT = 100;

/**
 * Overview sub-view — the Activities page's default. A digest of the
 * selected window: two stat-tile rows bracketing a combined weekly
 * activity chart (lifting minutes vs running minutes). Single-modality
 * drill-down belongs on the dedicated Workouts / Running tabs, so this
 * is deliberately a digest rather than its own dashboard.
 *
 * Owns its own parallel fetches (workouts + running sessions), refetched
 * on mount and on `days` change. All aggregates are computed client-side
 * over the fetched window.
 */
export function ActivitiesOverviewView({
  days,
  displayUnit,
  distanceUnit,
}: {
  days: number | null;
  displayUnit: "lb" | "kg";
  distanceUnit: "mi" | "km";
}) {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [sessions, setSessions] = useState<RunningSession[] | null>(null);
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
    const since =
      days !== null ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
    const until = days !== null ? new Date().toISOString() : undefined;

    // Reset to the loading state so a window change shows "Loading…"
    // rather than stale aggregates from the prior window.
    setWorkouts(null);
    setSessions(null);
    // /activities forbids mixing since/until with limit/before, and the
    // range form is uncapped server-side, so the running fetch omits
    // `limit` and trusts the window to bound the result.
    Promise.all([
      listWorkouts(token, { since, limit: WORKOUTS_LIMIT }),
      listRunningSessions(token, { since, until }),
    ])
      .then(([wp, sp]) => {
        setError(null);
        setWorkouts(wp.items);
        setSessions(sp.activities);
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

  // All aggregates are memoized on the two fetched arrays so re-renders
  // (e.g. from the chart's own state) don't recompute the sums.
  const stats = useMemo(() => {
    const ws = workouts ?? [];
    const ss = sessions ?? [];

    // Completed workouts only: skip in-progress (no ended_at) and any
    // non-positive span. ms → minutes.
    let totalWorkoutMinutes = 0;
    for (const w of ws) {
      if (!w.ended_at) continue;
      const ms = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
      if (ms > 0) totalWorkoutMinutes += ms / 60000;
    }

    let totalRunningMinutes = 0;
    let totalMileageMeters = 0;
    for (const s of ss) {
      totalRunningMinutes += s.duration_seconds / 60;
      totalMileageMeters += s.distance_meters;
    }

    const totalMinutes = totalWorkoutMinutes + totalRunningMinutes;
    const workoutCount = ws.length;
    const runCount = ss.length;
    const totalSessions = workoutCount + runCount;

    let totalVolume = 0;
    let prCount = 0;
    for (const w of ws) {
      totalVolume += workoutVolume(w, displayUnit);
      prCount += w.personal_records_set.length;
    }

    const avgSessionMinutes = totalSessions ? totalMinutes / totalSessions : 0;

    return {
      totalMinutes,
      workoutCount,
      runCount,
      totalSessions,
      totalVolume,
      totalMileageMeters,
      prCount,
      avgSessionMinutes,
    };
  }, [workouts, sessions, displayUnit]);

  // Both fetches resolve together (Promise.all), so either being null
  // means the digest is still loading.
  const loading = workouts === null || sessions === null;
  // Only workouts can truncate — running uses range mode (uncapped).
  const truncated = (workouts?.length ?? 0) >= WORKOUTS_LIMIT;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {!error && loading && <p className="text-sm text-[var(--muted)]">Loading activity…</p>}

      {!error && !loading && (
        <>
          {/* Hero row — the "how active was I?" headline. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile value={formatHours(stats.totalMinutes)} label="Total time" />
            <StatTile value={String(stats.totalSessions)} label="Total sessions" />
            <StatTile value={String(stats.workoutCount)} label="Workouts" />
            <StatTile value={String(stats.runCount)} label="Runs" />
          </div>

          {/* Combined weekly activity chart — chrome-less; the card
              border + label live here on the view. */}
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Weekly activity
            </p>
            <ActivitiesCombinedChart
              workouts={workouts}
              sessions={sessions}
              days={days}
              truncated={truncated}
              fetchLimit={WORKOUTS_LIMIT}
            />
          </section>

          {/* Secondary row — the supporting totals. */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile
              value={`${stats.totalVolume.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })} ${displayUnit}`}
              label="Total volume"
            />
            <StatTile
              value={`${formatDistanceValue(stats.totalMileageMeters, distanceUnit)} ${distanceUnit}`}
              label="Total mileage"
            />
            <StatTile value={String(stats.prCount)} label="PRs" />
            <StatTile
              value={stats.totalSessions ? formatHours(stats.avgSessionMinutes) : "—"}
              label="Avg session"
            />
          </div>
        </>
      )}
    </div>
  );
}
