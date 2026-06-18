/**
 * Pure data helpers shared across the design-exploration variants:
 * agenda summaries, logged actuals, and metric tiles. These derive
 * *what* to show; each variant decides *how* to compose it (the divergence
 * the DX is about). Sharing pure derivation is fine — it isn't a shared
 * visual abstraction.
 */

import type { Exercise, PlannedExercise, PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import { fmtKm, fmtClock, fmtPace, fmtMinutes } from "./_fixtures";

export type AgendaItem = {
  id: string;
  name: string;
  muscles: string[];
  /** e.g. "3 × 8 @ 135", "3 × AMRAP", "2 × 10" */
  spec: string;
  setCount: number;
  superset: number | null;
};

/** Collapse a planned exercise's target sets into one compact spec string. */
export function plannedSpec(ex: PlannedExercise): string {
  const sets = ex.sets;
  if (sets.length === 0) return "—";
  const allAmrap = sets.every((s) => s.amrap);
  if (allAmrap) return `${sets.length} × AMRAP`;
  // Common case: uniform reps/weight → "N × reps @ weight".
  const reps = sets[0].target_reps;
  const weight = sets[0].target_weight;
  const uniform = sets.every(
    (s) => s.target_reps === reps && s.target_weight === weight && !s.amrap,
  );
  const repPart = reps != null ? `${reps}` : "—";
  const wtPart = weight != null ? ` @ ${weight}` : "";
  if (uniform) return `${sets.length} × ${repPart}${wtPart}`;
  // Mixed → list rep targets.
  const repList = sets.map((s) => (s.amrap ? "AMRAP" : (s.target_reps ?? "—"))).join(", ");
  const topWeight = sets.map((s) => s.target_weight).filter((w): w is number => w != null);
  const wt = topWeight.length ? ` @ ${Math.max(...topWeight)}` : "";
  return `${repList}${wt}`;
}

export function plannedAgenda(planned: PlannedWorkout, exMap: Map<string, Exercise>): AgendaItem[] {
  return [...planned.exercises]
    .sort((a, b) => a.order_index - b.order_index)
    .map((ex) => {
      const cat = exMap.get(ex.exercise_id);
      return {
        id: ex.id,
        name: cat?.name ?? ex.exercise_id,
        muscles: cat?.muscle_groups ?? [],
        spec: plannedSpec(ex),
        setCount: ex.sets.length,
        superset: ex.superset_group,
      };
    });
}

/** Distinct muscle groups touched by a planned agenda, ordered by first appearance. */
export function muscleSummary(items: AgendaItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items)
    for (const m of it.muscles)
      if (!seen.has(m)) {
        seen.add(m);
        out.push(m);
      }
  return out;
}

export type MetricTile = { label: string; value: string; sub?: string };

export function runMetrics(run: RunningSession): MetricTile[] {
  const tiles: MetricTile[] = [
    { label: "Distance", value: fmtKm(run.distance_meters) },
    { label: "Duration", value: fmtClock(run.duration_seconds) },
  ];
  if (run.avg_pace_sec_per_km != null)
    tiles.push({ label: "Avg pace", value: fmtPace(run.avg_pace_sec_per_km) });
  if (run.avg_heart_rate_bpm != null)
    tiles.push({ label: "Avg HR", value: `${run.avg_heart_rate_bpm}`, sub: "bpm" });
  return tiles;
}

/** Total sets and per-dumbbell-aware volume for a logged workout. */
export function workoutMetrics(workout: Workout): MetricTile[] {
  let sets = 0;
  let volume = 0;
  for (const ex of workout.exercises)
    for (const s of ex.sets) {
      sets += 1;
      volume += s.reps * s.weight;
    }
  const tiles: MetricTile[] = [
    { label: "Exercises", value: `${workout.exercises.length}` },
    { label: "Sets", value: `${sets}` },
    { label: "Volume", value: volume.toLocaleString("en-US"), sub: "lb" },
  ];
  if (workout.personal_records_set.length > 0)
    tiles.push({ label: "PRs", value: `${workout.personal_records_set.length}` });
  return tiles;
}

export type LoggedRow = {
  id: string;
  name: string;
  spec: string;
  superset: number | null;
  pr: boolean;
};

/** Per-exercise actuals for a logged workout, formatted like the planned spec. */
export function loggedRows(workout: Workout, exMap: Map<string, Exercise>): LoggedRow[] {
  const prExerciseIds = new Set(workout.personal_records_set.map((p) => p.exercise_id));
  return [...workout.exercises]
    .sort((a, b) => a.order - b.order)
    .map((ex) => {
      const cat = exMap.get(ex.exercise_id);
      const reps = ex.sets.map((s) => s.reps).join(", ");
      const weights = ex.sets.map((s) => s.weight).filter((w) => w > 0);
      const wt = weights.length ? ` @ ${Math.max(...weights)}` : "";
      return {
        id: ex.exercise_id,
        name: cat?.name ?? ex.exercise_id,
        spec: `${reps}${wt}`,
        superset: ex.superset_group ?? null,
        pr: prExerciseIds.has(ex.exercise_id),
      };
    });
}

/** Planned-run agenda summary for a detail pane (run_type + details). */
export function runTypeLabel(t: PlannedWorkout["run_type"]): string {
  switch (t) {
    case "easy":
      return "Easy";
    case "threshold":
      return "Threshold";
    case "intervals":
      return "Intervals";
    default:
      return "Run";
  }
}

/** Planned target summary tiles (the "block" before the agenda). */
export function plannedTargets(
  planned: PlannedWorkout,
  exMap: Map<string, Exercise>,
): MetricTile[] {
  const mins = Math.round(
    (Date.parse(planned.scheduled_end) - Date.parse(planned.scheduled_start)) / 60000,
  );
  const tiles: MetricTile[] = [{ label: "Time block", value: fmtMinutes(mins) }];
  if (planned.activity_kind === "run") {
    tiles.push({ label: "Type", value: runTypeLabel(planned.run_type) });
  } else {
    const items = plannedAgenda(planned, exMap);
    const sets = items.reduce((n, it) => n + it.setCount, 0);
    tiles.push({ label: "Exercises", value: `${items.length}` });
    if (sets > 0) tiles.push({ label: "Sets", value: `${sets}` });
  }
  return tiles;
}
