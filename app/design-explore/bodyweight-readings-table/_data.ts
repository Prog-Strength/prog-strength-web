/**
 * Shared, throwaway fixtures + client-side derivation for the
 * bodyweight-readings-table design exploration.
 *
 * Per the DX ticket, EVERYTHING a variant wants to show beyond a flat
 * reading — day grouping, day average, intra-day spread, the delta vs
 * the prior reading / prior day — is derived here, client-side, from
 * `measured_at` + `weight`. The API returns only flat readings.
 *
 * This module is data-only on purpose: the variants diverge on *layout*,
 * not on how a day-average is computed, so the math lives in one place
 * and every variant renders the same derived truth differently.
 *
 * NOTE: `measured_at` is stored as a local wall-clock string with NO
 * timezone suffix (e.g. "2026-06-17T22:48"). `new Date(...)` parses that
 * as local time, and the calendar-day bucket is taken from the literal
 * date prefix — so the late-PM / early-AM day boundary is deterministic
 * in the mockup regardless of the viewer's timezone.
 */

export type Unit = "lb" | "kg";

export type Reading = {
  id: string;
  weight: number;
  unit: Unit;
  measured_at: string; // local wall-clock, no tz: "YYYY-MM-DDTHH:mm"
};

export type Goal = {
  weight: number;
  unit: Unit;
  created_at: string | null; // null ⇒ never set ⇒ "Set goal weight"
};

export type Direction = "down" | "up" | "flat";

/** One calendar day with its readings and everything derived from them. */
export type DayGroup = {
  dateKey: string; // "YYYY-MM-DD"
  date: Date; // local midnight of dateKey
  readings: Reading[]; // sorted within the day, earliest → latest
  unit: Unit;
  avg: number; // day average
  hi: number;
  lo: number;
  spread: number; // hi − lo, the intra-day range
  multi: boolean; // >1 reading on this day
  // Day-over-day, vs the *next older* day-group's average:
  deltaDay: number | null; // avg − prevDay.avg  (null on the oldest day)
  directionDay: Direction;
};

// --- Fixture ---------------------------------------------------------
//
// Mirrors the ticket's representative fixture (a multi-per-day June,
// above a 178 lb goal, trending roughly flat-to-up) and extends it back
// far enough to exercise the 20-row pagination boundary. Newest first.
//
// Deliberately seeded states: multi-per-day (Jun 17/15/14/6), several
// single-reading days (Jun 16/10/7), up AND down day-over-day moves, and
// the day-boundary cases — Mon Jun 15 11:24 PM vs the Fri Jun 12 12:44 AM
// reading both land on their own calendar day, ~80 min from a neighbour.

export const FIXTURE_READINGS: Reading[] = [
  { id: "r01", weight: 187.4, unit: "lb", measured_at: "2026-06-17T22:48" },
  { id: "r02", weight: 185.0, unit: "lb", measured_at: "2026-06-17T09:47" },
  { id: "r03", weight: 185.4, unit: "lb", measured_at: "2026-06-16T09:17" },
  { id: "r04", weight: 187.8, unit: "lb", measured_at: "2026-06-15T23:24" },
  { id: "r05", weight: 186.4, unit: "lb", measured_at: "2026-06-15T16:00" },
  { id: "r06", weight: 181.8, unit: "lb", measured_at: "2026-06-14T18:20" },
  { id: "r07", weight: 185.2, unit: "lb", measured_at: "2026-06-14T07:00" },
  { id: "r08", weight: 183.8, unit: "lb", measured_at: "2026-06-12T17:32" },
  { id: "r09", weight: 188.2, unit: "lb", measured_at: "2026-06-12T00:44" },
  { id: "r10", weight: 180.2, unit: "lb", measured_at: "2026-06-10T09:11" },
  { id: "r11", weight: 179.6, unit: "lb", measured_at: "2026-06-07T10:14" },
  { id: "r12", weight: 180.8, unit: "lb", measured_at: "2026-06-06T08:02" },
  { id: "r13", weight: 182.4, unit: "lb", measured_at: "2026-06-06T00:03" },
  // --- extended history so a 20-row page cap actually bites ---
  { id: "r14", weight: 181.2, unit: "lb", measured_at: "2026-06-04T07:41" },
  { id: "r15", weight: 183.0, unit: "lb", measured_at: "2026-06-03T21:10" },
  { id: "r16", weight: 181.6, unit: "lb", measured_at: "2026-06-03T07:25" },
  { id: "r17", weight: 182.2, unit: "lb", measured_at: "2026-06-02T08:05" },
  { id: "r18", weight: 184.0, unit: "lb", measured_at: "2026-05-31T09:30" },
  { id: "r19", weight: 183.4, unit: "lb", measured_at: "2026-05-30T08:48" },
  { id: "r20", weight: 185.6, unit: "lb", measured_at: "2026-05-28T22:15" },
  { id: "r21", weight: 184.2, unit: "lb", measured_at: "2026-05-28T07:02" },
  { id: "r22", weight: 184.8, unit: "lb", measured_at: "2026-05-27T08:20" },
  { id: "r23", weight: 186.0, unit: "lb", measured_at: "2026-05-26T09:05" },
];

/** The one-reading-so-far case (delta-less, trend-less, but not empty). */
export const FIRST_READING: Reading[] = [
  { id: "f1", weight: 186.0, unit: "lb", measured_at: "2026-06-17T08:30" },
];

export const FIXTURE_GOAL: Goal = {
  weight: 178,
  unit: "lb",
  created_at: "2026-05-01T00:00",
};

/** The `created_at: null` case — toolbar shows "Set goal weight". */
export const NO_GOAL: Goal = { weight: 0, unit: "lb", created_at: null };

