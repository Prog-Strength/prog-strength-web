/**
 * The HRV balance chart's own machinery — the guard, the band runs, the ms→pixel
 * scale, and the gauge position.
 *
 * Pure, and deliberately free of React: none of this needs a render to be true,
 * which is what makes it cheap to test exhaustively and what makes it the
 * natural import for the `/recovery` page when that chart follows. The tile
 * imports it; nothing here imports the tile.
 *
 * The standing rule for this file is that NOTHING recomputes a server figure.
 * Baselines, band bounds, z-scores and the 7-day mean are read straight off the
 * view as received. The arithmetic here maps an already-computed millisecond
 * value onto a pixel or a percentage of a bar, which is what a chart is.
 */

import type { RecoveryBaselineTrendView, RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";

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
  drift: RecoveryBaselineTrendView;
  /** The last charted day. Its `hrv` is null before the morning webhook lands. */
  today: RecoveryDayPoint;
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
    drift: baselineTrend,
    today: days[days.length - 1],
    domain: [Math.min(...values) - 5, Math.max(...values) + 5],
  };
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
