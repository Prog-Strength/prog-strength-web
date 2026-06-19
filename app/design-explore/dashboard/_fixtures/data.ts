/**
 * Static fixtures for the dashboard Design Exploration (DX).
 *
 * THROWAWAY: these are hand-built mock objects that *look* like the shape the
 * real dashboard fan-out would assemble (see dx/dashboard.md → "The data
 * layer"). They are intentionally NOT wired to lib/api.ts — a DX comparison
 * route renders static fixtures, never live services. The chosen variant's
 * SOW will do the real parallel fetch + client aggregation.
 *
 * Three fixtures + a loading flag cover the range a landing page lives or dies
 * on: a full multi-sport user, a partial user (lifts + steps only), and the
 * brand-new/empty user. Numbers mirror the ticket's representative fixture.
 */

export type FixtureState = "full" | "partial" | "empty" | "loading";

export type RunningMetric = {
  weekDistanceMi: number;
  runCount: number;
  deltaPct: number | null; // vs prior week
  avgPace: string | null; // "10:06 /mi"
  latest: { name: string; distanceMi: number; duration: string } | null;
  spark: number[]; // last ~8 weeks distance
};

export type LiftingMetric = {
  weekTime: string; // "2:43"
  sessions: number;
  sets: number;
  prs: number;
  bestE1rm: { lift: string; value: number } | null; // est-1RM
  topSession: string | null; // e.g. "Week 2 Workout 1"
  spark: number[]; // weekly volume
};

export type StepsMetric = {
  avg: number;
  goal: number | null;
  today: number;
  spark: number[]; // last 7 days
};

export type NutritionMetric = {
  calories: number;
  calorieGoal: number | null;
  proteinG: number;
  proteinGoal: number | null;
  carbsG: number;
  fatG: number;
};

export type BodyweightMetric = {
  current: number;
  unit: "lb" | "kg";
  ratePerWeek: number; // -0.3 → trending down
  goal: number | null;
  spark: number[]; // recent trend points
};

export type StreakMetric = {
  weeks: number; // active weeks
  activeDaysThisWeek: number; // 0..7
  // Mon..Sun activity flags for the current week
  week: boolean[];
};

export type DashboardData = {
  greetingName: string;
  running: RunningMetric | null;
  lifting: LiftingMetric | null;
  steps: StepsMetric | null;
  nutrition: NutritionMetric | null;
  bodyweight: BodyweightMetric | null;
  // Streak is never null — a 0-week streak still reads intentionally
  // ("start your streak"), never as a broken empty.
  streak: StreakMetric;
};

/** Full multi-sport user — the ticket's representative fixture. */
export const FULL: DashboardData = {
  greetingName: "Jordan",
  running: {
    weekDistanceMi: 13.18,
    runCount: 3,
    deltaPct: 9,
    avgPace: "10:06 /mi",
    latest: { name: "Lunch Run", distanceMi: 5.25, duration: "53:04" },
    spark: [8.2, 11.0, 9.4, 12.1, 10.8, 12.0, 12.1, 13.18],
  },
  lifting: {
    weekTime: "2:43",
    sessions: 3,
    sets: 21,
    prs: 4,
    bestE1rm: { lift: "Bench", value: 326.9 },
    topSession: "Week 2 Workout 1",
    spark: [18200, 21400, 19800, 24100, 22600, 23800, 26200, 28900],
  },
  steps: {
    avg: 9400,
    goal: 10000,
    today: 14000,
    spark: [8200, 11400, 7600, 9900, 10300, 6800, 14000],
  },
  nutrition: {
    calories: 1840,
    calorieGoal: 2100,
    proteinG: 150,
    proteinGoal: 180,
    carbsG: 196,
    fatG: 61,
  },
  bodyweight: {
    current: 182.4,
    unit: "lb",
    ratePerWeek: -0.3,
    goal: 178,
    spark: [184.6, 184.1, 183.7, 183.2, 183.0, 182.7, 182.5, 182.4],
  },
  streak: {
    weeks: 25,
    activeDaysThisWeek: 3,
    week: [true, false, true, false, true, false, false],
  },
};

/** Partial user — lifts + steps only; everything else unset. */
export const PARTIAL: DashboardData = {
  greetingName: "Sam",
  running: null,
  lifting: {
    weekTime: "1:58",
    sessions: 2,
    sets: 14,
    prs: 1,
    bestE1rm: { lift: "Squat", value: 245.0 },
    topSession: "Lower A",
    spark: [9200, 11800, 10400, 12600, 11900, 13200, 12800, 14100],
  },
  steps: {
    avg: 7200,
    goal: null, // no goal set → "set a goal" affordance
    today: 5400,
    spark: [6100, 8200, 5400, 7800, 9100, 6400, 5400],
  },
  nutrition: null,
  bodyweight: null,
  streak: {
    weeks: 4,
    activeDaysThisWeek: 2,
    week: [true, true, false, false, false, false, false],
  },
};

/** Brand-new user — the first thing they ever see. Everything empty. */
export const EMPTY: DashboardData = {
  greetingName: "there",
  running: null,
  lifting: null,
  steps: null,
  nutrition: null,
  bodyweight: null,
  streak: {
    weeks: 0,
    activeDaysThisWeek: 0,
    week: [false, false, false, false, false, false, false],
  },
};

export function fixtureFor(state: FixtureState): DashboardData {
  switch (state) {
    case "partial":
      return PARTIAL;
    case "empty":
      return EMPTY;
    // "loading" still needs a shape behind the skeletons; full is fine since
    // variants paint skeletons and ignore the values while loading.
    case "loading":
    case "full":
    default:
      return FULL;
  }
}

/** Deep-page links each domain card points into (real app routes). */
export const DEEP_LINKS = {
  running: "/activities?view=running",
  lifting: "/workouts",
  steps: "/activities?view=steps",
  nutrition: "/nutrition",
  bodyweight: "/bodyweight",
  streak: "/activities",
} as const;

export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;
