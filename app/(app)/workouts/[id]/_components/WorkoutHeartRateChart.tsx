"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { WorkoutHRTrackpoint } from "@/lib/api";

/** One plotted sample: elapsed seconds into the session → heart rate. */
export type HRChartPoint = { t: number; value: number | null };

const tooltipContentStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "0.375rem",
  padding: "8px 10px",
  fontSize: "12px",
} as const;

/** Formats elapsed seconds as compact clock time for the axis ("M:SS"). */
function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Heart-rate-over-elapsed-time line for a strength workout's TCX enrichment.
 * Unlike the run chart, the x-axis is TIME, not distance — a strength session
 * doesn't move across the ground. Styling mirrors the running HeartRateChart so
 * the two read as siblings. A dashed reference line marks the average bpm.
 */
export function WorkoutHeartRateChart({
  trackpoints,
  avgHr,
}: {
  trackpoints: WorkoutHRTrackpoint[];
  avgHr?: number | null;
}) {
  const data: HRChartPoint[] = trackpoints.map((tp) => ({
    t: tp.elapsed_seconds,
    value: tp.heart_rate_bpm,
  }));
  const hasData = data.some((d) => d.value != null);
  if (!hasData) {
    return (
      <div className="flex h-[240px] w-full items-center justify-center text-sm text-[var(--muted)]">
        No heart-rate data
      </div>
    );
  }
  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            stroke="#a1a1aa"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            tickFormatter={formatElapsed}
            label={{
              value: "Elapsed time",
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
            labelFormatter={(v) => formatElapsed(Number(v))}
            formatter={(v) => [`${Math.round(Number(v))} bpm`, "Heart rate"]}
          />
          {avgHr != null && (
            <ReferenceLine
              y={avgHr}
              stroke="#a1a1aa"
              strokeDasharray="4 3"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{
                value: `Avg ${avgHr} bpm`,
                position: "insideTopRight",
                fill: "#a1a1aa",
                fontSize: 10,
              }}
            />
          )}
          <Line
            dataKey="value"
            stroke="#f87171"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
