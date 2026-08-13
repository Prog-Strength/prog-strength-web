/**
 * The `/recovery` page's own helpers — dates, windowing, ledger paging, the one
 * x-mapping the deck's three plots share, and `prepareDeck`, which is the
 * correction the whole composition rests on.
 *
 * This module IMPORTS from the recovery tiles' `shared.ts` and `hrv-chart.ts`;
 * it does not re-export them. `recoveryBand`, `recoveryBandColor`,
 * `MIN_BASELINE_DAYS`, `round`, `prepareHrvChart` and `ROLLING_WINDOW_NIGHTS`
 * keep exactly one home in this codebase, and a page-level barrel that quietly
 * re-published them would be a second import path for the same figure — which is
 * how two surfaces start disagreeing about where 67 is.
 *
 * The standing house rule holds here: NOTHING recomputes a server figure. The
 * arithmetic below is date parsing, slicing, paging, and mapping an
 * already-computed value onto a pixel. `mean` is the one function that produces
 * a number the payload does not carry, and its comment says why that is allowed.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import {
  prepareHrvChart,
  ROLLING_WINDOW_NIGHTS,
  type HrvChart,
} from "@/app/(app)/dashboard/_components/recovery/hrv-chart";
import { recoveryBand, weekday } from "@/app/(app)/dashboard/_components/recovery/shared";

/**
 * Rows to a ledger page. The house figure, taken from the bodyweight readings
 * table (`components/bodyweight/bodyweight-readings-timeline.tsx`'s
 * `READINGS_PER_PAGE`) rather than picked afresh — two paginated tables in one
 * app that page at different depths is a difference the user has to learn for
 * nothing.
 */
export const LEDGER_PAGE_SIZE = 20;

// ── Dates ─────────────────────────────────────────────────────────────────────
//
// Every date on this page is a LOCAL calendar day: the endpoint materializes
// dates in the caller's timezone and the ledger prints them beside the mornings
// they happened on. `new Date("2026-08-12")` parses as UTC midnight, which is
// 11 Aug for every user west of Greenwich — so the ISO string is split into
// parts and handed to the local `Date` constructor instead, everywhere.

