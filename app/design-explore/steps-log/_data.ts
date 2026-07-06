/**
 * DX steps-log — shared fixture + derivation layer for the five variants.
 *
 * This is a THROWAWAY mockup data module: static fixtures that look real, plus
 * the pure client-side week/month bucketing every variant needs (the real API
 * returns only flat `{ date, steps }` daily totals + a single goal). It is a
 * *data* helper, not a shared visual abstraction — the five variants each own
 * their own layout and deliberately do not share presentation code.
 *
 * Weeks are Monday-start (Mon–Sun), matching the dashboard streak's week[]
 * convention. Aggregates use the LOGGED-days denominator (a day you didn't log
 * can't be "hit"), matching the shipped daysHit/daysLogged strip. Goal-relative
 * fields are null when no goal is set, so no variant ever renders NaN%.
 */

export type Entry = { date: string; steps: number };

export const GOAL = 10000;

/**
 * ~34 logged days, newest-first, spanning early June → Jul 5 2026 so that:
 *  - a July month divider and June rollup both appear under "Last 30 days",
 *  - the current week (Jun 29–Jul 5) is mixed, a strong week (Jun 22–28,
 *    5/7 hit) contrasts a weak week (Jun 15–21, 1/6 hit),
 *  - some weeks are sparse (gaps are simply absent rows), and
 *  - there is enough history for real multi-page pagination.
 */
export const ENTRIES: Entry[] = [
  // Week of Jun 29 – Jul 5 (current week, mixed) — July starts Jul 1
  { date: "2026-07-05", steps: 17000 },
  { date: "2026-07-04", steps: 2000 },
  { date: "2026-07-03", steps: 8500 },
  { date: "2026-07-02", steps: 11200 },
  { date: "2026-07-01", steps: 10400 },
  { date: "2026-06-30", steps: 6100 },
  { date: "2026-06-29", steps: 9800 },
  // Week of Jun 22 – Jun 28 (strong week, 5/7 hit)
  { date: "2026-06-28", steps: 12500 },
  { date: "2026-06-27", steps: 13000 },
  { date: "2026-06-26", steps: 4200 },
  { date: "2026-06-25", steps: 3800 },
  { date: "2026-06-24", steps: 14000 },
  { date: "2026-06-23", steps: 10100 },
  { date: "2026-06-22", steps: 11000 },
  // Week of Jun 15 – Jun 21 (weak week, sparse, 1/6 hit)
  { date: "2026-06-21", steps: 4800 },
  { date: "2026-06-20", steps: 3200 },
  { date: "2026-06-19", steps: 6100 },
  { date: "2026-06-18", steps: 5400 },
  { date: "2026-06-17", steps: 4000 },
  { date: "2026-06-16", steps: 11000 },
  // Week of Jun 8 – Jun 14 (a solid full week)
  { date: "2026-06-14", steps: 9200 },
  { date: "2026-06-13", steps: 10500 },
  { date: "2026-06-12", steps: 8800 },
  { date: "2026-06-11", steps: 12000 },
  { date: "2026-06-10", steps: 7600 },
  { date: "2026-06-09", steps: 9100 },
  { date: "2026-06-08", steps: 10200 },
  // Week of Jun 1 – Jun 7 (oldest, sparse — page 2/3 territory)
  { date: "2026-06-07", steps: 8000 },
  { date: "2026-06-06", steps: 9500 },
  { date: "2026-06-05", steps: 10800 },
  { date: "2026-06-04", steps: 7200 },
  { date: "2026-06-03", steps: 11500 },
  { date: "2026-06-02", steps: 6400 },
  { date: "2026-06-01", steps: 5900 },
];

// --- date utilities (local-time, matching the date-keyed log) -------------

/** Parse a YYYY-MM-DD as a local calendar day (not a UTC instant). */
export function parseLocal(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isoDate(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Monday of the Mon-start week containing `date`. */
export function weekStart(date: string): Date {
  const d = parseLocal(date);
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const backToMonday = (dow + 6) % 7;
  d.setDate(d.getDate() - backToMonday);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

// --- aggregation ----------------------------------------------------------

export type Aggregate = {
  daysLogged: number;
  daysHit: number | null; // null when no goal
  total: number;
  avg: number;
  attainmentPct: number | null; // round(avg/goal*100), null when no goal
  best: Entry;
};

export function aggregate(entries: Entry[], goal: number | null): Aggregate {
  const total = entries.reduce((s, e) => s + e.steps, 0);
  const avg = Math.round(total / entries.length);
  const best = entries.reduce((b, e) => (e.steps > b.steps ? e : b), entries[0]);
  return {
    daysLogged: entries.length,
    daysHit: goal ? entries.filter((e) => e.steps >= goal).length : null,
    total,
    avg,
    attainmentPct: goal ? Math.round((avg / goal) * 100) : null,
    best,
  };
}

export type WeekBucket = {
  key: string; // ISO of the Monday
  start: Date;
  end: Date;
  label: string; // "Jun 29 – Jul 5"
  entries: Entry[]; // newest-first
  agg: Aggregate;
};

export type MonthBucket = {
  key: string; // "2026-07"
  label: string; // "July 2026"
  entries: Entry[];
  weeks: WeekBucket[];
  agg: Aggregate;
};

/** Group newest-first entries into Monday-start week buckets, newest week first. */
export function bucketByWeek(entries: Entry[], goal: number | null): WeekBucket[] {
  const byKey = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = isoDate(weekStart(e.date));
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e);
  }
  const buckets: WeekBucket[] = [];
  for (const [k, list] of byKey) {
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const start = parseLocal(k);
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

/** Group into calendar-month chapters (newest first), each with its week buckets. */
export function bucketByMonth(entries: Entry[], goal: number | null): MonthBucket[] {
  const byKey = new Map<string, Entry[]>();
  for (const e of entries) {
    const k = e.date.slice(0, 7);
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(e);
  }
  const buckets: MonthBucket[] = [];
  for (const [k, list] of byKey) {
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    buckets.push({
      key: k,
      label: fmtMonthYear(k),
      entries: sorted,
      weeks: bucketByWeek(sorted, goal),
      agg: aggregate(sorted, goal),
    });
  }
  return buckets.sort((a, b) => b.key.localeCompare(a.key));
}

/** Does the fixture span two or more calendar months? (drives month headers) */
export function spansMultipleMonths(entries: Entry[]): boolean {
  return new Set(entries.map((e) => e.date.slice(0, 7))).size > 1;
}

// --- formatting -----------------------------------------------------------

export function fmtSteps(n: number): string {
  return n.toLocaleString();
}

/** Compact "9.5k" / "66.4k" for tight summary chips. */
export function fmtK(n: number): string {
  if (n < 1000) return String(Math.round(n));
  const k = n / 1000;
  return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
}

export function fmtMonDay(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtRowDate(date: string): string {
  return parseLocal(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function fmtMonthYear(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Per-day attainment %, null with no goal. */
export function dayPct(steps: number, goal: number | null): number | null {
  if (!goal) return null;
  return Math.round((steps / goal) * 100);
}
