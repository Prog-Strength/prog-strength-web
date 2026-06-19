/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";

import type { Exercise, WorkoutExercise, WorkoutSet } from "@/lib/api";
import { RecapExerciseList } from "./recap-exercise-list";

const catalog: Exercise[] = [
  { id: "bench", name: "Barbell Bench Press", muscle_groups: ["chest"], equipment: ["barbell"] },
  {
    id: "incline-db",
    name: "Incline Dumbbell Bench Press",
    muscle_groups: ["chest"],
    equipment: ["dumbbell"],
    description: "Record weight per dumbbell, not the combined pair.",
  },
  {
    id: "ohp",
    name: "Seated Dumbbell Shoulder Press",
    muscle_groups: ["shoulders"],
    equipment: ["dumbbell"],
  },
  { id: "pulldown", name: "Lat Pulldown", muscle_groups: ["back"], equipment: ["cable"] },
  { id: "plank", name: "Plank", muscle_groups: ["core"], equipment: ["bodyweight"] },
];
const exerciseMap = new Map(catalog.map((e) => [e.id, e]));

const set = (reps: number, weight: number, unit: WorkoutSet["unit"] = "lb"): WorkoutSet => ({
  reps,
  weight,
  unit,
});

const ex = (
  exercise_id: string,
  order: number,
  sets: WorkoutSet[],
  superset_group: number | null = null,
): WorkoutExercise => ({ exercise_id, order, superset_group, sets });

describe("RecapExerciseList", () => {
  it("renders the top set of a ramp, not every bullet", () => {
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(10, 185), set(10, 225), set(6, 275), set(2, 305)])]}
        exerciseMap={exerciseMap}
        onEditGroup={() => {}}
      />,
    );
    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText("4 × · top 305 lb")).toBeInTheDocument();
    // the warm-up loads are not listed
    expect(screen.queryByText(/185/)).not.toBeInTheDocument();
  });

  it("collapses a superset into one block with a single superset tag", () => {
    render(
      <RecapExerciseList
        exercises={[
          ex("ohp", 5, [set(12, 45), set(8, 60)], 1),
          ex("pulldown", 6, [set(12, 130), set(8, 170)], 1),
        ]}
        exerciseMap={exerciseMap}
        onEditGroup={() => {}}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByText("Seated Dumbbell Shoulder Press")).toBeInTheDocument();
    expect(within(items[0]).getByText("Lat Pulldown")).toBeInTheDocument();
    // one tag for the whole block, not one per line
    expect(within(items[0]).getAllByText("superset")).toHaveLength(1);
    expect(screen.getByLabelText("Edit superset")).toBeInTheDocument();
  });

  it("appends the per-dumbbell clarifier for bilateral dumbbell lifts", () => {
    render(
      <RecapExerciseList
        exercises={[ex("incline-db", 1, [set(10, 70), set(7, 90)])]}
        exerciseMap={exerciseMap}
        onEditGroup={() => {}}
      />,
    );
    expect(screen.getByText("2 × · top 90 lb per dumbbell")).toBeInTheDocument();
  });

  it("reads out reps for a bodyweight top set rather than a zero load", () => {
    render(
      <RecapExerciseList
        exercises={[ex("plank", 1, [set(30, 0), set(45, 0)])]}
        exerciseMap={exerciseMap}
        onEditGroup={() => {}}
      />,
    );
    expect(screen.getByText("2 × · top 45 reps")).toBeInTheDocument();
  });

  it("degrades gracefully for an exercise with no sets", () => {
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [])]}
        exerciseMap={exerciseMap}
        onEditGroup={() => {}}
      />,
    );
    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText("0 sets")).toBeInTheDocument();
  });

  it("falls back to the exercise id when the catalog has no entry", () => {
    render(
      <RecapExerciseList
        exercises={[ex("mystery-lift", 1, [set(5, 100)])]}
        exerciseMap={exerciseMap}
        onEditGroup={() => {}}
      />,
    );
    expect(screen.getByText("mystery-lift")).toBeInTheDocument();
    expect(screen.getByText("1 × · top 100 lb")).toBeInTheDocument();
  });

  it("hands the group and index back to the edit handler", () => {
    const onEditGroup = vi.fn();
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(2, 305)]), ex("pulldown", 2, [set(8, 170)])]}
        exerciseMap={exerciseMap}
        onEditGroup={onEditGroup}
      />,
    );
    fireEvent.click(screen.getAllByLabelText("Edit exercise")[1]);
    expect(onEditGroup).toHaveBeenCalledTimes(1);
    expect(onEditGroup.mock.calls[0][0][0].exercise_id).toBe("pulldown");
    expect(onEditGroup.mock.calls[0][1]).toBe(1);
  });
});
