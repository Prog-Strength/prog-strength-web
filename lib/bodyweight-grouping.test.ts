/// <reference types="vitest/globals" />

import { groupByLocalDay, packDayGroupsIntoPages } from "./bodyweight-grouping";
import type { DayGroup } from "./bodyweight-grouping";
import type { BodyweightEntry } from "./api";

let nextId = 0;
function entry(weight: number, measured_at: string, unit: "lb" | "kg" = "lb"): BodyweightEntry {
  return { id: `e${nextId++}`, weight, unit, measured_at, created_at: measured_at };
}

describe("groupByLocalDay", () => {
  it("returns an empty array for no entries", () => {
    expect(groupByLocalDay([], "lb")).toEqual([]);
  });

  it("buckets readings by local calendar date, newest day first", () => {
    const groups = groupByLocalDay(
      [
        entry(180, "2026-06-12T08:00:00"),
        entry(181, "2026-06-14T08:00:00"),
        entry(179, "2026-06-13T08:00:00"),
      ],
      "lb",
    );
    expect(groups.map((g) => g.dateKey)).toEqual(["2026-06-14", "2026-06-13", "2026-06-12"]);
  });

  it("clusters multiple readings on one day into a single group with spread", () => {
    const groups = groupByLocalDay(
      [entry(180, "2026-06-15T07:30:00"), entry(183, "2026-06-15T22:15:00")],
      "lb",
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].readings).toHaveLength(2);
    expect(groups[0].readings.map((r) => r.id)).toEqual(["e3", "e4"]);
    expect(groups[0].average).toBeCloseTo(181.5, 5);
    expect(groups[0].spread).toBeCloseTo(3, 5);
  });

  it("gives a single-reading day a null spread", () => {
    const groups = groupByLocalDay([entry(180, "2026-06-15T07:30:00")], "lb");
    expect(groups[0].spread).toBeNull();
  });

  it("keeps a late-PM and an early-AM reading ~80 min apart on different nodes", () => {
    const groups = groupByLocalDay(
      [entry(180, "2026-06-15T23:24:00"), entry(181, "2026-06-16T00:44:00")],
      "lb",
    );
    expect(groups.map((g) => g.dateKey)).toEqual(["2026-06-16", "2026-06-15"]);
  });

  it("computes deltaVsPrevDay as average minus the chronologically previous day's average", () => {
    const groups = groupByLocalDay(
      [
        entry(180, "2026-06-12T08:00:00"),
        entry(178, "2026-06-13T08:00:00"),
        entry(179, "2026-06-14T08:00:00"),
      ],
      "lb",
    );
    expect(groups[0].deltaVsPrevDay).toBeCloseTo(1, 5);
    expect(groups[1].deltaVsPrevDay).toBeCloseTo(-2, 5);
    expect(groups[2].deltaVsPrevDay).toBeNull();
  });

  it("converts mixed units to the display unit before averaging", () => {
    const groups = groupByLocalDay(
      [entry(180, "2026-06-15T07:00:00", "lb"), entry(81.65, "2026-06-15T19:00:00", "kg")],
      "lb",
    );
    expect(groups[0].average).toBeCloseTo(180.005, 1);
    expect(groups[0].readings[1].unit).toBe("lb");
    expect(groups[0].readings[1].weight).toBeCloseTo(180.01, 1);
  });
});

function group(dateKey: string, readingCount: number): DayGroup {
  const readings = Array.from({ length: readingCount }, (_, i) => ({
    id: `${dateKey}-${i}`,
    weight: 180,
    unit: "lb" as const,
    measured_at: `${dateKey}T0${i}:00:00`,
  }));
  return { dateKey, readings, average: 180, spread: null, deltaVsPrevDay: null };
}

describe("packDayGroupsIntoPages", () => {
  it("returns no pages for no groups", () => {
    expect(packDayGroupsIntoPages([], 20)).toEqual([]);
  });

  it("keeps everything on one page when under the cap", () => {
    const pages = packDayGroupsIntoPages([group("2026-06-14", 2), group("2026-06-13", 1)], 20);
    expect(pages).toHaveLength(1);
    expect(pages[0].map((g) => g.dateKey)).toEqual(["2026-06-14", "2026-06-13"]);
  });

  it("moves a day that would straddle the cap wholly to the next page", () => {
    const pages = packDayGroupsIntoPages([group("2026-06-14", 18), group("2026-06-13", 5)], 20);
    expect(pages).toHaveLength(2);
    expect(pages[0].map((g) => g.dateKey)).toEqual(["2026-06-14"]);
    expect(pages[1].map((g) => g.dateKey)).toEqual(["2026-06-13"]);
  });

  it("never splits a single day's readings across pages", () => {
    const pages = packDayGroupsIntoPages([group("2026-06-14", 12), group("2026-06-13", 12)], 20);
    expect(pages).toHaveLength(2);
    expect(pages[0][0].readings).toHaveLength(12);
    expect(pages[1][0].readings).toHaveLength(12);
  });

  it("gives a day larger than the cap its own page", () => {
    const pages = packDayGroupsIntoPages([group("2026-06-14", 25), group("2026-06-13", 3)], 20);
    expect(pages).toHaveLength(2);
    expect(pages[0].map((g) => g.dateKey)).toEqual(["2026-06-14"]);
    expect(pages[1].map((g) => g.dateKey)).toEqual(["2026-06-13"]);
  });

  it("preserves newest-first ordering across pages", () => {
    const pages = packDayGroupsIntoPages(
      [group("2026-06-14", 15), group("2026-06-13", 10), group("2026-06-12", 10)],
      20,
    );
    expect(pages).toHaveLength(2);
    expect(pages[0].map((g) => g.dateKey)).toEqual(["2026-06-14"]);
    expect(pages[1].map((g) => g.dateKey)).toEqual(["2026-06-13", "2026-06-12"]);
  });
});
