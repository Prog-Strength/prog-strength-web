/**
 * Single source of truth for workout volume math. Volume is
 * sum(reps × weight) across every set, with each set's weight converted
 * toward the user's display unit before summing. Consumed by both the
 * volume chart and the per-card volume badge so the two never drift.
 *
 * Bodyweight sets (weight 0) contribute 0 to the total.
 */

import type { Workout, WorkoutSet } from "@/lib/api";

const LB_PER_KG = 2.20462;

function convert(weight: number, from: "lb" | "kg", to: "lb" | "kg"): number {
  if (from === to) return weight;
  if (from === "kg" && to === "lb") return weight * LB_PER_KG;
  return weight / LB_PER_KG;
}

export function setsVolume(sets: WorkoutSet[], displayUnit: "lb" | "kg"): number {
  return sets.reduce((total, s) => total + s.reps * convert(s.weight, s.unit, displayUnit), 0);
}

export function workoutVolume(workout: Workout, displayUnit: "lb" | "kg"): number {
  return workout.exercises.reduce((total, e) => total + setsVolume(e.sets, displayUnit), 0);
}

/**
 * The unit to label a single workout's total-volume figure with. Picks the
 * first load-bearing set's unit (the one that actually carries weight),
 * falling back to the first set's unit, then to "lb" for an empty workout.
 * Shared by the detail-page stat tiles and the WorkoutDetailsBody footer
 * so the two never label the same number differently.
 */
export function predominantUnit(workout: Workout): "lb" | "kg" {
  let firstSet: WorkoutSet | undefined;
  for (const ex of workout.exercises) {
    for (const s of ex.sets) {
      if (firstSet === undefined) firstSet = s;
      if (s.weight > 0) return s.unit;
    }
  }
  return firstSet?.unit ?? "lb";
}
