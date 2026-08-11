/**
 * The HRV tile's own machinery — the guard, the nightly classification, the band
 * runs, the ms→pixel scale, and the gauge position.
 *
 * Pure, and deliberately free of React: none of this needs a render to be true,
 * which is what makes it cheap to test exhaustively and what makes it the
 * natural import for the `/recovery` page when that chart follows. The tile
 * imports it; nothing here imports the tile.
 *
 * `prepareHrvChart` is ALSO the tile's agreement contract. Both of the tile's
 * views — HRV Balance and Recovery Trend — render from the one object it
 * returns and never re-derive a figure for themselves, so a swipe between them
 * cannot cross a disagreement: one guard (both views calibrate together), one
 * nightly classification (`nights`, so a night that reads balanced on the chart
 * reads balanced on the rail), one verdict for last night (`today.status`) and
 * one for the week (`week`).
 *
 * The standing rule for this file is that NOTHING recomputes a server figure.
 * Baselines, band bounds, z-scores and the 7-day mean are read straight off the
 * view as received. The arithmetic here maps an already-computed millisecond
 * value onto a pixel or a percentage of a bar, which is what a chart is — plus
 * the two comparisons below, which sort an already-computed value into the
 * already-computed band it is being drawn against.
 */

import type {
  RecoveryBaselineTrendView,
  RecoveryDayPoint,
  RecoveryHrvStatus,
  RecoveryTrendDirection,
  RecoveryView,
} from "@/lib/dashboard";

/** Consecutive suppressed nights that read as a sustained dip rather than one bad night. */
export const SUSTAINED_DIP_NIGHTS = 3;

/**
 * One night, as both views draw it. `status` is the SERVER's verdict for that
 * morning against that morning's own band — never a re-comparison against
 * today's band, which is what used to make the rail and the chart disagree
 * about the same night.
 */
export type NightMark = {
  status: RecoveryHrvStatus;
  /** False when the morning webhook never landed — an absence, not a status. */
  hasReading: boolean;
  /** Inside a run of ≥ SUSTAINED_DIP_NIGHTS consecutive suppressed nights. */
  sustained: boolean;
};

/**
 * A recovery view with its optional blocks proven present and its band figures
 * proven non-null. Guard once at the top of the tile and render the calibrating
 * state otherwise — never `as number`, never `!`.
 */
export type HrvChart = {
  days: RecoveryDayPoint[];
  /** The 30-day baseline mean, proven non-null. */
  hrvAvg: number;
  /** Today's band, proven non-null. Both are server figures. */
  balancedLow: number;
  balancedHigh: number;
  /** The 7-day mean; null below min_trend_days, which is a real state. */
  shortAvg: number | null;
  /** Where the WEEK sits against today's band — the gauge's zone and the
   *  trend view's delta share it, so the tick and the figure agree in color. */
  week: RecoveryHrvStatus;
  /** The recent mean against the window it sits in — NOT the baseline's drift. */
  trend: RecoveryTrendDirection;
  drift: RecoveryBaselineTrendView;
  /** The last charted day. Its `hrv` is null before the morning webhook lands. */
  today: RecoveryDayPoint;
  /** One entry per charted night, in series order. Both views paint from this. */
  nights: NightMark[];
  /** Millisecond domain spanning every mark and every band bound, with headroom. */
  domain: [number, number];
};

/**
 * The single guard: `null` means *render the calibrating state*.
 *
 * Note what is NOT required — `baseline.hrvStdDev`. The gauge derives its scale
 * from the emitted band bounds rather than from the SD (see `gaugeTickPct`), so
 * demanding an SD here would gate the whole tile on a figure it never reads.
 */
export function prepareHrvChart(view: RecoveryView): HrvChart | null {
  const { days, baseline, hrv, baselineTrend } = view;
  if (!days || !baseline || !hrv || !baselineTrend) return null;
  if (days.length === 0) return null;

  const { hrvAvg } = baseline;
  const { balancedLow, balancedHigh } = hrv;
  if (hrvAvg === null || balancedLow === null || balancedHigh === null) return null;

  // Every value that will be drawn or printed against the vertical axis: the
  // nightly marks, each day's own band as it stood that morning, and today's
  // scalar bounds. A mark that sits outside the band must still be inside the box.
  const values: number[] = [balancedLow, balancedHigh];
  for (const d of days) {
    if (d.hrv !== null) values.push(d.hrv);
    if (d.balancedLow !== null) values.push(d.balancedLow);
    if (d.balancedHigh !== null) values.push(d.balancedHigh);
  }

  return {
    days,
    hrvAvg,
    balancedLow,
    balancedHigh,
    shortAvg: hrv.shortAvg,
    week: weekStatus(hrv.shortAvg, balancedLow, balancedHigh),
    trend: hrv.trend,
    drift: baselineTrend,
    today: days[days.length - 1],
    nights: classifyNights(days),
    domain: [Math.min(...values) - 5, Math.max(...values) + 5],
  };
}

