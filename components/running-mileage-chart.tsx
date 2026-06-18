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
import type { RunningSession } from "@/lib/api";
import {
  CHART_AXIS,
  CHART_CURSOR,
  CHART_GRID,
  CHART_RUN_LINE,
  CHART_TOOLTIP_BG,
  CHART_TOOLTIP_BORDER,
  CHART_TOOLTIP_RADIUS,
} from "@/lib/chart-colors";
import { formatWeekRangeFromMonday } from "@/lib/chart-format";
import { formatDistanceValue } from "@/lib/distance-unit-context";
import { buildWeeklyBuckets, type WeekBucket } from "@/lib/weekly-buckets";

/**
 * Total weekly mileage over the active timeframe — the "how far did I
 * run?" answer at the top of the Running view.
 *
 * Deliberately chrome-less, mirroring WorkoutDurationChart: this renders
 * only the inner chart block (loading / empty / single-stroke line) plus the truncated
 * note — the analytics wrapper (RunningAnalytics) owns the card border
 * and the shared summary header.
 *
 * Distance lives in two forms per bucket: `meters` (the raw sum, formatted
 * for the tooltip) and `distance` (the same value converted to the display
 * unit, used as the numeric Y datum so the axis scales in mi/km). Both the
 * Y datum and the tooltip convert through `formatDistanceValue(meters,
 * distanceUnit)` so axis and tooltip share one unit source — the
 * `distanceUnit` prop — and can never disagree.
 */

const CHART_HEIGHT = 200;

export function RunningMileageChart({
  sessions,
  days,
  truncated,
  fetchLimit,
  distanceUnit,
}: {
  // `null` while the parent is still loading. Empty array = no runs in
  // the window (rendered as an empty-state card).
  sessions: RunningSession[] | null;
  // Days back from now this window covers, or null for "all".
  days: number | null;
  // True when the parent's fetch hit `fetchLimit` and may have more.
  truncated: boolean;
  fetchLimit: number;
  // The active display unit; the single source for both the Y-axis
  // scale/labels and the tooltip values.
  distanceUnit: "mi" | "km";
}) {
  const summary = useMemo(
    () => summarize(sessions ?? [], days, distanceUnit),
    [sessions, days, distanceUnit],
  );

  return (
    <>
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {sessions === null ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            Loading…
          </div>
        ) : summary.weeks.length === 0 || summary.totalMeters === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
            No runs in this window.
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
                tickFormatter={(v: number) => `${Math.round(v)} ${distanceUnit}`}
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
                formatter={(_v, _n, item) => {
                  const meters = (item?.payload as WeekPoint | undefined)?.meters ?? 0;
                  return [
                    `${formatDistanceValue(meters, distanceUnit)} ${distanceUnit}`,
                    "Distance",
                  ];
                }}
              />
              <Line
                type="monotone"
                dataKey="distance"
                stroke={CHART_RUN_LINE}
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
  // Total distance run in the week, in meters (raw) and the display unit.
  meters: number;
  distance: number;
};

type WeekPoint = WeekBucket<WeekAccumulator>;

type Summary = {
  totalMeters: number;
  weeks: WeekPoint[];
};

/**
 * Buckets runs into Monday-anchored weeks and totals each week's
 * distance. Weeks with no runs still appear (zero-filled) so a multi-week
 * gap shows up visually rather than being smoothed away. The `distance`
 * field is the converted display-unit value used as the numeric Y datum;
 * `meters` is the raw sum the tooltip formats via formatDistanceValue.
 */
function summarize(
  sessions: RunningSession[],
  days: number | null,
  distanceUnit: "mi" | "km",
): Summary {
  const weeks = buildWeeklyBuckets<RunningSession, WeekAccumulator>({
    items: sessions,
    days,
    getTimestamp: (s) => new Date(s.start_time),
    factory: () => ({ meters: 0, distance: 0 }),
    accumulate: (bucket, s) => {
      bucket.meters += s.distance_meters;
      // Convert through the same helper the tooltip uses so the Y datum
      // and the tooltip never diverge. meters is always finite here.
      bucket.distance = Number(formatDistanceValue(bucket.meters, distanceUnit));
    },
  });

  let totalMeters = 0;
  for (const s of sessions) {
    totalMeters += s.distance_meters;
  }

  return { totalMeters, weeks };
}
