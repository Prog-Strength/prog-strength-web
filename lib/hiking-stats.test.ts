/// <reference types="vitest/globals" />

import { deriveHikingStats } from "./hiking-stats";
import type { RunningSession } from "./api";

const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;

let seq = 0;
const id = () => `id-${seq++}`;

/** A hiking session; every elevation field defaults to null (a manual hike). */
function hike(
  opts: Partial<RunningSession> & { distance_meters: number; duration_seconds: number },
): RunningSession {
  return {
    id: id(),
    activity_type: "hiking",
    ingest_source: "garmin_api",
    source_activity_id: id(),
    name: null,
    start_time: new Date("2026-06-22T07:00:00").toISOString(),
    raw_distance_meters: opts.distance_meters,
    environment: "outdoor",
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: null,
    max_heart_rate_bpm: null,
    total_calories: null,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: new Date("2026-06-22T07:00:00").toISOString(),
    ...opts,
  };
}

beforeEach(() => {
  seq = 0;
});

describe("deriveHikingStats", () => {
  it("sums total distance and gain, skipping null gain rows", () => {
    const s = deriveHikingStats([
      hike({ distance_meters: 5000, duration_seconds: 3600, elevation_gain_meters: 200 }),
      hike({ distance_meters: 3000, duration_seconds: 2400, elevation_gain_meters: null }),
      hike({ distance_meters: 2000, duration_seconds: 1800, elevation_gain_meters: 100 }),
    ]);
    expect(s.totalDistanceMeters).toBe(10000);
    // Null gain row skipped, not coerced to 0.
    expect(s.totalGainMeters).toBe(300);
  });

  it("computes distance-weighted avg pace (total time / total distance), not a mean of per-hike paces", () => {
    // Hike A: 2 km in 1200 s → 600 s/km. Hike B: 8 km in 3200 s → 400 s/km.
    // Naive mean of paces = (600 + 400) / 2 = 500 s/km.
    // Weighted = (1200 + 3200) / ((2000 + 8000) / 1000) = 4400 / 10 = 440 s/km.
    const s = deriveHikingStats([
      hike({ distance_meters: 2000, duration_seconds: 1200 }),
      hike({ distance_meters: 8000, duration_seconds: 3200 }),
    ]);
    expect(s.avgPaceSecPerKm).toBe(440);
    expect(s.avgPaceSecPerKm).not.toBe(500);
  });

  it("takes the max high point and min low point, skipping null rows independently", () => {
    const s = deriveHikingStats([
      hike({
        distance_meters: 5000,
        duration_seconds: 3600,
        elevation_high_meters: 1200,
        elevation_low_meters: 800,
      }),
      // Reports only a high point.
      hike({
        distance_meters: 4000,
        duration_seconds: 3000,
        elevation_high_meters: 1500,
        elevation_low_meters: null,
      }),
      // Reports only a low point.
      hike({
        distance_meters: 3000,
        duration_seconds: 2000,
        elevation_high_meters: null,
        elevation_low_meters: 600,
      }),
    ]);
    expect(s.highPointMeters).toBe(1500);
    expect(s.lowPointMeters).toBe(600);
  });

  it("computes gain per mile from total gain and total distance", () => {
    // 300 m gain over 10000 m = 300 / (10000 / 1609.344) = 48.28032 m/mi.
    const s = deriveHikingStats([
      hike({ distance_meters: 10000, duration_seconds: 3600, elevation_gain_meters: 300 }),
    ]);
    expect(s.gainPerMileMeters).toBeCloseTo(300 / (10000 / METERS_PER_MILE), 6);
    expect(s.gainPerMileMeters).toBeCloseTo(48.28032, 5);
  });

  it("computes gain per km from total gain and total distance", () => {
    // 300 m gain over 10000 m = 300 / (10000 / 1000) = 30 m/km.
    const s = deriveHikingStats([
      hike({ distance_meters: 10000, duration_seconds: 3600, elevation_gain_meters: 300 }),
    ]);
    expect(s.gainPerKmMeters).toBeCloseTo(300 / (10000 / METERS_PER_KM), 6);
    expect(s.gainPerKmMeters).toBeCloseTo(30, 5);
  });

  it("returns null high/low/gainPerMile for an all-null-elevation window", () => {
    const s = deriveHikingStats([
      hike({ distance_meters: 5000, duration_seconds: 3600 }),
      hike({ distance_meters: 3000, duration_seconds: 2400 }),
    ]);
    expect(s.totalDistanceMeters).toBe(8000);
    expect(s.totalGainMeters).toBe(0);
    expect(s.highPointMeters).toBeNull();
    expect(s.lowPointMeters).toBeNull();
    // No gain → gain-per-mile and gain-per-km are null even though there is distance.
    expect(s.gainPerMileMeters).toBeNull();
    expect(s.gainPerKmMeters).toBeNull();
    // Pace is still derivable from distance + time: 6000 s / 8 km = 750 s/km.
    expect(s.avgPaceSecPerKm).toBe(750);
  });

  it("returns zeros for the sums and nulls for the derived tiles on an empty window", () => {
    const s = deriveHikingStats([]);
    expect(s.totalDistanceMeters).toBe(0);
    expect(s.totalGainMeters).toBe(0);
    expect(s.highPointMeters).toBeNull();
    expect(s.lowPointMeters).toBeNull();
    expect(s.avgPaceSecPerKm).toBeNull();
    expect(s.gainPerMileMeters).toBeNull();
    expect(s.gainPerKmMeters).toBeNull();
  });

  it("treats a null sessions argument as empty", () => {
    const s = deriveHikingStats(null);
    expect(s.totalDistanceMeters).toBe(0);
    expect(s.totalGainMeters).toBe(0);
    expect(s.avgPaceSecPerKm).toBeNull();
  });
});