/** Parse a local `YYYY-MM-DD` without the UTC shift `new Date(iso)` applies. */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** The inverse of `parseISO` — a local date back to `YYYY-MM-DD`. */
export function toISO(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** `iso` shifted by `n` days, month and year rollover included. */
export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Wed 12 Aug" — the ledger's date column and the deck's header.
 *
 * The weekday comes from the tiles' `weekday`, not from a table of three-letter
 * names restated here: it already parses local date parts for the same reason
 * this module does, and two abbreviation tables in one app is how a `Tues`
 * appears on one surface and a `Tue` on another.
 */
export function longDate(iso: string): string {
  const d = parseISO(iso);
  return `${weekday(iso)} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "12 Aug" — the axis ends and the mobile ledger, where the weekday is noise. */
export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Aug" — the HRV panel's month ticks. */
export function monthLabel(iso: string): string {
  return MONTHS[parseISO(iso).getMonth()];
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/** A morning Whoop never recorded at all — a hollow slot, never a zero. */
export function isMissingNight(d: RecoveryDayPoint): boolean {
  return d.recoveryScore === null && d.restingHr === null && d.hrv === null;
}

/**
 * The ledger's rows: newest first, and mornings Whoop never recorded dropped
 * rather than printed as a row of em-dashes.
 *
 * The charts do the opposite, deliberately — they keep the date-aligned slot,
 * because an empty column between two full ones is what makes the absence
 * visible and what stops the axis compressing. The record has nothing to record.
 * A morning with SOME metrics is kept and prints em-dashes for the rest.
 */
export function ledgerRows(days: RecoveryDayPoint[]): RecoveryDayPoint[] {
  return days.filter((d) => !isMissingNight(d)).reverse();
}

/** Pages needed for `total` rows — at least one, so an empty ledger still pages. */
export function pageCount(total: number, per = LEDGER_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / per));
}

/** The rows on 1-indexed `page`. */
export function pageOf<T>(rows: T[], page: number, per = LEDGER_PAGE_SIZE): T[] {
  return rows.slice((page - 1) * per, page * per);
}

// ── Windowing ─────────────────────────────────────────────────────────────────

/** The last `n` date-aligned days, oldest → newest. Shorter when history is. */
export function tail(days: RecoveryDayPoint[], n: number): RecoveryDayPoint[] {
  return days.slice(Math.max(0, days.length - n));
}

/**
 * A view narrowed to a sub-window of its own history, so `prepareHrvChart` can
 * run at page scale over 90 mornings rather than over fourteen months.
 *
 * Every derived block travels UNTOUCHED: the baseline, the band bounds, the
 * short average and the drift describe what the server computed, and a window is
 * a choice about what is DRAWN, never a claim about what was measured.
 */
export function windowView(view: RecoveryView, days: RecoveryDayPoint[]): RecoveryView {
  return { ...view, days };
}

/**
 * Mean of the present values, or null when there are none.
 *
 * The one figure on this page that the payload does not carry, and the carve-out
 * is narrow and named: correction 2. The window strip's cells are means over the
 * RENDERED window — a stretch of time only the client knows about, because the
 * three windows are sliced in memory from one fetch. There is no server
 * counterpart being re-derived here, which is exactly why they are labelled
 * `window avg` and are never printed against `baseline.restingHrAvg`,
 * `baseline.hrvAvg` or `baseline.recoveryScoreAvg`. Every other number on the
 * page arrives computed.
 */
export function mean(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

/**
 * Day-count per band over a window — the distribution stated as three numbers.
 *
 * The thresholds are `recoveryBand`'s and are deliberately NOT restated here:
 * Whoop's thirds are defined once in this codebase, in the tiles' `shared.ts`,
 * and the score columns, the ledger's pill and this count all rank against that
 * one definition. A morning with no score falls in `none` and is counted nowhere
 * — the mix describes the mornings that were scored, not the slots on the axis.
 */
export function bandCounts(days: RecoveryDayPoint[]): {
  green: number;
  yellow: number;
  red: number;
} {
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const d of days) {
    const band = recoveryBand(d.recoveryScore);
    if (band === "none") continue;
    counts[band] += 1;
  }
  return counts;
}

// ── The shared x-axis ─────────────────────────────────────────────────────────

/**
 * The horizontal inset every plot on the deck draws inside, in pixels.
 *
 * It is the HRV chart's own `R_MAX` — the radius of the largest mark that chart
 * draws — so that a mark on the first or last morning sits fully inside its box
 * rather than half-clipped by it. The score columns and the resting-HR bars take
 * the SAME inset, which means they are centred on the HRV chart's positions
 * rather than on the centres of their own slots.
 *
 * That is the point, and it is why this constant is shared rather than three
 * private ones. A deck whose entire argument is that three metrics share one
 * time axis cannot have three x-mappings: the crosshair lands on one pixel and
 * must name one morning in all three rows. `4.6` looks arbitrary and is not —
 * it is a radius, borrowed on purpose.
 */
export const PLOT_INSET = 4.6;

/**
 * Where morning `i` of `n` sits across a plot `width` pixels wide — the one
 * x-mapping all three rows and the crosshair share.
 *
 * The deck inverts this to turn a pointer's clientX into an index, so any change
 * here is a change to where the crosshair thinks it is. A single morning has no
 * span to spread across, so it takes the centre of the drawable box.
 */
export function xAt(i: number, n: number, width: number): number {
  const span = width - 2 * PLOT_INSET;
  if (n <= 1) return PLOT_INSET + span / 2;
  return PLOT_INSET + (i / (n - 1)) * span;
}

/**
 * How wide one morning's column or bar is — the other half of `xAt`, and here
 * for the same reason it is.
 *
 * The score columns and the resting-HR bars are two rows of the same instrument
 * and are read down the page as one: a column and the bar beneath it that were
 * a pixel apart in width would make two adjacent rows of a single chart look
 * like two charts. So the derivation is stated ONCE — the step between two
 * adjacent centres across the drawable box, minus a pixel of air — rather than
 * privately in each plot where the two copies were free to drift.
 *
 * It is the same plot at three densities with no branching: thirty mornings
 * render fat columns, a 365-morning year renders 1px ones shoulder to shoulder,
 * and the `max(1, …)` floor is what stops the year rendering nothing at all. A
 * single morning has no step, so it takes the whole drawable box — `xAt`
 * centres it there.
 */
export function columnWidth(n: number, width: number): number {
  const span = width - 2 * PLOT_INSET;
  const step = n > 1 ? span / (n - 1) : span;
  return Math.max(1, step - 1);
}

// ── The window control ────────────────────────────────────────────────────────

/**
 * The three windows the page offers. A page about history starts at a month and
 * reaches a year — `7d` belongs to the tiles, which answer *this morning*.
 *
 * `days` is a count of MORNINGS to draw, not a calendar span, because the axis
 * is a list of date-aligned slots and 1y is simply the last 365 of them.
 *
 * `label` is the pill's own text, which is terse because the control is three
 * pills wide; `caption` is the prose the window strip prints above its figures,
 * where there is room to say which stretch of time the means describe.
 */
export const WINDOWS = [
  { key: "30d", days: 30, label: "30d", caption: "Last 30 days" },
  { key: "90d", days: 90, label: "90d", caption: "Last 90 days" },
  { key: "1y", days: 365, label: "1y", caption: "Last 12 months" },
] as const;

export type WindowKey = (typeof WINDOWS)[number]["key"];

/**
 * The mornings the HRV chart consumes before it can plot its first point.
 *
 * Imported from `ROLLING_WINDOW_NIGHTS`, never written as `6`: it is that
 * constant minus one, because a seven-night rolling mean needs six nights behind
 * the morning it is plotted on. If the server retunes its trend window and the
 * chart follows, the lead-in follows with it and nothing here has to be
 * remembered.
 */
export const LEAD_IN = ROLLING_WINDOW_NIGHTS - 1;

/**
 * The deck's two objects: the prepared HRV chart, and the ONE list of mornings
 * all three rows are drawn over. Called once per render, in the deck.
 *
 * ── CORRECTION 1, IN FULL. This function is the fix, and it is load-bearing.
 *
 * `prepareHrvChart` returns `series` — the tail of the days it was handed
 * beginning at the oldest one with a complete rolling window behind it — which
 * is `days.length − LEAD_IN` on a full payload, because a seven-night mean
 * cannot be formed over the first six charted mornings. The HRV plot maps its
 * points across `series.length`. The score columns and the resting-HR bars map
 * across the window's length. Same inset, same box, DIFFERENT POINT COUNTS: the
 * leftmost HRV point ends up sitting above a score column six mornings newer
 * than itself. The error is largest at the left edge and tapers to zero at the
 * right — on a 30-day window that is a fifth of the plot width — and the
 * crosshair is quietly lying about which morning it is reading.
 *
 * The fix is LEAD-IN, not clipping. Hand `prepareHrvChart` `windowLength +
 * LEAD_IN` mornings and its `series` comes out equal to the visible window: one
 * point per column, by construction rather than by agreement. Clipping the HRV
 * series to the window instead would throw away the six points the chart just
 * earned and shorten the curve for no reason; padding the other two rows with
 * six blank slots would put a gap on the axis where the data is fine.
 *
 * A FUTURE READER WHO TRIMS THE LEAD-IN — "we only draw 30 days, why fetch 36?"
 * — SILENTLY RE-INTRODUCES THE SIX-DAY SKEW. Nothing throws; the deck simply
 * starts naming the wrong morning at its left edge. `shared.test.ts` pins the
 * contract for all three windows.
 *
 * The returned `days` IS `chart.series` — the same `RecoveryDayPoint` objects,
 * not a re-slice by date — so the score and resting-HR rows read
 * `recoveryScore` and `restingHr` off the very objects the HRV curve was drawn
 * from. Equality of the three plotted date lists then holds by construction; a
 * lookup could drift.
 *
 * `chart` is null exactly when the deck must render the HRV calibrating state,
 * which folds two cases into one guard: a view too short to establish a baseline
 * at all, and a series so sparse that no rolling mean ever forms. In both, the
 * other two rows span the requested window and the crosshair binds two rows,
 * which is honest — there is no third series to bind.
 *
 * Short history needs no branch of its own: a user with 40 stored mornings
 * asking for 90 days gets a shorter `series`, and all three rows narrow
 * TOGETHER rather than one narrowing alone.
 */
export function prepareDeck(
  view: RecoveryView,
  windowLength: number,
): { chart: HrvChart | null; days: RecoveryDayPoint[] } {
  const days = view.days ?? [];
  // The EXTRA mornings are the whole correction. See above before touching.
  const hrvView = windowView(view, tail(days, windowLength + LEAD_IN));
  const prepared = prepareHrvChart(hrvView);
  const chart = prepared && prepared.series.length > 0 ? prepared : null;
  return { chart, days: chart ? chart.series : tail(days, windowLength) };
}
