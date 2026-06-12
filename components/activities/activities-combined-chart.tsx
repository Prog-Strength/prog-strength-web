"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RunningSession, Workout } from "@/lib/api";
import { formatHours, formatWeekRangeFromMonday, formatYTick } from "@/lib/chart-format";
import { buildWeeklyBuckets } from "@/lib/weekly-buckets";

/**
 * Combined weekly activity chart for the Activities Overview — the "how
 * active was I this week?" answer at a glance. A single stacked AreaChart
 * showing minutes spent lifting (blue) stacked under minutes spent running
 * (green), week over week, so the consolidated trend lives somewhere.
 *
 * Structurally a sibling of WorkoutDurationChart / RunningTimeChart: numeric
 * Monday-anchored weekly buckets on the X-axis, gradient-filled areas,
 * formatYTick on Y, the same tooltip/grid chrome. The twist is two series
 * sharing a single `stackId` so the areas stack into a total-activity band
 * instead of overlapping.
 *
 * Deliberately chrome-less: the outer card border and the Overview's hero
 * stat tiles live on the parent view (ActivitiesOverviewView). This renders
 * only the chart block plus the truncated note.
 *
 * Purely presentational. Both arrays, the timeframe's `days`, and the
 * truncation flags are passed in by the Overview view, which hydrates both
 * this chart and its surrounding stat tiles from one pair of fetches.
 */

const CHART_HEIGHT = 200;

// Each rendered point carries both modalities' minutes for one week. Built
// by zipping the two independent bucket runs together by `weekKey`.
type CombinedPoint = {
  // Unix-ms of the week's Monday — the numeric XAxis datum.
  t: number;
  weekKey: string;
  weekStart: Date;
  workout_minutes: number;
  running_minutes: number;
};

export function ActivitiesCombinedChart({
  workouts,
  sessions,
  days,
  truncated,
  fetchLimit,
}: {
  // `null` for either while the parent is still loading. Empty array =
  // no activity of that kind in the window.
  workouts: Workout[] | null;
  sessions: RunningSession[] | null;
  // Days back from now this window covers, or null for "all". Drives the
  // bucket span so empty weeks at the window edge still render as zero.
  days: number | null;
  // True when either parent fetch hit `fetchLimit` and may have more —
  // surfaced so the user understands why older data isn't included.
  truncated: boolean;
  fetchLimit: number;
}) {
  const points = useMemo(
    () => buildCombined(workouts ?? [], sessions ?? [], days),
    [workouts, sessions, days],
  );

  // Both inputs must have arrived before we can decide loading vs empty.
  const loading = workouts === null || sessions === null;
  const isEmpty =
    points.length === 0 || points.every((p) => p.workout_minutes === 0 && p.running_minutes === 0);

  return (
    <>
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            Loading…
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
            No activity in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <defs>
                {/* Blue gradient for the lifting band. */}
                <linearGradient id="combined-workout-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
                {/* Green gradient for the running band. */}
                <linearGradient id="combined-running-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={formatYTick}
                width={48}
              />
              <Legend
                verticalAlign="top"
                align="left"
                height={24}
                wrapperStyle={{ fontSize: "12px", paddingBottom: "4px" }}
              />
              <Tooltip
                cursor={{ stroke: "#52525b", strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #3f3f46",
                  borderRadius: "0.375rem",
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(v) =>
                  typeof v === "number" ? formatWeekRangeFromMonday(new Date(v)) : ""
                }
                // recharts hands us the per-series `name` ("Lifting" /
                // "Running"); pair it with the hours-formatted minutes so
                // each tooltip row reads "Lifting 1h 30m".
                formatter={(value, name) => [
                  formatHours(typeof value === "number" ? value : 0),
                  name,
                ]}
              />
              {/* Lifting band (bottom of the stack). `name` drives both the
                  legend label and the tooltip series name. */}
              <Area
                stackId="activity"
                type="monotone"
                dataKey="workout_minutes"
                name="Lifting"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#combined-workout-fill)"
                isAnimationActive={false}
              />
              {/* Running band (stacked on top). */}
              <Area
                stackId="activity"
                type="monotone"
                dataKey="running_minutes"
                name="Running"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#combined-running-fill)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {truncated && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Showing the most recent {fetchLimit} workouts. Older data isn&apos;t included in this
          chart yet.
        </p>
      )}
    </>
  );
}

// --- aggregation --------------------------------------------------

/**
 * Builds one week-keyed dataset spanning the same window for both inputs.
 *
 * Both `buildWeeklyBuckets` runs use identical window logic (same `days`,
 * same now), so when `days` is bounded they produce the exact same ordered
 * week keys. For "all" (days === null) the spans can differ — each run
 * anchors `since` to its own oldest item — so we cannot rely on the index
 * arrays lining up. We zip by `weekKey` via a Map keyed on the union of
 * both runs' weeks, which is correct regardless of window mode and keeps
 * every week that either modality touches.
 */
function buildCombined(
  workouts: Workout[],
  sessions: RunningSession[],
  days: number | null,
): CombinedPoint[] {
  // Workout minutes: completed-only, ended − performed span. Mirrors
  // WorkoutDurationChart's accumulate guard exactly.
  const workoutWeeks = buildWeeklyBuckets<Workout, { workout_minutes: number }>({
    items: workouts,
    days,
    getTimestamp: (w) => new Date(w.performed_at),
    factory: () => ({ workout_minutes: 0 }),
    accumulate: (bucket, w) => {
      if (!w.ended_at) return;
      const ms = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
      if (!Number.isFinite(ms) || ms <= 0) return;
      bucket.workout_minutes += ms / 60_000;
    },
  });

  // Running minutes: duration_seconds / 60. Mirrors RunningTimeChart.
  const runningWeeks = buildWeeklyBuckets<RunningSession, { running_minutes: number }>({
    items: sessions,
    days,
    getTimestamp: (s) => new Date(s.start_time),
    factory: () => ({ running_minutes: 0 }),
    accumulate: (bucket, s) => {
      bucket.running_minutes += s.duration_seconds / 60;
    },
  });

  // Zip by weekKey into one ordered point list. Insert in chronological
  // order: walk the workout weeks first (already ordered), then fold in any
  // running-only weeks, finally sort by `t` so the union stays monotonic.
  const byKey = new Map<string, CombinedPoint>();
  const ensure = (weekKey: string, weekStart: Date, t: number): CombinedPoint => {
    let point = byKey.get(weekKey);
    if (!point) {
      point = { t, weekKey, weekStart, workout_minutes: 0, running_minutes: 0 };
      byKey.set(weekKey, point);
    }
    return point;
  };

  for (const w of workoutWeeks) {
    ensure(w.weekKey, w.weekStart, w.t).workout_minutes = w.workout_minutes;
  }
  for (const r of runningWeeks) {
    ensure(r.weekKey, r.weekStart, r.t).running_minutes = r.running_minutes;
  }

  return Array.from(byKey.values()).sort((a, b) => a.t - b.t);
}
