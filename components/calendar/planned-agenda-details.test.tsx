/// <reference types="vitest/globals" />
import type { PlannedSet } from "@/lib/api";
import { formatPlannedSets } from "./planned-agenda-details";

function set(overrides: Partial<PlannedSet> = {}): PlannedSet {
  return {
    id: "s",
    order_index: 0,
    target_reps: 5,
    target_weight: null,
    unit: null,
    target_rpe: null,
    amrap: false,
    ...overrides,
  };
}

describe("formatPlannedSets", () => {
  it("collapses a run of identical sets into one line", () => {
    const sets = [0, 1, 2].map((i) =>
      set({ id: `s${i}`, order_index: i, target_reps: 5, target_weight: 225, unit: "lb" }),
    );
    expect(formatPlannedSets(sets)).toEqual(["5 reps × 3 sets @ 225 lbs"]);
  });

  it("omits the weight clause when weight is unset (the user fills it in later)", () => {
    expect(formatPlannedSets([set({ target_reps: 8, target_weight: null })])).toEqual([
      "8 reps × 1 set",
    ]);
  });

  it("renders AMRAP instead of a rep count", () => {
    expect(
      formatPlannedSets([set({ amrap: true, target_reps: 8, target_weight: 135, unit: "lb" })]),
    ).toEqual(["AMRAP × 1 set @ 135 lbs"]);
  });

  it("appends an RPE target when present", () => {
    expect(
      formatPlannedSets([set({ target_reps: 3, target_weight: 315, unit: "lb", target_rpe: 9 })]),
    ).toEqual(["3 reps × 1 set @ 315 lbs · RPE 9"]);
  });

  it("splits distinct sets into separate lines and sorts by order_index", () => {
    const sets = [
      set({ id: "b", order_index: 1, target_reps: 3, target_weight: 245, unit: "lb" }),
      set({ id: "a", order_index: 0, target_reps: 5, target_weight: 225, unit: "lb" }),
    ];
    expect(formatPlannedSets(sets)).toEqual([
      "5 reps × 1 set @ 225 lbs",
      "3 reps × 1 set @ 245 lbs",
    ]);
  });

  it("renders kg and singular/plural correctly", () => {
    expect(formatPlannedSets([set({ target_reps: 1, target_weight: 100, unit: "kg" })])).toEqual([
      "1 rep × 1 set @ 100 kg",
    ]);
  });
});
