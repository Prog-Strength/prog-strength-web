/// <reference types="vitest/globals" />

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StepsEntry } from "./api";
import { buildAxis, dayPct, deriveStats, entriesInPeriod } from "./steps-stats";

function entry(date: string, steps: number): StepsEntry {
  return { id: date, date, steps, created_at: date, updated_at: date };
}

// The DX representative window: ~30 days ending Jun 18, 2026 — avg riding just
// under the 10,000 goal (≈94%), the one big day (Jun 18, 14,000) that must not
// flatten the rest, a couple of clear misses (Jun 16/17), and two unlogged gaps
// (Jun 9, May 30) so "didn't walk" stays distinct from "didn't log". Newest
// first, mirroring the API.
const FIXTURE: StepsEntry[] = [
  entry("2026-06-18", 14000),
  entry("2026-06-17", 6500),
  entry("2026-06-16", 5500),
  entry("2026-06-15", 10000),
  entry("2026-06-14", 11000),
  entry("2026-06-13", 9500),
  entry("2026-06-12", 9200),
  entry("2026-06-11", 8800),
  entry("2026-06-10", 10400),
  // Jun 9 — unlogged gap
  entry("2026-06-08", 7600),
  entry("2026-06-07", 9800),
  entry("2026-06-06", 8600),
  entry("2026-06-05", 9900),
  entry("2026-06-04", 10100),
  entry("2026-06-03", 8200),
  entry("2026-06-02", 9400),
  entry("2026-06-01", 10600),
  entry("2026-05-31", 12000),
  // May 30 — unlogged gap
  entry("2026-05-29", 8400),
  entry("2026-05-28", 9100),
  entry("2026-05-27", 10800),
  entry("2026-05-26", 7300),
  entry("2026-05-25", 9600),
  entry("2026-05-24", 9000),
  entry("2026-05-23", 10200),
  entry("2026-05-22", 8700),
  entry("2026-05-21", 9300),
  entry("2026-05-20", 10000),
];

const GOAL = 10000;

