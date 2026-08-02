/**
 * Display adapter for the dashboard summary.
 *
 * GET /dashboard/summary returns native/metric values (distances in
 * meters, paces in sec/km) plus weights already in the user's stored
 * unit. This adapter converts that payload into a display-shaped view
 * model the dashboard page/components render directly — no further unit
 * math at the component level.
 *
 * The server already did all the aggregation/statistics; this layer is
 * pure conversion + formatting. Distances use the user's `distance_unit`
 * (mi/km) via the shared `formatDistanceValue`/`formatPaceValue` helpers;
 * weights pass through with the unit the server returned (the server
 * stores per-user units, so there's nothing to convert).
 *
 * Each null section becomes a discriminated-union empty marker
 * (`{ present: false }`) so the page can branch on `present` to render an
 * empty state. A null goal (no target set) and a brand-new all-zero
 * streak stay representable distinctly from a present-but-zero value.
 */

import type {
  BloodPressureCategory,
  DashboardBloodPressure,
  DashboardBodyweight,
  DashboardCycling,
  DashboardHiking,
  DashboardLifting,
  DashboardMacros,
  DashboardNutrition,
  DashboardRecovery,
  DashboardRunning,
  DashboardSteps,
  DashboardStreak,
  DashboardSummary,
  DashboardWalking,
  ResolvedProfile,
} from "@/lib/api";
import type { TileId } from "@/lib/dashboard-tiles";
import {
  formatDistanceValue,
  formatPaceValue,
  type DistanceUnit,
} from "@/lib/distance-unit-context";

const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;

/** Convert a metric distance (meters) to a finite display-unit number for charting. */
function distanceToDisplay(meters: number, unit: DistanceUnit): number {
  if (!Number.isFinite(meters)) return 0;
  const divisor = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  return meters / divisor;
}

/** A spark-line series carried as raw numbers (for charting) plus its display unit. */
export type SparkSeries = {
  /** Numbers in display units, oldest→newest. Always finite. */
  points: number[];
  unit: string;
};

/** Display view-model for the running widget. */
export type RunningView = {
  currentWeek: {
    distance: string; // display-unit numeric string, no suffix
    runCount: number;
    deltaPct: number | null; // signed % vs prior week; null when no prior week
  };
  pace: string; // "m:ss" in display unit, or "—"
  latestRun: {
    name: string | null;
    distance: string;
    durationSeconds: number;
    startTime: string;
  } | null;
  spark: SparkSeries; // weekly distances in display unit
  unit: DistanceUnit;
};

/**
 * Display view-model shared by the endurance widgets (walking/cycling).
 * Distances are display-unit strings/points; `unit` is the user's
 * display unit so the card can render the right suffix. `durationSeconds`
 * is this week's total moving time.
 */
export type EnduranceView = {
  currentWeek: { distance: string; sessionCount: number };
  durationSeconds: number;
  latest: {
    name: string | null;
    distance: string;
    durationSeconds: number;
    startTime: string;
  } | null;
  spark: SparkSeries; // weekly distances in display unit
  unit: DistanceUnit;
};

/** Display view-model for the walking widget. */
export type WalkingView = EnduranceView;

/** Display view-model for the cycling widget. */
export type CyclingView = EnduranceView;

/** Display view-model for the hiking widget — endurance plus elevation gain (meters). */
export type HikingView = EnduranceView & { elevationGainMeters: number };

/** Display view-model for the lifting widget. Weights stay in their stored unit. */
export type LiftingView = {
  currentWeek: {
    durationSeconds: number;
    sessions: number;
    sets: number;
    prs: number;
  };
  headline1rm: {
    exerciseName: string;
    value: number;
    unit: "lb" | "kg";
  } | null;
  spark: number[]; // weekly volume, oldest→newest (unitless tonnage proxy)
  unit: "lb" | "kg";
};

/** Display view-model for the steps widget. `goal` null = no goal set. */
export type StepsView = {
  avg: number;
  today: number;
  goal: number | null;
  spark: number[];
};

/** Display view-model for the nutrition widget. `goals` null = no goals set. */
export type NutritionView = {
  today: DashboardMacros;
  goals: DashboardMacros | null;
};

/** Display view-model for the bodyweight widget. Weights stay in their stored unit. */
export type BodyweightView = {
  current: number;
  unit: "lb" | "kg";
  ratePerWeek: number | null;
  goal: { weight: number; unit: "lb" | "kg" } | null;
  spark: number[]; // trend, oldest→newest, in the stored unit
};

