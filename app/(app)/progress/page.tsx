"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
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
  listWorkouts,
  type ExerciseBaseline,
  type MuscleGroupProgression,
  type MuscleGroupProgressionPoint,
  type Workout,
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
  const [progression, setProgression] = useState<MuscleGroupProgression | null>(null);
  // Raw workouts in the timeframe — feeds the Sets × Reps × Weight table
  // view alongside the chart. Fetched in parallel with progression so
  // both views are ready by the time the user toggles between them.
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch progression + workouts whenever selection changes. Default to
  // chest + 90d so the chart appears immediately on first visit rather
  // than forcing the user through an empty pick-something state.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? 90;
    const until = new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
    const sinceISO = since.toISOString();
    const untilISO = until.toISOString();

    setLoading(true);
    setError(null);
    // limit=100 covers a heavy lifter's 90-day window comfortably
    // (~4-5 sessions/week * 13 weeks ≈ 60). If a user ever exceeds
    // this, the Sets view truncates silently; pagination is a
    // follow-up if it becomes a real issue.
    Promise.all([
      listProgression(token, muscleGroup, sinceISO, untilISO),
      listWorkouts(token, { since: sinceISO, until: untilISO, limit: 100 }),
    ])
      .then(([prog, page]) => {
        setProgression(prog);
        setWorkouts(page.items);
      })
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
        setProgression(null);
        setWorkouts([]);
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
            <ProgressionView progression={progression} workouts={workouts} />
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
  workouts,
}: {
  progression: MuscleGroupProgression;
  workouts: Workout[];
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
    const values = points.map((p) => p.normalized_max);
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
      ? ((trendline.end_value - trendline.start_value) / trendline.start_value) * 100
      : null;
  const bestPoint = useMemo(
    () =>
      points.reduce<MuscleGroupProgressionPoint | null>(
        (acc, p) => (acc === null || p.normalized_max > acc.normalized_max ? p : acc),
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
          value={bestPoint ? `${formatPercent(bestPoint.normalized_max)} of baseline` : "—"}
          label={
            bestPoint ? `Best session • ${formatDate(bestPoint.performed_at)}` : "Best session"
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
            <ComposedChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
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
                content={<CustomTooltip exerciseColors={exerciseColors} />}
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
              {Array.from(seriesByExercise.entries()).map(([exerciseID, exercisePoints]) => {
                const data = exercisePoints.map((p) => ({
                  t: new Date(p.performed_at).getTime(),
                  normalized_max: p.normalized_max,
                  point: p,
                }));
                return (
                  <Scatter
                    key={exerciseID}
                    data={data}
                    dataKey="normalized_max"
                    fill={exerciseColors.get(exerciseID) ?? COLOR_TREND}
                    stroke={exerciseColors.get(exerciseID) ?? COLOR_TREND}
                    isAnimationActive={false}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
          {exercise_baselines.map((b) => (
            <LegendSwatch
              key={b.exercise_id}
              color={exerciseColors.get(b.exercise_id) ?? COLOR_TREND}
              label={`${b.exercise_name}${
                b.baseline > 0 ? ` · baseline ${formatNumber(b.baseline)} ${b.unit}` : ""
              }`}
            />
          ))}
          <span className="text-[10px] uppercase tracking-wider">Dashed line = trend</span>
        </div>
      </div>

      <TablesSection
        points={points}
        workouts={workouts}
        exerciseBaselines={exercise_baselines}
        exerciseColors={exerciseColors}
      />
    </div>
  );
}

type TableView = "estimates" | "sets";

/**
 * Sibling table views of the same window of data: one shows per-workout
 * 1RM estimates (the points feeding the chart), the other shows the raw
 * sets logged in those workouts. The view toggle, filter pills, and
 * filtered-exercise state are shared between them so switching feels
 * like flipping a tab on a single table, not jumping to a new screen.
 *
 * Sets are coalesced Strong-style: matching (reps, weight) inside the
 * same workout-exercise collapse into one row with a count. That's the
 * shape most lifters mentally hold when they think about a workout.
 */
function TablesSection({
  points,
  workouts,
  exerciseBaselines,
  exerciseColors,
}: {
  points: MuscleGroupProgressionPoint[];
  workouts: Workout[];
  exerciseBaselines: ExerciseBaseline[];
  exerciseColors: Map<string, string>;
}) {
  const [view, setView] = useState<TableView>("estimates");
  // `null` = no filter, show every exercise. Shared across views so
  // toggling preserves what the lifter is looking at.
  const [filterExerciseID, setFilterExerciseID] = useState<string | null>(null);

  // Lookup of exercise_id → baseline metadata. exercise_baselines lists
  // every exercise that contributed to the chart's muscle-group filter,
  // which is exactly the set of exercises we want to surface in the
  // Sets view too (exercises that don't target this muscle group are
  // filtered out via the missing-baseline check below).
  const baselineByID = useMemo(() => {
    const m = new Map<string, ExerciseBaseline>();
    for (const b of exerciseBaselines) m.set(b.exercise_id, b);
    return m;
  }, [exerciseBaselines]);

  // Estimates rows — same shape as before, just lifted out of the
  // table body so the wrapper can render counts/filters consistently.
  const estimateRows = useMemo(() => {
    const filtered = filterExerciseID
      ? points.filter((p) => p.exercise_id === filterExerciseID)
      : points;
    // Most recent first — that's how lifters naturally read a log.
    return [...filtered].sort(
      (a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime(),
    );
  }, [points, filterExerciseID]);

  // Sets rows — built from raw workouts, scoped to this muscle group
  // via baselineByID, and coalesced by (reps, weight, unit) within each
  // workout-exercise.
  const setsRows = useMemo(() => buildSetsRows(workouts, baselineByID), [workouts, baselineByID]);
  const filteredSetsRows = useMemo(
    () =>
      filterExerciseID ? setsRows.filter((r) => r.exercise_id === filterExerciseID) : setsRows,
    [setsRows, filterExerciseID],
  );

  // Per-exercise counts for the filter pills. Each view has its own
  // notion of "how many rows belong to this exercise" — for estimates
  // it's the number of workouts; for sets it's the number of unique
  // (reps, weight) combos. Show the count that matches the active view
  // so the pills always describe what the user will see.
  const estimateCountByExercise = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of points) {
      m.set(p.exercise_id, (m.get(p.exercise_id) ?? 0) + 1);
    }
    return m;
  }, [points]);
  const setsCountByExercise = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of setsRows) {
      m.set(r.exercise_id, (m.get(r.exercise_id) ?? 0) + 1);
    }
    return m;
  }, [setsRows]);
  const activeCountByExercise =
    view === "estimates" ? estimateCountByExercise : setsCountByExercise;
  const activeTotal = view === "estimates" ? points.length : setsRows.length;

  const meta =
    view === "estimates"
      ? {
          title: "Per-workout 1RM estimates",
          description:
            "Each row is one workout's data on this exercise, expressed as an estimated one-rep max — the points feeding the chart above.",
        }
      : {
          title: "Sets, reps, weight",
          description:
            "Raw sets logged in this window. Sets with matching reps and weight inside the same workout are grouped into one row.",
        };

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-tight">{meta.title}</h2>
          <p className="text-xs text-[var(--muted)]">{meta.description}</p>
        </div>
        <ViewToggle value={view} onChange={setView} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <FilterPill active={filterExerciseID === null} onClick={() => setFilterExerciseID(null)}>
          All ({activeTotal})
        </FilterPill>
        {exerciseBaselines.map((b) => {
          const count = activeCountByExercise.get(b.exercise_id) ?? 0;
          return (
            <FilterPill
              key={b.exercise_id}
              active={filterExerciseID === b.exercise_id}
              onClick={() => setFilterExerciseID(b.exercise_id)}
              color={exerciseColors.get(b.exercise_id) ?? COLOR_TREND}
            >
              {b.exercise_name} ({count})
            </FilterPill>
          );
        })}
      </div>

      {view === "estimates" ? (
        <EstimatesTableBody rows={estimateRows} exerciseColors={exerciseColors} />
      ) : (
        <SetsTableBody rows={filteredSetsRows} exerciseColors={exerciseColors} />
      )}
    </div>
  );
}

