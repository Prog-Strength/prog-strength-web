/**
 * Shared static fixtures for the bodyweight-page design exploration.
 *
 * These are MOCKUP fixtures, not live data — the DX renders five throwaway
 * visual variants side by side, so realistic-but-static numbers are exactly
 * what we want (see prog-strength-docs/dx/bodyweight-page.md → "These are
 * mockups: static fixtures that look real are preferred").
 *
 * The representative fixture mirrors the screenshot that prompted the DX:
 * a 30-day window ending Wed Jun 17 2026, unit lb, goal 178, several days
 * with a morning + evening reading 1–3 lb apart, trend wandering ~180→188
 * while sitting above a flat goal line at 178.
 *
 * Everything here is derived deterministically in UTC so the mockup renders
 * identically regardless of the viewer's timezone — no Date.now(), no local
 * date drift between server render and hydration.
 */

export type Reading = {
  /** minutes past midnight UTC on the day, for ordering + time label */
  hour: number;
  minute: number;
  weight: number;
};

export type Day = {
  /** 0-based month (5 = June) */
  month: number;
  day: number;
  readings: Reading[];
};

const YEAR = 2026;
export const UNIT = "lb" as const;
export const GOAL = 178;

// One row per calendar day, oldest → newest. Days with two readings carry a
// morning + evening pair 1–3 lb apart (the "heavy daily spread" the surface
// must stay legible through). May 30, Jun 7 (min), Jun 12 (max), Jun 15
// (a late 11:24 PM reading) and the recent Jun 16/17 rows mirror the ticket's
// named fixture points exactly.
const DAYS: Day[] = [
  { month: 4, day: 18, readings: [{ hour: 7, minute: 40, weight: 185.2 }] },
  { month: 4, day: 19, readings: [{ hour: 7, minute: 12, weight: 184.6 }] },
  {
    month: 4,
    day: 20,
    readings: [
      { hour: 7, minute: 20, weight: 183.6 },
      { hour: 21, minute: 10, weight: 184.4 },
    ],
  },
  { month: 4, day: 21, readings: [{ hour: 7, minute: 5, weight: 183.2 }] },
  { month: 4, day: 22, readings: [{ hour: 6, minute: 55, weight: 182.4 }] },
  {
    month: 4,
    day: 23,
    readings: [
      { hour: 7, minute: 30, weight: 182.4 },
      { hour: 22, minute: 5, weight: 183.6 },
    ],
  },
  { month: 4, day: 24, readings: [{ hour: 8, minute: 2, weight: 184.0 }] },
  { month: 4, day: 25, readings: [{ hour: 7, minute: 18, weight: 184.8 }] },
  { month: 4, day: 26, readings: [{ hour: 7, minute: 44, weight: 185.4 }] },
  { month: 4, day: 27, readings: [{ hour: 7, minute: 9, weight: 186.0 }] },
  {
    month: 4,
    day: 28,
    readings: [
      { hour: 7, minute: 15, weight: 184.6 },
      { hour: 21, minute: 40, weight: 185.8 },
    ],
  },
  { month: 4, day: 29, readings: [{ hour: 7, minute: 22, weight: 184.4 }] },
  {
    month: 4,
    day: 30,
    readings: [
      { hour: 7, minute: 35, weight: 182.0 },
      { hour: 21, minute: 15, weight: 182.4 },
    ],
  },
  { month: 4, day: 31, readings: [{ hour: 7, minute: 50, weight: 181.6 }] },
  { month: 5, day: 1, readings: [{ hour: 7, minute: 12, weight: 182.0 }] },
  { month: 5, day: 2, readings: [{ hour: 7, minute: 28, weight: 183.4 }] },
  {
    month: 5,
    day: 3,
    readings: [
      { hour: 7, minute: 20, weight: 183.6 },
      { hour: 22, minute: 30, weight: 184.8 },
    ],
  },
  { month: 5, day: 4, readings: [{ hour: 7, minute: 6, weight: 183.0 }] },
  { month: 5, day: 5, readings: [{ hour: 7, minute: 40, weight: 181.4 }] },
  { month: 5, day: 6, readings: [{ hour: 7, minute: 15, weight: 180.2 }] },
  { month: 5, day: 7, readings: [{ hour: 7, minute: 2, weight: 179.6 }] }, // min
  { month: 5, day: 8, readings: [{ hour: 7, minute: 33, weight: 180.8 }] },
  {
    month: 5,
    day: 9,
    readings: [
      { hour: 7, minute: 25, weight: 181.8 },
      { hour: 21, minute: 50, weight: 183.0 },
    ],
  },
  { month: 5, day: 10, readings: [{ hour: 7, minute: 10, weight: 184.6 }] },
  { month: 5, day: 11, readings: [{ hour: 7, minute: 48, weight: 186.8 }] },
  { month: 5, day: 12, readings: [{ hour: 7, minute: 4, weight: 188.2 }] }, // max
  { month: 5, day: 13, readings: [{ hour: 7, minute: 36, weight: 187.4 }] },
  { month: 5, day: 14, readings: [{ hour: 7, minute: 19, weight: 186.6 }] },
  {
    month: 5,
    day: 15,
    readings: [
      { hour: 7, minute: 30, weight: 186.0 },
      { hour: 23, minute: 24, weight: 187.8 }, // late evening reading
    ],
  },
  { month: 5, day: 16, readings: [{ hour: 9, minute: 17, weight: 185.4 }] },
  { month: 5, day: 17, readings: [{ hour: 9, minute: 47, weight: 185.0 }] },
];

