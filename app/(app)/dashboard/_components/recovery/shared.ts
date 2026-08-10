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
 *
 * The remit now also covers BASELINE DRIFT — whether the athlete's normal range
 * is itself moving — which is a different question from "was last night normal"
 * and carries its own glyphs and its own color mapping. Same single-sourcing
 * argument: the drift tag reads identically wherever it is printed.
 */

import type {
  RecoveryBaselineTrendView,
  RecoveryHrvStatus,
  RecoveryTrendDirection,
} from "@/lib/dashboard";

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

/**
 * The house word for each status (sentence case). `unknown` splits on WHY it is
 * unknown: with a reading in hand the baseline is still calibrating, without one
 * the morning webhook simply has not landed yet, and conflating the two tells a
 * user at 7am that their history is too short when it is not. Defaults to the
 * pre-existing behaviour so the other recovery tiles are unaffected.
 */
export function statusWord(status: RecoveryHrvStatus, hasReading = true): string {
  switch (status) {
    case "suppressed":
      return "Suppressed";
    case "elevated":
      return "Elevated";
    case "balanced":
      return "Balanced";
    default:
      return hasReading ? "Calibrating" : "No reading yet";
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

/** The glyph for a baseline-drift direction; `·` when there is no verdict. */
export function driftGlyph(direction: RecoveryTrendDirection): string {
  switch (direction) {
    case "rising":
      return "▲";
    case "falling":
      return "▼";
    case "steady":
      return "▬";
    default:
      return "·";
  }
}

/**
 * The color a DRIFT direction carries. Deliberately NOT `hrvStatusColor`: this
 * is about the RANGE moving over weeks, not about last night, so the two must
 * not share a mapping. Steady and unknown stay muted so an ordinary month reads
 * calm rather than as an absence, and color is spent only where the baseline is
 * actually going somewhere.
 */
export function driftColor(direction: RecoveryTrendDirection): string {
  switch (direction) {
    case "rising":
      return "var(--success)";
    case "falling":
      return "var(--warning)";
    default:
      return "var(--muted)";
  }
}

/**
 * The drift tag, e.g. `▲ +6 ms · 4w` — or a shrug when the history is too short
 * to say. The magnitude prints whenever `deltaMs` is known, INCLUDING a `steady`
 * verdict: a bare "steady" throws away the number the user came for.
 */
export function driftTag(drift: RecoveryBaselineTrendView, unit = " ms"): string {
  if (drift.deltaMs === null || drift.direction === "unknown") return "drift not yet known";
  const weeks = Math.round(drift.overDays / 7);
  return `${driftGlyph(drift.direction)} ${signed(drift.deltaMs)}${unit} · ${weeks}w`;
}

/** "2026-08-01" → "Sat". Parsed as local date parts — no timezone drift. */
export function weekday(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}
