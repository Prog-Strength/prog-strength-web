/// <reference types="vitest/globals" />

import { describe, expect, it } from "vitest";
import type { BodyweightEntry } from "./api";
import {
  buildDayPoints,
  computeStats,
  convertWeight,
  ewmaTrend,
  trendSummary,
  type DayPoint,
} from "./bodyweight-trend";

const DAY = 24 * 60 * 60 * 1000;

function dp(day: number, avg: number, spread = 0): DayPoint {
  return { t: day * DAY + 12 * 60 * 60 * 1000, avg, spread };
}

let nextId = 0;
function entry(weight: number, measured_at: string, unit: "lb" | "kg" = "lb"): BodyweightEntry {
  return { id: `e${nextId++}`, weight, unit, measured_at, created_at: measured_at };
}

describe("convertWeight", () => {
  it("is identity when units match", () => {
    expect(convertWeight(180, "lb", "lb")).toBe(180);
  });
  it("converts kg → lb", () => {
    expect(convertWeight(100, "kg", "lb")).toBeCloseTo(220.462, 2);
  });
});

describe("buildDayPoints", () => {
  it("groups multi-per-day readings into one mean point with intra-day spread", () => {
    const points = buildDayPoints(
      [
        entry(180, "2026-06-01T07:00:00"),
        entry(182, "2026-06-01T19:00:00"),
        entry(181, "2026-06-02T07:00:00"),
      ],
      "lb",
    );
    expect(points).toHaveLength(2);
    expect(points[0].avg).toBeCloseTo(181, 5);
    expect(points[0].spread).toBeCloseTo(2, 5);
    expect(points[1].avg).toBeCloseTo(181, 5);
    expect(points[1].spread).toBe(0);
    expect(points[0].t).toBeLessThan(points[1].t);
  });
});

describe("ewmaTrend", () => {
  it("seeds at the first day's mean and weights by alpha", () => {
    const out = ewmaTrend([dp(0, 200), dp(1, 210)], 0.25);
    expect(out[0].trend).toBeCloseTo(200, 5);
    expect(out[1].trend).toBeCloseTo(0.25 * 210 + 0.75 * 200, 5);
  });
  it("floors the band at 0.6 and adds half the intra-day spread", () => {
    const out = ewmaTrend([dp(0, 200, 4)], 0.25);
    expect(out[0].hi - out[0].trend).toBeCloseTo(0.6 + 2, 5);
    expect(out[0].trend - out[0].lo).toBeCloseTo(0.6 + 2, 5);
  });
  it("handles single-day input: trend equals that mean, minimal band", () => {
    const out = ewmaTrend([dp(0, 175)], 0.25);
    expect(out).toHaveLength(1);
    expect(out[0].trend).toBeCloseTo(175, 5);
    expect(out[0].hi - out[0].trend).toBeCloseTo(0.6, 5);
  });
  it("returns [] for empty input", () => {
    expect(ewmaTrend([], 0.25)).toEqual([]);
  });
});

describe("trendSummary", () => {
  it("computes the weekly rate over a clean 7-day window", () => {
    const trend = ewmaTrend([dp(0, 200), dp(7, 193)], 0.25);
    const s = trendSummary(trend);
    expect(s.hasRate).toBe(true);
    expect(s.current).toBeCloseTo(trend[trend.length - 1].trend, 5);
    expect(s.ratePerWeek).toBeCloseTo(trend[1].trend - trend[0].trend, 5);
  });
  it("normalizes a sparse/gapped window by true days, not index", () => {
    const trend = ewmaTrend([dp(0, 200), dp(10, 190)], 0.25);
    const s = trendSummary(trend);
    expect(s.hasRate).toBe(true);
    const expected = ((trend[1].trend - trend[0].trend) / 10) * 7;
    expect(s.ratePerWeek).toBeCloseTo(expected, 5);
  });
  it("hides the rate for a single point", () => {
    const s = trendSummary(ewmaTrend([dp(0, 200)], 0.25));
    expect(s.hasRate).toBe(false);
    expect(s.ratePerWeek).toBeNull();
    expect(s.current).toBeCloseTo(200, 5);
  });
  it("hides the rate when the range spans under a week", () => {
    const s = trendSummary(ewmaTrend([dp(0, 200), dp(3, 199)], 0.25));
    expect(s.hasRate).toBe(false);
    expect(s.ratePerWeek).toBeNull();
  });
  it("returns nulls for empty input", () => {
    expect(trendSummary([])).toEqual({ current: null, ratePerWeek: null, hasRate: false });
  });
});

describe("computeStats", () => {
  it("computes average, range delta, and dated min/max", () => {
    const stats = computeStats(
      [
        entry(200, "2026-06-01T08:00:00"),
        entry(196, "2026-06-08T08:00:00"),
        entry(198, "2026-06-15T08:00:00"),
      ],
      "lb",
    );
    expect(stats.count).toBe(3);
    expect(stats.avg).toBeCloseTo(198, 5);
    expect(stats.min?.weight).toBeCloseTo(196, 5);
    expect(stats.max?.weight).toBeCloseTo(200, 5);
    expect(stats.delta).toBeCloseTo(-2, 5);
  });
  it("returns nulls for empty input", () => {
    const stats = computeStats([], "lb");
    expect(stats.avg).toBeNull();
    expect(stats.min).toBeNull();
    expect(stats.delta).toBeNull();
  });
});
