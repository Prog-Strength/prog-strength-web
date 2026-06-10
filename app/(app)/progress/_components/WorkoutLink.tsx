"use client";

import Link from "next/link";

/** A compact link to a workout's detail page, shared by both table views. */
export function WorkoutLink({ workoutID }: { workoutID: string }) {
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
