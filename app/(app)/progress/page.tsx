"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { clearToken, getToken } from "@/lib/auth";
import {
  listProgression,
  type MuscleGroupProgression,
  type MuscleGroupProgressionPoint,
} from "@/lib/api";

/**
 * Progress page — pick a muscle group, pick a timeframe, see whether
 * you're actually getting stronger.
 *
 * The chart's Y-axis is *normalized* estimated 1RM: each per-workout
 * data point is expressed as a fraction of that exercise's current
 * recency-weighted baseline (1.0 = at current capability). That
 * normalization is what lets disparate exercises within a muscle group
 * — barbell bench, dumbbell bench, cable fly — share a single axis.
 * See prog-strength-docs/sows/estimated-one-rep-max-time-series-table.md
 * for the full design.
 *
 * Every per-point detail (raw 1RM, baseline, exercise, set count) sits
 * in the tooltip so the chart stays clean but the underlying numbers
 * are one hover away.
 */

type Timeframe = "30d" | "60d" | "90d";

const TIMEFRAMES: { id: Timeframe; label: string; days: number }[] = [
  { id: "30d", label: "30d", days: 30 },
  { id: "60d", label: "60d", days: 60 },
  { id: "90d", label: "90d", days: 90 },
];

// Muscle groups in display order — primary upper-body movers first,
// then lower body, then small/secondary groups. Matches the order most
// lifters mentally scan when answering "what did I train this week?".
const MUSCLE_GROUPS: { id: string; label: string }[] = [
  { id: "chest", label: "Chest" },
  { id: "back", label: "Back" },
  { id: "shoulders", label: "Shoulders" },
  { id: "biceps", label: "Biceps" },
  { id: "triceps", label: "Triceps" },
  { id: "core", label: "Core" },
  { id: "quads", label: "Quads" },
  { id: "hamstrings", label: "Hamstrings" },
  { id: "glutes", label: "Glutes" },
  { id: "calves", label: "Calves" },
  { id: "forearms", label: "Forearms" },
];

// Distinct palette for exercise series. Eight colors covers every
// realistic muscle group (which usually has 2-5 tracked exercises)
// with room to spare. Chosen to be visually distinct on a dark
// background and to avoid clashing with the app's blue accent —
// blue is the lead color, the rest fan out around the wheel.
const EXERCISE_COLORS = [
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
];

// Trendline + reference line palette. The reference line at y=1.0
// gets a neutral gray so it reads as "baseline anchor" rather than
// another data series. The trendline gets the app accent so the
// "where are you trending" answer is visually prominent.
const COLOR_TREND = "#3b82f6";
const COLOR_REFERENCE = "#71717a";

