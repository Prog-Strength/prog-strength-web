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
  DashboardRunningBaseline,
  DashboardRunningWeekRun,
  DashboardSteps,
  DashboardStreak,
  DashboardSummary,
  DashboardWalking,
  ResolvedProfile,
} from "@/lib/api";
import type { TileId } from "@/lib/dashboard-tiles";
import {
  formatDistanceValue,
  formatElevationValue,
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

/** One of this week's runs, display-shaped. Raw sec/km and metres are kept
 * alongside the display strings ONLY for unit-free comparisons and chart
 * proportions (ratios of two server figures) — never for re-conversion. */
export type RunningWeekRunView = {
  activityId: string;
  name: string | null;
  localDate: string; // YYYY-MM-DD
  startTime: string;
  distance: string; // display-unit numeric string, no suffix
  durationSeconds: number;
  pace: string; // "m:ss" in display unit, or "—"
  paceSecPerKm: number | null;
  avgHeartRate: number | null;
  heartRateZone: number | null; // 1..5, null unless Run Effort enabled
  elevation: string | null; // display string with suffix; null = source carried none
  elevationGainMeters: number | null;
  indoor: boolean;
};

export type RunningWeekPointView = {
  weekStart: string; // YYYY-MM-DD, local Monday
  distance: number; // display-unit numeric, for charting
  durationSeconds: number;
  runCount: number;
};

/** Trailing 4-week averages excluding the current week; null until a prior
 * week holds a run. `weeks` is the denominator actually used (weeks with a
 * run), so tiles can caption "4-wk avg · 3 weeks" honestly. */
export type RunningBaselineView = {
  windowWeeks: number;
  weeks: number;
  distance: string | null;
  durationSeconds: number | null;
  pace: string | null;
  paceSecPerKm: number | null;
  avgHeartRate: number | null;
  elevation: string | null;
  runsPerWeek: number | null;
};

/** Display view-model for the running-family tiles. */
export type RunningView = {
  currentWeek: {
    distance: string;
    runCount: number;
    deltaPct: number | null;
    durationSeconds: number;
    pace: string; // THIS WEEK's aggregate — label distinctly from `pace` below
    avgHeartRate: number | null; // duration-weighted
    elevation: string | null; // null = no run carried altitude (≠ "0 ft")
    heartRateRuns: number;
    elevationRuns: number;
    longestRun: string;
    daysRun: number;
  };
  pace: string; // 30-DAY aggregate — labelled "30d", never "this week"
  baseline: RunningBaselineView | null;
  latestRun: {
    name: string | null;
    distance: string;
    durationSeconds: number;
    startTime: string;
  } | null;
  weekRuns: RunningWeekRunView[]; // oldest→newest
  weeklyLoad: RunningWeekPointView[]; // 8 buckets, oldest→newest
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

export type RecoveryHrvStatus = "balanced" | "elevated" | "suppressed" | "unknown";
export type RecoveryTrendDirection = "rising" | "falling" | "steady" | "unknown";

/** A single date-aligned day in the recovery history; nulls preserved as null. */
export type RecoveryDayPoint = {
  date: string; // YYYY-MM-DD, local
  restingHr: number | null;
  recoveryScore: number | null;
  hrv: number | null; // ms
};

/** Trailing baselines behind the tile; averages null until calibrated. */
export type RecoveryBaselineView = {
  windowDays: number;
  restingHrAvg: number | null;
  restingHrDays: number;
  hrvAvg: number | null;
  hrvStdDev: number | null;
  hrvDays: number;
  recoveryScoreAvg: number | null;
  recoveryScoreDays: number;
};

/** Today's HRV vs the user's own baseline; bounds/z agree with status. */
export type RecoveryHrvView = {
  status: RecoveryHrvStatus;
  balancedLow: number | null;
  balancedHigh: number | null;
  zScore: number | null;
  trend: RecoveryTrendDirection;
  shortAvg: number | null;
};

/**
 * Display view-model for the recovery widget (Whoop-sourced). Present only
 * for a connected user; the page renders NO card when absent. `restingToday`
 * / `recoveryScore` / `hrvToday` are null when Whoop has no reading yet today.
 * `days` is the date-aligned history (nulls preserved); `baseline` and `hrv`
 * are the always-present derived blocks. Server figures are displayed as
 * received — the adapter never recomputes an average, band bound, or z-score.
 */
export type RecoveryView = {
  restingToday: number | null;
  recoveryScore: number | null;
  hrvToday?: number | null; // NEW — was fetched and dropped
  spark: number[]; // unchanged; resting-HR trend, oldest→newest
  days?: RecoveryDayPoint[]; // NEW — date-aligned, nulls preserved
  baseline?: RecoveryBaselineView; // NEW
  hrv?: RecoveryHrvView; // NEW
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

/** Elevation display, preserving null (missing ≠ zero — the tiles branch on it). */
function elevationOrNull(meters: number | null, unit: DistanceUnit): string | null {
  return meters === null ? null : formatElevationValue(meters, unit);
}

function adaptRunningWeekRun(r: DashboardRunningWeekRun, unit: DistanceUnit): RunningWeekRunView {
  return {
    activityId: r.activity_id,
    name: r.name,
    localDate: r.local_date,
    startTime: r.start_time,
    distance: formatDistanceValue(r.distance_meters, unit),
    durationSeconds: r.duration_seconds,
    pace: formatPaceValue(r.avg_pace_sec_per_km, unit),
    paceSecPerKm: r.avg_pace_sec_per_km,
    avgHeartRate: r.avg_heart_rate_bpm,
    heartRateZone: r.heart_rate_zone,
    elevation: elevationOrNull(r.elevation_gain_meters, unit),
    elevationGainMeters: r.elevation_gain_meters,
    indoor: r.environment === "indoor",
  };
}

function adaptRunningBaseline(
  b: DashboardRunningBaseline,
  unit: DistanceUnit,
): RunningBaselineView {
  return {
    windowWeeks: b.window_weeks,
    weeks: b.weeks,
    distance: b.distance_meters === null ? null : formatDistanceValue(b.distance_meters, unit),
    durationSeconds: b.duration_seconds,
    pace: b.avg_pace_sec_per_km === null ? null : formatPaceValue(b.avg_pace_sec_per_km, unit),
    paceSecPerKm: b.avg_pace_sec_per_km,
    avgHeartRate: b.avg_heart_rate_bpm,
    elevation: elevationOrNull(b.elevation_gain_meters, unit),
    runsPerWeek: b.runs_per_week,
  };
}

function adaptRunning(running: DashboardRunning, unit: DistanceUnit): RunningView {
  return {
    currentWeek: {
      distance: formatDistanceValue(running.current_week.distance_meters, unit),
      runCount: running.current_week.run_count,
      deltaPct: running.current_week.delta_pct_vs_prior_week,
      durationSeconds: running.current_week.duration_seconds,
      pace: formatPaceValue(running.current_week.avg_pace_sec_per_km, unit),
      avgHeartRate: running.current_week.avg_heart_rate_bpm,
      elevation: elevationOrNull(running.current_week.elevation_gain_meters, unit),
      heartRateRuns: running.current_week.heart_rate_runs,
      elevationRuns: running.current_week.elevation_runs,
      longestRun: formatDistanceValue(running.current_week.longest_run_meters, unit),
      daysRun: running.current_week.days_run,
    },
    pace: formatPaceValue(running.recent_avg_pace_sec_per_km, unit),
    baseline: running.baseline ? adaptRunningBaseline(running.baseline, unit) : null,
    latestRun: running.latest_run
      ? {
          name: running.latest_run.name,
          distance: formatDistanceValue(running.latest_run.distance_meters, unit),
          durationSeconds: running.latest_run.duration_seconds,
          startTime: running.latest_run.start_time,
        }
      : null,
    weekRuns: running.week_runs.map((r) => adaptRunningWeekRun(r, unit)),
    weeklyLoad: running.weekly_load.map((p) => ({
      weekStart: p.week_start,
      distance: distanceToDisplay(p.distance_meters, unit),
      durationSeconds: p.duration_seconds,
      runCount: p.run_count,
    })),
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

const RECOVERY_STATUSES: readonly RecoveryHrvStatus[] = [
  "balanced",
  "elevated",
  "suppressed",
  "unknown",
];
const RECOVERY_TRENDS: readonly RecoveryTrendDirection[] = [
  "rising",
  "falling",
  "steady",
  "unknown",
];

/** Narrow an unknown server string to a known union member, else "unknown". */
function recoveryStatus(s: string): RecoveryHrvStatus {
  return (RECOVERY_STATUSES as readonly string[]).includes(s)
    ? (s as RecoveryHrvStatus)
    : "unknown";
}

function recoveryTrend(s: string): RecoveryTrendDirection {
  return (RECOVERY_TRENDS as readonly string[]).includes(s)
    ? (s as RecoveryTrendDirection)
    : "unknown";
}

function adaptRecovery(recovery: DashboardRecovery): RecoveryView {
  return {
    restingToday: recovery.today?.resting_heart_rate ?? null,
    recoveryScore: recovery.today?.recovery_score ?? null,
    hrvToday: recovery.today?.hrv_rmssd_milli ?? null,
    // Only the sparkline is sanitized (non-finite → 0, correct for a sparkline).
    // The day series keeps its nulls — a null is "no reading", never a zero HR.
    spark: sanitizeSpark(recovery.resting_hr_spark),
    days: recovery.days.map((d) => ({
      date: d.date,
      restingHr: d.resting_heart_rate,
      recoveryScore: d.recovery_score,
      hrv: d.hrv_rmssd_milli,
    })),
    // Server figures pass through unchanged — never re-derived from a partial
    // series (house convention: a server average is a window figure).
    baseline: {
      windowDays: recovery.baseline.window_days,
      restingHrAvg: recovery.baseline.resting_hr_avg,
      restingHrDays: recovery.baseline.resting_hr_days,
      hrvAvg: recovery.baseline.hrv_avg,
      hrvStdDev: recovery.baseline.hrv_std_dev,
      hrvDays: recovery.baseline.hrv_days,
      recoveryScoreAvg: recovery.baseline.recovery_score_avg,
      recoveryScoreDays: recovery.baseline.recovery_score_days,
    },
    hrv: {
      status: recoveryStatus(recovery.hrv.status),
      balancedLow: recovery.hrv.balanced_low,
      balancedHigh: recovery.hrv.balanced_high,
      zScore: recovery.hrv.z_score,
      trend: recoveryTrend(recovery.hrv.trend),
      shortAvg: recovery.hrv.short_avg,
    },
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