beforeEach(() => {
  // Pin "today" to the DX reference day so the relative windows are
  // deterministic. Local noon avoids any DST/midnight edge.
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 18, 12, 0, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("entriesInPeriod", () => {
  it("filters a bounded window inclusive of the cutoff, newest first", () => {
    const got = entriesInPeriod(FIXTURE, 7); // Jun 12 … Jun 18
    expect(got.map((e) => e.date)).toEqual([
      "2026-06-18",
      "2026-06-17",
      "2026-06-16",
      "2026-06-15",
      "2026-06-14",
      "2026-06-13",
      "2026-06-12",
    ]);
  });

  it("returns every entry for the All period (days = null)", () => {
    expect(entriesInPeriod(FIXTURE, null)).toHaveLength(FIXTURE.length);
  });
});

describe("deriveStats", () => {
  it("computes avg/total/best over a bounded window", () => {
    // Last 7 days: 14000,6500,5500,10000,11000,9500,9200 → total 65700, avg 9385.71…
    const s = deriveStats(FIXTURE, 7, GOAL);
    expect(s.total).toBe(65700);
    expect(s.daysLogged).toBe(7);
    expect(s.best).toEqual({ date: "2026-06-18", steps: 14000 });
    expect(s.avg).toBeCloseTo(9385.71, 1);
  });

  it("rounds the near-miss average to a legible 94%, not away", () => {
    // 30-day window average sits just under goal; attainment must read as a
    // percent close to the goal, never silently rounded to 100.
    const s = deriveStats(FIXTURE, 30, GOAL);
    expect(s.attainmentPct).not.toBeNull();
    expect(s.attainmentPct as number).toBeLessThan(100);
    expect(s.attainmentPct as number).toBeGreaterThanOrEqual(90);
    expect(s.attainmentPct).toBe(Math.round(((s.avg as number) / GOAL) * 100));
  });

  it("counts daysHit over logged days and derives hitRatePct", () => {
    const s = deriveStats(FIXTURE, 7, GOAL);
    // ≥10000 in the last 7: Jun 18 (14000), Jun 15 (10000), Jun 14 (11000) → 3
    expect(s.daysHit).toBe(3);
    expect(s.hitRatePct).toBe(Math.round((3 / 7) * 100));
  });

  it("nulls every goal-relative field when no goal is set", () => {
    const s = deriveStats(FIXTURE, 30, 0);
    expect(s.attainmentPct).toBeNull();
    expect(s.hitRatePct).toBeNull();
    expect(s.daysHit).toBe(0);
    // avg/total/best still compute without a goal.
    expect(s.avg).not.toBeNull();
    expect(s.total).toBeGreaterThan(0);
    expect(s.best).not.toBeNull();
  });

  it("returns the all-null shape for an empty period", () => {
    const s = deriveStats([], 30, GOAL);
    expect(s).toEqual({
      avg: null,
      total: 0,
      best: null,
      daysLogged: 0,
      daysHit: 0,
      attainmentPct: null,
      hitRatePct: null,
    });
  });
});

describe("buildAxis", () => {
  it("spans the bounded window oldest→newest, one entry per calendar day", () => {
    const axis = buildAxis(FIXTURE, 7, GOAL);
    expect(axis).toHaveLength(7);
    expect(axis[0].date).toBe("2026-06-12");
    expect(axis[axis.length - 1].date).toBe("2026-06-18");
  });

  it("renders unlogged days as null gaps, never zeros", () => {
    const axis = buildAxis(FIXTURE, 30, GOAL);
    const jun9 = axis.find((d) => d.date === "2026-06-09");
    const may30 = axis.find((d) => d.date === "2026-05-30");
    expect(jun9).toBeDefined();
    expect(jun9?.steps).toBeNull();
    expect(jun9?.logged).toBe(false);
    expect(may30?.steps).toBeNull();
    // A logged day keeps its real value (and the big day is not flattened).
    const jun18 = axis.find((d) => d.date === "2026-06-18");
    expect(jun18?.steps).toBe(14000);
    expect(jun18?.logged).toBe(true);
  });

  it("marks hit / pct / delta against the goal", () => {
    const axis = buildAxis(FIXTURE, 7, GOAL);
    const jun18 = axis.find((d) => d.date === "2026-06-18");
    const jun17 = axis.find((d) => d.date === "2026-06-17");
    expect(jun18?.hit).toBe(true);
    expect(jun18?.pct).toBeCloseTo(1.4, 5);
    expect(jun18?.delta).toBe(4000);
    expect(jun17?.hit).toBe(false);
    expect(jun17?.delta).toBe(-3500);
  });

  it("nulls pct/delta and clears hit when no goal is set", () => {
    const axis = buildAxis(FIXTURE, 7, 0);
    for (const d of axis.filter((x) => x.logged)) {
      expect(d.pct).toBeNull();
      expect(d.delta).toBeNull();
      expect(d.hit).toBe(false);
    }
  });

  it("runs earliest-entry → today for the All period and keeps its gaps", () => {
    const axis = buildAxis(FIXTURE, null, GOAL);
    expect(axis[0].date).toBe("2026-05-20"); // earliest logged day
    expect(axis[axis.length - 1].date).toBe("2026-06-18"); // today
    // 2026-05-20 → 2026-06-18 inclusive = 30 calendar days.
    expect(axis).toHaveLength(30);
    expect(axis.find((d) => d.date === "2026-05-30")?.steps).toBeNull();
    expect(axis.find((d) => d.date === "2026-06-09")?.steps).toBeNull();
  });

  it("returns an empty axis for no entries", () => {
    expect(buildAxis([], 30, GOAL)).toEqual([]);
  });

  it("emits strictly consecutive calendar days with no gaps or duplicates", () => {
    // Guards the DST-safe day stepping: every step advances exactly one
    // calendar day, so no day is dropped (spring-forward) or repeated
    // (fall-back).
    const axis = buildAxis(FIXTURE, 30, GOAL);
    for (let i = 1; i < axis.length; i++) {
      const prev = new Date(axis[i - 1].date);
      const expected = new Date(prev);
      expected.setUTCDate(expected.getUTCDate() + 1);
      expect(axis[i].date).toBe(expected.toISOString().slice(0, 10));
    }
  });
});

describe("dayPct", () => {
  it("rounds steps/goal to a percent", () => {
    expect(dayPct(14000, 10000)).toBe(140);
    expect(dayPct(6500, 10000)).toBe(65);
  });
  it("is null with no goal", () => {
    expect(dayPct(8000, 0)).toBeNull();
  });
});
