/**
 * Ranking and strip geometry for the `resting_hr` tile — pure, no React.
 *
 * The tile's claim is that a resting heart rate is the metric where an absolute
 * number is least interpretable: a 50 is excellent for one athlete and elevated
 * for another. So it does not date the morning, it RANKS it — the last thirty
 * mornings sorted low to high as a strip of ticks, today's filled, under the
 * caption `4th lowest of your last 30`. Everything that decides where a tick
 * goes and which morning outranks which lives here, because that is where the
 * corrections below can be tested rather than eyeballed.
 *
 * INTEGER-FIRST RANKING is the load-bearing one, and it is the one most likely
 * to be undone by a well-meaning simplification. Every figure on this card
 * prints as an integer, so ranking on the raw floats would order two mornings
 * the card both calls `50` — and then print an ordinal counting a difference
 * the user cannot see. It is the same lesson the `flat-month` fixture taught
 * about colour, applied to order instead of ink: *a difference the card does
 * not print is a difference the card does not rank*. Round first and the
 * strip's order, the endpoint labels and the caption all describe the same
 * numbers.
 *
 * The strip encodes ORDER, not magnitude — ticks are evenly spaced by rank, and
 * magnitude lives in the printed extremes. That is what makes a flat month
 * legible without a chart: `48 lowest` / `50 highest` reads as *nothing is
 * happening*, with no auto-scale to lie about it.
 */

import type { RecoveryDayPoint } from "@/lib/dashboard";

/**
 * The strip's window: the last thirty mornings INCLUDING today. `days` carries
 * 31 entries, so the oldest is excluded.
 */
export const STRIP_WINDOW = 30;

/**
 * The athlete's last `window` mornings as INTEGER bpm, sorted ascending.
 *
 * Rounding before sorting is not cosmetic — see the file header.
 *
 * Nulls are dropped, not zero-filled: a strap-off morning is an absent reading,
 * not a heart rate of zero, and the caller's `n` (this array's length) reports
 * how many mornings are actually behind the rank. On a sparse month that is
 * visibly not thirty, and saying so is the honest caption.
 *
 * `window` defaults to `STRIP_WINDOW` because every call site passes exactly
 * that; it stays a parameter so a promotion to `/recovery` can widen it. The
 * default is also the safer shape: `slice(-window)` with a computed `0` returns
 * the WHOLE array rather than none of it, so a caller that let a zero through
 * would silently disable the trim instead of emptying the strip.
 */
export function sortedMornings(days: RecoveryDayPoint[], window: number = STRIP_WINDOW): number[] {
  return days
    .slice(-window)
    .map((d) => d.restingHr)
    .filter((v): v is number => v !== null)
    .map((v) => Math.round(v))
    .sort((a, b) => a - b);
}

/**
 * Today's rank among them, 1-based, with ties sharing the LOWER rank — two
 * identical 48s are both "1st lowest" rather than arbitrarily ordered. Null when
 * there is no reading yet today.
 *
 * `today` is rounded here for the same reason the series is: a 49.6 that prints
 * as `50` must rank exactly where a 50 ranks.
 */
export function rankOf(sorted: number[], today: number | null): number | null {
  if (today === null) return null;
  const t = Math.round(today);
  return sorted.filter((v) => v < t).length + 1;
}

/**
 * Tick centres, evenly spaced by rank: tick `i` of `n` owns the slice from
 * `i / n` to `(i + 1) / n` and sits in the MIDDLE of it.
 *
 * Half of a matched pair with `avgInsertPct`, and the halves must stay
 * different. A morning IS one of the athlete's readings, so it gets a tick
 * centre; the average is not, so it gets a boundary between two of them. That
 * offset of half a slice is the whole visual distinction between *a morning*
 * and *the mean of thirty*, and collapsing the two formulas into one would sit
 * the dash on top of a tick and claim membership the average does not have.
 *
 * `n >= 1` is the caller's obligation — `n === 0` yields `Infinity`, and there
 * are no ticks to place on an empty strip anyway. Unlike `avgInsertPct` there
 * is no useful total version of this: a tick index with no strip to sit in is a
 * caller bug, not a state.
 */
export function tickPct(i: number, n: number): number {
  return ((i + 0.5) / n) * 100;
}

