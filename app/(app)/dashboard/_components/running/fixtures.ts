/**
 * RunningView fixtures for the four SOW states, in both units. View-level on
 * purpose (like recovery/fixtures.ts): component tests assert rendering, not
 * conversion — lib/dashboard.test.ts owns the adapter. The ordinary week
 * mirrors the DX headline fixture: 4 runs, one indoor treadmill (no
 * elevation), one with no HR, one 12.7 mi long run — three awkward states
 * visible in the default view.
 */

import type { DistanceUnit } from "@/lib/distance-unit-context";
import type { RunningView, RunningWeekPointView, RunningWeekRunView } from "@/lib/dashboard";

function load(
  unit: DistanceUnit,
  weeks: [string, number, number, number][],
): RunningWeekPointView[] {
  const div = unit === "mi" ? 1609.344 : 1000;
  return weeks.map(([weekStart, meters, durationSeconds, runCount]) => ({
    weekStart,
    distance: meters / div,
    durationSeconds,
    runCount,
  }));
}

const WEEKS: [string, number, number, number][] = [
  ["2026-06-08", 24140, 9180, 3],
  ["2026-06-15", 27359, 10230, 4],
  ["2026-06-22", 21726, 8220, 3],
  ["2026-06-29", 24140, 9180, 3],
  ["2026-07-06", 29772, 11310, 4],
  ["2026-07-13", 0, 0, 0], // down week — a real zero
  ["2026-07-20", 30900, 11760, 4],
  ["2026-07-27", 34278, 12977, 4],
];

function weekRuns(unit: DistanceUnit): RunningWeekRunView[] {
  const mi = unit === "mi";
  return [
    {
      activityId: "a1",
      name: "Easy shakeout",
      localDate: "2026-07-27",
      startTime: "2026-07-27T11:00:00Z",
      distance: mi ? "3.5" : "5.6",
      durationSeconds: 2128,
      pace: mi ? "10:08" : "6:18",
      paceSecPerKm: 377.8,
      avgHeartRate: 148,
      heartRateZone: 2,
      elevation: mi ? "125 ft" : "38 m",
      elevationGainMeters: 38,
      indoor: false,
    },
    {
      activityId: "a2",
      name: null,
      localDate: "2026-07-28",
      startTime: "2026-07-28T10:30:00Z",
      distance: mi ? "2.6" : "4.2",
      durationSeconds: 1490,
      pace: mi ? "9:33" : "5:56",
      paceSecPerKm: 356.1,
      avgHeartRate: 152,
      heartRateZone: 3,
      elevation: null, // treadmill: the source carried no altitude
      elevationGainMeters: null,
      indoor: true,
    },
    {
      activityId: "a3",
      name: "Lunch run",
      localDate: "2026-07-30",
      startTime: "2026-07-30T16:15:00Z",
      distance: mi ? "2.5" : "4.0",
      durationSeconds: 1575,
      pace: mi ? "10:30" : "6:32",
      paceSecPerKm: 391.5,
      avgHeartRate: null, // manual import: no HR
      heartRateZone: null,
      elevation: mi ? "72 ft" : "22 m",
      elevationGainMeters: 22,
      indoor: false,
    },
    {
      activityId: "a4",
      name: "Saturday long run",
      localDate: "2026-08-01",
      startTime: "2026-08-01T11:02:00Z",
      distance: mi ? "12.7" : "20.4",
      durationSeconds: 7784,
      pace: mi ? "10:13" : "6:21",
      paceSecPerKm: 380.9,
      avgHeartRate: 156,
      heartRateZone: 3,
      elevation: mi ? "702 ft" : "214 m",
      elevationGainMeters: 214,
      indoor: false,
    },
  ];
}

