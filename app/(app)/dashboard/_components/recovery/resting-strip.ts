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
 */
export function sortedMornings(days: RecoveryDayPoint[], window: number): number[] {
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

/** Tick centres, evenly spaced by rank. */
export const tickPct = (i: number, n: number): number => ((i + 0.5) / n) * 100;

/**
 * Where the 30-day average inserts. Deliberately at the BOUNDARY between two
 * ticks — `k / n`, exactly halfway between tick k−1 and tick k — because the
 * average is not one of the athlete's mornings and must not appear to be one.
 * Computed against the raw average, not a rounded one: the tick is a position,
 * and 53.4 genuinely sits above every 53.
 *
 * The average's own window (30 days trailing, EXCLUDING today) is not the same
 * set as the strip's thirty (including today, excluding the oldest). That is
 * not a defect and must not be "fixed" by re-averaging the strip's values,
 * which is the forbidden operation. The tick claims a position, not membership
 * — and the dash the caller draws it with is what says so.
 *
 * Callers guard `sorted.length > 0` before the strip renders at all, so the
 * division is safe by construction.
 */
export function avgInsertPct(sorted: number[], avg: number | null): number | null {
  if (avg === null) return null;
  return (sorted.filter((v) => v < avg).length / sorted.length) * 100;
}

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
  if (pct < 6) return { left: "0%", transform: "none" };
  if (pct > 94) return { left: "100%", transform: "translateX(-100%)" };
  return { left: `${pct}%`, transform: "translateX(-50%)" };
}

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
