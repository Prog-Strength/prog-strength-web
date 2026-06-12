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
import type { RunningSession } from "@/lib/api";
import { formatHours, formatWeekRangeFromMonday, formatYTick } from "@/lib/chart-format";
import { buildWeeklyBuckets, type WeekBucket } from "@/lib/weekly-buckets";

/**
 * Total weekly running time over the active timeframe — the "how long
 * did I run?" answer at the top of the Running view.
 *
 * Structurally identical to RunningMileageChart (and WorkoutDurationChart)
 * but the Y datum is minutes: the axis uses formatYTick (m/h) and the
 * tooltip uses formatHours. Deliberately chrome-less; the analytics
 * wrapper owns the card border and summary header.
 */

const CHART_HEIGHT = 200;

export function RunningTimeChart({
  sessions,
  days,
  truncated,
  fetchLimit,
}: {
  // `null` while the parent is still loading. Empty array = no runs in
  // the window (rendered as an empty-state card).
  sessions: RunningSession[] | null;
  // Days back from now this window covers, or null for "all".
  days: number | null;
  // True when the parent's fetch hit `fetchLimit` and may have more.
  truncated: boolean;
  fetchLimit: number;
  // Accepted for prop parity with the mileage chart; unused here since
  // the time series is unit-agnostic.
  distanceUnit?: "mi" | "km";
}) {
  const summary = useMemo(() => summarize(sessions ?? [], days), [sessions, days]);

  return (
    <>
      <div className="mt-3" style={{ height: CHART_HEIGHT }}>
        {sessions === null ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
            Loading…
          </div>
        ) : summary.weeks.length === 0 || summary.totalMinutes === 0 ? (
          <div className="flex h-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
            No runs in this window.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={summary.weeks} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <defs>
                <linearGradient id="running-time-fill" x1="0" y1="0" x2="0" y2="1">
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
                tickFormatter={formatYTick}
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
                formatter={(v) =>
                  typeof v === "number" ? [formatHours(v), "Total"] : ["—", "Total"]
                }
              />
              <Area
                type="monotone"
                dataKey="minutes"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#running-time-fill)"
                isAnimationActive={false}
                dot={{ r: 3, fill: "#3b82f6", stroke: "#3b82f6" }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
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
  // Total minutes spent running in the week.
  minutes: number;
};

type WeekPoint = WeekBucket<WeekAccumulator>;

type Summary = {
  totalMinutes: number;
  weeks: WeekPoint[];
};

/**
 * Buckets runs into Monday-anchored weeks and totals each week's minutes
 * (duration_seconds / 60). Weeks with no runs still appear (zero-filled)
 * so gaps are visible as dips.
 */
function summarize(sessions: RunningSession[], days: number | null): Summary {
  const weeks = buildWeeklyBuckets<RunningSession, WeekAccumulator>({
    items: sessions,
    days,
    getTimestamp: (s) => new Date(s.start_time),
    factory: () => ({ minutes: 0 }),
    accumulate: (bucket, s) => {
      bucket.minutes += s.duration_seconds / 60;
    },
  });

  let totalMinutes = 0;
  for (const s of sessions) {
    totalMinutes += s.duration_seconds / 60;
  }

  return { totalMinutes, weeks };
}
