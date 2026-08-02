/**
 * Shared formatting and status→token mapping for the five recovery tiles.
 *
 * Single-sourced on purpose: five hand-rolled copies of the status switch is
 * exactly how `elevated` ends up green on one tile. The mapping is the SOW's
 * color contract — `suppressed` reads as warning (a low-HRV morning is
 * information, not an emergency, never danger red), `elevated` reads as accent
 * (unusual, never a bigger green), `balanced` reads as success (the ordinary
 * state), `unknown` reads as muted. Pure functions, no React; reads the v0.4
 * CSS vars by name, never a raw hex.
 */

import type { RecoveryHrvStatus, RecoveryTrendDirection } from "@/lib/dashboard";

/** Map an HRV balance status to the CSS var that carries its color. */
export function hrvStatusColor(status: RecoveryHrvStatus): string {
  switch (status) {
    case "suppressed":
      return "var(--warning)";
    case "elevated":
      return "var(--accent)";
    case "balanced":
      return "var(--success)";
    default:
      return "var(--muted)";
  }
}

/** The house word for each status (sentence case). */
export function statusWord(status: RecoveryHrvStatus): string {
  switch (status) {
    case "suppressed":
      return "Suppressed";
    case "elevated":
      return "Elevated";
    case "balanced":
      return "Balanced";
    default:
      return "Calibrating";
  }
}

/** A small glyph + word pair for a trend direction. */
export function trendLabel(trend: RecoveryTrendDirection): { glyph: string; word: string } {
  switch (trend) {
    case "rising":
      return { glyph: "▲", word: "rising this week" };
    case "falling":
      return { glyph: "▼", word: "falling this week" };
    case "steady":
      return { glyph: "▬", word: "steady this week" };
    default:
      return { glyph: "·", word: "calibrating" };
  }
}

/** Signed delta string, e.g. +3 / −17 / ±0, always with a unicode minus. */
export function signed(n: number, digits = 0): string {
  const r = digits > 0 ? Number(n.toFixed(digits)) : Math.round(n);
  if (r === 0) return "±0";
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

/** Signed delta with a unit suffix, e.g. "−17 ms". */
export function signedUnit(n: number, unit: string, digits = 0): string {
  return `${signed(n, digits)} ${unit}`;
}

/** "2026-08-01" → "Sat". Parsed as local date parts — no timezone drift. */
export function weekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}
