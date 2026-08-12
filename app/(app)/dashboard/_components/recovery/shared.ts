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
 *
 * The remit now also covers WHOOP'S RECOVERY-BAND VOCABULARY and one display
 * formatter, so the recovery log's bands and figures are single-sourced too.
 * The recovery SCORE is the one deliberate exception to the no-danger-red rule
 * above: a sub-33 score reads as `--danger` because that is Whoop's own red in
 * Whoop's own app. The rule still holds for HRV — a `suppressed` morning is
 * warning, never danger.
 */

import type {
  RecoveryBaselineTrendView,
  RecoveryHrvStatus,
  RecoveryTrendDirection,
} from "@/lib/dashboard";
import type { NightMark } from "./hrv-chart";

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
 * The paint for ONE night, shared by both views of the HRV tile.
 *
 * This exists because the tile's two views draw the same thirty-one nights in
 * two idioms — a dot on a chart, a mark on a rail — and the user swipes between
 * them. A night that is green on one and grey on the other reads as the tile
 * contradicting itself, so the color is decided here, once, and neither view
 * keeps a palette of its own. That is what "the same green means balanced on
 * both views" costs: exactly this function.
 *
 * A night with no reading is not a status — it is an absence, and it takes the
 * surface color (a blank slot on the rail; the chart simply draws no dot).
 */
export function nightColor(mark: NightMark): string {
  if (!mark.hasReading) return "var(--surface-2)";
  return hrvStatusColor(mark.status);
}

/**
 * Weight for one night's paint. Full strength for a night that says something
 * definite, and two deliberate reductions: a night whose own band was not
 * established yet is drawn faintly (0.45) because the color is `--muted`
 * standing in for "no verdict", and an ISOLATED suppressed night is drawn at
 * 0.55 so a genuine sustained dip — three or more in a row — is the thing that
 * reads as solid warning. Both views apply it, so the emphasis matches.
 */
export function nightOpacity(mark: NightMark): number {
  if (!mark.hasReading) return 1;
  if (mark.status === "unknown") return 0.45;
  if (mark.status === "suppressed" && !mark.sustained) return 0.55;
  return 1;
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

/** A recovery score's band — a third of Whoop's 0–100 scale, or `none` when there is no score. */
export type RecoveryBand = "green" | "yellow" | "red" | "none";

/**
 * Which third of Whoop's published 0–100 recovery scale a score falls in, at
 * Whoop's own published cut points (67 and 33). This is a LABELLING, not a
 * recomputation: the house rule forbids re-deriving a server figure — an
 * average, a band bound, a z-score — and naming a third of a fixed scale
 * introduces no statistics. Single-sourced here for the reason this file
 * already exists: three hand-rolled copies of a threshold switch is how `52`
 * ends up green on one tile and yellow on another.
 *
 * This is NOT the only `recoveryBand` in the repo. `lib/recovery.ts` already
 * exports `RecoveryBand`, `recoveryBand` and `recoveryBandColor` at these same
 * cut points, and the `/recovery` deep page this tile links into consumes them
 * (`recovery-hero.tsx`, `recovery-log.tsx`). The two agree exactly today — same
 * 67/33 boundaries, same `--success`/`--warning`/`--danger` tokens — so what
 * splits them is vocabulary, not values: `lib/recovery.ts` names the bands after
 * the tokens they paint and takes a non-null score, while this one names them
 * after Whoop's own green/yellow/red, carries a fourth `"none"` member for a
 * morning with no score, and pairs each band with a display word. Those last two
 * are concepts `lib/recovery.ts` has no notion of, which is why this file did
 * not simply import it.
 *
 * Reconciling the two is deliberately out of this SOW's scope. Picking a single
 * owner for the vocabulary means changing `lib/recovery.ts`'s consumers, and the
 * SOW's non-goals are explicit that there is no `/recovery` deep-page change in
 * this work. It is a follow-up, and the owner's call which module wins.
 */
export function recoveryBand(score: number | null): RecoveryBand {
  if (score === null) return "none";
  if (score >= 67) return "green";
  if (score <= 33) return "red";
  return "yellow";
}

/**
 * The word Whoop trained every one of its users to read beside the score, plus
 * the house word for an absence — which mirrors `statusWord`'s "No reading yet"
 * rather than borrowing any vocabulary from Whoop.
 */
export function recoveryBandWord(band: RecoveryBand): string {
  switch (band) {
    case "green":
      return "Recovered";
    case "yellow":
      return "Adequate";
    case "red":
      return "Low";
    default:
      return "No reading";
  }
}

/**
 * Re-toned to v0.4, never Whoop's saturated traffic light. Red really is
 * `--danger`, and the recovery SCORE is the one place in this family that is
 * allowed: this file's contract that a suppressed HRV morning reads `--warning`
 * ("information, not an emergency") still holds for HRV, but a sub-33 recovery
 * score is Whoop's own red shown in Whoop's own app, and softening it means the
 * log disagrees with the device the number came from. Text and mark weight
 * only — a red word or a red bar, never a red row.
 */
export function recoveryBandColor(band: RecoveryBand): string {
  switch (band) {
    case "green":
      return "var(--success)";
    case "yellow":
      return "var(--warning)";
    case "red":
      return "var(--danger)";
    default:
      return "var(--muted)";
  }
}

/**
 * A server figure rounded for display, or `—`. Never re-derived, only rounded.
 *
 * The recovery log's figures go through this one formatter. `hrv` is a
 * raw Whoop RMSSD float (`96.10188`) and `recoveryScore` is a nullable float on
 * the wire, so printing either raw is what breaks a row onto two lines.
 */
export function round(v: number | null): string {
  return v === null ? "—" : String(Math.round(v));
}
