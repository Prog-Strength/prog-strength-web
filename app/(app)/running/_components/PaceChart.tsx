"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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

/** Format a seconds-per-unit pace value as an "m:ss" tick label. */
function paceTick(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return "";
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Pace-vs-distance line. `value` is pace in seconds-per-active-unit
 * (the page converts from sec/km before handing it over), so the Y
 * ticks and tooltip read directly in the user's unit. Lower is faster;
 * the axis is plotted as-is. Shares a `syncId` with the other charts.
 */
export function PaceChart({
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
    return <ChartPlaceholder title="Pace" message="No pace data" />;
  }
  return (
    <ChartCard title="Pace">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} syncId={syncId} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
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
            width={48}
            domain={["dataMin", "dataMax"]}
            tickFormatter={paceTick}
          />
          <Tooltip
            cursor={{ stroke: "#52525b", strokeWidth: 1 }}
            contentStyle={tooltipContentStyle}
            wrapperStyle={{ outline: "none" }}
            labelFormatter={(v) => `${Number(v).toFixed(2)} ${unitLabel}`}
            formatter={(v) => [`${paceTick(Number(v))} /${unitLabel}`, "Pace"]}
          />
          <Line
            dataKey="value"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