/**
 * Display view-model for the blood-pressure widget. `latest` is the most
 * recent reading with its server-assigned `category`; `avg30` is the
 * trailing 30-day mean (null when none). `systolicSpark`/`diastolicSpark`
 * are the recent daily-average trends, oldest→newest.
 */
export type BloodPressureView = {
  latest: { systolic: number; diastolic: number; measured_at: string };
  category: BloodPressureCategory;
  avg30: { systolic: number; diastolic: number } | null;
  systolicSpark: number[];
  diastolicSpark: number[];
};

/**
 * Display view-model for the recovery widget (Whoop-sourced). Present only
 * for a connected user; the page renders NO card when absent. `restingToday`
 * / `recoveryScore` are null when Whoop has no reading yet today.
 */
export type RecoveryView = {
  restingToday: number | null;
  recoveryScore: number | null;
  spark: number[]; // resting-HR trend, oldest→newest
};

/**
 * Display view-model for the streak widget. Always present; `isNew`
 * distinguishes a brand-new (all-zero) streak from a present-but-zero
 * week so the page can render a distinct welcome state.
 */
export type StreakView = {
  weeks: number;
  activeDaysThisWeek: number;
  week: boolean[]; // Mon→Sun
  isNew: boolean; // true when zeroed (brand-new user)
};

/**
 * A section that may be absent. `present: false` is the empty-state
 * marker the page branches on; `present: true` carries the view-model.
 */
export type Section<T> = { present: false } | ({ present: true } & T);

/** The full dashboard display view-model — one entry per widget. */
export type DashboardData = {
  /** The ordered enabled tile ids from the server; `[]` when no layout. */
  layout: TileId[];
  running: Section<RunningView>;
  walking: Section<WalkingView>;
  cycling: Section<CyclingView>;
  hiking: Section<HikingView>;
  lifting: Section<LiftingView>;
  steps: Section<StepsView>;
  nutrition: Section<NutritionView>;
  bodyweight: Section<BodyweightView>;
  bloodPressure: Section<BloodPressureView>;
  recovery: Section<RecoveryView>;
  streak: StreakView; // always present
};

function sanitizeSpark(points: number[]): number[] {
  return points.map((n) => (Number.isFinite(n) ? n : 0));
}

function adaptRunning(running: DashboardRunning, unit: DistanceUnit): RunningView {
  return {
    currentWeek: {
      distance: formatDistanceValue(running.current_week.distance_meters, unit),
      runCount: running.current_week.run_count,
      deltaPct: running.current_week.delta_pct_vs_prior_week,
    },
    pace: formatPaceValue(running.recent_avg_pace_sec_per_km, unit),
    latestRun: running.latest_run
      ? {
          name: running.latest_run.name,
          distance: formatDistanceValue(running.latest_run.distance_meters, unit),
          durationSeconds: running.latest_run.duration_seconds,
          startTime: running.latest_run.start_time,
        }
      : null,
    spark: {
      points: running.weekly_distance_spark.map((m) => distanceToDisplay(m, unit)),
      unit,
    },
    unit,
  };
}

/** Shared endurance-shape adapter (walking/cycling; hiking extends it). */
function adaptEndurance(e: DashboardWalking, unit: DistanceUnit): EnduranceView {
  return {
    currentWeek: {
      distance: formatDistanceValue(e.current_week.distance_meters, unit),
      sessionCount: e.current_week.session_count,
    },
    durationSeconds: e.current_week.duration_seconds,
    latest: e.latest_session
      ? {
          name: e.latest_session.name,
          distance: formatDistanceValue(e.latest_session.distance_meters, unit),
          durationSeconds: e.latest_session.duration_seconds,
          startTime: e.latest_session.start_time,
        }
      : null,
    spark: {
      points: e.weekly_distance_spark.map((m) => distanceToDisplay(m, unit)),
      unit,
    },
    unit,
  };
}

function adaptWalking(walking: DashboardWalking, unit: DistanceUnit): WalkingView {
  return adaptEndurance(walking, unit);
}

function adaptCycling(cycling: DashboardCycling, unit: DistanceUnit): CyclingView {
  return adaptEndurance(cycling, unit);
}

function adaptHiking(hiking: DashboardHiking, unit: DistanceUnit): HikingView {
  return {
    ...adaptEndurance(hiking, unit),
    elevationGainMeters: hiking.elevation_gain_meters,
  };
}

