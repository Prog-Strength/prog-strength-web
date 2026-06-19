/**
 * Collapses the exercise catalog's 11 `MuscleGroup` enum values into the
 * 6 broad categories the radar chart plots. Unknown muscle-group values
 * return null and are dropped by the radar rather than bucketed.
 */

export const CATEGORIES = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"] as const;
export type MuscleCategory = (typeof CATEGORIES)[number];

/**
 * The catalog's 11 fine-grained muscle-group keys mapped to the 6 broad
 * categories. Exported so finer-grained consumers (the workout body-map) can
 * enumerate the canonical key set without re-spelling it.
 */
export const MAP: Record<string, MuscleCategory> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Arms",
  triceps: "Arms",
  forearms: "Arms",
  core: "Core",
  quads: "Legs",
  hamstrings: "Legs",
  glutes: "Legs",
  calves: "Legs",
};

export function categorize(muscleGroup: string): MuscleCategory | null {
  return MAP[muscleGroup] ?? null;
}
