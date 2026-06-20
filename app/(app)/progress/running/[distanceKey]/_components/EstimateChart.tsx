"use client";

/**
 * The estimate-over-time chart for the max-effort detail view.
 *
 * Three layers over a shared time X-axis (estimate-history `as_of` dates):
 *   - a shaded confidence band between `lower_seconds` and `upper_seconds`,
 *     drawn as two stacked Areas (a transparent floor at `lower` plus a
 *     gradient-filled band of height `upper − lower`) — the same gradient
 *     technique as ElevationChart;
 *   - the estimate line itself (`seconds`); and
 *   - the user's actual attempts overlaid as reference dots (a dot-only
 *     Scatter at each attempt's achieved_at → duration_seconds).
 *
 * Y is time, formatted m:ss; lower is faster, so a "lower is faster" note
 * sits under the title. Loading / empty / single-point states mirror the
 * personal-records FeaturedEstimateChart.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RunningMaxEffortAttempt, RunningMaxEffortHistoryPoint } from "@/lib/api";
import { tooltipContentStyle } from "@/app/(app)/running/_components/HeartRateChart";

const CHART_HEIGHT = 280;

/** Format a duration in seconds as an "m:ss" tick label. */
function durationTick(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "";
  const total = Math.round(secs);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Short date tick for the X axis, e.g. "Apr 18". */
function dateTick(t: number): string {
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type BandDatum = {
  t: number;
  seconds: number;
  lower: number;
  // The stacked floor + height so two Areas render a band; `height` is
  // (upper − lower) so the upper stacked Area lands at `upper`.
  height: number;
};

export function EstimateChart({
  history,
  attempts,
  isPending,
}: {
  history: RunningMaxEffortHistoryPoint[];
  attempts: RunningMaxEffortAttempt[];
  isPending?: boolean;
}) {
  const data: BandDatum[] = history.map((p) => ({
    t: new Date(p.as_of).getTime(),
    seconds: p.seconds,
    lower: p.lower_seconds,
    height: Math.max(0, p.upper_seconds - p.lower_seconds),
  }));

  const scatterData = attempts.map((a) => ({
    t: new Date(a.achieved_at).getTime(),
    value: a.duration_seconds,
  }));

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Estimate over time
      </p>
      <p className="text-[10px] text-[var(--muted)]">lower is faster</p>

      {isPending ? (
        <div
          className="mt-3 w-full animate-pulse rounded-md bg-[var(--surface-2)]"
          style={{ height: CHART_HEIGHT }}
          aria-hidden="true"
        />
      ) : data.length === 0 ? (
        <p className="mt-3 text-xs text-[var(--muted)]">No estimate history yet</p>
      ) : data.length === 1 ? (
        <SinglePoint datum={data[0]} />
      ) : (
        <div className="mt-3 w-full" style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <defs>
                <linearGradient id="estimate-band" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.06} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                scale="time"
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                tickFormatter={dateTick}
              />
              <YAxis
                stroke="#a1a1aa"
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                width={52}
                domain={["dataMin", "dataMax"]}
                tickFormatter={durationTick}
              />
              <Tooltip
                cursor={{ stroke: "#52525b", strokeWidth: 1 }}
                contentStyle={tooltipContentStyle}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(v) => dateTick(Number(v))}
                formatter={(value, name) => {
                  if (name === "estimate") return [durationTick(Number(value)), "Estimate"];
                  if (name === "attempt") return [durationTick(Number(value)), "Attempt"];
                  return null as unknown as [string, string];
                }}
              />

              {/* Confidence band: a transparent floor at `lower`, then a
                  gradient-filled band of `height` stacked on top so its
                  top edge sits at `upper`. */}
              <Area
                stackId="band"
                dataKey="lower"
                stroke="none"
                fill="transparent"
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
                name="lower"
              />
              <Area
                stackId="band"
                dataKey="height"
                stroke="none"
                fill="url(#estimate-band)"
                isAnimationActive={false}
                activeDot={false}
                legendType="none"
                name="band"
              />

              <Line
                dataKey="seconds"
                name="estimate"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />

              <Scatter data={scatterData} dataKey="value" name="attempt" fill="#fbbf24" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/**
 * A single history point can't draw a line, so render the one value plus a
 * muted "not enough data yet" note — mirrors the FeaturedEstimateChart state.
 */
function SinglePoint({ datum }: { datum: BandDatum }) {
  return (
    <div className="mt-3 flex flex-col gap-1">
      <p className="text-sm font-medium tabular-nums">
        <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#60a5fa] align-middle" />
        {durationTick(datum.seconds)}
        <span className="ml-2 text-xs text-[var(--muted)]">{dateTick(datum.t)}</span>
      </p>
      <p className="text-xs text-[var(--muted)]">Not enough data yet</p>
    </div>
  );
}