/**
 * Where the 7-day mean sits against TODAY's band — the same two bounds the gauge
 * prints under its 25% and 75% marks, so a tick left of the balanced-low label
 * and a `suppressed` week are the same fact rather than two facts that happen to
 * usually coincide.
 *
 * Deliberately about the WEEK, not last night: it colors the trend view's delta
 * and the balance view's gauge tick, both of which are figures about `shortAvg`.
 * Last night's verdict has its own source (`today.status`) and its own place.
 */
export function weekStatus(
  shortAvg: number | null,
  balancedLow: number,
  balancedHigh: number,
): RecoveryHrvStatus {
  if (shortAvg === null) return "unknown";
  if (shortAvg < balancedLow) return "suppressed";
  if (shortAvg > balancedHigh) return "elevated";
  return "balanced";
}

/**
 * Classify each night once, for every view that draws it.
 *
 * The status is the server's own per-day verdict, passed through: each morning
 * was already judged against the band as it stood THAT morning, which is the
 * only comparison that stays true on a baseline that drifts. Re-testing an old
 * reading against today's bounds — which the rail used to do — reports a night
 * as in-band that the same payload calls suppressed.
 *
 * A run of ≥ SUSTAINED_DIP_NIGHTS consecutive suppressed nights is flagged on
 * every night in the run: one low morning is noise, three in a row is a week
 * going wrong, and the two should not paint identically. Missing nights break a
 * run rather than extending it — an absent reading is not evidence of a dip.
 */
export function classifyNights(days: RecoveryDayPoint[]): NightMark[] {
  const nights: NightMark[] = days.map((d) => ({
    status: d.status,
    hasReading: d.hrv !== null,
    sustained: false,
  }));
  let start = -1;
  for (let i = 0; i <= nights.length; i++) {
    const dipping = i < nights.length && nights[i].hasReading && nights[i].status === "suppressed";
    if (dipping) {
      if (start === -1) start = i;
      continue;
    }
    if (start !== -1 && i - start >= SUSTAINED_DIP_NIGHTS) {
      for (let j = start; j < i; j++) nights[j].sustained = true;
    }
    start = -1;
  }
  return nights;
}

/**
 * Split a day series into runs of consecutive days that HAVE a band, so a band
 * polygon breaks where the baseline is null instead of closing across it. The
 * ORIGINAL index travels with each day so a polygon stays registered with the
 * marks drawn from the same series.
 *
 * Total and unfiltered on purpose: a one-day run has no area to fill, but that
 * is the component's decision about polygons, not this function's decision about
 * the data.
 */
export function bandRuns(days: RecoveryDayPoint[]): { i: number; d: RecoveryDayPoint }[][] {
  const runs: { i: number; d: RecoveryDayPoint }[][] = [];
  let run: { i: number; d: RecoveryDayPoint }[] = [];
  days.forEach((d, i) => {
    if (d.balancedLow === null || d.balancedHigh === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ i, d });
    }
  });
  if (run.length) runs.push(run);
  return runs;
}

/** A linear ms→pixel mapper for a top-down SVG box: high ms yields a small y. */
export function scaler(domain: [number, number], top: number, height: number) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  return (v: number) => top + (1 - (v - lo) / span) * height;
}

/**
 * Position the 7-day average on a ±2-band-width gauge, in band half-widths.
 *
 * The half-width is read off the EMITTED bounds, not off `hrv_std_dev`, and that
 * distinction is the whole point. The server's band is
 * `hrv_avg ± balanced_z × max(sd, min_std_dev_ms)`: it uses a floored deviation
 * and a multiplier the client never receives. Scaling by the raw `hrv_std_dev`
 * therefore silently assumes `balanced_z == 1` and no SD floor, and would put
 * the tick somewhere the printed 25%/75% bound labels say it should not be —
 * visible only for an athlete with a near-flat history, or the first time
 * `balanced_z` is retuned. Deriving the half-width from the bounds makes the
 * tick and the labels agree by construction, whatever those two constants are.
 *
 * The half-width is taken from the UPPER bound alone, so the `balancedLow`
 * label the caller prints at 25% is exact only while the server's band is
 * symmetric about `hrv_avg` — which `hrv_avg ± z × sd` is.
 *
 * Null when there is no 7-day mean or the band is degenerate. The clamp pins a
 * wildly atypical week to an end of the bar rather than letting it escape.
 */
export function gaugeTickPct(
  shortAvg: number | null,
  hrvAvg: number,
  balancedHigh: number,
): number | null {
  const half = balancedHigh - hrvAvg;
  if (shortAvg === null || half <= 0) return null;
  const u = (shortAvg - hrvAvg) / half;
  return Math.min(100, Math.max(0, ((u + 2) / 4) * 100));
}
