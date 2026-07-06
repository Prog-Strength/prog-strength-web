/**
 * Pure week/month grouping for the Activities → Steps log accordion.
 *
 * The API returns flat daily totals; this module buckets them into Monday-start
 * weeks with goal-relative aggregates. Date parsing reuses `steps-stats` so the
 * log stays aligned with the ring/chart layer.
 */

import type { StepsEntry } from "./api";
import { isoDate, parseLocalDate } from "./steps-stats";

export const WEEKS_PER_PAGE = 4;

export type Aggregate = {
  daysLogged: number;
  daysHit: number | null;
  total: number;
  avg: number;
  attainmentPct: number | null;
  best: { date: string; steps: number };
};

export type WeekBucket = {
  key: string;
  start: Date;
  end: Date;
  label: string;
  entries: StepsEntry[];
  agg: Aggregate;
};

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Monday of the Mon-start week containing `date`. */
export function weekStart(date: string): Date {
  const d = parseLocalDate(date);
  const backToMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - backToMonday);
  return d;
}

function fmtMonDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function aggregate(entries: StepsEntry[], goal: number | null): Aggregate {
  const hasGoal = goal !== null && goal > 0;
  const total = entries.reduce((s, e) => s + e.steps, 0);
  const avg = Math.round(total / entries.length);
  const best = entries.reduce((b, e) => (e.steps > b.steps ? e : b), entries[0]);
  return {
    daysLogged: entries.length,
    daysHit: hasGoal ? entries.filter((e) => e.steps >= goal).length : null,
    total,
    avg,
    attainmentPct: hasGoal ? Math.round((avg / goal) * 100) : null,
    best: { date: best.date, steps: best.steps },
  };
}

/** Group newest-first entries into Monday-start week buckets, newest week first. */
export function bucketByWeek(entries: StepsEntry[], goal: number | null): WeekBucket[] {
  if (entries.length === 0) return [];

  const byKey = new Map<string, StepsEntry[]>();
  for (const e of entries) {
    const k = isoDate(weekStart(e.date));
    const list = byKey.get(k);
    if (list) list.push(e);
    else byKey.set(k, [e]);
  }

  const buckets: WeekBucket[] = [];
  for (const [k, list] of byKey) {
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const start = parseLocalDate(k);
    const end = addDays(start, 6);
    buckets.push({
      key: k,
      start,
      end,
      label: `${fmtMonDay(start)} – ${fmtMonDay(end)}`,
      entries: sorted,
      agg: aggregate(sorted, goal),
    });
  }
  return buckets.sort((a, b) => b.key.localeCompare(a.key));
}

/** True when loaded history spans two or more calendar months. */
export function spansMultipleMonths(entries: StepsEntry[]): boolean {
  return new Set(entries.map((e) => e.date.slice(0, 7))).size > 1;
}

export function entriesInMonth(entries: StepsEntry[], monthKey: string): StepsEntry[] {
  return entries.filter((e) => e.date.slice(0, 7) === monthKey);
}

export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}
