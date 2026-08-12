/**
 * The small, boring things all five `resting-hr-tile` variants would otherwise
 * re-type — THROWAWAY.
 *
 * Deliberately thin. Shared abstraction is NOT the goal of a DX; divergence is,
 * and each variant owns its own layout, scale, and colour decisions outright.
 * What lives here is only formatting, null-guarding, and the one arithmetic
 * operation the ticket licenses.
 *
 * ON THAT ARITHMETIC — the tile's central constraint is that resting heart rate
 * has NO band, NO z-score, NO status and NO trend on the wire.
 * `recoverytrend.Compute` derives all of that for HRV only; for RHR it computes
 * a mean and stops. So:
 *
 *   - `delta()` subtracts a server value from a server baseline. This is
 *     established house practice (`readiness-verdict.tsx`,
 *     `three-dial-vitals.tsx` both print `vs 30d ±n` this way) and is a true
 *     statement built from two server figures.
 *   - There is NO short-window average here, and there must not be. Re-averaging
 *     a series on the client is the rule the ticket forbids outright. A variant
 *     that wants to hero a stable recent figure cannot, and must find another hero.
 *   - There is NO threshold function here, and there must not be. Deciding that
 *     +4 bpm is "elevated" is a client-side classification the server never made,
 *     and unlike HRV there is no `day.status` to fall back on.
 *
 * `isAbove()` therefore names a DIRECTION (is this reading over the athlete's
 * own average?) and never a verdict. That is the whole colour budget.
 */

import type { RecoveryDayPoint } from "@/lib/dashboard";

/** `internal/recoverytrend`'s gate: a metric's average is withheld below this. */
export const MIN_BASELINE_DAYS = 14;

/**
 * Integer bpm, always. `resting_heart_rate` is a `*float64` on the wire, so
 * `49.6` arrives whole from nothing — this is the same lesson `96.10188 ms`
 * taught on `recovery_log`, arriving early enough to design around.
 */
export function bpm(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : String(Math.round(v));
}

/** A day's departure from the athlete's own 30-day mean, or null if either is absent. */
export function delta(value: number | null, avg: number | null | undefined): number | null {
  if (value === null || avg === null || avg === undefined) return null;
  return value - avg;
}

/** "+6" / "−5" / "0". A true minus sign, so the column sits straight under tabular figures. */
export function signed(d: number | null): string {
  if (d === null) return "—";
  const n = Math.round(d);
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

/**
 * Is this morning over the athlete's own average? A direction, not a judgement —
 * the only question the colour contract is allowed to ask.
 *
 * NOTE THE ROUNDING, which the `flat-month` fixture forced and which is not a
 * threshold in disguise. Every figure on this tile renders as an INTEGER, so a
 * departure that rounds to zero is one the card does not print. Colouring it
 * anyway produces a warm `0` — literally what the first build of `delta-ledger`
 * did on `flat-month`, where a 49 against a 48.9 average lit up as "above" while
 * printing `0` beside it. Tying the colour to the PRINTED delta keeps the ink
 * and the digits telling the same story.
 *
 * This decides nothing about whether a rise is good or bad, and applies no
 * client-side classification: `+1` is coloured exactly the same as `+9`, because
 * both mean the one thing colour is allowed to mean here — above your average.
 */
export function isAbove(value: number | null, avg: number | null | undefined): boolean {
  const d = delta(value, avg);
  return d !== null && Math.round(d) > 0;
}

/** The last n date-aligned days, oldest→newest, nulls preserved. */
export function lastDays(days: RecoveryDayPoint[], n: number): RecoveryDayPoint[] {
  return days.slice(-n);
}

/** Advance a local YYYY-MM-DD by n days, with no timezone in the middle. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

/** 0 = Monday … 6 = Sunday. The week `month-grid` aligns its columns to. */
export function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(y, m - 1, d).getDay() + 6) % 7;
}

/** "2026-08-11" → "Tue". Local date parts, no timezone drift. */
export function shortDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
}

/** "2026-08-11" → "T". For column heads where three letters will not fit. */
export function dayInitial(iso: string): string {
  return shortDay(iso).charAt(0);
}

/** "2026-08-11" → "11 Aug", for the few places a date beats a weekday. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/** 1 → "1st", 4 → "4th". For `sorted-strip`'s rank caption. */
export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * The one colour the tile is allowed to spend, and the two it defaults to.
 * `--danger` is deliberately absent: red is licensed for exactly one thing in
 * this family — a sub-33 Whoop recovery score, which is Whoop's own red in
 * Whoop's own app — and a resting HR has no such published threshold. The
 * warmest this tile ever gets is `--warning`.
 */
export const ABOVE = "var(--warning)";
export const NEUTRAL = "var(--foreground)";
export const QUIET = "var(--muted)";
export const ABSENT = "var(--surface-2)";

/** `--warning` at an arbitrary alpha, for the variants that fill rather than ink. */
export function warmTint(alpha: number): string {
  return `rgba(214, 184, 127, ${alpha})`;
}
