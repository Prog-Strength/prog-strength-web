"use client";

import { WorkoutDetailsBody } from "@/components/workout-details";
import type { Exercise, Workout } from "@/lib/api";

/**
 * Read-only workout digest sized to render inside a calendar day
 * dropdown. Thin wrapper around the shared {@link WorkoutDetailsBody}
 * so the exercise/set/superset rendering stays the single source of
 * truth; here we opt in to the total-volume footer.
 */
export function WorkoutDigest({
  workout,
  exerciseMap,
}: {
  workout: Workout;
  exerciseMap: Map<string, Exercise>;
}) {
  return <WorkoutDetailsBody workout={workout} exerciseMap={exerciseMap} showTotalVolume />;
}