export default function ProgressPage() {
  const router = useRouter();
  const [muscleGroup, setMuscleGroup] = useState<string>("chest");
  const [timeframe, setTimeframe] = useState<Timeframe>("90d");
  const [progression, setProgression] =
    useState<MuscleGroupProgression | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch progression whenever selection changes. Default to chest +
  // 90d so the chart appears immediately on first visit rather than
  // forcing the user through an empty pick-something state.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? 90;
    const until = new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

    setLoading(true);
    setError(null);
    listProgression(
      token,
      muscleGroup,
      since.toISOString(),
      until.toISOString(),
    )
      .then(setProgression)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
        setProgression(null);
      })
      .finally(() => setLoading(false));
  }, [muscleGroup, timeframe, router]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Progress</h1>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {MUSCLE_GROUPS.map((mg) => {
              const active = mg.id === muscleGroup;
              return (
                <button
                  key={mg.id}
                  type="button"
                  onClick={() => setMuscleGroup(mg.id)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    active
                      ? muscleGroupActiveClass(mg.id)
                      : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {mg.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            {TIMEFRAMES.map((tf) => {
              const active = tf.id === timeframe;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTimeframe(tf.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  Last {tf.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {loading && !progression && (
            <p className="text-sm text-[var(--muted)]">Loading progression…</p>
          )}

          {!loading && progression && progression.points.length === 0 && (
            <EmptyHint
              title={`No ${muscleGroup} sessions in this window`}
              body="Log a few sessions of this muscle group via chat and come back, or extend the timeframe to look further back."
            />
          )}

          {progression && progression.points.length > 0 && (
            <ProgressionView progression={progression} />
          )}
        </div>
      </div>
    </main>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{body}</p>
    </div>
  );
}

function ProgressionView({
  progression,
}: {
  progression: MuscleGroupProgression;
}) {
  const { points, trendline, exercise_baselines } = progression;

  // Map exercise_id → color, in the order exercises are listed in
  // exercise_baselines (alphabetical). Stable per render so the
  // legend, scatter dots, and tooltip swatches all agree.
  const exerciseColors = useMemo(() => {
    const map = new Map<string, string>();
    exercise_baselines.forEach((b, i) => {
      map.set(b.exercise_id, EXERCISE_COLORS[i % EXERCISE_COLORS.length]);
    });
    return map;
  }, [exercise_baselines]);

  // Group points by exercise so each gets its own <Scatter> — that's
  // what lets recharts color them independently and gives the tooltip
  // a clean per-series identity. The shape preserves the API's
  // (already-sorted) order within each group.
  const seriesByExercise = useMemo(() => {
    const m = new Map<string, MuscleGroupProgressionPoint[]>();
    for (const p of points) {
      const arr = m.get(p.exercise_id);
      if (arr) arr.push(p);
      else m.set(p.exercise_id, [p]);
    }
    return m;
  }, [points]);

  // Trendline data — just two endpoints, recharts will draw a straight
  // segment between them. Kept as its own data array so it can live
  // in a ComposedChart alongside the Scatter series without scaling
  // issues from missing values.
  const trendlineData = useMemo(() => {
    if (!trendline) return [];
    return [
      { t: new Date(trendline.start_at).getTime(), trend: trendline.start_value },
      { t: new Date(trendline.end_at).getTime(), trend: trendline.end_value },
    ];
  }, [trendline]);

  // Y-axis padding: include a little headroom above the max point
  // and below the min so the chart doesn't clip dots that sit at the
  // edge of the visible range. Anchored around 1.0 so the reference
  // line is always visible even if the user is well above or below.
  const yDomain = useMemo<[number, number]>(() => {
    const values = points.map((p) => p.normalized_avg);
    if (trendline) {
      values.push(trendline.start_value, trendline.end_value);
    }
    values.push(1.0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(0.05, (max - min) * 0.15);
    return [Math.max(0, min - pad), max + pad];
  }, [points, trendline]);

  // Stat tiles. "Trend" uses the trendline's normalized endpoint delta
  // (the slope answer), "Best session" finds the workout where the
  // lifter performed highest relative to their current baseline (most
  // motivating metric to surface), and "Exercises" counts the unique
  // exercises that contributed at least one point in this window.
  const trendPct =
    trendline && trendline.start_value > 0
      ? ((trendline.end_value - trendline.start_value) /
          trendline.start_value) *
        100
      : null;
  const bestPoint = useMemo(
    () =>
      points.reduce<MuscleGroupProgressionPoint | null>(
        (acc, p) =>
          acc === null || p.normalized_avg > acc.normalized_avg ? p : acc,
        null,
      ),
    [points],
  );
  const exerciseCount = seriesByExercise.size;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          value={formatChange(trendPct)}
          label="Trend over period"
          tone={
            trendPct === null
              ? "neutral"
              : trendPct > 0.5
                ? "positive"
                : trendPct < -0.5
                  ? "negative"
                  : "neutral"
          }
        />
        <StatTile
          value={
            bestPoint
              ? `${formatPercent(bestPoint.normalized_avg)} of baseline`
              : "—"
          }
          label={
            bestPoint
              ? `Best session • ${formatDate(bestPoint.performed_at)}`
              : "Best session"
          }
        />
        <StatTile
          value={String(exerciseCount)}
          label={`${exerciseCount === 1 ? "Exercise" : "Exercises"} tracked`}
        />
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              margin={{ top: 12, right: 16, bottom: 8, left: 0 }}
            >
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
                content={
                  <CustomTooltip exerciseColors={exerciseColors} />
                }
              />

              {/* Reference line at 1.0 = "your current baseline".
                  Drawn first so series sit on top of it. */}
              <ReferenceLine
                y={1.0}
                stroke={COLOR_REFERENCE}
                strokeDasharray="2 4"
                strokeWidth={1}
                ifOverflow="extendDomain"
                label={{
                  value: "Current baseline",
                  position: "insideTopRight",
                  fill: COLOR_REFERENCE,
                  fontSize: 10,
                }}
              />

              {/* Trendline — single line through every normalized
                  point, drawn in the lead accent color. Dot-less; the
                  scatter series carry the actual data. */}
              {trendlineData.length === 2 && (
                <Line
                  data={trendlineData}
                  dataKey="trend"
                  stroke={COLOR_TREND}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* One Scatter per exercise so each gets its own color
                  and its own tooltip identity. */}
              {Array.from(seriesByExercise.entries()).map(
                ([exerciseID, exercisePoints]) => {
                  const data = exercisePoints.map((p) => ({
                    t: new Date(p.performed_at).getTime(),
                    normalized_avg: p.normalized_avg,
                    point: p,
                  }));
                  return (
                    <Scatter
                      key={exerciseID}
                      data={data}
                      dataKey="normalized_avg"
                      fill={exerciseColors.get(exerciseID) ?? COLOR_TREND}
                      stroke={exerciseColors.get(exerciseID) ?? COLOR_TREND}
                      isAnimationActive={false}
                    />
                  );
                },
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          {exercise_baselines.map((b) => (
            <LegendSwatch
              key={b.exercise_id}
              color={exerciseColors.get(b.exercise_id) ?? COLOR_TREND}
              label={`${b.exercise_name}${
                b.baseline > 0
                  ? ` · baseline ${formatNumber(b.baseline)} ${b.unit}`
                  : ""
              }`}
            />
          ))}
          <span className="text-[10px] uppercase tracking-wider">
            Dashed line = trend
          </span>
        </div>
      </div>
    </div>
  );
}

// Recharts' default tooltip renders a generic dataKey label. For a
// scatter where the data is points keyed by exercise, we want the
// exercise name, the date, and rich per-point context. Custom tooltip
// gets the full payload so we can pull `point` out of the embedded
// scatter datum and render it directly.
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
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload?.point;
  if (!point) return null;
  const color = exerciseColors.get(point.exercise_id) ?? COLOR_TREND;
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
        {formatPercent(point.normalized_avg)} of current baseline
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

function StatTile({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneColor =
    tone === "positive"
      ? "text-[#86efac]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className={`text-2xl font-semibold tracking-tight ${toneColor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-3 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

// --- helpers --------------------------------------------------------------

/**
 * Active-state classes for a muscle-group selector pill. Reuses the
 * same hue family the rest of the app already uses for muscle-group
 * pills (see components/muscle-group-pill.tsx), so a selected pill on
 * this page reads as "you're looking at chest data" without needing
 * to learn a second color language.
 */
function muscleGroupActiveClass(id: string): string {
  switch (id) {
    case "chest":
      return "border-red-500/40 bg-red-500/20 text-red-200";
    case "back":
      return "border-blue-500/40 bg-blue-500/20 text-blue-200";
    case "shoulders":
      return "border-amber-500/40 bg-amber-500/20 text-amber-200";
    case "biceps":
      return "border-teal-500/40 bg-teal-500/20 text-teal-200";
    case "triceps":
      return "border-orange-500/40 bg-orange-500/20 text-orange-200";
    case "forearms":
      return "border-yellow-500/40 bg-yellow-500/20 text-yellow-200";
    case "core":
      return "border-emerald-500/40 bg-emerald-500/20 text-emerald-200";
    case "quads":
      return "border-indigo-500/40 bg-indigo-500/20 text-indigo-200";
    case "hamstrings":
      return "border-lime-500/40 bg-lime-500/20 text-lime-200";
    case "glutes":
      return "border-rose-500/40 bg-rose-500/20 text-rose-200";
    case "calves":
      return "border-cyan-500/40 bg-cyan-500/20 text-cyan-200";
    default:
      return "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]";
  }
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function formatChange(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

