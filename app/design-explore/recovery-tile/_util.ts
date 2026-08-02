/**
 * Shared throwaway helpers for the recovery-tile DX variants.
 *
 * Formatting + status→token mapping only. Nothing here recomputes a server
 * figure (baseline averages, band bounds, z-score are displayed as received);
 * the derivations below are only signed deltas of a today-value against a
 * baseline the server already computed, and short weekday labels.
 */

import type { RecoveryHrvStatus, RecoveryTrendDirection } from "@/lib/dashboard";

/** A guarded recovery view — the three optional blocks proven present. */
export type CalibratedGuard = {
  hasCore: boolean;
};

/** Signed delta string, e.g. +3 / −17 / ±0, with a unicode minus. */
export function signed(n: number, digits = 0): string {
  const r = digits > 0 ? Number(n.toFixed(digits)) : Math.round(n);
  if (r === 0) return `±0`;
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

/** Signed delta with a unit suffix, e.g. "−17 ms". */
export function signedUnit(n: number, unit: string, digits = 0): string {
  return `${signed(n, digits)} ${unit}`;
}

/**
 * Map an HRV balance status to its color role on THIS surface.
 *   suppressed → warning (never danger — a bad night is information)
 *   elevated   → accent  (unusual, NOT "extra good")
 *   balanced   → success (the ordinary state — calm, unremarkable)
 *   unknown    → muted
 * Returns a CSS var string.
 */
export function hrvStatusColor(status: RecoveryHrvStatus): string {
  switch (status) {
    case "suppressed":
      return "var(--warning)";
    case "elevated":
      return "var(--accent)";
    case "balanced":
      return "var(--success)";
    case "unknown":
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

/** A small glyph + word for a trend direction. */
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

/** "2026-08-01" → "Fri". Parsed as a local date, no timezone drift. */
export function weekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}
