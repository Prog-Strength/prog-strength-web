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
import { formatWeekRangeFromMonday } from "@/lib/chart-format";
import { workoutVolume } from "@/lib/workout-volume";
import { buildWeeklyBuckets, type WeekBucket } from "@/lib/weekly-buckets";

/**
 * Volume sibling of the duration chart: total weekly training volume
 * (sum of reps × weight) over the active timeframe — the "am I moving
 * enough weight?" answer alongside "did I spend enough time lifting?".
 *
 * Deliberately chrome-less. Unlike the duration chart this renders only
 * the inner chart block (loading / empty / single-stroke line) plus the truncated
 * note — the analytics wrapper owns the card border and the shared
 * header so the two views can sit under one set of totals.
 *
 * Purely presentational. The workouts array, the timeframe's `days`,
 * and the truncation flags are passed in by the page so a single fetch
 * hydrates both this chart and the paginated list below.
 */

const CHART_HEIGHT = 200;

export function WorkoutVolumeChart({
  workouts,
  days,
  displayUnit,
  truncated,
  fetchLimit,
}: {
  // `null` while the parent is still loading. Empty array = no
  // workouts in the window (rendered as an empty-state block).
  workouts: Workout[] | null;
  // Days back from now this window covers, or null for "all".
  // Drives the X-axis bucket span so empty weeks at the edge of the
  // window still appear as zero-points instead of clipping the line.
  days: number | null;
  // The unit each set's weight is converted toward before summing, so
  // the totals match the user's preference and the per-card badges.
  displayUnit: "lb" | "kg";
  // True when the parent's fetch returned exactly `fetchLimit` rows
  // and the API may have more — the chart surfaces this so the user
  // understands why older data isn't included.
  truncated: boolean;
  fetchLimit: number;
}) {
  const summary = useMemo(
    () => summarize(workouts ?? [], days, displayUnit),
    [workouts, days, displayUnit],
  );

  return (
    <>
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {workouts === null ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            Loading…
          </div>
        ) : summary.weeks.length === 0 || summary.totalVolume === 0 ? (
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
                  typeof v === "number"
                    ? [
                        `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${displayUnit}`,
                        "Volume",
                      ]
                    : ["—", "Volume"]
                }
              />
              <Line
                type="monotone"
                dataKey="volume"
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
  // Total training volume (reps × weight) for the week.
  volume: number;
};

type WeekPoint = WeekBucket<WeekAccumulator>;

type Summary = {
  totalVolume: number;
  weeks: WeekPoint[];
};

/**
 * Buckets workouts into Monday-anchored weeks and totals each week's
 * training volume. Weeks with no sessions still appear so the line dips
 * to zero — a multi-week gap shows up visually rather than being
 * smoothed away by adjacent points.
 *
 * Unlike the duration chart this counts every workout in the window,
 * not only completed ones: volume comes from logged sets, so an
 * in-progress (no `ended_at`) session still has real volume to show.
 *
 * For bounded timeframes (7d/30d/90d) the bucket span is derived from
 * the timeframe so even an empty user sees a chart shaped like the
 * window. For the "all" timeframe (days === null) the span runs from
 * the oldest workout in the array to today.
 */
function summarize(workouts: Workout[], days: number | null, displayUnit: "lb" | "kg"): Summary {
  const weeks = buildWeeklyBuckets<Workout, WeekAccumulator>({
    items: workouts,
    days,
    getTimestamp: (w) => new Date(w.performed_at),
    factory: () => ({ volume: 0 }),
    accumulate: (bucket, w) => {
      const volume = workoutVolume(w, displayUnit);
      if (!Number.isFinite(volume) || volume <= 0) return;
      bucket.volume += volume;
    },
  });

  // Total counts every workout with positive volume passed in (matching
  // the previous pass), independent of its week's bucket window.
  let totalVolume = 0;
  for (const w of workouts) {
    const volume = workoutVolume(w, displayUnit);
    if (!Number.isFinite(volume) || volume <= 0) continue;
    totalVolume += volume;
  }

  return { totalVolume, weeks };
}

// --- helpers ------------------------------------------------------

function formatYTick(volume: number): string {
  if (volume <= 0) return "0";
  return Math.round(volume).toLocaleString();
}
