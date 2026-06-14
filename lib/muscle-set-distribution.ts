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
import { CATEGORIES, categorize, type MuscleCategory } from "@/lib/muscle-categories";

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
