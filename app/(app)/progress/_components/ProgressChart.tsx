"use client";

/**
 * The chart band: one connected <Line> per exercise (each indexed to its
 * own recency-weighted baseline so disparate lifts share a Y-axis), a
 * reference line at 1.0 = "current capability", and a legend whose entries
 * carry a per-exercise direction indicator + slope readout fed by
 * per_exercise_trends.
 *
 * The prior single cross-exercise dashed regression is gone — fitting one
 * line across exercises with different baselines was the load-bearing
 * source of the misleading headline. Direction now lives per-exercise in
 * the legend, not as an overlay on the chart.
 */

import { useMemo, type ReactNode } from "react";
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
import type { ExerciseBaseline, MuscleGroupProgressionPoint, PerExerciseTrend } from "@/lib/api";
import {
  COLOR_DEFAULT,
  COLOR_REFERENCE,
  formatNumber,
  formatPercent,
  formatDate,
  titleCase,
} from "./shared";

export type Direction = {
  arrow: "↑" | "→" | "↓" | null;
  text: string;
  tone: "positive" | "negative" | "neutral";
};

/**
 * Map a per-exercise trend to its legend direction indicator. The ±0.5
 * %/mo band splits ↑/→/↓; a null slope (fewer than 3 sessions, or a
 * degenerate regression) reads "not enough data" with no arrow.
 */
export function directionLabel(trend: PerExerciseTrend | undefined): Direction {
  const slope = trend?.slope_per_month ?? null;
  if (slope === null || !Number.isFinite(slope)) {
    return { arrow: null, text: "not enough data", tone: "neutral" };
  }
  const sign = slope > 0 ? "+" : slope < 0 ? "−" : "";
  const magnitude = Math.abs(slope).toFixed(1);
  const text = `${sign}${magnitude}%/mo`;
  if (slope > 0.5) return { arrow: "↑", text, tone: "positive" };
  if (slope < -0.5) return { arrow: "↓", text, tone: "negative" };
  return { arrow: "→", text, tone: "neutral" };
}

const ARROW_ARIA: Record<NonNullable<Direction["arrow"]>, string> = {
  "↑": "trending up",
  "→": "flat",
  "↓": "trending down",
};

