/// <reference types="vitest/globals" />

import {
  startOfWeek,
  weekDayTotals,
  computeWeekStats,
  computeStreakDays,
  type DatedActivity,
} from "./weekStats";

describe("startOfWeek", () => {
  it("returns the Monday 00:00 of the week containing the date", () => {
    // 2026-06-17 is a Wednesday
    const mon = startOfWeek(new Date("2026-06-17T15:00:00"));
    expect(mon.getFullYear()).toBe(2026);
    expect(mon.getMonth()).toBe(5); // June
    expect(mon.getDate()).toBe(15); // Monday
    expect(mon.getHours()).toBe(0);
  });

  it("treats Sunday as the last day of the prior Monday week", () => {
    const mon = startOfWeek(new Date("2026-06-21T09:00:00")); // Sunday
    expect(mon.getDate()).toBe(15);
  });
});

describe("weekDayTotals", () => {
  it("buckets activities into 7 Monday→Sunday day counts", () => {
    const weekStart = startOfWeek(new Date("2026-06-17T00:00:00"));
    const acts: DatedActivity[] = [
      { at: "2026-06-15T08:00:00", kind: "lift" }, // Mon
      { at: "2026-06-15T18:00:00", kind: "run" }, // Mon
      { at: "2026-06-17T07:00:00", kind: "run" }, // Wed
    ];
    expect(weekDayTotals(acts, weekStart)).toEqual([2, 0, 1, 0, 0, 0, 0]);
  });
});

describe("computeWeekStats", () => {
  it("totals lift count and run distance/count within the current week", () => {
    const now = new Date("2026-06-17T12:00:00");
    const stats = computeWeekStats(
      [{ at: "2026-06-16T10:00:00", kind: "lift" }],
      [{ at: "2026-06-15T06:00:00", kind: "run", distanceMeters: 5000 }],
      now,
    );
    expect(stats.liftCount).toBe(1);
    expect(stats.runCount).toBe(1);
    expect(stats.runMeters).toBe(5000);
    expect(stats.dayBars).toEqual([1, 1, 0, 0, 0, 0, 0]); // Mon=run, Tue=lift
  });
});

describe("computeStreakDays", () => {
  it("counts consecutive days up to today that have an activity", () => {
    const today = new Date("2026-06-17T12:00:00"); // Wed
    const days = computeStreakDays(
      [
        { at: "2026-06-17T06:00:00", kind: "run" },
        { at: "2026-06-16T06:00:00", kind: "lift" },
        { at: "2026-06-15T06:00:00", kind: "run" },
        // gap on 2026-06-13
        { at: "2026-06-12T06:00:00", kind: "run" },
      ],
      today,
    );
    expect(days).toBe(3); // 17,16,15
  });

  it("returns 0 when nothing happened today or yesterday", () => {
    const today = new Date("2026-06-17T12:00:00");
    expect(computeStreakDays([{ at: "2026-06-10T06:00:00", kind: "run" }], today)).toBe(0);
  });
});
