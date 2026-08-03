/**
 * DX fixtures — dx/running-tile. THROWAWAY.
 *
 * Static, realistic fixtures in the shape the DX ticket proposes for the
 * extended `RunningSection` payload (camelCase mirror of the Go contract in
 * prog-strength-docs/dx/running-tile.md). All figures are METRIC — meters,
 * seconds, sec/km — and every variant formats them through the shared
 * `formatDistanceValue` / `formatPaceValue` / `formatElevationValue` helpers
 * so each mockup can be checked in both `mi` and `km`.
 *
 * Four states, per the ticket's "states every variant must render":
 *   ordinary   — 4 runs, one 12.7 mi long run (59% of the week), a treadmill
 *                run with no elevation, and a run with no HR
 *   zero       — no runs this week; latest run five days back; baseline intact
 *   first-run  — one run ever: baseline nil, delta nil, load history zeros
 *   indoor     — three treadmill runs, every elevation nil, one without HR
 */

export type DxWeekRun = {
  localDate: string; // YYYY-MM-DD in the user's tz
  name: string | null;
  distanceMeters: number;
  durationSeconds: number;
  avgPaceSecPerKm: number | null;
  avgHeartRateBpm: number | null;
  elevationGainMeters: number | null; // null = source carried no altitude
  environment: "outdoor" | "indoor";
};

export type DxWeekPoint = {
  weekStart: string; // YYYY-MM-DD, local Monday
  distanceMeters: number;
  durationSeconds: number;
  runCount: number;
  elevationGainMeters: number | null;
};

export type DxBaseline = {
  windowWeeks: number; // 4
  weeks: number; // weeks with ≥1 run behind it
  distanceMeters: number | null;
  durationSeconds: number | null;
  avgPaceSecPerKm: number | null;
  avgHeartRateBpm: number | null;
  elevationGainMeters: number | null;
  runsPerWeek: number | null;
};

export type DxRunningFixture = {
  key: string;
  label: string; // comparison-route column label
  currentWeek: {
    distanceMeters: number;
    runCount: number;
    deltaPctVsPriorWeek: number | null;
    durationSeconds: number;
    avgPaceSecPerKm: number | null; // THIS WEEK's aggregate — not the 30-day figure
    avgHeartRateBpm: number | null; // duration-weighted over HR-bearing runs
    elevationGainMeters: number | null; // null when NO run carried altitude
    heartRateRuns: number;
    elevationRuns: number;
    longestRunMeters: number;
    daysRun: number;
  };
  recentAvgPaceSecPerKm: number | null; // 30-DAY aggregate — label it as such
  latestRun: {
    name: string | null;
    distanceMeters: number;
    durationSeconds: number;
    localDate: string;
  } | null;
  /** Days between "now" and latestRun. Static (fixtures, not clocks). */
  daysSinceLastRun: number | null;
  weekRuns: DxWeekRun[]; // this local week, oldest→newest
  weeklyLoad: DxWeekPoint[]; // 8 buckets, oldest→newest, current week last
  baseline: DxBaseline | null; // nil until a prior week has a run
};