/** "Now" pinned to the fixture's last reading so range math is stable. */
export const NOW_MS = Date.UTC(YEAR, 5, 17, 12, 0);

export type RawPoint = { t: number; weight: number; hour: number; minute: number };
export type DayPoint = {
  t: number; // noon UTC of the day, where the trend line plots
  month: number;
  day: number;
  avg: number;
  readings: Reading[];
  spread: number; // max-min within the day (0 for single readings)
};

function dayMs(d: Day, hour = 12, minute = 0): number {
  return Date.UTC(YEAR, d.month, d.day, hour, minute);
}

/** Every individual weigh-in as a scatter point (raw readings). */
export const RAW_POINTS: RawPoint[] = DAYS.flatMap((d) =>
  d.readings.map((r) => ({
    t: dayMs(d, r.hour, r.minute),
    weight: r.weight,
    hour: r.hour,
    minute: r.minute,
  })),
);

/** One arithmetic-mean point per calendar day, plotted at noon. */
export const DAY_POINTS: DayPoint[] = DAYS.map((d) => {
  const ws = d.readings.map((r) => r.weight);
  const avg = ws.reduce((a, b) => a + b, 0) / ws.length;
  const spread = Math.max(...ws) - Math.min(...ws);
  return { t: dayMs(d), month: d.month, day: d.day, avg, readings: d.readings, spread };
});

/**
 * TrendWeight-style exponentially-weighted moving average over the daily
 * means — the smoothed curve a variant may make the subject. Alpha 0.25 is
 * a gentle smoothing that reads the trajectory through the daily scatter.
 * Also returns a ±band (one rolling standard-deviation-ish envelope) so the
 * spread can be drawn as context around the trend.
 */
export type TrendPoint = { t: number; trend: number; lo: number; hi: number };
export function ewmaTrend(alpha = 0.25): TrendPoint[] {
  const out: TrendPoint[] = [];
  let s = DAY_POINTS[0]?.avg ?? 0;
  let v = 0; // EW variance of (reading - trend)
  for (const p of DAY_POINTS) {
    s = alpha * p.avg + (1 - alpha) * s;
    const dev = p.avg - s;
    v = alpha * dev * dev + (1 - alpha) * v;
    const band = Math.max(Math.sqrt(v), 0.6) + p.spread / 2;
    out.push({ t: p.t, trend: s, lo: s - band, hi: s + band });
  }
  return out;
}

/** Latest smoothed trend value and its weekly rate of change. */
export function trendSummary() {
  const trend = ewmaTrend();
  const last = trend[trend.length - 1];
  const weekAgo = trend[Math.max(0, trend.length - 8)];
  const ratePerWeek = last.trend - weekAgo.trend;
  return { current: last.trend, ratePerWeek };
}

/**
 * Canonical headline numbers, taken verbatim from the ticket's
 * representative fixture so every variant shows the same agreed stats
 * (the screenshot the DX is reconciling against).
 */
export const SUMMARY = {
  average: 183.4,
  deltaLb: -0.2,
  deltaPct: -0.1,
  min: { weight: 179.6, label: "Jun 7" },
  max: { weight: 188.2, label: "Jun 12" },
  goal: GOAL,
  toGo: 5.4,
  readingCount: RAW_POINTS.length,
  rangeLabel: "30 days",
  endLabel: "Wed, Jun 17 2026",
} as const;

// --- formatting helpers (shared by variants) ----------------------

export function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function fmtSigned(v: number): string {
  return `${v >= 0 ? "+" : ""}${fmt(v)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtTick(t: number): string {
  const d = new Date(t);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtDayLong(t: number): string {
  const d = new Date(t);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtWeekday(month: number, day: number): string {
  const d = new Date(Date.UTC(YEAR, month, day, 12));
  return WEEKDAYS[d.getUTCDay()];
}

export function fmtMonthDay(month: number, day: number): string {
  return `${MONTHS[month]} ${day}`;
}

export function fmtTime(hour: number, minute: number): string {
  const ampm = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}
