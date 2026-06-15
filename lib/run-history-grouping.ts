/**
 * Groups the run-history list by Monday-anchored week, then rolls those
 * weeks up into months — the data model behind the Activities → Running
 * history's week/month dividers and their cumulative totals (distance,
 * duration, run count).
 *
 * Pure and unit-agnostic on purpose: distances are summed in meters and
 * durations in seconds so this can be unit-tested without React, while the
 * rendering layer (RunHistoryList) does the mi/km formatting through the
 * DistanceUnitContext.
 *
 * Week→month assignment: a week is assigned whole to the month of its
 * Monday, so a week that straddles a month boundary is never split across
 * two dividers (which would look broken). Month totals are therefore the
 * sum of the weeks anchored in that month — the standard training-log
 * convention where a week "belongs" to the month it starts in.
 */

import type { RunningSession } from "./api";
import { isoDate, startOfMonday } from "./weekly-buckets";

export type RunWeekGroup = {
  // ISO date (YYYY-MM-DD) of the Monday anchoring this week — React key + dedupe key.
  mondayKey: string;
  monday: Date;
  runs: RunningSession[];
  meters: number;
  durationSec: number;
  count: number;
};

export type RunMonthGroup = {
  // "YYYY-MM" of the month these weeks are anchored in.
  monthKey: string;
  monthStart: Date;
  weeks: RunWeekGroup[];
  meters: number;
  durationSec: number;
  count: number;
};

/**
 * Buckets runs into months → weeks, newest first. Input order doesn't
 * matter — runs are sorted by start time descending first, so both the
 * group ordering and the rows within each week read newest-to-oldest.
 * Weeks and months with no runs never appear (this is a history list, not
 * a zero-filled chart axis).
 */
export function groupRunsByMonthAndWeek(sessions: RunningSession[]): RunMonthGroup[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
  );

  // First pass: week buckets in newest-first encounter order.
  const weekByKey = new Map<string, RunWeekGroup>();
  for (const s of sorted) {
    const monday = startOfMonday(new Date(s.start_time));
    const key = isoDate(monday);
    let week = weekByKey.get(key);
    if (!week) {
      week = { mondayKey: key, monday, runs: [], meters: 0, durationSec: 0, count: 0 };
      weekByKey.set(key, week);
    }
    week.runs.push(s);
    week.meters += s.distance_meters;
    week.durationSec += s.duration_seconds;
    week.count += 1;
  }

  // Second pass: roll weeks up into the month their Monday falls in,
  // preserving the newest-first week order.
  const monthByKey = new Map<string, RunMonthGroup>();
  for (const week of weekByKey.values()) {
    const monthKey = monthKeyOf(week.monday);
    let month = monthByKey.get(monthKey);
    if (!month) {
      month = {
        monthKey,
        monthStart: new Date(week.monday.getFullYear(), week.monday.getMonth(), 1),
        weeks: [],
        meters: 0,
        durationSec: 0,
        count: 0,
      };
      monthByKey.set(monthKey, month);
    }
    month.weeks.push(week);
    month.meters += week.meters;
    month.durationSec += week.durationSec;
    month.count += week.count;
  }

  return [...monthByKey.values()];
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Friendly week title: "This week" / "Last week" when they apply, else
 * "Week of <Mon D>". `now` is injectable so the relative labels are
 * deterministic under test.
 */
export function weekLabel(monday: Date, now: Date = new Date()): string {
  const thisMonday = startOfMonday(now);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  if (monday.getTime() === thisMonday.getTime()) return "This week";
  if (monday.getTime() === lastMonday.getTime()) return "Last week";
  return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

/** "June 2026" — the month-divider title. */
export function monthLabel(monthStart: Date): string {
  return monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
