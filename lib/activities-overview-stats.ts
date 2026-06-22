/**
 * Pure, React-free derivation layer for the Activities → Overview tab's
 * instrument-panel composition.
 *
 * The Overview fetches workouts, running sessions, steps, and a steps goal,
 * then needs a panel of *trends* over the active window — avg pace, weekly
 * mileage/pace buckets, a lifting-vs-running time split, days-active +
 * streaks, HR/elevation effort, and a steps trend. None of that is stored;
 * the API exposes the raw rows and the UI derives the rollups. This module
 * is that derivation, ported from the DX mockup's `_data.ts` to read the
 * real `lib/api.ts` shapes against a real `now`.
 *
 * Nullability is load-bearing. `avg_pace_sec_per_km`, `best_pace_sec_per_km`,
 * and the HR fields are null on manually-logged runs (no TCX). Every
 * pace/HR/effort aggregate weights only the rows that carry the data and
 * returns `null` (→ rendered "—") when the window has none — never NaN or 0.
 * Weekly buckets and the steps axis treat missing periods as gaps (`null`),
 * not zeros, so a rest week reads as intentional rest rather than broken data.
 *
 * Bucketing uses local-date parsing (a `YYYY-MM-DD` steps key is a local
 * calendar day, not a UTC instant) consistent with `parseLocalDate` /
 * `isoDate`, and a real `now` injected by the caller (the view passes
 * `new Date()`; tests pin it) so "today" is honest and testable.
 */

import type { RunningSession, StepsEntry, Workout } from "./api";
import { buildWeeklyBuckets } from "./weekly-buckets";
import { isoDate, parseLocalDate } from "./steps-stats";

const METERS_PER_MILE = 1609.344;

/** Headline rollups for the KPI row. */
export type HeadlineStats = {
  totalActiveSeconds: number;
  workoutCount: number;
  runCount: number;
  sessionCount: number;
  /** 0 when there are no sessions; the view guards the display with "—". */
  avgSessionSeconds: number;
};

/** One week of the run trends. `null` fields are gaps (no qualifying run). */
export type WeekPoint = {
  /** Monday of the week (local). */
  weekStart: Date;
  /** Unix-ms of the Monday, for a numeric x-axis. */
  t: number;
  /** Sum of run distance this week, or `null` when the week had no run. */
  mileageMeters: number | null;
  /** Distance-weighted avg pace (sec/mi), or `null` when no pace-carrying run. */
  paceSecPerMi: number | null;
};

/** Share of active *time* across the two disciplines. */
export type DisciplineSplit = {
  liftSeconds: number;
  runSeconds: number;
  /** 0–100; both 0 only when the window has no completed activity at all. */
  liftPct: number;
  runPct: number;
};

/** Show-up record over the window. */
export type ConsistencyStats = {
  daysActive: number;
  totalDays: number;
  /** Consecutive active days ending at today (0 if today is a rest day). */
  currentStreak: number;
  longestStreak: number;
};

/** Intensity dimension; each field `null` when no run reports it. */
export type EffortStats = {
  avgHrBpm: number | null;
  maxHrBpm: number | null;
  elevationGainMeters: number | null;
};

/** One day of the steps trend; `null` steps = unlogged day (a gap). */
export type StepPoint = { date: Date; steps: number | null };

export type OverviewStats = {
  headline: HeadlineStats;
  /** Distance-weighted avg run pace (sec/mi) over the window, or `null`. */
  avgRunPaceSecPerMi: number | null;
  /** Best (fastest) pace (sec/mi) over the window, or `null`. */
  bestPaceSecPerMi: number | null;
  weekly: WeekPoint[];
  disciplineSplit: DisciplineSplit;
  consistency: ConsistencyStats;
  effort: EffortStats;
  /** Continuous day axis of steps; empty when the window has no entries. */
  stepsSeries: StepPoint[];
};

/** Completed-workout duration in seconds (ms span), or 0 for in-progress /
 * non-positive spans (mirrors the existing Overview/chart guard). */
function workoutSeconds(w: Workout): number {
  if (!w.ended_at) return 0;
  const ms = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 1000;
}

/** Local midnight for a Date (the right edge of every window). */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

