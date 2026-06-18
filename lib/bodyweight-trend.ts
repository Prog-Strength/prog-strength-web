import type { BodyweightEntry } from "./api";

const LB_PER_KG = 2.20462;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Convert a weight between lb and kg. Identity when units match. */
export function convertWeight(weight: number, from: "lb" | "kg", to: "lb" | "kg"): number {
  if (from === to) return weight;
  return from === "kg" ? weight * LB_PER_KG : weight / LB_PER_KG;
}

/** One per-day aggregate: local-noon timestamp, daily mean (in display
 * unit), and the intra-day max−min spread (0 for a single reading). */
export type DayPoint = { t: number; avg: number; spread: number };

/** Group readings by LOCAL calendar day, mean them in the display unit,
 * and timestamp each day at local noon — the same grouping the chart has
 * always used. Returns points sorted ascending by time. */
export function buildDayPoints(entries: BodyweightEntry[], displayUnit: "lb" | "kg"): DayPoint[] {
  const byDay = new Map<number, number[]>();
  for (const e of entries) {
    const d = new Date(e.measured_at);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const arr = byDay.get(dayStart) ?? [];
    arr.push(convertWeight(e.weight, e.unit, displayUnit));
    byDay.set(dayStart, arr);
  }
  const points: DayPoint[] = [];
  for (const [dayStart, weights] of byDay) {
    const avg = weights.reduce((a, b) => a + b, 0) / weights.length;
    const spread = Math.max(...weights) - Math.min(...weights);
    points.push({ t: dayStart + 12 * 60 * 60 * 1000, avg, spread });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

/** One point on the smoothed trend: the EWMA value plus the ±band edges. */
export type TrendPoint = { t: number; trend: number; lo: number; hi: number };

/** TrendWeight-style exponentially-weighted moving average over the daily
 * means (α 0.25 by default). Seeds `s` at the first day's mean, then
 * `s = α·avg + (1−α)·s`; tracks an EW variance of the residual and emits a
 * ±band of `max(√v, 0.6) + spread/2`. */
export function ewmaTrend(dayPoints: DayPoint[], alpha = 0.25): TrendPoint[] {
  if (dayPoints.length === 0) return [];
  let s = dayPoints[0].avg;
  let v = 0;
  const out: TrendPoint[] = [];
  for (const p of dayPoints) {
    s = alpha * p.avg + (1 - alpha) * s;
    const dev = p.avg - s;
    v = alpha * dev * dev + (1 - alpha) * v;
    const band = Math.max(Math.sqrt(v), 0.6) + p.spread / 2;
    out.push({ t: p.t, trend: s, lo: s - band, hi: s + band });
  }
  return out;
}

/** The hero readout: the latest trend value, plus a time-normalized weekly
 * rate of change. `hasRate` is false (and `ratePerWeek` null) when there is
 * under ~a week of data or only one point. */
export type TrendSummary = {
  current: number | null;
  ratePerWeek: number | null;
  hasRate: boolean;
};

export function trendSummary(trend: TrendPoint[]): TrendSummary {
  if (trend.length === 0) return { current: null, ratePerWeek: null, hasRate: false };
  const last = trend[trend.length - 1];
  const current = last.trend;
  // Reference point: the nearest trend point at least 7 days before the
  // latest. `trend` is sorted ascending, so the last qualifying point is the
  // one closest to the 7-day mark. Time-normalize rather than stepping a
  // fixed number of indices back, so gaps / multi-per-day don't skew it.
  const cutoff = last.t - 7 * DAY_MS;
  let ref: TrendPoint | null = null;
  for (const p of trend) {
    if (p.t <= cutoff) ref = p;
  }
  if (!ref) return { current, ratePerWeek: null, hasRate: false };
  const deltaDays = (last.t - ref.t) / DAY_MS;
  if (deltaDays <= 0) return { current, ratePerWeek: null, hasRate: false };
  const ratePerWeek = ((last.trend - ref.trend) / deltaDays) * 7;
  return { current, ratePerWeek, hasRate: true };
}

/** Derived summary stats for the caption strip: count, average, dated
 * min/max, and the range delta (last day mean − first day mean). */
export type Stats = {
  count: number;
  avg: number | null;
  min: { weight: number; date: string } | null;
  max: { weight: number; date: string } | null;
  delta: number | null;
};

export function computeStats(entries: BodyweightEntry[], displayUnit: "lb" | "kg"): Stats {
  if (entries.length === 0) {
    return { count: 0, avg: null, min: null, max: null, delta: null };
  }
  const normalized = entries.map((e) => ({
    weight: convertWeight(e.weight, e.unit, displayUnit),
    measured_at: e.measured_at,
  }));
  const sum = normalized.reduce((a, b) => a + b.weight, 0);
  const avg = sum / normalized.length;
  const min = normalized.reduce((acc, w) => (w.weight < acc.weight ? w : acc), normalized[0]);
  const max = normalized.reduce((acc, w) => (w.weight > acc.weight ? w : acc), normalized[0]);

  const byDay = new Map<number, number[]>();
  for (const w of normalized) {
    const d = new Date(w.measured_at);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const arr = byDay.get(dayStart) ?? [];
    arr.push(w.weight);
    byDay.set(dayStart, arr);
  }
  const dayStartTimes = [...byDay.keys()].sort((a, b) => a - b);
  let delta: number | null = null;
  if (dayStartTimes.length >= 2) {
    const firstAvg = mean(byDay.get(dayStartTimes[0]) ?? []);
    const lastAvg = mean(byDay.get(dayStartTimes[dayStartTimes.length - 1]) ?? []);
    delta = lastAvg - firstAvg;
  }

  return {
    count: entries.length,
    avg,
    min: { weight: min.weight, date: min.measured_at },
    max: { weight: max.weight, date: max.measured_at },
    delta,
  };
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