export function ProgressChart({
  points,
  exerciseBaselines,
  perExerciseTrends,
  muscleGroupsIncluded,
  exerciseColors,
}: {
  points: MuscleGroupProgressionPoint[];
  exerciseBaselines: ExerciseBaseline[];
  perExerciseTrends: PerExerciseTrend[];
  muscleGroupsIncluded: string[];
  exerciseColors: Map<string, string>;
}) {
  // Group points by exercise so each gets its own <Line> with its own
  // color. Recharts handles the per-<Line> `data` override; the shape
  // carries the epoch-ms timestamp on `t` for shared-axis scaling.
  const pointsByExercise = useMemo(() => {
    const m = new Map<
      string,
      { t: number; normalized_max: number; point: MuscleGroupProgressionPoint }[]
    >();
    for (const p of points) {
      const datum = {
        t: new Date(p.performed_at).getTime(),
        normalized_max: p.normalized_max,
        point: p,
      };
      const arr = m.get(p.exercise_id);
      if (arr) arr.push(datum);
      else m.set(p.exercise_id, [datum]);
    }
    return m;
  }, [points]);

  const trendsByExerciseId = useMemo(() => {
    const m = new Map<string, PerExerciseTrend>();
    for (const t of perExerciseTrends) m.set(t.exercise_id, t);
    return m;
  }, [perExerciseTrends]);

  // Y-axis padding: a little headroom above the max and below the min so
  // edge dots aren't clipped, always anchored to include 1.0 so the
  // reference line stays visible.
  const yDomain = useMemo<[number, number]>(() => {
    const values = points.map((p) => p.normalized_max);
    values.push(1.0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.05, (max - min) * 0.15);
    return [Math.max(0, min - pad), max + pad];
  }, [points]);

  // "Below threshold" state: every contributing exercise has a null slope,
  // so no direction can be drawn anywhere. Render the dots but show a
  // banner nudging the lifter toward the session-3 cutoff.
  const allBelowThreshold =
    perExerciseTrends.length > 0 && perExerciseTrends.every((t) => t.slope_per_month === null);

  const showingCaption =
    muscleGroupsIncluded.length > 0
      ? `Showing: ${muscleGroupsIncluded.map(titleCase).join(", ")}`
      : null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      {allBelowThreshold && (
        <p className="mb-3 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted)]">
          You have at least 3 sessions needed per exercise to fit a trend. Keep logging — direction
          shows up around session 3.
        </p>
      )}

      <div className="h-[380px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="#a1a1aa"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickFormatter={(v: number) =>
                new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              }
            />
            <YAxis
              type="number"
              domain={yDomain}
              stroke="#a1a1aa"
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              width={52}
            />
            <Tooltip
              cursor={{ stroke: "#52525b", strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "0.375rem",
                padding: "8px 10px",
                fontSize: "12px",
              }}
              wrapperStyle={{ outline: "none" }}
              content={<CustomTooltip exerciseColors={exerciseColors} />}
            />

            {/* Reference line at 1.0 = "your current baseline". Drawn first
                so series sit on top of it. */}
            <ReferenceLine
              y={1.0}
              stroke={COLOR_REFERENCE}
              strokeDasharray="2 4"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{
                value: "Current baseline — recency-weighted capability",
                position: "insideTopRight",
                fill: COLOR_REFERENCE,
                fontSize: 10,
              }}
            />

            {/* One <Line> per exercise so each gets its own color and its
                own tooltip identity. */}
            {exerciseBaselines.map((b) => (
              <Line
                key={b.exercise_id}
                data={pointsByExercise.get(b.exercise_id)}
                dataKey="normalized_max"
                stroke={exerciseColors.get(b.exercise_id) ?? COLOR_DEFAULT}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={{ r: 3 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showingCaption && <p className="mt-2 text-[11px] text-[var(--muted)]">{showingCaption}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
        {exerciseBaselines.map((b) => (
          <LegendSwatch
            key={b.exercise_id}
            color={exerciseColors.get(b.exercise_id) ?? COLOR_DEFAULT}
            label={`${b.exercise_name}${
              b.baseline > 0 ? ` · baseline ${formatNumber(b.baseline)} ${b.unit}` : ""
            }`}
            direction={directionLabel(trendsByExerciseId.get(b.exercise_id))}
          />
        ))}
      </div>
    </div>
  );
}

function LegendSwatch({
  color,
  label,
  direction,
}: {
  color: string;
  label: string;
  direction: Direction;
}) {
  const toneColor =
    direction.tone === "positive"
      ? "text-emerald-300"
      : direction.tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
      <span className={`inline-flex items-center gap-1 ${toneColor}`}>
        {direction.arrow && (
          <span aria-label={ARROW_ARIA[direction.arrow]} role="img">
            {direction.arrow}
          </span>
        )}
        <span>{direction.text}</span>
      </span>
    </span>
  );
}

// Recharts' default tooltip renders a generic dataKey label. The per-Line
// data carries the full point on `point`, so the custom tooltip can render
// the exercise name, date, and rich per-point context directly.
type TooltipPayloadItem = {
  payload?: {
    point?: MuscleGroupProgressionPoint;
  };
};

function CustomTooltip({
  active,
  payload,
  exerciseColors,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  exerciseColors: Map<string, string>;
}): ReactNode {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload?.point;
  if (!point) return null;
  const color = exerciseColors.get(point.exercise_id) ?? COLOR_DEFAULT;
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] uppercase tracking-wider text-[var(--muted)]">
        {formatDate(point.performed_at)}
      </p>
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
        {point.exercise_name}
      </p>
      <p className="text-base font-semibold text-[var(--foreground)]">
        {formatPercent(point.normalized_max)} of current baseline
      </p>
      <p className="text-xs text-[var(--muted)]">
        {formatNumber(point.avg_estimated_1rm)} {point.unit} avg
        {" · "}
        {point.set_count} {point.set_count === 1 ? "set" : "sets"}
        {point.max_estimated_1rm > point.avg_estimated_1rm &&
          ` · max ${formatNumber(point.max_estimated_1rm)} ${point.unit}`}
      </p>
    </div>
  );
}
