/// <reference types="vitest/globals" />

import type {
  Exercise,
  PersonalRecordEvent,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/api";
import {
  leadHeadline,
  populatedCategories,
  prSubhead,
  shortLift,
  topSetIndex,
  workoutTitle,
} from "./workout-recap";

const catalog: Exercise[] = [
  {
    id: "bench",
    name: "Barbell Bench Press",
    muscle_groups: ["chest", "triceps"],
    equipment: ["barbell"],
  },
  {
    id: "row",
    name: "Barbell Bent Over Row",
    muscle_groups: ["back", "biceps"],
    equipment: ["barbell"],
  },
  {
    id: "incline-db",
    name: "Incline Dumbbell Bench Press",
    muscle_groups: ["chest", "shoulders"],
    equipment: ["dumbbell"],
  },
  {
    id: "tripod-row",
    name: "Dumbbell Tripod Row",
    muscle_groups: ["back", "biceps"],
    equipment: ["dumbbell"],
  },
  {
    id: "squat",
    name: "Barbell Back Squat",
    muscle_groups: ["quads", "glutes"],
    equipment: ["barbell"],
  },
];
const exerciseMap = new Map(catalog.map((e) => [e.id, e]));

const set = (reps: number, weight: number, unit: WorkoutSet["unit"] = "lb"): WorkoutSet => ({
  reps,
  weight,
  unit,
});

const ex = (
  exercise_id: string,
  sets: WorkoutSet[],
  order = 0,
  superset_group: number | null = null,
): WorkoutExercise => ({ exercise_id, order, superset_group, sets });

const pr = (
  exercise_id: string,
  weight: number,
  reps: number,
  unit: WorkoutSet["unit"] = "lb",
): PersonalRecordEvent => ({
  id: `pr-${exercise_id}-${weight}-${reps}`,
  exercise_id,
  workout_id: "w",
  weight,
  reps,
  unit,
  previous_weight: null,
  previous_reps: null,
  previous_unit: null,
  achieved_at: "2026-05-11T18:00:00Z",
});

function workout(over: Partial<Workout> = {}): Workout {
  return {
    id: "w",
    user_id: "u",
    name: "Week 2 Workout 1 - Chest & Back",
    performed_at: "2026-05-11T17:30:00Z",
    ended_at: "2026-05-11T18:50:00Z",
    notes: "great day",
    exercises: [],
    created_at: "2026-05-11T18:50:00Z",
    updated_at: "2026-05-11T18:50:00Z",
    personal_records_set: [],
    ...over,
  };
}

describe("shortLift", () => {
  it("strips a leading equipment/stance word", () => {
    expect(shortLift("Barbell Bench Press")).toBe("Bench Press");
    expect(shortLift("Dumbbell Tripod Row")).toBe("Tripod Row");
    expect(shortLift("Seated Dumbbell Shoulder Press")).toBe("Dumbbell Shoulder Press");
  });

  it("leaves an unprefixed name alone", () => {
    expect(shortLift("Lat Pulldown")).toBe("Lat Pulldown");
  });
});

describe("workoutTitle", () => {
  it("uses a meaningful name verbatim", () => {
    expect(workoutTitle(workout({ name: "Leg Day" }))).toBe("Leg Day");
  });

  it("falls back to the formatted date for an auto-generated name", () => {
    expect(
      workoutTitle(workout({ name: "Workout - May 14", performed_at: "2026-05-14T18:00:00Z" })),
    ).toBe("May 14, 2026");
  });

  it("falls back to the date when the name is missing", () => {
    expect(workoutTitle(workout({ name: undefined }))).toBe("May 11, 2026");
  });
});

describe("leadHeadline", () => {
  it("with no PRs uses the workout title as the headline", () => {
    const { kicker, headline } = leadHeadline(workout({ personal_records_set: [] }), exerciseMap);
    expect(kicker).toBe("May 11, 2026");
    expect(headline).toBe("Week 2 Workout 1 - Chest & Back");
  });

  it("with no PRs and an auto name falls back to the date", () => {
    const { headline } = leadHeadline(
      workout({
        name: "Workout - May 14",
        performed_at: "2026-05-14T18:00:00Z",
        personal_records_set: [],
      }),
      exerciseMap,
    );
    expect(headline).toBe("May 14, 2026");
  });

  it("with one PR names it in the singular and strips the lift prefix", () => {
    const { headline } = leadHeadline(
      workout({ personal_records_set: [pr("bench", 305, 2)] }),
      exerciseMap,
    );
    expect(headline).toBe("A new PR — 305 lb × 2 on Bench Press");
  });

  it("carries the set's unit through the headline", () => {
    const { headline } = leadHeadline(
      workout({ personal_records_set: [pr("row", 100, 5, "kg")] }),
      exerciseMap,
    );
    expect(headline).toBe("A new PR — 100 kg × 5 on Bent Over Row");
  });

  it("with four PRs spells the count and names the heaviest break", () => {
    const { headline } = leadHeadline(
      workout({
        personal_records_set: [
          pr("incline-db", 90, 7),
          pr("bench", 305, 2),
          pr("row", 205, 3),
          pr("tripod-row", 80, 6),
        ],
      }),
      exerciseMap,
    );
    expect(headline).toBe("Four PRs, topped by 305 lb × 2 on Bench Press");
  });
});

describe("prSubhead", () => {
  it("renders a single record", () => {
    expect(prSubhead([pr("bench", 305, 2)])).toBe("1 new personal record — including 305 lb × 2.");
  });

  it("renders the top two of many breaks", () => {
    expect(
      prSubhead([
        pr("incline-db", 90, 7),
        pr("bench", 305, 2),
        pr("row", 205, 3),
        pr("tripod-row", 80, 6),
      ]),
    ).toBe("4 new personal records — including 305 lb × 2 and 205 lb × 3.");
  });
});

describe("topSetIndex", () => {
  it("picks the heaviest set of a ramp", () => {
    expect(topSetIndex(ex("bench", [set(10, 185), set(10, 225), set(6, 275), set(2, 305)]))).toBe(
      3,
    );
  });

  it("returns the first set of a flat scheme", () => {
    expect(topSetIndex(ex("squat", [set(5, 225), set(5, 225), set(5, 225)]))).toBe(0);
  });

  it("breaks an equal-weight tie by reps", () => {
    expect(topSetIndex(ex("incline-db", [set(7, 90), set(9, 90), set(7, 90)]))).toBe(1);
  });
});

describe("populatedCategories", () => {
  it("returns only populated categories, largest first", () => {
    const w = workout({
      personal_records_set: [],
      exercises: [
        ex("bench", [set(10, 185), set(10, 225)], 0), // Chest +2, Arms +2
        ex("row", [set(10, 135), set(8, 175), set(5, 195)], 1), // Back +3, Arms +3
      ],
    });
    const result = populatedCategories(w, catalog);
    expect(result.map((d) => [d.category, d.value])).toEqual([
      ["Arms", 5],
      ["Back", 3],
      ["Chest", 2],
    ]);
  });

  it("is empty-safe", () => {
    expect(populatedCategories(workout({ exercises: [] }), catalog)).toEqual([]);
  });
});
