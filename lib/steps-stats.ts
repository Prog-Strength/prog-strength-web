/**
 * Pure, React-free derivation layer for the Activities → Steps tab.
 *
 * The API returns only flat daily totals (`{ date, steps }`) plus a single
 * `goal`. Everything the goal-ring view shows beyond that — the average, the
 * attainment percent, the per-day goal delta, the goal-hit count, the
 * continuous day axis with its gaps — is derived HERE, client-side, from the
 * windowed `listSteps` range fetch.
 *
 * Two functions carry the weight:
 *   - `deriveStats` adds `daysHit` / `daysLogged` / `attainmentPct` to the
 *     avg/total/best the old `computeStats` produced.
 *   - `buildAxis` builds a CONTINUOUS calendar-day axis across the period where
 *     **unlogged days are gaps (`steps: null`), never zeros** — the single most
 *     important fix for an honest chart.
 *
 * The period is production's `days: number | null` (`null` ⇒ All). "Today" is a
 * real `new Date()`; local-date parsing matches the date-keyed log (a
 * `YYYY-MM-DD` is a local calendar day, not a UTC instant). Goal-relative
 * fields are `null` whenever no goal is set, so the view never renders `NaN%`.
 */

import type { StepsEntry } from "./api";

/** A YYYY-MM-DD string parsed as local time (not UTC), so the displayed day
 * matches the date key the user logged. */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Local-time YYYY-MM-DD for a Date, matching the date-keyed log. */
export function isoDate(d: Date): string {
  const yyyy = String(d.getFullYear()).padStart(4, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}`;
}

/** Local midnight today, the right edge of every window. */
function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Local midnight `days - 1` calendar days before today — the inclusive start
 * of a bounded window. Stepped with `setDate` (not fixed-ms arithmetic) so it
 * stays correct across daylight-saving transitions, where a local day is 23h
 * or 25h. */
function windowStart(days: number): Date {
  const d = today();
  d.setDate(d.getDate() - (days - 1));
  return d;
}

/** YYYY-MM-DD of a bounded window's inclusive start. Exported so the view's
 * range fetch and the client-side windowing agree to the exact day. */
export function rangeSinceIso(days: number): string {
  return isoDate(windowStart(days));
}

/**
 * One continuous calendar day on the axis — present whether or not it was
 * logged, so the chart can render a gap as a gap. `steps: null` ⇒ unlogged
 * (NOT a zero). `pct` / `delta` / `hit` are goal-relative and null/false with
 * no goal or on an unlogged day.
 */
export type Day = {
  date: string; // YYYY-MM-DD
  steps: number | null; // null ⇒ unlogged gap (NOT a zero)
  logged: boolean;
  hit: boolean; // logged && goal>0 && steps>=goal
  pct: number | null; // steps/goal, null when no goal or unlogged
  delta: number | null; // steps − goal, null when no goal or unlogged
};

export type Stats = {
  avg: number | null;
  total: number;
  best: { date: string; steps: number } | null;
  daysLogged: number;
  daysHit: number; // logged days at/over goal (0 with no goal)
  attainmentPct: number | null; // round(avg / goal × 100), null with no goal
  hitRatePct: number | null; // round(daysHit / daysLogged × 100), null with no goal
};

/** The window cutoff (inclusive) for a bounded period, or null for All. */
function cutoffFor(days: number | null): string | null {
  if (days === null) return null;
  return rangeSinceIso(days);
}

/** Entries within the active period, newest first. A `null` period (All)
 * returns every entry. */
export function entriesInPeriod(entries: StepsEntry[], days: number | null): StepsEntry[] {
  const cutoff = cutoffFor(days);
  const within = cutoff === null ? [...entries] : entries.filter((e) => e.date >= cutoff);
  return within.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * The continuous day axis for the period, oldest → newest. Every calendar day
 * from the window start to today appears; days with no entry are `steps: null`
 * (a gap, never a 0). When `days === null` (All) the axis runs from the
 * earliest logged day to today. Empty entries ⇒ `[]`.
 */
export function buildAxis(entries: StepsEntry[], days: number | null, goal: number): Day[] {
  if (entries.length === 0) return [];
  const byDate = new Map(entries.map((e) => [e.date, e.steps]));
  const end = today();
  let start: Date;
  if (days === null) {
    const earliest = entries.reduce((min, e) => (e.date < min ? e.date : min), entries[0].date);
    start = parseLocalDate(earliest);
  } else {
    start = windowStart(days);
  }
  const hasGoal = goal > 0;
  const out: Day[] = [];
  // Step one calendar day at a time (`setDate`, not fixed-ms) so the axis stays
  // correct across DST — no dropped or duplicated day on a 23h/25h boundary.
  const cursor = new Date(start);
  while (cursor <= end) {
    const date = isoDate(cursor);
    const steps = byDate.has(date) ? (byDate.get(date) as number) : null;
    const logged = steps !== null;
    const hit = logged && hasGoal && steps >= goal;
    out.push({
      date,
      steps,
      logged,
      hit,
      pct: logged && hasGoal ? steps / goal : null,
      delta: logged && hasGoal ? steps - goal : null,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * Aggregate stats over the period. `daysHit` / `daysLogged` count LOGGED days
 * (you can't "hit" a day you didn't log). Goal-relative fields are null when no
 * goal is set so the view never renders `NaN%`.
 */
export function deriveStats(entries: StepsEntry[], days: number | null, goal: number): Stats {
  const inPeriod = entriesInPeriod(entries, days);
  const hasGoal = goal > 0;
  if (inPeriod.length === 0) {
    return {
      avg: null,
      total: 0,
      best: null,
      daysLogged: 0,
      daysHit: 0,
      attainmentPct: null,
      hitRatePct: null,
    };
  }
  let total = 0;
  let best = inPeriod[0];
  for (const e of inPeriod) {
    total += e.steps;
    if (e.steps > best.steps) best = e;
  }
  const avg = total / inPeriod.length;
  const daysHit = hasGoal ? inPeriod.filter((e) => e.steps >= goal).length : 0;
  return {
    avg,
    total,
    best: { date: best.date, steps: best.steps },
    daysLogged: inPeriod.length,
    daysHit,
    attainmentPct: hasGoal ? Math.round((avg / goal) * 100) : null,
    hitRatePct: hasGoal ? Math.round((daysHit / inPeriod.length) * 100) : null,
  };
}

/** Per-day goal attainment percent for a single logged day — `round(steps /
 * goal × 100)`, null with no goal. Used by the log rows' mini-ring + %. */
export function dayPct(steps: number, goal: number): number | null {
  if (goal <= 0) return null;
  return Math.round((steps / goal) * 100);
}