/** An ordinary training week: 21.3 mi over 4 runs, +24% time on feet. */
export function ordinaryWeek(unit: DistanceUnit = "mi"): RunningView {
  const mi = unit === "mi";
  return {
    currentWeek: {
      distance: mi ? "21.3" : "34.3",
      runCount: 4,
      deltaPct: 10.9,
      durationSeconds: 12977,
      pace: mi ? "10:09" : "6:19",
      avgHeartRate: 153,
      elevation: mi ? "899 ft" : "274 m",
      heartRateRuns: 3,
      elevationRuns: 3,
      longestRun: mi ? "12.7" : "20.4",
      daysRun: 4,
    },
    pace: mi ? "10:06" : "6:17",
    baseline: {
      windowWeeks: 4,
      weeks: 3,
      distance: mi ? "17.0" : "27.4",
      durationSeconds: 10440,
      pace: mi ? "10:13" : "6:21",
      paceSecPerKm: 381.2,
      avgHeartRate: 150,
      elevation: mi ? "650 ft" : "198 m",
      runsPerWeek: 3.75,
    },
    latestRun: {
      name: "Saturday long run",
      distance: mi ? "12.7" : "20.4",
      durationSeconds: 7784,
      startTime: "2026-08-01T11:02:00Z",
    },
    weekRuns: weekRuns(unit),
    weeklyLoad: load(unit, WEEKS),
    unit,
  };
}

/** Monday morning / a skipped week: zero runs, baseline intact, last run 5 days old. */
export function zeroRuns(unit: DistanceUnit = "mi"): RunningView {
  const base = ordinaryWeek(unit);
  return {
    ...base,
    currentWeek: {
      distance: "0.0",
      runCount: 0,
      deltaPct: -100,
      durationSeconds: 0,
      pace: "—",
      avgHeartRate: null,
      elevation: null,
      heartRateRuns: 0,
      elevationRuns: 0,
      longestRun: "0.0",
      daysRun: 0,
    },
    latestRun: {
      name: "Saturday long run",
      distance: unit === "mi" ? "12.7" : "20.4",
      durationSeconds: 7784,
      startTime: "2026-08-01T11:02:00Z",
    },
    weekRuns: [],
    weeklyLoad: load(unit, [...WEEKS.slice(1), ["2026-08-03", 0, 0, 0]]),
  };
}

/** A brand-new runner: one run ever, no baseline, no delta, load almost all zeros. */
export function firstRunEver(unit: DistanceUnit = "mi"): RunningView {
  const mi = unit === "mi";
  return {
    currentWeek: {
      distance: mi ? "3.5" : "5.6",
      runCount: 1,
      deltaPct: null,
      durationSeconds: 2128,
      pace: mi ? "10:08" : "6:18",
      avgHeartRate: 148,
      elevation: mi ? "125 ft" : "38 m",
      heartRateRuns: 1,
      elevationRuns: 1,
      longestRun: mi ? "3.5" : "5.6",
      daysRun: 1,
    },
    pace: mi ? "10:08" : "6:18",
    baseline: null,
    latestRun: {
      name: "First run",
      distance: mi ? "3.5" : "5.6",
      durationSeconds: 2128,
      startTime: "2026-07-27T11:00:00Z",
    },
    weekRuns: [weekRuns(unit)[0]],
    weeklyLoad: load(unit, [
      ["2026-06-08", 0, 0, 0],
      ["2026-06-15", 0, 0, 0],
      ["2026-06-22", 0, 0, 0],
      ["2026-06-29", 0, 0, 0],
      ["2026-07-06", 0, 0, 0],
      ["2026-07-13", 0, 0, 0],
      ["2026-07-20", 0, 0, 0],
      ["2026-07-27", 5633, 2128, 1],
    ]),
    unit,
  };
}

/** An indoor-only week: three treadmill runs, every elevation null, HR intact. */
export function indoorOnly(unit: DistanceUnit = "mi"): RunningView {
  const base = ordinaryWeek(unit);
  const treadmill = weekRuns(unit)[1];
  const runs: RunningWeekRunView[] = [
    { ...treadmill, activityId: "t1", localDate: "2026-07-27", heartRateZone: 2 },
    { ...treadmill, activityId: "t2", localDate: "2026-07-29", avgHeartRate: 149 },
    { ...treadmill, activityId: "t3", localDate: "2026-07-31", avgHeartRate: 155 },
  ];
  return {
    ...base,
    currentWeek: {
      ...base.currentWeek,
      runCount: 3,
      elevation: null, // nil — not "0 ft" — no run carried altitude
      elevationRuns: 0,
      heartRateRuns: 3,
      daysRun: 3,
    },
    weekRuns: runs,
  };
}
