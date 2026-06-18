"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Workout } from "@/lib/api";
import {
  CHART_AXIS,
  CHART_CURSOR,
  CHART_GRID,
  CHART_LIFT_LINE,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_RADIUS,
} from "@/lib/chart-colors";
import { formatHours, formatWeekRangeFromMonday, formatYTick } from "@/lib/chart-format";
import { buildWeeklyBuckets, type WeekBucket } from "@/lib/weekly-buckets";

/**
 * Total weekly training time over the active timeframe — the "did I
 * spend enough time lifting?" answer at the top of the Workouts page.
 *
 * Deliberately chrome-less. This renders only the inner chart block
 * (loading / empty / single-stroke line) plus the truncated note — the analytics
 * wrapper (WorkoutsAnalytics) owns the card border and the shared
 * summary header (Total Time / Sessions / PRs) so the sibling views can
 * sit under one set of totals.
 *
 * Purely presentational. The workouts array, the timeframe's `days`,
 * and the truncation flags are passed in by the page so a single
 * fetch hydrates both this chart and the paginated list below.
 */

const CHART_HEIGHT = 200;

export function WorkoutDurationChart({
  workouts,
  days,
  truncated,
  fetchLimit,
}: {
  // `null` while the parent is still loading. Empty array = no
  // workouts in the window (rendered as an empty-state card).
  workouts: Workout[] | null;
  // Days back from now this window covers, or null for "all".
  // Drives the X-axis bucket span so empty weeks at the edge of the
  // window still appear as zero-points instead of clipping the line.
  days: number | null;
  // True when the parent's fetch returned exactly `fetchLimit` rows
  // and the API may have more — the chart surfaces this so the user
  // understands why older data isn't included.
  truncated: boolean;
  fetchLimit: number;
}) {
  const summary = useMemo(() => summarize(workouts ?? [], days), [workouts, days]);

  return (
    <>
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {workouts === null ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            Loading…
          </div>
        ) : summary.weeks.length === 0 || summary.totalMinutes === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
            No completed workouts in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={summary.weeks} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke={CHART_GRID} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke={CHART_AXIS}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                tickFormatter={(v: number) =>
                  new Date(v).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                stroke={CHART_AXIS}
                tick={{ fill: CHART_AXIS, fontSize: 11 }}
                tickFormatter={formatYTick}
                width={48}
              />
              <Tooltip
                cursor={{ stroke: CHART_CURSOR, strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: CHART_TOOLTIP_BG,
                  border: `1px solid ${CHART_TOOLTIP_BORDER}`,
                  borderRadius: CHART_TOOLTIP_RADIUS,
                  padding: "6px 10px",
                  fontSize: "12px",
                }}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(v) =>
                  typeof v === "number" ? formatWeekRangeFromMonday(new Date(v)) : ""
                }
                formatter={(v) =>
                  typeof v === "number" ? [formatHours(v), "Total"] : ["—", "Total"]
                }
              />
              <Line
                type="monotone"
                dataKey="minutes"
                stroke={CHART_LIFT_LINE}
                strokeWidth={1}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {truncated && (
        <p className="mt-2 text-[11px] text-[var(--muted)]">
          Showing the most recent {fetchLimit} sessions. Older data isn&apos;t included in this
          chart yet.
        </p>
      )}
    </>
  );
}

// --- aggregation --------------------------------------------------

type WeekAccumulator = {
  // Total minutes of completed training for the week.
  minutes: number;
};

type WeekPoint = WeekBucket<WeekAccumulator>;

type Summary = {
  totalMinutes: number;
  sessionCount: number;
  openWorkouts: number;
  weeks: WeekPoint[];
};

/**
 * Buckets workouts into Monday-anchored weeks and totals each week's
 * completed-workout minutes. Weeks with no completed sessions still
 * appear so the line dips to zero — a multi-week gap shows up
 * visually rather than being smoothed away by adjacent points.
 *
 * For bounded timeframes (7d/30d/90d) the bucket span is derived from
 * the timeframe so even an empty user sees a chart shaped like the
 * window. For the "all" timeframe (days === null) the span runs from
 * the oldest workout in the array to today.
 */
function summarize(workouts: Workout[], days: number | null): Summary {
  const weeks = buildWeeklyBuckets<Workout, WeekAccumulator>({
    items: workouts,
    days,
    getTimestamp: (w) => new Date(w.performed_at),
    factory: () => ({ minutes: 0 }),
    accumulate: (bucket, w) => {
      // Only completed workouts with a positive span contribute minutes;
      // weeks outside the window simply never receive a bucket here.
      if (!w.ended_at) return;
      const durationMs = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
      if (!Number.isFinite(durationMs) || durationMs <= 0) return;
      bucket.minutes += durationMs / 60_000;
    },
  });

  // Totals count every workout passed in (matching the previous pass),
  // independent of whether its week falls inside the bucket window.
  let totalMinutes = 0;
  let sessionCount = 0;
  let openWorkouts = 0;
  for (const w of workouts) {
    sessionCount++;
    if (!w.ended_at) {
      openWorkouts++;
      continue;
    }
    const durationMs = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
    if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
    totalMinutes += durationMs / 60_000;
  }

  return { totalMinutes, sessionCount, openWorkouts, weeks };
}
