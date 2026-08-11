/**
 * Sleep-stage colour and duration formatting, single-sourced for the same
 * reason `recovery/shared.ts` exists: two hand-rolled copies of a stage palette
 * is exactly how REM ends up a different blue on the bar than in the legend.
 * Pure functions, no React; reads the v0.4 CSS vars by name, never a raw hex.
 *
 * THE STAGE RAMP. Design-system v0.4 has no four-way categorical set that would
 * read correctly here — the one accent is app chrome and never a data hue, the
 * per-discipline hues would say "sleep is a discipline", and the status colours
 * would say "light sleep is a warning". SOW Open Question 2's decided
 * resolution is an ordinal single-hue luminance ramp, which is also the more
 * honest encoding: sleep stages have a natural ordering by depth, so an ordinal
 * scale says something true that four categorical hues would not.
 *
 * So the bar reuses the EXISTING four-stop `--discipline-lift-1..4` ramp, which
 * the design system already names "the canonical encoding of graded intensity …
 * reusable by any future per-intensity graphic". Zero new tokens, so the SOW's
 * `in-system` scope holds. Deep is darkest, awake lightest.
 */

import type { SleepNightView } from "@/lib/dashboard";

/**
 * The stages of a night, ordered by depth — deepest first. The order is the
 * encoding: it is what the ramp is mapped onto, and it is the order the bar
 * stacks and the legend prints, so a reader can go left-to-right from deep to
 * awake on every surface that draws a night.
 */
export const STAGE_ORDER = ["slowWave", "light", "rem", "awake"] as const;

export type SleepStage = (typeof STAGE_ORDER)[number];

/** Depth position → ramp stop. Darkest (1) is deepest sleep, lightest (4) awake. */
const STAGE_COLOR: Record<SleepStage, string> = {
  slowWave: "var(--discipline-lift-1)",
  light: "var(--discipline-lift-2)",
  rem: "var(--discipline-lift-3)",
  awake: "var(--discipline-lift-4)",
};

/** The house word for each stage — "Deep", not "slowWaveSleepMilli". */
const STAGE_LABEL: Record<SleepStage, string> = {
  slowWave: "Deep",
  light: "Light",
  rem: "REM",
  awake: "Awake",
};

/** The CSS var carrying a stage's colour. Never a hex, never `--accent`. */
export function stageColor(stage: SleepStage): string {
  return STAGE_COLOR[stage];
}

/** The user-facing word for a stage. */
export function stageLabel(stage: SleepStage): string {
  return STAGE_LABEL[stage];
}

/**
 * One stage's duration off a night, in milliseconds — the single place the
 * stage names are married to the view model's field names, so the bar and the
 * legend cannot disagree about which field "REM" reads.
 */
export function stageMilli(night: SleepNightView, stage: SleepStage): number | null {
  switch (stage) {
    case "slowWave":
      return night.slowWaveSleepMilli;
    case "light":
      return night.lightSleepMilli;
    case "rem":
      return night.remSleepMilli;
    default:
      return night.awakeMilli;
  }
}

/**
 * "7h 12m" from milliseconds; "—" for null, non-finite, or negative. Rounds to
 * the nearest minute — the milliseconds are stored so nothing is lost, and a
 * tile that prints seconds of sleep claims a precision the user does not have.
 * The minutes place survives a whole hour ("8h 0m") so a column of durations
 * stays aligned.
 */
export function formatSleepDuration(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms) || ms < 0) return "—";
  const minutes = Math.round(ms / 60_000);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/**
 * "89%" from one of WHOOP's scored percentages; "—" for null or non-finite.
 * The non-finite rejection is the point: it is the same guard
 * `formatSleepDuration` makes, and without it a NaN off the wire reaches
 * `Math.round` and renders literally as "NaN%".
 */
export function formatSleepPercent(pct: number | null): string {
  if (pct === null || !Number.isFinite(pct)) return "—";
  return `${Math.round(pct)}%`;
}

/**
 * Time actually asleep = in bed − awake − no-data, or null when the pieces are
 * not all present. This is NOT a re-derivation of a server figure: WHOOP sends
 * no "total asleep" field, so it is the one arithmetic the tile must do.
 *
 * A negative result means the three fields contradict each other; that is an
 * absence of a usable number, not a number, so it reads as null rather than
 * printing a nonsense duration.
 */
export function asleepMilli(night: SleepNightView): number | null {
  const { inBedMilli, awakeMilli, noDataMilli } = night;
  if (inBedMilli === null || awakeMilli === null || noDataMilli === null) return null;
  const asleep = inBedMilli - awakeMilli - noDataMilli;
  return asleep < 0 ? null : asleep;
}

/**
 * WHOOP's computed sleep need = baseline + sleep debt + recent strain + recent
 * nap, or null when any component is absent — a need with a hole in it is not
 * WHOOP's need, and printing a partial sum as if it were would misreport it.
 *
 * The nap component is legitimately NEGATIVE (a nap discharges need), so the
 * sum is signed; clamping it to zero would overstate the need.
 */
export function sleepNeedMilli(night: SleepNightView): number | null {
  const parts = [
    night.needBaselineMilli,
    night.needFromSleepDebtMilli,
    night.needFromStrainMilli,
    night.needFromNapMilli,
  ];
  if (parts.some((p) => p === null)) return null;
  return parts.reduce((sum: number, p) => sum + (p as number), 0);
}
