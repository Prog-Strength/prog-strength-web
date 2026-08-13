/**
 * Small helpers shared by the `recovery-page-refresh` variants — THROWAWAY.
 *
 * Dates, windowing, ledger paging and the two chart scales that more than one
 * variant needs. Everything here is presentation arithmetic — mapping a value
 * the fixture (standing in for the server) already computed onto a pixel or a
 * percentage. Nothing invents a baseline, a band, or a verdict: a variant that
 * wants a resting-HR band declares prerequisite P2 and says so on the page.
 *
 * Deliberately NOT a component library. The variants duplicate their panels,
 * pagers and headers on purpose — the exploration's value is the spread, and a
 * shared abstraction would quietly pull four compositions back together.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";

/** The house pager size, from the bodyweight readings table. */
export const LEDGER_PAGE_SIZE = 20;

// ── Dates ─────────────────────────────────────────────────────────────────────

/** Parse a local YYYY-MM-DD without the UTC shift `new Date(iso)` applies. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Wed 12 Aug" — the ledger's date column. */
export function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "12 Aug" — where the weekday is noise. */
export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function monthLabel(iso: string): string {
  return MONTHS[parseISO(iso).getMonth()];
}

/** "Aug 2026" — the rail's month ruler. */
export function monthYear(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function isMonthStart(iso: string): boolean {
  return parseISO(iso).getDate() === 1;
}

export function weekdayOf(iso: string): string {
  return WEEKDAYS[parseISO(iso).getDay()];
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/** A morning Whoop never recorded at all — a hollow cell, never a zero. */
export function isMissingNight(d: RecoveryDayPoint): boolean {
  return d.recoveryScore === null && d.restingHr === null && d.hrv === null;
}

/**
 * The ledger's rows: newest first, and mornings Whoop never recorded dropped
 * rather than printed as a row of em-dashes. The charts keep the date-aligned
 * slot (that is what makes the gap visible); the record has nothing to record.
 */
export function ledgerRows(days: RecoveryDayPoint[]): RecoveryDayPoint[] {
  return days.filter((d) => !isMissingNight(d)).reverse();
}

export function pageCount(total: number, per = LEDGER_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / per));
}

export function pageOf<T>(rows: T[], page: number, per = LEDGER_PAGE_SIZE): T[] {
  return rows.slice((page - 1) * per, page * per);
}

/** The last `n` date-aligned days, oldest → newest. */
export function tail(days: RecoveryDayPoint[], n: number): RecoveryDayPoint[] {
  return days.slice(Math.max(0, days.length - n));
}

/**
 * A view narrowed to a sub-window of its own history, so `prepareHrvChart` can
 * be run at page scale over 90 days rather than over fourteen months. Every
 * derived block travels untouched — the window changes what is DRAWN, never
 * what the server said.
 */
export function windowView(view: RecoveryView, days: RecoveryDayPoint[]): RecoveryView {
  return { ...view, days };
}

/** Mean of the non-null values, or null when there are none. */
export function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

export function round(v: number | null): string {
  return v === null ? "—" : String(Math.round(v));
}

/** "+6" / "−3" / "±0" — the house sign convention (a real minus sign). */
export function signed(v: number, digits = 0): string {
  const r = Number(v.toFixed(digits));
  if (r === 0) return "±0";
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

// ── Scales ────────────────────────────────────────────────────────────────────

/** Map a value in `[min,max]` onto `[0,1]`, clamped. */
export function norm(v: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

/**
 * A y-scale over `domain`, mapping the top of the range to `top` pixels and the
 * bottom to `top + height`. Same convention as the HRV chart's own `scaler`,
 * restated here so a variant that never touches HRV does not import from it.
 */
export function yScale(domain: [number, number], top: number, height: number) {
  const [lo, hi] = domain;
  return (v: number) => top + (1 - norm(v, lo, hi)) * height;
}

/** A padded domain over the present values, with a minimum span so a flat
 *  stretch does not get magnified into a mountain range. */
export function extent(values: (number | null)[], minSpan: number, pad = 0.08): [number, number] {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return [0, minSpan];
  let lo = Math.min(...present);
  let hi = Math.max(...present);
  if (hi - lo < minSpan) {
    const mid = (hi + lo) / 2;
    lo = mid - minSpan / 2;
    hi = mid + minSpan / 2;
  }
  const p = (hi - lo) * pad;
  return [lo - p, hi + p];
}

// ── Score bands ───────────────────────────────────────────────────────────────

/**
 * Whoop's canonical thirds, which is the whole reason a banded score chart is
 * free: the boundaries are fixed, user-recognised, and need no server figure.
 */
export const SCORE_ZONES = [
  { key: "red", from: 0, to: 33, color: "var(--danger)", word: "Low" },
  { key: "yellow", from: 34, to: 66, color: "var(--warning)", word: "Adequate" },
  { key: "green", from: 67, to: 100, color: "var(--success)", word: "Recovered" },
] as const;

/** Day-count per band over a window — the distribution stated as text. */
export function bandCounts(days: RecoveryDayPoint[]): {
  green: number;
  yellow: number;
  red: number;
} {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const d of days) {
    if (d.recoveryScore === null) continue;
    if (d.recoveryScore >= 67) counts.green += 1;
    else if (d.recoveryScore >= 34) counts.yellow += 1;
    else counts.red += 1;
  }
  return counts;
}
