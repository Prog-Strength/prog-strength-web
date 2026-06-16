/// <reference types="vitest/globals" />
import {
  type PlannedExerciseDraft,
  groupRuns,
  normalizeSupersets,
  summarizeDraftSets,
  toggleSupersetWithPrevious,
} from "./agenda-editor";

function ex(exercise_id: string, superset_group: number | null = null): PlannedExerciseDraft {
  return { exercise_id, notes: "", superset_group, sets: [] };
}

describe("toggleSupersetWithPrevious", () => {
  it("groups an exercise with the one above (creating a new group)", () => {
    const out = toggleSupersetWithPrevious([ex("a"), ex("b"), ex("c")], 1);
    expect(out[0].superset_group).toBe(1);
    expect(out[1].superset_group).toBe(1);
    expect(out[2].superset_group).toBeNull();
  });

  it("joins the previous exercise's existing group", () => {
    const out = toggleSupersetWithPrevious([ex("a", 1), ex("b", 1), ex("c")], 2);
    expect(out.map((e) => e.superset_group)).toEqual([1, 1, 1]);
  });

  it("ungroups when toggled off, clearing a now-singleton group", () => {
    // a+b are a superset; toggling b off leaves a alone → both cleared.
    const out = toggleSupersetWithPrevious([ex("a", 1), ex("b", 1)], 1);
    expect(out.map((e) => e.superset_group)).toEqual([null, null]);
  });

  it("is a no-op for the first exercise", () => {
    const input = [ex("a"), ex("b")];
    expect(toggleSupersetWithPrevious(input, 0)).toEqual(input);
  });
});

describe("normalizeSupersets", () => {
  it("clears groups that aren't consecutive runs of 2+", () => {
    // a(1), b(2 — isolated), c(1) → not consecutive, so all singletons clear.
    const out = normalizeSupersets([ex("a", 1), ex("b", 2), ex("c", 1)]);
    expect(out.map((e) => e.superset_group)).toEqual([null, null, null]);
  });

  it("keeps a valid consecutive group", () => {
    const out = normalizeSupersets([ex("a", 1), ex("b", 1), ex("c")]);
    expect(out.map((e) => e.superset_group)).toEqual([1, 1, null]);
  });
});

describe("groupRuns", () => {
  it("buckets consecutive same-group exercises and leaves singletons alone", () => {
    const runs = groupRuns([ex("a", 1), ex("b", 1), ex("c"), ex("d", 2), ex("e", 2)]);
    expect(runs).toEqual([
      { group: 1, indices: [0, 1] },
      { group: null, indices: [2] },
      { group: 2, indices: [3, 4] },
    ]);
  });
});

describe("summarizeDraftSets", () => {
  it("collapses identical sets and shows weight when present", () => {
    const sets = [
      { target_reps: "5", target_weight: "135", unit: "lb" as const, target_rpe: "" },
      { target_reps: "5", target_weight: "135", unit: "lb" as const, target_rpe: "" },
      { target_reps: "5", target_weight: "135", unit: "lb" as const, target_rpe: "" },
    ];
    expect(summarizeDraftSets(sets)).toBe("3×5 @ 135 lb");
  });

  it("omits weight when unset", () => {
    expect(
      summarizeDraftSets([{ target_reps: "8", target_weight: "", unit: "lb", target_rpe: "" }]),
    ).toBe("1×8");
  });
});
