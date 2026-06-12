/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import type { Exercise, Workout } from "@/lib/api";
import { WorkoutDigest } from "./workout-digest";

function makeWorkout(): Workout {
  return {
    id: "wk-1",
    user_id: "user-1",
    performed_at: "2026-06-09T18:00:00Z",
    exercises: [
      {
        exercise_id: "bench-press",
        order: 0,
        sets: [
          { reps: 5, weight: 100, unit: "lb" },
          { reps: 5, weight: 100, unit: "lb" },
        ],
      },
    ],
    created_at: "2026-06-09T19:00:00Z",
    updated_at: "2026-06-09T19:00:00Z",
    personal_records_set: [],
  };
}

function makeExerciseMap(): Map<string, Exercise> {
  return new Map<string, Exercise>([
    [
      "bench-press",
      {
        id: "bench-press",
        name: "Bench Press",
        muscle_groups: [],
        equipment: [],
      },
    ],
  ]);
}

describe("WorkoutDigest", () => {
  it("renders the exercise set/rep/weight line", () => {
    render(<WorkoutDigest workout={makeWorkout()} exerciseMap={makeExerciseMap()} />);
    // formatSets collapses the two identical sets into one line:
    // "5 reps × 2 sets @ 100 lbs".
    const line = screen.getByText(/5 reps/);
    expect(line).toBeInTheDocument();
    expect(line).toHaveTextContent("5 reps × 2 sets @ 100 lbs");
  });

  it("renders the total-volume footer with the computed value", () => {
    render(<WorkoutDigest workout={makeWorkout()} exerciseMap={makeExerciseMap()} />);
    // 2 sets × 5 reps × 100 = 1,000, labelled in the predominant unit
    // (formatted with a thousands separator, matching the Workouts list).
    expect(screen.getByText(/Total volume/i)).toBeInTheDocument();
    expect(screen.getByText(/1,000 lbs/)).toBeInTheDocument();
  });
});
