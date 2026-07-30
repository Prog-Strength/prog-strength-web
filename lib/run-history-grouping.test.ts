import { describe, expect, it } from "vitest";
import type { RunningSession } from "./api";
import { groupRunsByMonthAndWeek, monthLabel, weekLabel } from "./run-history-grouping";

// Minimal RunningSession factory — only the fields the grouping reads
// (start_time, distance_meters, duration_seconds, id) matter; the rest are
// filled with inert defaults. Local-time start strings (no trailing Z) keep
// the Monday/month math tz-independent under test.
function makeRun(partial: Partial<RunningSession> & { id: string }): RunningSession {
  return {
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: `src-${partial.id}`,
    name: null,
    start_time: "2026-06-10T08:00:00",
    distance_meters: 1000,
    raw_distance_meters: 1000,
    environment: "outdoor",
    duration_seconds: 300,
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: null,
    max_heart_rate_bpm: null,
    total_calories: null,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: "2026-06-10T08:00:00",
    ...partial,
  };
}

describe("groupRunsByMonthAndWeek", () => {
  // 2026-06-01 is a Monday, so June weeks anchor on the 1st, 8th, 15th…,
  // and the week of Mon May 25 sits entirely in May (May 31 is a Sunday).
  const runs = [
    makeRun({
      id: "A",
      start_time: "2026-06-10T08:00:00",
      distance_meters: 5000,
      duration_seconds: 1800,
    }), // wk Jun 8
    makeRun({
      id: "B",
      start_time: "2026-06-09T08:00:00",
      distance_meters: 3000,
      duration_seconds: 1200,
    }), // wk Jun 8
    makeRun({
      id: "C",
      start_time: "2026-06-03T08:00:00",
      distance_meters: 4000,
      duration_seconds: 1500,
    }), // wk Jun 1
    makeRun({
      id: "D",
      start_time: "2026-05-27T08:00:00",
      distance_meters: 8000,
      duration_seconds: 2400,
    }), // wk May 25
  ];

  it("buckets by Monday-anchored week with cumulative distance/time/count", () => {
    const months = groupRunsByMonthAndWeek(runs);
    const june = months.find((m) => m.monthKey === "2026-06")!;
    const weekJun8 = june.weeks.find((w) => w.mondayKey === "2026-06-08")!;

    expect(weekJun8.count).toBe(2);
    expect(weekJun8.meters).toBe(8000);
    expect(weekJun8.durationSec).toBe(3000);
  });

  it("rolls weeks up into months with summed totals", () => {
    const months = groupRunsByMonthAndWeek(runs);
    const june = months.find((m) => m.monthKey === "2026-06")!;

    expect(june.weeks).toHaveLength(2); // wk Jun 8 + wk Jun 1
    expect(june.count).toBe(3);
    expect(june.meters).toBe(12000);
    expect(june.durationSec).toBe(4500);
  });

  it("orders months, weeks, and rows newest-first regardless of input order", () => {
    const shuffled = [runs[2], runs[0], runs[3], runs[1]];
    const months = groupRunsByMonthAndWeek(shuffled);

    expect(months.map((m) => m.monthKey)).toEqual(["2026-06", "2026-05"]);
    expect(months[0].weeks.map((w) => w.mondayKey)).toEqual(["2026-06-08", "2026-06-01"]);
    // Newest run first within the week.
    expect(months[0].weeks[0].runs.map((r) => r.id)).toEqual(["A", "B"]);
  });

  it("returns a single month group when the window spans one month", () => {
    const months = groupRunsByMonthAndWeek([runs[0], runs[1], runs[2]]);
    expect(months).toHaveLength(1);
    expect(months[0].monthKey).toBe("2026-06");
  });

  it("keeps a month-straddling week whole under the month of its Monday", () => {
    // Week of Mon Jun 29 spans Jun 29 – Jul 5; a Jul 1 run rolls into June,
    // and no July group is created (the week is never split across dividers).
    const straddle = [
      makeRun({ id: "X", start_time: "2026-06-30T08:00:00" }),
      makeRun({ id: "Y", start_time: "2026-07-01T08:00:00" }),
    ];
    const months = groupRunsByMonthAndWeek(straddle);

    expect(months.map((m) => m.monthKey)).toEqual(["2026-06"]);
    expect(months[0].weeks).toHaveLength(1);
    expect(months[0].weeks[0].count).toBe(2);
  });

  it("ignores empty input", () => {
    expect(groupRunsByMonthAndWeek([])).toEqual([]);
  });
});

describe("weekLabel / monthLabel", () => {
  const now = new Date(2026, 5, 8); // Mon Jun 8 2026, local

  it("labels the current and prior weeks relatively", () => {
    expect(weekLabel(new Date(2026, 5, 8), now)).toBe("This week");
    expect(weekLabel(new Date(2026, 5, 1), now)).toBe("Last week");
  });

  it("labels older weeks as 'Week of <Mon D>'", () => {
    expect(weekLabel(new Date(2026, 4, 25), now)).toBe("Week of May 25");
  });

  it("formats the month divider title", () => {
    expect(monthLabel(new Date(2026, 5, 1))).toBe("June 2026");
  });
});
