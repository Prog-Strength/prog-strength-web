"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartCard,
  ChartPlaceholder,
  tooltipContentStyle,
  type ChartPoint,
} from "./HeartRateChart";

/**
 * Elevation-vs-distance area, rendered full width below the HR/pace
 * pair. `value` is elevation in meters. Shares a `syncId` so the cursor
 * stays aligned with the other two charts; renders a placeholder when no
 * point carries elevation.
 */
export function ElevationChart({
  data,
  syncId,
  unitLabel,
}: {
  data: ChartPoint[];
  syncId: string;
  unitLabel: string;
}) {
  const hasData = data.some((d) => d.value != null);
  if (!hasData) {
    return <ChartPlaceholder title="Elevation" message="No elevation data" />;
  }
  return (
    <ChartCard title="Elevation">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} syncId={syncId} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#34d399" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis
            dataKey="distance"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke="#a1a1aa"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            tickFormatter={(v: number) => v.toFixed(1)}
            label={{
              value: `Distance (${unitLabel})`,
              position: "insideBottom",
              offset: -2,
              fill: "#a1a1aa",
              fontSize: 11,
            }}
          />
          <YAxis
            stroke="#a1a1aa"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            width={44}
            domain={["dataMin - 5", "dataMax + 5"]}
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip
            cursor={{ stroke: "#52525b", strokeWidth: 1 }}
            contentStyle={tooltipContentStyle}
            wrapperStyle={{ outline: "none" }}
            labelFormatter={(v) => `${Number(v).toFixed(2)} ${unitLabel}`}
            formatter={(v) => [`${Math.round(Number(v))} m`, "Elevation"]}
          />
          <Area
            dataKey="value"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#elevation-fill)"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
