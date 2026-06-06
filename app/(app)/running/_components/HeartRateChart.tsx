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

/** One plotted sample: distance along the run (in the active unit) → value. */
export type ChartPoint = { distance: number; value: number | null };

/**
 * Heart-rate-vs-distance line. Shares a `syncId` with the pace and
 * elevation charts so hovering any one of them moves a synced cursor
 * across all three. Renders a placeholder when no point carries HR.
 */
export function HeartRateChart({
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
    return <ChartPlaceholder title="Heart rate" message="No heart-rate data" />;
  }
  return (
    <ChartCard title="Heart rate">
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
            width={44}
            domain={["dataMin - 5", "dataMax + 5"]}
            tickFormatter={(v: number) => String(Math.round(v))}
          />
          <Tooltip
            cursor={{ stroke: "#52525b", strokeWidth: 1 }}
            contentStyle={tooltipContentStyle}
            wrapperStyle={{ outline: "none" }}
            labelFormatter={(v) => `${Number(v).toFixed(2)} ${unitLabel}`}
            formatter={(v) => [`${Math.round(Number(v))} bpm`, "Heart rate"]}
          />
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
    </ChartCard>
  );
}

export const tooltipContentStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "0.375rem",
  padding: "8px 10px",
  fontSize: "12px",
} as const;

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </p>
      <div className="h-[240px] w-full">{children}</div>
    </div>
  );
}

export function ChartPlaceholder({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </p>
      <div className="flex h-[240px] w-full items-center justify-center text-sm text-[var(--muted)]">
        {message}
      </div>
    </div>
  );
}
