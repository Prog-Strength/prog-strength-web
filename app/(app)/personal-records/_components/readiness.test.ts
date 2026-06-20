/// <reference types="vitest/globals" />
import { deriveReadiness, summarizeReadiness, READY_THRESHOLD_PCT } from "./readiness";
import {
  liftsByReadiness,
  runningByReadiness,
  STANDARD_DISTANCES,
  type RunningLedgerItem,
} from "./readiness";
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

describe("liftsByReadiness", () => {
  const mk = (id: string, weight: number | null, est: number | null): PersonalRecord => ({
    ...base,
    exercise_id: id,
    exercise_name: id,
    workout_id: weight === null ? null : "wk",
    weight,
    current_estimated_1rm: est,
  });

  it("orders tested lifts by descending gap (most over PR first)", () => {
    const out = liftsByReadiness([mk("a", 300, 305), mk("b", 300, 360), mk("c", 300, 330)], NOW);
    expect(out.map((r) => r.exercise_id)).toEqual(["b", "c", "a"]);
  });

  it("sinks untested lifts to the bottom in stable name order", () => {
    const out = liftsByReadiness(
      [mk("z", null, null), mk("a", 300, 330), mk("y", null, null)],
      NOW,
    );
    expect(out.map((r) => r.exercise_id)).toEqual(["a", "z", "y"]);
  });

  it("does not mutate the input array", () => {
    const input = [mk("a", 300, 305), mk("b", 300, 360)];
    const copy = [...input];
    liftsByReadiness(input, NOW);
    expect(input).toEqual(copy);
  });
});

describe("runningByReadiness", () => {
  const item = (key: string, covered: boolean): RunningLedgerItem => ({
    key,
    label: key,
    best: covered
      ? {
          distance_key: key,
          distance_label: key,
          distance_meters: 1,
          duration_seconds: 600,
          pace_sec_per_km: 120,
          activity_id: "a",
          activity_start_time: "2026-01-01T00:00:00Z",
        }
      : null,
  });

  it("ranks 5k first, then covered distances, then uncovered — stable within a rank", () => {
    const out = runningByReadiness([
      item("1mi", false),
      item("5k", false),
      item("10k", true),
      item("2mi", true),
      item("marathon", false),
    ]);
    expect(out.map((r) => r.key)).toEqual(["5k", "10k", "2mi", "1mi", "marathon"]);
  });

  it("includes one row per standard distance the caller passes", () => {
    const items = STANDARD_DISTANCES.map((d) => item(d.key, false));
    expect(runningByReadiness(items)).toHaveLength(6);
  });
});
