"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StatsPoint } from "@/lib/api";
import { formatWeekRangeFromMonday } from "@/lib/chart-format";

/**
 * A dumb, presentational weekly-series area chart for the public profile
 * graphs. Renders a single AreaChart over the API's dense 12-week stats
 * series, styled to match the activity charts (WorkoutDurationChart /
 * RunningMileageChart): the same theme colors, gradient fill, axis/tooltip
 * treatment, and Monday-week tooltip label.
 *
 * Deliberately presentational — it does no fetching, no unit math, and no
 * empty/locked detection. The caller (ProfileStats) owns those decisions and
 * passes a `valueFormatter` that turns the raw `value` into a display string
 * (e.g. "2h 30m" for minutes, "5.0 mi" for distance). `unitLabel` names the
 * tooltip's metric row.
 */

const CHART_HEIGHT = 200;

export function WeeklySeriesChart({
  points,
  label,
  valueFormatter,
  unitLabel,
}: {
  points: StatsPoint[];
  // The series name, used as the tooltip's metric row label.
  label: string;
  // Turns a raw `value` into the displayed string (Y tick + tooltip).
  valueFormatter: (v: number) => string;
  // Optional accessible heading hint; unused for layout but kept so callers
  // can document the series. Headings live in the parent.
  unitLabel?: string;
}) {
  // Project the API series onto the recharts datum shape the existing charts
  // use: a numeric `t` (week_start epoch ms) for the time axis and the raw
  // `value` for the area. A numeric X axis with a dataMin/dataMax domain keeps
  // the spacing even across the dense 12-week window.
  const data = useMemo(
    () =>
      points.map((p) => ({
        t: new Date(p.week_start).getTime(),
        value: p.value,
      })),
    [points],
  );

  // A stable, unique gradient id per chart instance so two charts on the same
  // page don't share a single <linearGradient> definition.
  const gradientId = useMemo(
    () => `profile-stats-fill-${label.replace(/\s+/g, "-").toLowerCase()}`,
    [label],
  );

  return (
    <div style={{ height: CHART_HEIGHT }} data-testid="weekly-series-chart" aria-label={unitLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
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
            tickFormatter={(v: number) => valueFormatter(v)}
            width={48}
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
            formatter={(v) => (typeof v === "number" ? [valueFormatter(v), label] : ["—", label])}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
            dot={{ r: 3, fill: "#3b82f6", stroke: "#3b82f6" }}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