/**
 * Where the 30-day average inserts. Deliberately at the BOUNDARY between two
 * ticks — `k / n`, exactly halfway between tick k−1 and tick k — because the
 * average is not one of the athlete's mornings and must not appear to be one.
 * Computed against the raw average, not a rounded one: the tick is a position,
 * and 53.4 genuinely sits above every 53.
 *
 * The comparison is STRICTLY `<`, so an average equal to a run of values lands
 * at the START of that run rather than after it — and that is the correct end
 * of the run, not merely the current one. It is the case that ships: both
 * `creepingUpView` and `flatMonthView` average exactly 49 over a strip full of
 * 49s. On flat-month, `<` puts the dash immediately LEFT of today's own tick,
 * where *today is the average* reads at a glance; `<=` would throw it to the
 * far side of eight identical mornings, and on creeping-up it would move the
 * dash 23 points right and cost the `highest` endpoint its label.
 *
 * The average's own window (30 days trailing, EXCLUDING today) is not the same
 * set as the strip's thirty (including today, excluding the oldest). That is
 * not a defect and must not be "fixed" by re-averaging the strip's values,
 * which is the forbidden operation. The tick claims a position, not membership
 * — and the dash the caller draws it with is what says so.
 *
 * An empty strip returns null rather than dividing by zero. The function
 * already speaks `null` for *nothing to place*, so being total costs one clause
 * — and the alternative fails INVISIBLY: a NaN percentage reaches the DOM as
 * `left: "NaN%"`, an invalid declaration the CSSOM drops silently, leaving the
 * dash at its static fallback position on a card that still looks plausible.
 */
export function avgInsertPct(sorted: number[], avg: number | null): number | null {
  if (avg === null || sorted.length === 0) return null;
  return (sorted.filter((v) => v < avg).length / sorted.length) * 100;
}

/**
 * Where a CENTRED label stops fitting: past these, anchoring switches to the
 * card edge. 6% is the half-width assumed for the only label routed through
 * `labelAnchor` — today's, a bare two- or three-digit bpm figure — so a tick
 * inside 6% of either end is one whose centred label would overhang the panel.
 * A wider label, or a much narrower strip, is what would retune this pair.
 */
export const LABEL_EDGE_MIN_PCT = 6;
export const LABEL_EDGE_MAX_PCT = 94;

/**
 * left / centre / right anchoring, so a label near an edge stays on the card
 * AND stays adjacent to the tick it names.
 *
 * Switching anchor rather than clamping is the point: `tickPct(0, 30)` is 1.7%,
 * and a centred label there sits mostly outside the panel. Clamping the
 * POSITION would drag the label away from its tick; switching the anchor keeps
 * it over the tick and inside the card at the same time.
 */
export function labelAnchor(pct: number): { left: string; transform: string } {
  if (pct < LABEL_EDGE_MIN_PCT) return { left: "0%", transform: "none" };
  if (pct > LABEL_EDGE_MAX_PCT) return { left: "100%", transform: "translateX(-100%)" };
  return { left: `${pct}%`, transform: "translateX(-50%)" };
}

/**
 * Where the AVG label is allowed to stop. A wider bound than
 * `LABEL_EDGE_*_PCT` because this label is wider — it carries the word `avg`
 * beside its figure — and because it is the one label with neighbours to clear.
 *
 * The two pairs cannot fight, and that is by construction rather than by luck:
 * `[18, 82]` sits strictly inside `(6, 94)`, so a clamped avg label is always
 * within the range `labelAnchor` would CENTRE. That is why the caller renders
 * it centred outright instead of re-anchoring it — the avg label is only ever
 * nudged, and it keeps the same symmetric relationship to its dash at every
 * position the strip can produce.
 */
export const AVG_LABEL_MIN_PCT = 18;
export const AVG_LABEL_MAX_PCT = 82;
/** Clearance either side of the avg label before an endpoint label is dropped. */
export const ENDPOINT_CLEARANCE_PCT = 16;

/**
 * The endpoint register's layout: where the avg label sits, and whether the
 * `lowest` / `highest` captions survive beside it.
 *
 * The avg label yields to the card edges and WINS against the endpoints. It is
 * the more informative figure, and the extreme values remain visible as the
 * outermost ticks even without their captions.
 *
 * Only the LABEL is clamped — the caller draws the avg tick at its true
 * `avgPct`, so the geometry never lies even when the caption is nudged. On the
 * shipped fixtures `avgPct` lands mid-strip and nothing is suppressed; this
 * machinery exists for the athlete the fixtures do not cover, which is why it
 * is unit-tested rather than eyeballed.
 */
export function endpointRow(avgPct: number | null): {
  avgLabelPct: number | null;
  showLowest: boolean;
  showHighest: boolean;
} {
  if (avgPct === null) return { avgLabelPct: null, showLowest: true, showHighest: true };
  const avgLabelPct = Math.min(AVG_LABEL_MAX_PCT, Math.max(AVG_LABEL_MIN_PCT, avgPct));
  return {
    avgLabelPct,
    showLowest: avgLabelPct >= AVG_LABEL_MIN_PCT + ENDPOINT_CLEARANCE_PCT, // ≥ 34
    showHighest: avgLabelPct <= AVG_LABEL_MAX_PCT - ENDPOINT_CLEARANCE_PCT, // ≤ 66
  };
}
