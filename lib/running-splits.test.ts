import { describe, expect, it } from "vitest";
import { buildPaceStrip, parseTargetPace } from "./running-splits";
import type { RunningTrackpoint } from "./api";

const KM_PER_MILE = 1.609344;

const pt = (dist: number, pace: number | null, clean: boolean): RunningTrackpoint => ({
  sequence: 0,
  elapsed_seconds: 0,
  distance_meters: dist,
  heart_rate_bpm: null,
  pace_sec_per_km: pace,
  elevation_meters: null,
  clean_pace: clean,
});

describe("buildPaceStrip", () => {
  it("trusts the server clean_pace flag and converts units", () => {
    const points = buildPaceStrip(
      [pt(0, null, false), pt(1609.344, 300, true), pt(3218.688, 1200, false)],
      "mi",
    );
    expect(points[0].paceSecPerUnit).toBeNull();
    expect(points[1].distanceUnit).toBeCloseTo(1);
    expect(points[1].paceSecPerUnit).toBeCloseTo(300 * KM_PER_MILE);
    expect(points[2].paceSecPerUnit).toBeNull(); // dropout: gap, not a value
  });

  it("keeps km paces verbatim and buckets distance per km", () => {
    const points = buildPaceStrip([pt(0, 300, true), pt(2000, 310, true)], "km");
    expect(points[0].paceSecPerUnit).toBe(300);
    expect(points[1].distanceUnit).toBeCloseTo(2);
    expect(points[1].paceSecPerUnit).toBe(310);
  });

  it("never plots a flagged-clean point with a null pace", () => {
    // Defensive: a malformed point (clean but no pace) must render as a gap.
    const points = buildPaceStrip([pt(0, null, true)], "mi");
    expect(points[0].paceSecPerUnit).toBeNull();
  });
});

describe("parseTargetPace", () => {
  it("Step 10: parses a unit-qualified pace and converts to the active unit", () => {
    const text = "Workout: 8 × 400m @ 5K effort (~6:30/mi) with 200m jog recovery.";
    expect(parseTargetPace(text, "mi")!).toBe(390);
    expect(parseTargetPace(text, "km")!).toBe(Math.round(390 / KM_PER_MILE));
  });

  it("Step 10b: returns null without a unit-qualified pace", () => {
    expect(parseTargetPace("8 × 400m hard", "mi")).toBeNull();
    expect(parseTargetPace(null, "mi")).toBeNull();
    expect(parseTargetPace("threshold for 20 minutes", "km")).toBeNull();
  });

  it("Step 10c: converts a /km token to the active mi unit", () => {
    expect(parseTargetPace("tempo @ 4:00/km", "km")).toBe(240);
    expect(parseTargetPace("tempo @ 4:00/km", "mi")).toBe(Math.round(240 * KM_PER_MILE));
  });

  it("Step 10d: accepts 'per mile' / 'per km' phrasing", () => {
    expect(parseTargetPace("hold 7:30 per mile", "mi")).toBe(450);
    expect(parseTargetPace("hold 5:00 per kilometer", "km")).toBe(300);
  });
});
