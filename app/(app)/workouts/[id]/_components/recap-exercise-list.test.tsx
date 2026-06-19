/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";

import type { Exercise, PersonalRecordEvent, WorkoutExercise, WorkoutSet } from "@/lib/api";
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

const noPrs: PersonalRecordEvent[] = [];

const prEvent = (
  exercise_id: string,
  weight: number,
  reps: number,
  unit: WorkoutSet["unit"] = "lb",
): PersonalRecordEvent => ({
  id: `pr-${exercise_id}-${weight}x${reps}`,
  exercise_id,
  workout_id: "w",
  weight,
  reps,
  unit,
  previous_weight: null,
  previous_reps: null,
  previous_unit: null,
  achieved_at: "2026-06-19T10:00:00.000Z",
});

describe("RecapExerciseList", () => {
  it("renders the top set of a ramp, not every bullet", () => {
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(10, 185), set(10, 225), set(6, 275), set(2, 305)])]}
        exerciseMap={exerciseMap}
        personalRecords={noPrs}
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
        personalRecords={noPrs}
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
        personalRecords={noPrs}
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
        personalRecords={noPrs}
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
        personalRecords={noPrs}
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
        personalRecords={noPrs}
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
        personalRecords={noPrs}
        onEditGroup={onEditGroup}
      />,
    );
    fireEvent.click(screen.getAllByLabelText("Edit exercise")[1]);
    expect(onEditGroup).toHaveBeenCalledTimes(1);
    expect(onEditGroup.mock.calls[0][0][0].exercise_id).toBe("pulldown");
    expect(onEditGroup.mock.calls[0][1]).toBe(1);
  });
});

describe("RecapExerciseList — expand to sets", () => {
  it("toggles the per-set detail open and closed via the chevron", () => {
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(8, 135), set(5, 225), set(4, 315)])]}
        exerciseMap={exerciseMap}
        personalRecords={noPrs}
        onEditGroup={() => {}}
      />,
    );
    // collapsed by default — warm-up loads not shown
    expect(screen.queryByText("8 × 135 lb")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /show sets for Barbell Bench Press/i });
    fireEvent.click(toggle);
    expect(screen.getByText("8 × 135 lb")).toBeInTheDocument();
    expect(screen.getByText("5 × 225 lb")).toBeInTheDocument();
    expect(screen.getByText("4 × 315 lb")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    // collapse again
    fireEvent.click(screen.getByRole("button", { name: /hide sets for Barbell Bench Press/i }));
    expect(screen.queryByText("8 × 135 lb")).not.toBeInTheDocument();
  });

  it("reads bodyweight sets as reps and appends the per-dumbbell clarifier", () => {
    render(
      <RecapExerciseList
        exercises={[ex("plank", 1, [set(30, 0), set(45, 0)]), ex("incline-db", 2, [set(10, 70)])]}
        exerciseMap={exerciseMap}
        personalRecords={noPrs}
        onEditGroup={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show sets for Plank/i }));
    expect(screen.getByText("30 reps")).toBeInTheDocument();
    expect(screen.getByText("45 reps")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /show sets for Incline Dumbbell Bench Press/i }),
    );
    expect(screen.getByText("10 × 70 lb per dumbbell")).toBeInTheDocument();
  });

  it("marks the PR set with a trophy and no other set", () => {
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(8, 135), set(5, 225), set(4, 315)])]}
        exerciseMap={exerciseMap}
        personalRecords={[prEvent("bench", 315, 4)]}
        onEditGroup={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show sets for Barbell Bench Press/i }));
    const trophies = screen.getAllByText("🏆");
    expect(trophies).toHaveLength(1);
    // the trophy sits on the 315×4 row
    const prRow = screen.getByText("4 × 315 lb").closest("li")!;
    expect(within(prRow).getByText("🏆")).toBeInTheDocument();
  });

  it("marks nothing when no set matches the PR (unit mismatch / reconstruction gap)", () => {
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(8, 135), set(4, 315)])]}
        exerciseMap={exerciseMap}
        // PR weight present but reps differ → no client match
        personalRecords={[prEvent("bench", 315, 2)]}
        onEditGroup={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show sets for Barbell Bench Press/i }));
    expect(screen.queryByText("🏆")).not.toBeInTheDocument();
  });

  it("resolves a PR tie to the top set", () => {
    // two sets tie 225×5; the top set (heaviest, ties→reps) is index of the
    // first 225×5 here since both equal — topSetIndex returns the first.
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(5, 225), set(5, 225)])]}
        exerciseMap={exerciseMap}
        personalRecords={[prEvent("bench", 225, 5)]}
        onEditGroup={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /show sets for Barbell Bench Press/i }));
    const trophies = screen.getAllByText("🏆");
    expect(trophies).toHaveLength(1);
    const rows = screen.getAllByText("5 × 225 lb").map((n) => n.closest("li")!);
    // trophy on the first (top) row only
    expect(within(rows[0]).queryByText("🏆")).toBeInTheDocument();
    expect(within(rows[1]).queryByText("🏆")).not.toBeInTheDocument();
  });

  it("expands each exercise of a superset independently", () => {
    render(
      <RecapExerciseList
        exercises={[
          ex("ohp", 5, [set(12, 45), set(8, 60)], 1),
          ex("pulldown", 6, [set(12, 130), set(8, 170)], 1),
        ]}
        exerciseMap={exerciseMap}
        personalRecords={noPrs}
        onEditGroup={() => {}}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /show sets for Seated Dumbbell Shoulder Press/i }),
    );
    expect(screen.getByText("12 × 45 lb")).toBeInTheDocument();
    // pulldown stays collapsed
    expect(screen.queryByText("12 × 130 lb")).not.toBeInTheDocument();
    // still one superset block with one tag
    expect(screen.getAllByText("superset")).toHaveLength(1);
  });

  it("keeps the edit pencil firing onEditGroup, distinct from the chevron", () => {
    const onEditGroup = vi.fn();
    render(
      <RecapExerciseList
        exercises={[ex("bench", 1, [set(2, 305)])]}
        exerciseMap={exerciseMap}
        personalRecords={noPrs}
        onEditGroup={onEditGroup}
      />,
    );
    fireEvent.click(screen.getByLabelText("Edit exercise"));
    expect(onEditGroup).toHaveBeenCalledTimes(1);
  });
});
