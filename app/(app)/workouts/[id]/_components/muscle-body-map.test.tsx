/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";

import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/lib/api";
import { MAP } from "@/lib/muscle-categories";
import { MuscleBodyMap, GROUP_TO_SLUGS } from "./muscle-body-map";

const RAMP = ["#39405a", "#5a6493", "#7d88c2", "#aab4dd"];
const DEFAULT_FILL = "#191c21";

const catalog: Exercise[] = [
  {
    id: "squat",
    name: "Barbell Back Squat",
    muscle_groups: ["quads", "glutes"],
    equipment: ["barbell"],
  },
  { id: "curl", name: "Lying Leg Curl", muscle_groups: ["hamstrings"], equipment: ["machine"] },
  { id: "calf", name: "Standing Calf Raise", muscle_groups: ["calves"], equipment: ["machine"] },
  { id: "plank", name: "Plank", muscle_groups: ["core"], equipment: ["bodyweight"] },
  { id: "row", name: "Barbell Row", muscle_groups: ["back"], equipment: ["barbell"] },
  { id: "mystery", name: "Mystery", muscle_groups: ["unknown-thing"], equipment: [] },
];

const set = (): WorkoutSet => ({ reps: 5, weight: 100, unit: "lb" });
const ex = (exercise_id: string, order: number, n: number): WorkoutExercise => ({
  exercise_id,
  order,
  superset_group: null,
  sets: Array.from({ length: n }, set),
});

function workout(exercises: WorkoutExercise[]): Workout {
  return {
    id: "w",
    user_id: "u",
    performed_at: "2026-06-19T10:00:00.000Z",
    exercises,
    created_at: "2026-06-19T10:00:00.000Z",
    updated_at: "2026-06-19T10:00:00.000Z",
    personal_records_set: [],
  };
}

// Helper: the fill of the first <path> the library rendered for a slug.
function fillOf(container: HTMLElement, slug: string): string | null {
  return container.querySelector(`path[id="${slug}"]`)?.getAttribute("fill") ?? null;
}

describe("GROUP_TO_SLUGS", () => {
  it("covers every catalog muscle-group key, so no muscle falls off the figure", () => {
    for (const key of Object.keys(MAP)) {
      expect(GROUP_TO_SLUGS[key]).toBeDefined();
      expect(GROUP_TO_SLUGS[key].length).toBeGreaterThan(0);
    }
  });
});

describe("MuscleBodyMap", () => {
  it("renders null when no exercise maps to a muscle group", () => {
    const { container } = render(
      <MuscleBodyMap workout={workout([ex("mystery", 0, 3)])} exercises={catalog} />,
    );
    expect(container.querySelector("path")).toBeNull();
  });

  it("shades worked slugs from the ramp and leaves unworked slugs at defaultFill", () => {
    // squat → quads (front) + glutes (back); only-worked-region session.
    const { container } = render(
      <MuscleBodyMap workout={workout([ex("squat", 0, 4)])} exercises={catalog} />,
    );
    // quads is the single worked region → busiest → tier 4 → brightest ramp stop.
    expect(fillOf(container, "quadriceps")).toBe(RAMP[3]);
    expect(fillOf(container, "gluteal")).toBe(RAMP[3]);
    // chest was never worked → default fill
    expect(fillOf(container, "chest")).toBe(DEFAULT_FILL);
    // non-muscle / untracked regions read as the same near-black silhouette,
    // not the library's internal gray — a uniform unworked body.
    expect(fillOf(container, "head")).toBe(DEFAULT_FILL);
    expect(fillOf(container, "hands")).toBe(DEFAULT_FILL);
  });

  it("buckets relative to the busiest region so the lightest worked region is tier 1", () => {
    // quads 8 sets (busiest, tier 4) vs core 1 set (tier 1 = ceil(1/8*4)=1).
    const { container } = render(
      <MuscleBodyMap
        workout={workout([ex("squat", 0, 8), ex("plank", 1, 1)])}
        exercises={catalog}
      />,
    );
    expect(fillOf(container, "quadriceps")).toBe(RAMP[3]);
    expect(fillOf(container, "abs")).toBe(RAMP[0]);
  });

  it("gives every slug of a multi-slug group the same tier", () => {
    // back → trapezius + upper-back + lower-back, all one tier.
    const { container } = render(
      <MuscleBodyMap workout={workout([ex("row", 0, 4)])} exercises={catalog} />,
    );
    expect(fillOf(container, "trapezius")).toBe(RAMP[3]);
    expect(fillOf(container, "upper-back")).toBe(RAMP[3]);
    expect(fillOf(container, "lower-back")).toBe(RAMP[3]);
  });

  it("captions the populated categories largest-first", () => {
    // 4 leg exercises + 1 core → Legs (quads+glutes+hamstrings+calves credited)
    // dominates Core. Caption mirrors the old strip's counts.
    render(
      <MuscleBodyMap
        workout={workout([
          ex("squat", 0, 4),
          ex("curl", 1, 4),
          ex("calf", 2, 4),
          ex("plank", 3, 2),
        ])}
        exercises={catalog}
      />,
    );
    const caption = screen.getByTestId("muscle-body-map-caption");
    expect(caption).toHaveTextContent("Legs");
    expect(caption).toHaveTextContent("Core");
    // Legs appears before Core (largest-first)
    expect(caption.textContent!.indexOf("Legs")).toBeLessThan(caption.textContent!.indexOf("Core"));
  });
});
