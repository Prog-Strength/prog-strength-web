import { describe, expect, it } from "vitest";
import {
  buildElevationStrip,
  buildHeartRateStrip,
  hasPlottableSeries,
  type MetricStripPoint,
} from "./running-traces";
import { buildPaceStrip } from "./running-splits";
import type { RunningTrackpoint } from "./api";

type Overrides = Partial<RunningTrackpoint>;

const pt = (dist: number, overrides: Overrides = {}): RunningTrackpoint => ({
  sequence: 0,
  elapsed_seconds: 0,
  distance_meters: dist,
  heart_rate_bpm: null,
  pace_sec_per_km: null,
  elevation_meters: null,
  clean_pace: false,
  ...overrides,
});

describe("buildHeartRateStrip", () => {
  it("passes raw bpm through and preserves a null gap without bridging", () => {
    const points = buildHeartRateStrip(
      [
        pt(0, { heart_rate_bpm: 120 }),
        pt(1609.344, { heart_rate_bpm: null }),
        pt(3218.688, { heart_rate_bpm: 160 }),
      ],
      "mi",
    );
    expect(points.map((p) => p.value)).toEqual([120, null, 160]);
    // The gap sample must be exactly null — not the 140 average of its neighbours.
    expect(points[1].value).toBeNull();
    expect(points[1].value).not.toBe(140);
  });
});

describe("buildElevationStrip", () => {
  it("passes raw meters through and preserves a null gap without bridging", () => {
    const points = buildElevationStrip(
      [
        pt(0, { elevation_meters: 10 }),
        pt(1000, { elevation_meters: null }),
        pt(2000, { elevation_meters: 30 }),
      ],
      "km",
    );
    expect(points.map((p) => p.value)).toEqual([10, null, 30]);
    // No interpolation: the middle stays null, not the 20 midpoint.
    expect(points[1].value).toBeNull();
    expect(points[1].value).not.toBe(20);
  });
});

describe("distance axis parity with buildPaceStrip", () => {
  const track: RunningTrackpoint[] = [
    pt(0, { heart_rate_bpm: 100, elevation_meters: 5, pace_sec_per_km: 300, clean_pace: true }),
    pt(1609.344, {
      heart_rate_bpm: 150,
      elevation_meters: 12,
      pace_sec_per_km: 305,
      clean_pace: true,
    }),
    pt(2414.016, {
      heart_rate_bpm: 155,
      elevation_meters: 8,
      pace_sec_per_km: 310,
      clean_pace: true,
    }),
  ];

  for (const unit of ["mi", "km"] as const) {
    it(`distanceUnit matches buildPaceStrip in "${unit}"`, () => {
      const pace = buildPaceStrip(track, unit);
      const hr = buildHeartRateStrip(track, unit);
      const elev = buildElevationStrip(track, unit);
      expect(hr.map((p) => p.distanceUnit)).toEqual(pace.map((p) => p.distanceUnit));
      expect(elev.map((p) => p.distanceUnit)).toEqual(pace.map((p) => p.distanceUnit));
    });
  }
});

describe("hasPlottableSeries", () => {
  const point = (value: number | null): MetricStripPoint => ({ distanceUnit: 0, value });

  it("is false for an empty series", () => {
    expect(hasPlottableSeries([])).toBe(false);
  });

  it("is false for a single non-null point", () => {
    expect(hasPlottableSeries([point(120)])).toBe(false);
  });

  it("is false when every point is null", () => {
    expect(hasPlottableSeries([point(null), point(null), point(null)])).toBe(false);
  });

  it("is true once two or more points carry a value", () => {
    expect(hasPlottableSeries([point(120), point(null), point(160)])).toBe(true);
    expect(hasPlottableSeries([point(120), point(130)])).toBe(true);
  });
});
