/**
 * Shared muscle-category set tally. Resolves every WorkoutExercise through
 * the catalog to its muscle groups and credits each mapped category with
 * the exercise's set count, so a compound lift contributes to every
 * category it hits. Axis/bar order follows the fixed CATEGORIES tuple so
 * the radar's shape and the bar order stay stable across renders.
 *
 * Single source of truth for both the muscle-group radar and the per-
 * muscle set bars on the workout detail page — the two never drift.
 */

import type { Exercise, Workout } from "@/lib/api";
import { CATEGORIES, categorize, MAP, type MuscleCategory } from "@/lib/muscle-categories";

/**
 * The 11 catalog muscle-group keys in a fixed order, so the per-group tally's
 * output order is stable across renders (mirrors how CATEGORIES fixes the
 * category tally's order). Derived from the shared MAP so it can never drift
 * from the categorizer's key set.
 */
export const MUSCLE_GROUPS = Object.keys(MAP);

export type CategorySetCount = {
  category: MuscleCategory;
  // Count of sets across the given workouts that touched this category.
  value: number;
};

export function setsByCategory(
  workouts: Workout[],
  exercises: Exercise[],
): { data: CategorySetCount[]; hasData: boolean } {
  const byId = new Map<string, Exercise>();
  for (const ex of exercises) byId.set(ex.id, ex);

  const tallies = {} as Record<MuscleCategory, number>;
  for (const category of CATEGORIES) tallies[category] = 0;

  for (const w of workouts) {
    for (const we of w.exercises) {
      const catalog = byId.get(we.exercise_id);
      if (!catalog) continue;
      for (const mg of catalog.muscle_groups) {
        const category = categorize(mg);
        if (category) tallies[category] += we.sets.length;
      }
    }
  }

  const data = CATEGORIES.map((category) => ({ category, value: tallies[category] }));
  const hasData = data.reduce((sum, point) => sum + point.value, 0) > 0;
  return { data, hasData };
}

export type MuscleGroupSetCount = {
  muscleGroup: string;
  // Count of sets in the workout that credited this muscle group.
  value: number;
};

/**
 * Fine-grained sibling of `setsByCategory`: tallies sets at the catalog's 11
 * `muscle_groups` grain rather than collapsing to the 6 broad CATEGORIES, so a
 * body-map can shade each region. Same crediting rule — a compound lift credits
 * every group it hits with its full set count. Only worked groups appear in
 * `data` (an unworked region is absent, not a zero), ordered by MUSCLE_GROUPS.
 * `hasData` is false when no exercise resolves to any mappable group.
 */
export function setsByMuscleGroup(
  workout: Workout,
  exercises: Exercise[],
): { data: MuscleGroupSetCount[]; hasData: boolean } {
  const byId = new Map<string, Exercise>();
  for (const ex of exercises) byId.set(ex.id, ex);

  const tallies = new Map<string, number>();
  for (const we of workout.exercises) {
    const catalog = byId.get(we.exercise_id);
    if (!catalog) continue;
    for (const mg of catalog.muscle_groups) {
      // Only credit groups the categorizer knows — keeps an unknown catalog
      // value from creating a slug-less region the body-map can't draw.
      if (!categorize(mg)) continue;
      tallies.set(mg, (tallies.get(mg) ?? 0) + we.sets.length);
    }
  }

  const data: MuscleGroupSetCount[] = [];
  for (const mg of MUSCLE_GROUPS) {
    const value = tallies.get(mg);
    if (value) data.push({ muscleGroup: mg, value });
  }
  return { data, hasData: data.length > 0 };
}
