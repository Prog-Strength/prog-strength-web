/// <reference types="vitest/globals" />
import { deriveReadiness, summarizeReadiness, READY_THRESHOLD_PCT } from "./readiness";
import type { PersonalRecord } from "@/lib/api";

const base: PersonalRecord = {
  exercise_id: "barbell-bench-press",
  exercise_name: "Barbell Bench Press",
  workout_id: "wk_1",
  weight: 300,
  reps: 3,
  unit: "lb",
  achieved_at: "2026-06-01T00:00:00Z",
  current_estimated_1rm: 330,
  estimated_1rm_unit: "lb",
  recent_estimated_1rm_points: [300, 315, 330],
};

const NOW = new Date("2026-06-19T00:00:00Z");

describe("deriveReadiness", () => {
  it("computes gap, gapPct and ready for a PR'd lift", () => {
    const r = deriveReadiness(base, NOW);
    expect(r.hasPR).toBe(true);
    expect(r.gap).toBe(30);
    expect(r.gapPct).toBeCloseTo(10);
    expect(r.ready).toBe(true);
  });

  it("counts days since the PR against the given now", () => {
    const r = deriveReadiness(base, NOW);
    expect(r.daysSince).toBe(18);
  });

  it("is not ready when the gap is under the threshold (fresh)", () => {
    const r = deriveReadiness({ ...base, current_estimated_1rm: 312 }, NOW);
    expect(r.ready).toBe(false);
    expect(r.gapPct).toBeCloseTo(4);
  });

  it("returns the null path for a never-PR'd lift", () => {
    const r = deriveReadiness(
      {
        ...base,
        workout_id: null,
        weight: null,
        reps: null,
        achieved_at: null,
        current_estimated_1rm: null,
        recent_estimated_1rm_points: null,
      },
      NOW,
    );
    expect(r.hasPR).toBe(false);
    expect(r.gap).toBeNull();
    expect(r.gapPct).toBeNull();
    expect(r.ready).toBe(false);
    expect(r.daysSince).toBeNull();
  });

  it("detects dumbbell lifts from the name", () => {
    expect(
      deriveReadiness({ ...base, exercise_name: "Dumbbell Bench Press" }, NOW).isDumbbell,
    ).toBe(true);
    expect(deriveReadiness(base, NOW).isDumbbell).toBe(false);
  });

  it("computes the gap in kg the same way (unit-agnostic math)", () => {
    const r = deriveReadiness(
      { ...base, unit: "kg", estimated_1rm_unit: "kg", weight: 140, current_estimated_1rm: 154 },
      NOW,
    );
    expect(r.gap).toBe(14);
    expect(r.gapPct).toBeCloseTo(10);
  });

  it("treats threshold exactly at READY_THRESHOLD_PCT as ready", () => {
    const r = deriveReadiness({ ...base, current_estimated_1rm: 315 }, NOW);
    expect(r.gapPct).toBeCloseTo(READY_THRESHOLD_PCT);
    expect(r.ready).toBe(true);
  });
});

describe("summarizeReadiness", () => {
  it("counts due, tested and total", () => {
    const records: PersonalRecord[] = [
      base,
      { ...base, exercise_id: "a", current_estimated_1rm: 305 },
      { ...base, exercise_id: "b", workout_id: null, weight: null, current_estimated_1rm: null },
    ];
    expect(summarizeReadiness(records, NOW)).toEqual({ due: 1, tested: 2, total: 3 });
  });
});
