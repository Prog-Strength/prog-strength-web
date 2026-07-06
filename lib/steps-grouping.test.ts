/// <reference types="vitest/globals" />

import type { StepsEntry } from "./api";
import { aggregate, bucketByWeek, spansMultipleMonths, weekStart } from "./steps-grouping";
import { isoDate } from "./steps-stats";

function entry(date: string, steps: number): StepsEntry {
  return { id: date, date, steps, created_at: date, updated_at: date };
}

/** DX fixture — newest first, June→July 2026. */
const FIXTURE: StepsEntry[] = [
  { date: "2026-07-05", steps: 17000 },
  { date: "2026-07-04", steps: 2000 },
  { date: "2026-07-03", steps: 8500 },
  { date: "2026-07-02", steps: 11200 },
  { date: "2026-07-01", steps: 10400 },
  { date: "2026-06-30", steps: 6100 },
  { date: "2026-06-29", steps: 9800 },
  { date: "2026-06-28", steps: 12500 },
  { date: "2026-06-27", steps: 13000 },
  { date: "2026-06-26", steps: 4200 },
  { date: "2026-06-25", steps: 3800 },
  { date: "2026-06-24", steps: 14000 },
  { date: "2026-06-23", steps: 10100 },
  { date: "2026-06-22", steps: 11000 },
  { date: "2026-06-21", steps: 4800 },
  { date: "2026-06-20", steps: 3200 },
  { date: "2026-06-19", steps: 6100 },
  { date: "2026-06-18", steps: 5400 },
  { date: "2026-06-17", steps: 4000 },
  { date: "2026-06-16", steps: 11000 },
].map((e) => entry(e.date, e.steps));

const GOAL = 10000;

describe("aggregate", () => {
  it("returns null goal-relative fields when no goal is set", () => {
    const week = FIXTURE.filter((e) => e.date >= "2026-06-22" && e.date <= "2026-06-28");
    const agg = aggregate(week, null);
    expect(agg.daysHit).toBeNull();
    expect(agg.attainmentPct).toBeNull();
    expect(agg.avg).toBe(9800);
  });

  it("counts days hit against the logged-days denominator", () => {
    const strong = FIXTURE.filter((e) => e.date >= "2026-06-22" && e.date <= "2026-06-28");
    const agg = aggregate(strong, GOAL);
    expect(agg.daysHit).toBe(5);
    expect(agg.daysLogged).toBe(7);
    expect(agg.avg).toBe(9800);
    expect(agg.attainmentPct).toBe(98);
  });

  it("surfaces a weak week with low avg and few hits", () => {
    const weak = FIXTURE.filter((e) => e.date >= "2026-06-16" && e.date <= "2026-06-21");
    const agg = aggregate(weak, GOAL);
    expect(agg.daysHit).toBe(1);
    expect(agg.daysLogged).toBe(6);
    expect(agg.avg).toBe(5750);
  });
});

describe("bucketByWeek", () => {
  it("returns newest-first Monday-start buckets", () => {
    const weeks = bucketByWeek(FIXTURE, GOAL);
    expect(weeks[0].key).toBe("2026-06-29");
    expect(weeks[0].entries).toHaveLength(7);
    expect(weeks[0].agg.daysHit).toBe(3);
    expect(weeks[0].agg.daysLogged).toBe(7);
  });

  it("assigns Sunday Jun 28 to the week starting Jun 22", () => {
    expect(isoDate(weekStart("2026-06-28"))).toBe("2026-06-22");
  });

  it("returns an empty list for empty input", () => {
    expect(bucketByWeek([], GOAL)).toEqual([]);
  });
});

describe("spansMultipleMonths", () => {
  it("is true for the June+July fixture", () => {
    expect(spansMultipleMonths(FIXTURE)).toBe(true);
  });

  it("is false for a single-month slice", () => {
    const julyOnly = FIXTURE.filter((e) => e.date.startsWith("2026-07"));
    expect(spansMultipleMonths(julyOnly)).toBe(false);
  });
});