function adaptLifting(lifting: DashboardLifting): LiftingView {
  return {
    currentWeek: {
      durationSeconds: lifting.current_week.duration_seconds,
      sessions: lifting.current_week.sessions,
      sets: lifting.current_week.sets,
      prs: lifting.current_week.prs,
    },
    headline1rm: lifting.headline_estimated_1rm
      ? {
          exerciseName: lifting.headline_estimated_1rm.exercise_name,
          value: lifting.headline_estimated_1rm.value,
          unit: lifting.headline_estimated_1rm.unit,
        }
      : null,
    spark: sanitizeSpark(lifting.weekly_volume_spark),
    unit: lifting.unit,
  };
}

function adaptSteps(steps: DashboardSteps): StepsView {
  return {
    avg: steps.avg,
    today: steps.today,
    goal: steps.goal,
    spark: sanitizeSpark(steps.daily_spark),
  };
}

function adaptNutrition(nutrition: DashboardNutrition): NutritionView {
  return {
    today: nutrition.today,
    goals: nutrition.goals,
  };
}

function adaptBodyweight(bodyweight: DashboardBodyweight): BodyweightView {
  return {
    current: bodyweight.current,
    unit: bodyweight.unit,
    ratePerWeek: bodyweight.rate_per_week,
    goal: bodyweight.goal,
    spark: sanitizeSpark(bodyweight.trend_spark),
  };
}

function adaptBloodPressure(bp: DashboardBloodPressure): BloodPressureView {
  return {
    latest: {
      systolic: bp.latest.systolic,
      diastolic: bp.latest.diastolic,
      measured_at: bp.latest.measured_at,
    },
    category: bp.category,
    avg30: bp.avg_30d,
    systolicSpark: sanitizeSpark(bp.systolic_spark),
    diastolicSpark: sanitizeSpark(bp.diastolic_spark),
  };
}

function adaptRecovery(recovery: DashboardRecovery): RecoveryView {
  return {
    restingToday: recovery.today?.resting_heart_rate ?? null,
    recoveryScore: recovery.today?.recovery_score ?? null,
    spark: sanitizeSpark(recovery.resting_hr_spark),
  };
}

function adaptStreak(streak: DashboardStreak): StreakView {
  const isNew =
    streak.weeks === 0 &&
    streak.active_days_this_week === 0 &&
    streak.week.every((active) => !active);
  return {
    weeks: streak.weeks,
    activeDaysThisWeek: streak.active_days_this_week,
    week: streak.week,
    isNew,
  };
}

/**
 * Convert the server's dashboard summary into the display view-model.
 * Pure: distances → the user's `distance_unit`; weights pass through.
 * A null summary (no payload) collapses every section to its empty
 * marker and yields a brand-new streak.
 */
export function adaptDashboard(
  summary: DashboardSummary | null,
  profile: ResolvedProfile,
): DashboardData {
  const distanceUnit = profile.distance_unit;

  if (!summary) {
    return {
      layout: [],
      running: { present: false },
      walking: { present: false },
      cycling: { present: false },
      hiking: { present: false },
      lifting: { present: false },
      steps: { present: false },
      nutrition: { present: false },
      bodyweight: { present: false },
      bloodPressure: { present: false },
      recovery: { present: false },
      streak: { weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true },
    };
  }

  return {
    layout: summary.layout ?? [],
    running: summary.running
      ? { present: true, ...adaptRunning(summary.running, distanceUnit) }
      : { present: false },
    walking: summary.walking
      ? { present: true, ...adaptWalking(summary.walking, distanceUnit) }
      : { present: false },
    cycling: summary.cycling
      ? { present: true, ...adaptCycling(summary.cycling, distanceUnit) }
      : { present: false },
    hiking: summary.hiking
      ? { present: true, ...adaptHiking(summary.hiking, distanceUnit) }
      : { present: false },
    lifting: summary.lifting
      ? { present: true, ...adaptLifting(summary.lifting) }
      : { present: false },
    steps: summary.steps ? { present: true, ...adaptSteps(summary.steps) } : { present: false },
    nutrition: summary.nutrition
      ? { present: true, ...adaptNutrition(summary.nutrition) }
      : { present: false },
    bodyweight: summary.bodyweight
      ? { present: true, ...adaptBodyweight(summary.bodyweight) }
      : { present: false },
    bloodPressure: summary.blood_pressure
      ? { present: true, ...adaptBloodPressure(summary.blood_pressure) }
      : { present: false },
    recovery: summary.recovery
      ? { present: true, ...adaptRecovery(summary.recovery) }
      : { present: false },
    streak: summary.streak
      ? adaptStreak(summary.streak)
      : { weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true },
  };
}
