import { describe, expect, it } from "vitest";
import type { Activity } from "@/lib/api";
import { partitionActivities } from "./partition-activities";

// Minimal unified fixtures — a lift (with strength details), a run, and a
// walk — exercising the split every mixed-type surface relies on.
function base(id: string, type: Activity["activity_type"]): Activity {
  return {
    id,
    activity_type: type,
    ingest_source: "manual",
    source_activity_id: "",
    name: null,
    start_time: "2026-07-27T10:00:00Z",
    distance_meters: type === "strength_training" ? 0 : 5000,
    raw_distance_meters: type === "strength_training" ? 0 : 5000,
    environment: "outdoor",
    duration_seconds: 3600,
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: null,
    max_heart_rate_bpm: null,
    total_calories: null,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: "2026-07-27T11:00:00Z",
  };
}

describe("partitionActivities", () => {
  it("adapts strength rows to Workouts and passes every other type through", () => {
    const lift: Activity = {
      ...base("l1", "strength_training"),
      name: "Push day",
      details: {
        exercises: [
          { exercise_id: "bench", order: 0, sets: [{ reps: 5, weight: 185, unit: "lb" }] },
        ],
        personal_records_set: [],
      },
    };
    const run = base("r1", "running");
    const walk = base("w1", "walking");

    const { workouts, sessions } = partitionActivities([lift, run, walk]);

    expect(workouts).toHaveLength(1);
    // The strength side comes back adapted: legacy Workout field names.
    expect(workouts[0]).toMatchObject({
      id: "l1",
      name: "Push day",
      performed_at: "2026-07-27T10:00:00Z",
      ended_at: "2026-07-27T11:00:00.000Z",
      personal_records_set: [],
    });
    expect(workouts[0].exercises).toHaveLength(1);
    // Runs AND walks/rides land in the endurance bucket, in input order.
    expect(sessions.map((s) => s.id)).toEqual(["r1", "w1"]);
  });

  it("returns empty buckets for an empty page", () => {
    expect(partitionActivities([])).toEqual({ workouts: [], sessions: [] });
  });
});
