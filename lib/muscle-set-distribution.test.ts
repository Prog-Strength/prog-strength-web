/// <reference types="vitest/globals" />

import type { Exercise, Workout } from "@/lib/api";
import { setsByCategory, setsByMuscleGroup } from "./muscle-set-distribution";

const catalog: Exercise[] = [
  { id: "bench", name: "Bench Press", muscle_groups: ["chest", "triceps"], equipment: ["barbell"] },
  { id: "squat", name: "Squat", muscle_groups: ["quads", "glutes"], equipment: ["barbell"] },
  { id: "mystery", name: "Mystery", muscle_groups: ["unknown-thing"], equipment: [] },
];

function workout(exercises: Workout["exercises"]): Workout {
  return {
    id: "w",
    user_id: "u",
    performed_at: "2026-06-14T10:00:00.000Z",
    exercises,
    created_at: "2026-06-14T10:00:00.000Z",
    updated_at: "2026-06-14T10:00:00.000Z",
    personal_records_set: [],
  };
}

describe("setsByCategory", () => {
  it("credits each mapped category with the exercise's set count", () => {
    const w = workout([
      {
        exercise_id: "bench",
        order: 0,
        sets: [
          { reps: 5, weight: 185, unit: "lb" },
          { reps: 5, weight: 185, unit: "lb" },
        ],
      },
      { exercise_id: "squat", order: 1, sets: [{ reps: 5, weight: 225, unit: "lb" }] },
    ]);
    const { data, hasData } = setsByCategory([w], catalog);
    const byCat = Object.fromEntries(data.map((d) => [d.category, d.value]));
    expect(hasData).toBe(true);
    // bench: 2 sets → Chest +2, Arms +2 (triceps). squat: 1 set → Legs +2 (quads+glutes both Legs).
    expect(byCat.Chest).toBe(2);
    expect(byCat.Arms).toBe(2);
    expect(byCat.Legs).toBe(2);
    expect(byCat.Back).toBe(0);
  });

  it("ignores unknown muscle groups and exercises not in the catalog", () => {
    const w = workout([
      { exercise_id: "mystery", order: 0, sets: [{ reps: 1, weight: 0, unit: "lb" }] },
      { exercise_id: "not-in-catalog", order: 1, sets: [{ reps: 1, weight: 0, unit: "lb" }] },
    ]);
    const { hasData } = setsByCategory([w], catalog);
    expect(hasData).toBe(false);
  });

  it("returns all six categories in fixed order", () => {
    const { data } = setsByCategory([], catalog);
    expect(data.map((d) => d.category)).toEqual([
      "Chest",
      "Back",
      "Shoulders",
      "Arms",
      "Legs",
      "Core",
    ]);
  });
});

describe("setsByMuscleGroup", () => {
  it("credits each muscle group the exercise hits with its set count", () => {
    const w = workout([
      {
        exercise_id: "bench",
        order: 0,
        sets: [
          { reps: 5, weight: 185, unit: "lb" },
          { reps: 5, weight: 185, unit: "lb" },
        ],
      },
      { exercise_id: "squat", order: 1, sets: [{ reps: 5, weight: 225, unit: "lb" }] },
    ]);
    const { data, hasData } = setsByMuscleGroup(w, catalog);
    const byGroup = Object.fromEntries(data.map((d) => [d.muscleGroup, d.value]));
    expect(hasData).toBe(true);
    // bench (2 sets) hits chest + triceps; squat (1 set) hits quads + glutes.
    expect(byGroup.chest).toBe(2);
    expect(byGroup.triceps).toBe(2);
    expect(byGroup.quads).toBe(1);
    expect(byGroup.glutes).toBe(1);
    // an unworked group is absent from the data, not present as zero
    expect(byGroup.back).toBeUndefined();
  });

  it("is false-flagged and empty when no exercise resolves to a mappable group", () => {
    const w = workout([
      { exercise_id: "mystery", order: 0, sets: [{ reps: 1, weight: 0, unit: "lb" }] },
      { exercise_id: "not-in-catalog", order: 1, sets: [{ reps: 1, weight: 0, unit: "lb" }] },
    ]);
    const { data, hasData } = setsByMuscleGroup(w, catalog);
    expect(hasData).toBe(false);
    expect(data).toEqual([]);
  });

  it("orders groups by the fixed catalog key order, stably across renders", () => {
    const w = workout([
      { exercise_id: "squat", order: 0, sets: [{ reps: 5, weight: 225, unit: "lb" }] },
      { exercise_id: "bench", order: 1, sets: [{ reps: 5, weight: 185, unit: "lb" }] },
    ]);
    const { data } = setsByMuscleGroup(w, catalog);
    // chest/triceps (bench) and quads/glutes (squat) appear in MUSCLE_GROUPS order,
    // regardless of exercise order in the workout.
    expect(data.map((d) => d.muscleGroup)).toEqual(["chest", "triceps", "quads", "glutes"]);
  });
});
