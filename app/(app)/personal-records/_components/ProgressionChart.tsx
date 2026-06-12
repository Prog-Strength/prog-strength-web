"use client";

/**
 * Compact per-card progression line chart, shared by both the Lifts and
 * Running views. The `kind` prop selects the data fetcher and the axis
 * semantics:
 *
 *   - kind="lifts":   plots estimated 1RM over time for one exercise.
 *                     Higher is better; default Y domain.
 *   - kind="running": plots best-effort time over time for one distance.
 *                     Lower is faster; the Y ticks are formatted m:ss and a
 *                     "lower is faster" note sits under the title so the
 *                     downward-good slope doesn't read as a regression.
 *
 * The series is lazy-fetched via TanStack Query — the chart only mounts
 * when its card is expanded, so the query fires on first expand and is
 * cached for the page lifetime (re-expanding a card re-reads the cache,
 * no second network call). Keyed by ["pr-history", kind, id] so the
 * page.test.tsx "exactly one query per card" assertion holds.
 */

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { getExerciseOneRMHistory, getRunningBestEffortHistory } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { tooltipContentStyle } from "@/app/(app)/running/_components/HeartRateChart";

const CHART_HEIGHT = 140;

type ProgressionChartProps =
  | { kind: "lifts"; exerciseId: string; distanceKey?: never }
  | { kind: "running"; distanceKey: string; exerciseId?: never };

/** One plotted sample: an epoch-ms timestamp on X, the metric on Y. */
type ChartDatum = { t: number; value: number };

/** Format a duration in seconds as an "m:ss" tick label (no hour roll-up
 * needed at chart-tick granularity — these are sub-hour for every standard
 * distance except marathon, where m:ss still reads fine as total minutes). */
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

export function ProgressionChart(props: ProgressionChartProps) {
  const { kind } = props;
  const id = kind === "lifts" ? props.exerciseId : props.distanceKey;

  const query = useQuery({
    queryKey: ["pr-history", kind, id],
    queryFn: async () => {
      const token = getToken() ?? "";
      if (kind === "lifts") {
        const hist = await getExerciseOneRMHistory(token, props.exerciseId);
        return {
          unit: hist.unit as string,
          data: hist.points.map<ChartDatum>((p) => ({
            t: new Date(p.performed_at).getTime(),
            value: p.estimated_1rm,
          })),
        };
      }
      const hist = await getRunningBestEffortHistory(token, props.distanceKey);
      return {
        unit: "",
        data: hist.points.map<ChartDatum>((p) => ({
          t: new Date(p.activity_start_time).getTime(),
          value: p.duration_seconds,
        })),
      };
    },
  });

  const yLabel = kind === "lifts" ? `Est. 1RM (${query.data?.unit || "lb"})` : "Time";
  const yTickFormatter = kind === "running" ? durationTick : (v: number) => String(Math.round(v));

  return (
    <div className="mt-3 border-t border-[var(--border)] pt-3">
      <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{yLabel}</p>
      {kind === "running" && <p className="text-[10px] text-[var(--muted)]">lower is faster</p>}

      {query.isPending ? (
        <div
          className="mt-2 w-full animate-pulse rounded-md bg-[var(--surface-2)]"
          style={{ height: CHART_HEIGHT }}
          aria-hidden="true"
        />
      ) : query.isError ? (
        <p className="mt-2 text-xs text-[var(--muted)]">Couldn&apos;t load history</p>
      ) : query.data.data.length <= 1 ? (
        <SinglePoint datum={query.data.data[0]} formatY={yTickFormatter} />
      ) : (
        <div className="mt-2 w-full" style={{ height: CHART_HEIGHT }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={query.data.data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
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
                width={44}
                domain={["dataMin", "dataMax"]}
                tickFormatter={yTickFormatter}
              />
              <Tooltip
                cursor={{ stroke: "#52525b", strokeWidth: 1 }}
                contentStyle={tooltipContentStyle}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(v) => dateTick(Number(v))}
                formatter={(v) => [yTickFormatter(Number(v)), yLabel]}
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
        </div>
      )}
    </div>
  );
}

/**
 * A single-point series can't draw a line, so render the one value plus a
 * muted "not enough data yet" note. Mirrors the SOW's single-point state.
 */
function SinglePoint({
  datum,
  formatY,
}: {
  datum: ChartDatum | undefined;
  formatY: (v: number) => string;
}) {
  return (
    <div className="mt-2 flex flex-col gap-1">
      {datum && (
        <p className="text-sm font-medium tabular-nums">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#60a5fa] align-middle" />
          {formatY(datum.value)}
          <span className="ml-2 text-xs text-[var(--muted)]">{dateTick(datum.t)}</span>
        </p>
      )}
      <p className="text-xs text-[var(--muted)]">Not enough data yet</p>
    </div>
  );
}