/** Short weekday label from a local date, e.g. "Sat". */
export function weekdayShort(localDate: string): string {
  const d = new Date(`${localDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

/** The headline week: Mon 2026-07-27, a real ramp driven by one long run. */
export const ORDINARY_WEEK: DxRunningFixture = {
  key: "ordinary",
  label: "Ordinary week",
  currentWeek: {
    distanceMeters: 34278, // 21.30 mi
    runCount: 4,
    deltaPctVsPriorWeek: 10.9,
    durationSeconds: 12977, // 3:36:17
    avgPaceSecPerKm: 378.6, // 10:09 /mi — this week
    avgHeartRateBpm: 153, // duration-weighted over the 3 HR-bearing runs
    elevationGainMeters: 274, // 899 ft, from the 3 outdoor runs
    heartRateRuns: 3,
    elevationRuns: 3,
    longestRunMeters: 20438, // 12.70 mi
    daysRun: 4,
  },
  recentAvgPaceSecPerKm: 376.6, // 10:06 /mi — 30-day
  latestRun: {
    name: "Saturday long run",
    distanceMeters: 20438,
    durationSeconds: 7784,
    localDate: "2026-08-01",
  },
  daysSinceLastRun: 1,
  weekRuns: [
    {
      localDate: "2026-07-27",
      name: "Easy shakeout",
      distanceMeters: 5633,
      durationSeconds: 2128,
      avgPaceSecPerKm: 377.8,
      avgHeartRateBpm: 148,
      elevationGainMeters: 38,
      environment: "outdoor",
    },
    {
      localDate: "2026-07-28",
      name: null,
      distanceMeters: 4184,
      durationSeconds: 1490,
      avgPaceSecPerKm: 356.1,
      avgHeartRateBpm: 152,
      elevationGainMeters: null, // treadmill — no altitude, not zero
      environment: "indoor",
    },
    {
      localDate: "2026-07-30",
      name: "Lunch run",
      distanceMeters: 4023,
      durationSeconds: 1575,
      avgPaceSecPerKm: 391.5,
      avgHeartRateBpm: null, // manual import — no HR
      elevationGainMeters: 22,
      environment: "outdoor",
    },
    {
      localDate: "2026-08-01",
      name: "Saturday long run",
      distanceMeters: 20438,
      durationSeconds: 7784,
      avgPaceSecPerKm: 380.9,
      avgHeartRateBpm: 156,
      elevationGainMeters: 214,
      environment: "outdoor",
    },
  ],
  weeklyLoad: [
    {
      weekStart: "2026-06-08",
      distanceMeters: 25105,
      durationSeconds: 9540,
      runCount: 3,
      elevationGainMeters: 142,
    },
    {
      weekStart: "2026-06-15",
      distanceMeters: 27359,
      durationSeconds: 10380,
      runCount: 4,
      elevationGainMeters: 188,
    },
    {
      weekStart: "2026-06-22",
      distanceMeters: 20921,
      durationSeconds: 7980,
      runCount: 3,
      elevationGainMeters: 121,
    },
    {
      weekStart: "2026-06-29",
      distanceMeters: 24140,
      durationSeconds: 9180,
      runCount: 3,
      elevationGainMeters: 156,
    },
    {
      weekStart: "2026-07-06",
      distanceMeters: 29772,
      durationSeconds: 11310,
      runCount: 4,
      elevationGainMeters: 203,
    },
    {
      weekStart: "2026-07-13",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    }, // down week
    {
      weekStart: "2026-07-20",
      distanceMeters: 30900,
      durationSeconds: 11760,
      runCount: 4,
      elevationGainMeters: 231,
    },
    {
      weekStart: "2026-07-27",
      distanceMeters: 34278,
      durationSeconds: 12977,
      runCount: 4,
      elevationGainMeters: 274,
    },
  ],
  baseline: {
    windowWeeks: 4,
    weeks: 3,
    distanceMeters: 27358, // 17.0 mi/wk
    durationSeconds: 10440, // 2:54
    avgPaceSecPerKm: 381.2, // 10:13 /mi
    avgHeartRateBpm: 150,
    elevationGainMeters: 198, // 650 ft
    runsPerWeek: 3.75,
  },
};

/** Monday-morning / taper state: nothing this week, latest run 5 days back. */
export const ZERO_RUNS: DxRunningFixture = {
  key: "zero",
  label: "Zero runs this week",
  currentWeek: {
    distanceMeters: 0,
    runCount: 0,
    deltaPctVsPriorWeek: null,
    durationSeconds: 0,
    avgPaceSecPerKm: null,
    avgHeartRateBpm: null,
    elevationGainMeters: null,
    heartRateRuns: 0,
    elevationRuns: 0,
    longestRunMeters: 0,
    daysRun: 0,
  },
  recentAvgPaceSecPerKm: 376.6,
  latestRun: {
    name: "Saturday long run",
    distanceMeters: 20438,
    durationSeconds: 7784,
    localDate: "2026-07-25",
  },
  daysSinceLastRun: 5,
  weekRuns: [],
  weeklyLoad: [
    {
      weekStart: "2026-06-08",
      distanceMeters: 25105,
      durationSeconds: 9540,
      runCount: 3,
      elevationGainMeters: 142,
    },
    {
      weekStart: "2026-06-15",
      distanceMeters: 27359,
      durationSeconds: 10380,
      runCount: 4,
      elevationGainMeters: 188,
    },
    {
      weekStart: "2026-06-22",
      distanceMeters: 20921,
      durationSeconds: 7980,
      runCount: 3,
      elevationGainMeters: 121,
    },
    {
      weekStart: "2026-06-29",
      distanceMeters: 24140,
      durationSeconds: 9180,
      runCount: 3,
      elevationGainMeters: 156,
    },
    {
      weekStart: "2026-07-06",
      distanceMeters: 29772,
      durationSeconds: 11310,
      runCount: 4,
      elevationGainMeters: 203,
    },
    {
      weekStart: "2026-07-13",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-20",
      distanceMeters: 30900,
      durationSeconds: 11760,
      runCount: 4,
      elevationGainMeters: 231,
    },
    {
      weekStart: "2026-07-27",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
  ],
  baseline: {
    windowWeeks: 4,
    weeks: 3,
    distanceMeters: 27358,
    durationSeconds: 10440,
    avgPaceSecPerKm: 381.2,
    avgHeartRateBpm: 150,
    elevationGainMeters: 198,
    runsPerWeek: 3.75,
  },
};

/** A brand-new runner: one run ever. Baseline nil, delta nil, history zeros. */
export const FIRST_RUN_EVER: DxRunningFixture = {
  key: "first-run",
  label: "First run ever",
  currentWeek: {
    distanceMeters: 4160, // 2.6 mi
    runCount: 1,
    deltaPctVsPriorWeek: null,
    durationSeconds: 1712, // 28:32
    avgPaceSecPerKm: 411.5, // 11:02 /mi
    avgHeartRateBpm: 164, // new-runner HR
    elevationGainMeters: 18,
    heartRateRuns: 1,
    elevationRuns: 1,
    longestRunMeters: 4160,
    daysRun: 1,
  },
  recentAvgPaceSecPerKm: null, // no 30-day window yet
  latestRun: {
    name: "First run",
    distanceMeters: 4160,
    durationSeconds: 1712,
    localDate: "2026-07-28",
  },
  daysSinceLastRun: 4,
  weekRuns: [
    {
      localDate: "2026-07-28",
      name: "First run",
      distanceMeters: 4160,
      durationSeconds: 1712,
      avgPaceSecPerKm: 411.5,
      avgHeartRateBpm: 164,
      elevationGainMeters: 18,
      environment: "outdoor",
    },
  ],
  weeklyLoad: [
    {
      weekStart: "2026-06-08",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-06-15",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-06-22",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-06-29",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-06",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-13",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-20",
      distanceMeters: 0,
      durationSeconds: 0,
      runCount: 0,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-27",
      distanceMeters: 4160,
      durationSeconds: 1712,
      runCount: 1,
      elevationGainMeters: 18,
    },
  ],
  baseline: null,
};

/** A committed treadmill runner: three indoor runs, no altitude anywhere. */
export const INDOOR_ONLY: DxRunningFixture = {
  key: "indoor",
  label: "Indoor only",
  currentWeek: {
    distanceMeters: 16093, // 10.0 mi
    runCount: 3,
    deltaPctVsPriorWeek: -8.2,
    durationSeconds: 5920, // 1:38:40
    avgPaceSecPerKm: 367.9, // 9:52 /mi
    avgHeartRateBpm: 149, // duration-weighted over the 2 HR-bearing runs
    elevationGainMeters: null, // NO run carried altitude — null, never 0
    heartRateRuns: 2,
    elevationRuns: 0,
    longestRunMeters: 6437,
    daysRun: 3,
  },
  recentAvgPaceSecPerKm: 372.4, // 9:59 /mi
  latestRun: {
    name: "Treadmill intervals",
    distanceMeters: 6437,
    durationSeconds: 2280,
    localDate: "2026-07-31",
  },
  daysSinceLastRun: 2,
  weekRuns: [
    {
      localDate: "2026-07-27",
      name: null,
      distanceMeters: 4828,
      durationSeconds: 1815,
      avgPaceSecPerKm: 375.9,
      avgHeartRateBpm: 146,
      elevationGainMeters: null,
      environment: "indoor",
    },
    {
      localDate: "2026-07-29",
      name: "Easy treadmill",
      distanceMeters: 4828,
      durationSeconds: 1825,
      avgPaceSecPerKm: 378.0,
      avgHeartRateBpm: null, // gym treadmill, no strap
      elevationGainMeters: null,
      environment: "indoor",
    },
    {
      localDate: "2026-07-31",
      name: "Treadmill intervals",
      distanceMeters: 6437,
      durationSeconds: 2280,
      avgPaceSecPerKm: 354.2,
      avgHeartRateBpm: 152,
      elevationGainMeters: null,
      environment: "indoor",
    },
  ],
  weeklyLoad: [
    {
      weekStart: "2026-06-08",
      distanceMeters: 16093,
      durationSeconds: 6000,
      runCount: 3,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-06-15",
      distanceMeters: 17703,
      durationSeconds: 6540,
      runCount: 3,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-06-22",
      distanceMeters: 14484,
      durationSeconds: 5400,
      runCount: 3,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-06-29",
      distanceMeters: 17703,
      durationSeconds: 6480,
      runCount: 3,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-06",
      distanceMeters: 16093,
      durationSeconds: 5940,
      runCount: 3,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-13",
      distanceMeters: 19312,
      durationSeconds: 7080,
      runCount: 4,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-20",
      distanceMeters: 17530,
      durationSeconds: 6420,
      runCount: 3,
      elevationGainMeters: null,
    },
    {
      weekStart: "2026-07-27",
      distanceMeters: 16093,
      durationSeconds: 5920,
      runCount: 3,
      elevationGainMeters: null,
    },
  ],
  baseline: {
    windowWeeks: 4,
    weeks: 4,
    distanceMeters: 17660,
    durationSeconds: 6480, // 1:48
    avgPaceSecPerKm: 370.1, // 9:56 /mi
    avgHeartRateBpm: 148,
    elevationGainMeters: null, // indoor history — no altitude to average
    runsPerWeek: 3.25,
  },
};

export const ALL_FIXTURES: DxRunningFixture[] = [
  ORDINARY_WEEK,
  ZERO_RUNS,
  FIRST_RUN_EVER,
  INDOOR_ONLY,
];
