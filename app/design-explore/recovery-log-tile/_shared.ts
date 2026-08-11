/**
 * Small helpers shared by the five `recovery-log-tile` variants — THROWAWAY.
 *
 * Two things live here and nothing else:
 *
 * 1. `recoveryBand*()` — the Whoop band vocabulary the ticket makes the row's
 *    single colour system. Naming which third of a fixed, published 0–100 scale
 *    a number falls in is display formatting, the same class of operation as
 *    `weekday()`; it introduces no statistics and recomputes no server figure.
 *    The downstream SOW single-sources this into `recovery/shared.ts` beside
 *    `hrvStatusColor` and `statusWord` — for exactly the reason that file gives,
 *    that three hand-rolled copies of a threshold switch is how `52` ends up
 *    green on one tile. It sits here for the duration of the exploration so the
 *    DX produces no production diff.
 *
 * 2. Formatting and null-guarding the variants would otherwise each re-type.
 *
 * HRV's own status is NOT re-mapped here: where a variant paints it, it uses
 * `hrvStatusColor` / `nightOpacity` from the production module, never a private
 * palette. `nightMark()` just adapts a `RecoveryDayPoint` into the `NightMark`
 * those two already take.
 */

import type { RecoveryDayPoint } from "@/lib/dashboard";
import type { NightMark } from "@/app/(app)/dashboard/_components/recovery/hrv-chart";

export type RecoveryBand = "green" | "yellow" | "red" | "none";

/** Whoop's published cut points: 67 and 33. A label, not a recomputation. */
export function recoveryBand(score: number | null): RecoveryBand {
  if (score === null) return "none";
  if (score >= 67) return "green";
  if (score >= 34) return "yellow";
  return "red";
}

/** The word Whoop trained every one of its users to read beside the score. */
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
 * Re-toned to the system: never Whoop's saturated traffic light. Red really is
 * `--danger` and this is the one place in the recovery family that is allowed —
 * a sub-33 recovery score is Whoop's own red, shown to the user in Whoop's own
 * app, and softening it to yellow means the log disagrees with the device it
 * came from. Text weight only, never a filled block.
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
      return "var(--faint)";
  }
}

/** The ~13%-alpha macro-tint of a band, for variants that fill rather than rule. */
export function recoveryBandTint(band: RecoveryBand): string {
  switch (band) {
    case "green":
      return "rgba(134, 179, 159, 0.13)";
    case "yellow":
      return "rgba(214, 184, 127, 0.13)";
    case "red":
      return "rgba(199, 146, 146, 0.13)";
    default:
      return "transparent";
  }
}

/** A morning the webhook never delivered — an absence, not a status. */
export function isMissing(d: RecoveryDayPoint): boolean {
  return d.recoveryScore === null && d.restingHr === null && d.hrv === null;
}

/** Consecutive suppressed nights before a dip counts as sustained. Mirrors hrv-chart. */
const SUSTAINED_DIP_NIGHTS = 3;

/**
 * Adapt one day into the `NightMark` that `nightColor` / `nightOpacity` take, so
 * a variant that demotes HRV status still weights it exactly the way the HRV
 * tile does — an isolated suppressed night reads softer than a run of them.
 */
export function nightMark(days: RecoveryDayPoint[], i: number): NightMark {
  const d = days[i];
  const suppressedAt = (j: number) => days[j] !== undefined && days[j].status === "suppressed";
  let run = 0;
  if (d.status === "suppressed") {
    run = 1;
    for (let j = i - 1; suppressedAt(j); j--) run++;
    for (let j = i + 1; suppressedAt(j); j++) run++;
  }
  return {
    status: d.status,
    hasReading: d.hrv !== null,
    sustained: run >= SUSTAINED_DIP_NIGHTS,
  };
}

/** Integer milliseconds, always — the house convention, and the wrap this DX fixes. */
export function ms(v: number | null): string {
  return v === null ? "—" : String(Math.round(v));
}

/** A server figure rounded for display; never re-derived. */
export function int(v: number | null): string {
  return v === null ? "—" : String(Math.round(v));
}

/** "2026-08-11" → "Tue". Local date parts, no timezone drift. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

/** "2026-08-11" → "T". For column heads where a three-letter day will not fit. */
export function dayInitial(iso: string): string {
  return shortDay(iso).charAt(0);
}
