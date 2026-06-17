/**
 * Pure client-side aggregation for the timeline's left "your week" rail:
 * Monday-started week bucketing, this-week run/lift totals, and a daily
 * streak count. Mirrors the calendar's weekly-aggregate approach
 * (components/calendar/weekly-overview.tsx) but trimmed to what the rail
 * shows. No fetching here — the container passes already-fetched activities
 * in, so this stays trivially testable.
 */

/** A source-agnostic activity reduced to the two facts the rail needs. */
export type DatedActivity = {
  /** RFC3339 / parseable timestamp of when the activity occurred. */
  at: string;
  kind: "lift" | "run";
  /** Run distance in meters; ignored for lifts. */
  distanceMeters?: number;
};

export type WeekStats = {
  liftCount: number;
  runCount: number;
  runMeters: number;
  /** 7 entries, Monday→Sunday, total activity count per day this week. */
  dayBars: number[];
};

/** Monday 00:00 (local) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // Mon=0 … Sun=6
  out.setDate(out.getDate() - dow);
  return out;
}

/** Local midnight of `d`, for day-level comparisons. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole days between two local midnights (b - a). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000);
}

/** 7 Monday→Sunday counts of activities falling in [weekStart, +7d). */
export function weekDayTotals(activities: DatedActivity[], weekStart: Date): number[] {
  const bars = [0, 0, 0, 0, 0, 0, 0];
  for (const a of activities) {
    const i = dayDiff(weekStart, new Date(a.at));
    if (i >= 0 && i < 7) bars[i] += 1;
  }
  return bars;
}

/** Run/lift totals + day bars for the week containing `now`. */
export function computeWeekStats(
  lifts: DatedActivity[],
  runs: DatedActivity[],
  now: Date,
): WeekStats {
  const weekStart = startOfWeek(now);
  const inWeek = (a: DatedActivity) => {
    const i = dayDiff(weekStart, new Date(a.at));
    return i >= 0 && i < 7;
  };
  const weekLifts = lifts.filter(inWeek);
  const weekRuns = runs.filter(inWeek);
  return {
    liftCount: weekLifts.length,
    runCount: weekRuns.length,
    runMeters: weekRuns.reduce((s, r) => s + (r.distanceMeters ?? 0), 0),
    dayBars: weekDayTotals([...weekLifts, ...weekRuns], weekStart),
  };
}

/**
 * Consecutive-day streak ending today: the number of back-to-back days
 * (starting at `today`, or yesterday if nothing today yet) with at least one
 * activity. A gap day ends the streak. Returns 0 when neither today nor
 * yesterday had activity.
 */
export function computeStreakDays(activities: DatedActivity[], today: Date): number {
  const has = new Set(activities.map((a) => startOfDay(new Date(a.at)).getTime()));
  const t0 = startOfDay(today).getTime();
  // Allow the streak to "include today" only if today has activity; otherwise
  // start counting from yesterday so an as-yet-untrained today doesn't zero a
  // real streak mid-morning.
  let cursor = has.has(t0) ? t0 : t0 - 86_400_000;
  if (!has.has(cursor)) return 0;
  let count = 0;
  while (has.has(cursor)) {
    count += 1;
    cursor -= 86_400_000;
  }
  return count;
}