function EstimatesTableBody({
  rows,
  exerciseColors,
}: {
  rows: MuscleGroupProgressionPoint[];
  exerciseColors: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--muted)]">
        No estimates for this exercise in the selected window.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th className="py-2 pr-3 text-left font-medium">Date</th>
            <th className="py-2 pr-3 text-left font-medium">Exercise</th>
            <th className="py-2 pr-3 text-right font-medium">Avg 1RM</th>
            <th className="py-2 pr-3 text-right font-medium">Min</th>
            <th className="py-2 pr-3 text-right font-medium">Max</th>
            <th className="py-2 pr-3 text-right font-medium">Sets</th>
            <th className="py-2 pr-3 text-right font-medium">% Baseline</th>
            <th className="py-2 text-right font-medium">Workout</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const color = exerciseColors.get(p.exercise_id) ?? COLOR_TREND;
            return (
              <tr
                key={`${p.workout_id}:${p.exercise_id}`}
                className="border-b border-[var(--border)]/60 last:border-b-0"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                  {formatDate(p.performed_at)}
                </td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{p.exercise_name}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(p.avg_estimated_1rm)} {p.unit}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {formatNumber(p.min_estimated_1rm)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {formatNumber(p.max_estimated_1rm)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {p.set_count}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatPercent(p.normalized_max)}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <WorkoutLink workoutID={p.workout_id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One row in the Sets view: one workout-exercise's set group, collapsed
 * by (reps, weight, unit). A workout-exercise that did 3×8 @ 50 then
 * 1×6 @ 50 produces two rows here; doing 3×8 @ 50 + 3×8 @ 55 also
 * produces two rows. Sets with identical reps/weight in the same
 * workout-exercise stay collapsed regardless of adjacency.
 */
type SetsTableRow = {
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  performed_at: string;
  reps: number;
  weight: number;
  unit: "lb" | "kg";
  set_count: number;
};

function buildSetsRows(
  workouts: Workout[],
  baselineByID: Map<string, ExerciseBaseline>,
): SetsTableRow[] {
  const rows: SetsTableRow[] = [];
  for (const w of workouts) {
    for (const we of w.exercises) {
      const baseline = baselineByID.get(we.exercise_id);
      // Skip exercises that don't contribute to this muscle group —
      // baselineByID is the authoritative scope for the active filter.
      if (!baseline) continue;
      // Map preserves insertion order, so the first occurrence of a
      // (reps, weight) combo determines where its row sits within
      // the workout-exercise. The within-group secondary sort below
      // overrides that to weight-desc for stable presentation.
      const groups = new Map<
        string,
        { reps: number; weight: number; unit: "lb" | "kg"; count: number }
      >();
      for (const s of we.sets) {
        const key = `${s.reps}|${s.weight}|${s.unit}`;
        const existing = groups.get(key);
        if (existing) {
          existing.count++;
        } else {
          groups.set(key, {
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            count: 1,
          });
        }
      }
      for (const g of groups.values()) {
        rows.push({
          workout_id: w.id,
          exercise_id: we.exercise_id,
          exercise_name: baseline.exercise_name,
          performed_at: w.performed_at,
          reps: g.reps,
          weight: g.weight,
          unit: g.unit,
          set_count: g.count,
        });
      }
    }
  }
  // Sort: most recent first (matches the chart + estimates view),
  // then by exercise name alphabetically so multiple exercises on
  // the same day group together, then by weight descending so the
  // heaviest sets land at the top of each (workout, exercise) cluster.
  rows.sort((a, b) => {
    const t = new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime();
    if (t !== 0) return t;
    if (a.exercise_id !== b.exercise_id) {
      return a.exercise_name.localeCompare(b.exercise_name);
    }
    return b.weight - a.weight;
  });
  return rows;
}

function SetsTableBody({
  rows,
  exerciseColors,
}: {
  rows: SetsTableRow[];
  exerciseColors: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--muted)]">
        No sets logged for this exercise in the selected window.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th className="py-2 pr-3 text-left font-medium">Date</th>
            <th className="py-2 pr-3 text-left font-medium">Exercise</th>
            <th className="py-2 pr-3 text-right font-medium">Sets</th>
            <th className="py-2 pr-3 text-right font-medium">Reps</th>
            <th className="py-2 pr-3 text-right font-medium">Weight</th>
            <th className="py-2 text-right font-medium">Workout</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const color = exerciseColors.get(r.exercise_id) ?? COLOR_TREND;
            return (
              <tr
                // (workout, exercise, reps, weight) is unique within
                // the coalesced row set — idx is the tiebreaker for
                // the (rare) case where two muscle-groups overlap and
                // the same combo appears twice in one workout-exercise
                // through some upstream quirk.
                key={`${r.workout_id}:${r.exercise_id}:${r.reps}:${r.weight}:${idx}`}
                className="border-b border-[var(--border)]/60 last:border-b-0"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                  {formatDate(r.performed_at)}
                </td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{r.exercise_name}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.set_count}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.reps}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(r.weight)} {r.unit}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <WorkoutLink workoutID={r.workout_id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: TableView; onChange: (v: TableView) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Table view"
      className="inline-flex shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs"
    >
      <ViewToggleButton active={value === "estimates"} onClick={() => onChange("estimates")}>
        1RM estimates
      </ViewToggleButton>
      <ViewToggleButton active={value === "sets"} onClick={() => onChange("sets")}>
        Sets × Reps × Weight
      </ViewToggleButton>
    </div>
  );
}

function ViewToggleButton({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-medium transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

function WorkoutLink({ workoutID }: { workoutID: string }) {
  return (
    <Link
      href={`/workouts/${workoutID}`}
      aria-label="View workout"
      className="text-xs text-[var(--accent)] hover:underline"
    >
      View →
    </Link>
  );
}

function FilterPill({
  children,
  active,
  onClick,
  color,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {color !== undefined && (
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {children}
    </button>
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
      <p className={`text-2xl font-semibold tracking-tight ${toneColor}`}>{value}</p>
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