/**
 * Derive every Overview instrument's data from the fetched window.
 *
 * @param workouts completed + in-progress lifting sessions (in-progress are
 *   excluded from durations); `null`/`[]` treated as empty.
 * @param sessions running sessions in the window.
 * @param steps date-keyed daily step entries in the window.
 * @param days window length in days, or `null` for "all".
 * @param now "today" — `new Date()` in the view, pinned in tests.
 */
export function deriveOverviewStats({
  workouts,
  sessions,
  steps,
  days,
  now,
}: {
  workouts: Workout[] | null;
  sessions: RunningSession[] | null;
  steps: StepsEntry[] | null;
  days: number | null;
  now: Date;
}): OverviewStats {
  const ws = workouts ?? [];
  const ss = sessions ?? [];
  const st = steps ?? [];

  // --- headline + discipline split -----------------------------------------
  let liftSeconds = 0;
  for (const w of ws) liftSeconds += workoutSeconds(w);

  let runSeconds = 0;
  for (const s of ss) runSeconds += s.duration_seconds;

  const workoutCount = ws.length;
  const runCount = ss.length;
  const sessionCount = workoutCount + runCount;
  const totalActiveSeconds = liftSeconds + runSeconds;

  const headline: HeadlineStats = {
    totalActiveSeconds,
    workoutCount,
    runCount,
    sessionCount,
    avgSessionSeconds: sessionCount ? totalActiveSeconds / sessionCount : 0,
  };

  const splitTotal = liftSeconds + runSeconds;
  const disciplineSplit: DisciplineSplit = {
    liftSeconds,
    runSeconds,
    liftPct: splitTotal ? (liftSeconds / splitTotal) * 100 : 0,
    runPct: splitTotal ? (runSeconds / splitTotal) * 100 : 0,
  };

  // --- avg / best pace (weighted only over pace-carrying runs) --------------
  // Distance-weighted: Σ distance / Σ duration over runs that report pace, so
  // a manual (pace-less) run contributes to neither numerator nor denominator.
  let paceDistMeters = 0;
  let paceDurSeconds = 0;
  let bestPaceSecPerKm: number | null = null;
  for (const s of ss) {
    if (s.avg_pace_sec_per_km != null && s.duration_seconds > 0) {
      paceDistMeters += s.distance_meters;
      paceDurSeconds += s.duration_seconds;
    }
    if (s.best_pace_sec_per_km != null) {
      bestPaceSecPerKm =
        bestPaceSecPerKm == null
          ? s.best_pace_sec_per_km
          : Math.min(bestPaceSecPerKm, s.best_pace_sec_per_km);
    }
  }
  const avgRunPaceSecPerMi =
    paceDistMeters > 0 ? (paceDurSeconds / paceDistMeters) * METERS_PER_MILE : null;
  const bestPaceSecPerMi =
    bestPaceSecPerKm != null ? bestPaceSecPerKm * (METERS_PER_MILE / 1000) : null;

  // --- weekly mileage / pace buckets (gaps, not zeros) ---------------------
  type WeekAcc = {
    mileageMeters: number;
    paceDistMeters: number;
    paceDurSeconds: number;
    runCount: number;
  };
  const weekBuckets = buildWeeklyBuckets<RunningSession, WeekAcc>({
    items: ss,
    days,
    now,
    getTimestamp: (s) => new Date(s.start_time),
    factory: () => ({ mileageMeters: 0, paceDistMeters: 0, paceDurSeconds: 0, runCount: 0 }),
    accumulate: (bucket, s) => {
      bucket.runCount += 1;
      bucket.mileageMeters += s.distance_meters;
      if (s.avg_pace_sec_per_km != null && s.duration_seconds > 0) {
        bucket.paceDistMeters += s.distance_meters;
        bucket.paceDurSeconds += s.duration_seconds;
      }
    },
  });
  const weekly: WeekPoint[] = weekBuckets.map((b) => ({
    weekStart: b.weekStart,
    t: b.t,
    // A week with no run is a gap, not a zero-mileage week.
    mileageMeters: b.runCount > 0 ? b.mileageMeters : null,
    paceSecPerMi:
      b.paceDistMeters > 0 ? (b.paceDurSeconds / b.paceDistMeters) * METERS_PER_MILE : null,
  }));

  // --- consistency (days active + streaks) ---------------------------------
  // Distinct local calendar days carrying any workout, run, or step entry.
  const activeDays = new Set<string>();
  for (const w of ws) activeDays.add(isoDate(startOfDay(new Date(w.performed_at))));
  for (const s of ss) activeDays.add(isoDate(startOfDay(new Date(s.start_time))));
  for (const e of st) activeDays.add(isoDate(parseLocalDate(e.date)));

  const todayMidnight = startOfDay(now);
  // Window's inclusive start day: bounded windows count `days` days; "all"
  // runs from the earliest active day (or today when there's nothing).
  let windowStart: Date;
  if (days !== null) {
    windowStart = addDays(todayMidnight, -(days - 1));
  } else if (activeDays.size > 0) {
    let earliest = Infinity;
    for (const k of activeDays) earliest = Math.min(earliest, parseLocalDate(k).getTime());
    windowStart = startOfDay(new Date(earliest));
  } else {
    windowStart = todayMidnight;
  }

  let totalDays = 0;
  let daysActive = 0;
  let longestStreak = 0;
  let runLen = 0;
  for (
    let cursor = windowStart;
    cursor.getTime() <= todayMidnight.getTime();
    cursor = addDays(cursor, 1)
  ) {
    totalDays += 1;
    if (activeDays.has(isoDate(cursor))) {
      daysActive += 1;
      runLen += 1;
      if (runLen > longestStreak) longestStreak = runLen;
    } else {
      runLen = 0;
    }
  }

  // Current streak: consecutive active days ending at today (0 if today rest).
  let currentStreak = 0;
  for (let cursor = todayMidnight; activeDays.has(isoDate(cursor)); cursor = addDays(cursor, -1)) {
    currentStreak += 1;
  }

  const consistency: ConsistencyStats = {
    daysActive,
    totalDays,
    currentStreak,
    longestStreak,
  };

  // --- effort (null when no run reports the field) -------------------------
  let hrSum = 0;
  let hrCount = 0;
  let maxHr: number | null = null;
  let elevSum = 0;
  let elevCount = 0;
  for (const s of ss) {
    if (s.avg_heart_rate_bpm != null) {
      hrSum += s.avg_heart_rate_bpm;
      hrCount += 1;
    }
    if (s.max_heart_rate_bpm != null) {
      maxHr = maxHr == null ? s.max_heart_rate_bpm : Math.max(maxHr, s.max_heart_rate_bpm);
    }
    if (s.elevation_gain_meters != null) {
      elevSum += s.elevation_gain_meters;
      elevCount += 1;
    }
  }
  const effort: EffortStats = {
    avgHrBpm: hrCount > 0 ? hrSum / hrCount : null,
    maxHrBpm: maxHr,
    elevationGainMeters: elevCount > 0 ? elevSum : null,
  };

  // --- steps trend (continuous day axis; unlogged = gap) -------------------
  const stepsByDay = new Map<string, number>();
  for (const e of st) stepsByDay.set(isoDate(parseLocalDate(e.date)), e.steps);
  let stepsSeries: StepPoint[] = [];
  if (st.length > 0) {
    // Bounded windows span the whole window; "all" runs earliest-entry→today.
    let stepsStart: Date;
    if (days !== null) {
      stepsStart = addDays(todayMidnight, -(days - 1));
    } else {
      let earliest = Infinity;
      for (const e of st) earliest = Math.min(earliest, parseLocalDate(e.date).getTime());
      stepsStart = startOfDay(new Date(earliest));
    }
    const out: StepPoint[] = [];
    for (
      let cursor = stepsStart;
      cursor.getTime() <= todayMidnight.getTime();
      cursor = addDays(cursor, 1)
    ) {
      const key = isoDate(cursor);
      out.push({
        date: new Date(cursor),
        steps: stepsByDay.has(key) ? stepsByDay.get(key)! : null,
      });
    }
    stepsSeries = out;
  }

  return {
    headline,
    avgRunPaceSecPerMi,
    bestPaceSecPerMi,
    weekly,
    disciplineSplit,
    consistency,
    effort,
    stepsSeries,
  };
}

// --- formatters (pure; shared by the KPI row + instruments) ----------------

/** "46h 7m" / "59m" / "2h" / "0m" from a *seconds* count. */
export function formatHm(seconds: number): string {
  const total = Math.round(seconds / 60);
  if (total <= 0) return "0m";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
