/**
 * Shared formatting and status→token mapping for the four running tiles.
 *
 * Single-sourced on purpose: four hand-rolled copies of the status switch is
 * exactly how a +25% week ends up red. The mapping is the SOW's color
 * contract — ramping reads as warning (a big week is a CHOICE, not a
 * failure: nothing in this family is ever danger red), building as success,
 * resting/easing as muted. Pure functions, no React; reads the v0.4 CSS vars
 * by name, never a raw hex.
 */

import type { DistanceUnit } from "@/lib/distance-unit-context";

const KM_PER_MILE = 1.609344;

/** The ramp band above which a build reads as warning (per week, %). */
export const RAMP_WARNING_PCT = 10;

export type LoadStatus = "resting" | "ramping" | "building" | "easing";

/** SOW status bands. A zero-run week is resting no matter what the delta says. */
export function loadStatus(deltaPct: number, runCount: number): LoadStatus {
  if (runCount === 0) return "resting";
  if (deltaPct >= RAMP_WARNING_PCT) return "ramping";
  if (deltaPct >= 0) return "building";
  return "easing";
}

/** Status → CSS var. Never `--danger`: running more than usual is not an emergency. */
export function loadStatusColor(status: LoadStatus): string {
  switch (status) {
    case "ramping":
      return "var(--warning)";
    case "building":
      return "var(--success)";
    default:
      return "var(--muted)"; // resting, easing
  }
}

/** Signed integer with a unicode minus: +3 / −17 / ±0. */
export function signed(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "±0";
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

/** Signed percentage: +25% / −100% / ±0%. */
export function signedPct(pct: number): string {
  return `${signed(pct)}%`;
}

/**
 * Signed pace delta vs a baseline, converted to seconds in the display unit
 * (s/mi under "mi", s/km under "km") — a signed difference of two server
 * figures, the only pace arithmetic a tile may do.
 */
export function paceDelta(secPerKm: number, baselineSecPerKm: number, unit: DistanceUnit): string {
  const factor = unit === "mi" ? KM_PER_MILE : 1;
  return `${signed((secPerKm - baselineSecPerKm) * factor)}s`;
}

/** Short local date for a run's own timestamp ("Aug 1") — pure, prop-driven. */
export function shortDate(startTime: string): string {
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "2026-08-01" → "Sat" — parsed as local date parts, no timezone drift. */
export function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

/** Honest coverage caption: "3 of 4 runs". */
export function coverageCaption(n: number, total: number): string {
  return `${n} of ${total} ${total === 1 ? "run" : "runs"}`;
}

/**
 * Zone index (1..5, as the API ships it) → its CSS var. Anything else —
 * including null when Run Effort's engine is unwired — reads neutral ink,
 * never a guessed zone.
 */
export function zoneToken(zone: number | null): string {
  if (zone === null || zone < 1 || zone > 5) return "var(--muted)";
  return `var(--zone-${zone})`;
}