// --- Derivation ------------------------------------------------------

function dayKey(measuredAt: string): string {
  // Literal date prefix — see the module note on timezone-free bucketing.
  return measuredAt.slice(0, 10);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

export function directionOf(delta: number | null): Direction {
  if (delta === null || Math.abs(delta) < 0.05) return "flat";
  return delta < 0 ? "down" : "up";
}

/**
 * Group flat readings into calendar days (newest day first), deriving the
 * average / spread / multi flag per day and the day-over-day delta vs the
 * next-older day. `deltaDay < 0` means the body trended *down* — toward
 * the cut goal in the fixture — which every variant renders in the accent.
 */
export function groupByDay(readings: Reading[]): DayGroup[] {
  const buckets = new Map<string, Reading[]>();
  for (const r of readings) {
    const k = dayKey(r.measured_at);
    const list = buckets.get(k);
    if (list) list.push(r);
    else buckets.set(k, [r]);
  }

  const keys = [...buckets.keys()].sort().reverse(); // newest day first

  // Walk oldest → newest to compute day-over-day deltas, then reverse.
  const oldestFirst = [...keys].reverse();
  const byKey = new Map<string, DayGroup>();
  let prevAvg: number | null = null;

  for (const k of oldestFirst) {
    const dayReadings = [...buckets.get(k)!].sort((a, b) =>
      a.measured_at < b.measured_at ? -1 : 1,
    );
    const weights = dayReadings.map((r) => r.weight);
    const avg = round1(weights.reduce((s, w) => s + w, 0) / weights.length);
    const hi = Math.max(...weights);
    const lo = Math.min(...weights);
    const deltaDay = prevAvg === null ? null : round1(avg - prevAvg);
    byKey.set(k, {
      dateKey: k,
      date: new Date(`${k}T00:00`),
      readings: dayReadings,
      unit: dayReadings[0].unit,
      avg,
      hi,
      lo,
      spread: round1(hi - lo),
      multi: dayReadings.length > 1,
      deltaDay,
      directionDay: directionOf(deltaDay),
    });
    prevAvg = avg;
  }

  return keys.map((k) => byKey.get(k)!);
}

/** Per-reading delta vs the immediately-prior (older) reading overall. */
export function readingDeltas(readings: Reading[]): Map<string, number | null> {
  // readings come newest-first; prior = the next entry in the list.
  const out = new Map<string, number | null>();
  for (let i = 0; i < readings.length; i++) {
    const next = readings[i + 1];
    out.set(readings[i].id, next ? round1(readings[i].weight - next.weight) : null);
  }
  return out;
}

export type WeekSummary = {
  avg: number | null;
  deltaVsPrevWeek: number | null;
  direction: Direction;
  streakDays: number; // consecutive most-recent calendar days with a reading
  loggedDays: number;
  toGoal: number | null; // latest day-avg − goal (null if no goal)
  unit: Unit;
};

/** The summary band the stat-ledger variant leads with. */
export function summarize(days: DayGroup[], goal: Goal): WeekSummary {
  if (days.length === 0) {
    return {
      avg: null,
      deltaVsPrevWeek: null,
      direction: "flat",
      streakDays: 0,
      loggedDays: 0,
      toGoal: null,
      unit: goal.unit,
    };
  }

  const unit = days[0].unit;
  const last7 = days.slice(0, 7);
  const prev7 = days.slice(7, 14);
  const mean = (ds: DayGroup[]) =>
    ds.length ? round1(ds.reduce((s, d) => s + d.avg, 0) / ds.length) : null;

  const avg = mean(last7);
  const prevAvg = mean(prev7);
  const deltaVsPrevWeek = avg !== null && prevAvg !== null ? round1(avg - prevAvg) : null;

  // Logged-day streak: consecutive calendar days back from the newest,
  // counting a day only if it has a reading.
  const have = new Set(days.map((d) => d.dateKey));
  let streak = 0;
  const cursor = new Date(days[0].date);
  // Streak is anchored at the most recent logged day.
  while (have.has(toKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  const toGoal = goal.created_at ? round1(days[0].avg - goal.weight) : null;

  return {
    avg,
    deltaVsPrevWeek,
    direction: directionOf(deltaVsPrevWeek),
    streakDays: streak,
    loggedDays: days.length,
    toGoal,
    unit,
  };
}

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// --- Formatting (mirrors the shipped table's helpers) ----------------

export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = round1(v);
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Signed, always one-decimal — for delta chips ("+0.8", "−0.6"). */
export function fmtSigned(v: number): string {
  const r = round1(Math.abs(v));
  const body = Number.isInteger(r) ? `${r}.0` : r.toFixed(1);
  return `${v < 0 ? "−" : v > 0 ? "+" : "±"}${body}`;
}

export function fmtDelta(v: number): string {
  const r = round1(Math.abs(v));
  return Number.isInteger(r) ? `${r}.0` : r.toFixed(1);
}

export function fmtTime(measuredAt: string): string {
  return new Date(measuredAt).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtDayLong(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function fmtDayShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function fmtWeekday(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

export function fmtMonthDay(d: Date): { mon: string; day: string } {
  return {
    mon: d.toLocaleDateString("en-US", { month: "short" }),
    day: String(d.getDate()),
  };
}

/** "morning" / "evening"-ish label for a reading's time-of-day. */
export function partOfDay(measuredAt: string): string {
  const h = new Date(measuredAt).getHours();
  if (h < 5) return "Late";
  if (h < 11) return "AM";
  if (h < 17) return "Midday";
  if (h < 22) return "PM";
  return "Late";
}

export const PAGE_SIZE = 20;
