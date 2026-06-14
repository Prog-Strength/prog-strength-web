/// <reference types="vitest/globals" />

import type { Workout } from "@/lib/api";
import { workoutToPayload } from "./workout-payload";

function baseWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w1",
    user_id: "u1",
    performed_at: "2026-06-14T10:00:00.000Z",
    exercises: [],
    created_at: "2026-06-14T10:00:00.000Z",
    updated_at: "2026-06-14T10:00:00.000Z",
    personal_records_set: [],
    ...overrides,
  };
}

describe("workoutToPayload", () => {
  it("carries required performed_at and maps exercises", () => {
    const w = baseWorkout({
      exercises: [{ exercise_id: "bench", order: 0, sets: [{ reps: 5, weight: 185, unit: "lb" }] }],
    });
    const payload = workoutToPayload(w);
    expect(payload.performed_at).toBe("2026-06-14T10:00:00.000Z");
    expect(payload.exercises).toEqual([
      { exercise_id: "bench", sets: [{ reps: 5, weight: 185, unit: "lb" }] },
    ]);
  });

  it("omits optional workout fields when empty/absent", () => {
    const payload = workoutToPayload(baseWorkout({ name: "", notes: undefined }));
    expect(payload).not.toHaveProperty("name");
    expect(payload).not.toHaveProperty("ended_at");
    expect(payload).not.toHaveProperty("notes");
  });

  it("includes optional workout fields when present", () => {
    const payload = workoutToPayload(
      baseWorkout({ name: "Push", notes: "felt strong", ended_at: "2026-06-14T11:00:00.000Z" }),
    );
    expect(payload.name).toBe("Push");
    expect(payload.notes).toBe("felt strong");
    expect(payload.ended_at).toBe("2026-06-14T11:00:00.000Z");
  });

  it("sorts exercises by order and preserves superset_group + notes", () => {
    const w = baseWorkout({
      exercises: [
        { exercise_id: "second", order: 2, sets: [{ reps: 8, weight: 0, unit: "lb" }] },
        {
          exercise_id: "first",
          order: 1,
          superset_group: 3,
          notes: "tempo",
          sets: [{ reps: 10, weight: 30, unit: "lb" }],
        },
      ],
    });
    const payload = workoutToPayload(w);
    expect(payload.exercises.map((e) => e.exercise_id)).toEqual(["first", "second"]);
    expect(payload.exercises[0]).toEqual({
      exercise_id: "first",
      superset_group: 3,
      notes: "tempo",
      sets: [{ reps: 10, weight: 30, unit: "lb" }],
    });
  });

  it("omits a null superset_group", () => {
    const w = baseWorkout({
      exercises: [
        {
          exercise_id: "bench",
          order: 0,
          superset_group: null,
          sets: [{ reps: 5, weight: 100, unit: "lb" }],
        },
      ],
    });
    expect(workoutToPayload(w).exercises[0]).not.toHaveProperty("superset_group");
  });
});
