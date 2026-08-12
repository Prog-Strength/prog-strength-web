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
 * nightly classification (`nights`, which the rail paints from), one verdict for
 * last night (`today.status`) and one for the week (`week` — the balance view's
 * gauge tick, its curve's final mark, and the trend view's delta).
 *
 * The two views divide the SUBJECT rather than the palette: the balance view
 * draws the smoothed week-scale pattern (`rolling`), the trend rail draws the
 * per-night verdicts (`nights`). They answer different questions from the same
 * object, which is why neither can contradict the other about the one figure
 * they share.
 *
 * The standing rule for this file is that NOTHING recomputes a server figure.
 * Baselines, band bounds, z-scores and the 7-day mean are read straight off the
 * view as received. The arithmetic here maps an already-computed millisecond
 * value onto a pixel or a percentage of a bar, which is what a chart is — plus
 * the two comparisons below, which sort an already-computed value into the
 * already-computed band it is being drawn against.
 *
 * `rollingAverages` is the ONE exception, and it is a narrow one. The balance
 * view plots the 7-day rolling mean rather than the raw nightly reading — a
 * single night of RMSSD is noise, and the tile is read for a pattern — but the
 * payload carries exactly one such mean, `hrv.short_avg`, which is TODAY's. The
 * twenty-four before it have to be averaged here or not drawn at all. The rule
 * survives where it matters, in two ways: the window and its sample floor mirror
 * the server's own (`ROLLING_WINDOW_NIGHTS`, `MIN_ROLLING_NIGHTS`), and the
 * FINAL point is not computed at all — `prepareHrvChart` overwrites it with
 * `short_avg` itself, so the curve terminates on the very figure the tile prints
 * at 28px above it rather than on a client re-derivation that merely ought to
 * equal it.
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
 * The trailing window each plotted average covers, and the readings that window
 * must hold before an average is emitted at all.
 *
 * Both mirror the server's `[recovery]` config — `trend_window_days` and
 * `min_trend_days` — and that is the point of stating them here rather than
 * picking a client-side "seven feels right". The series ENDS on the server's own
 * `short_avg`, so every earlier point has to be the same kind of figure computed
 * the same way; a client that averaged over five nights, or over a window with
 * one reading in it, would draw a curve whose last point belonged to a different
 * series. If either constant is retuned server-side, it is retuned here too.
 *
 * Neither is on the wire. Duplicating them is the cost of plotting a series the
 * payload carries only the last point of, and it is deliberately paid in two
 * named constants rather than in two literals buried in a loop.
 */
export const ROLLING_WINDOW_NIGHTS = 7;
export const MIN_ROLLING_NIGHTS = 4;

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
 * One plotted point of the balance view's curve: a 7-day rolling mean, and where
 * that mean sat against the band as it stood THAT morning.
 *
 * The status is a comparison, not a re-derivation — the same one `weekStatus`
 * makes for the gauge tick, applied per day instead of once. The server's own
 * per-day `status` cannot be reused here because it judges that morning's RAW
 * reading; a week whose mean is comfortably in band can easily contain a night
 * the server calls suppressed, and painting the mean with the night's verdict is
 * how a smoothed chart ends up contradicting its own smoothing.
 */
export type RollingPoint = {
  /** The trailing mean, in ms. */
  avg: number;
  /** Where that mean sits in that day's own band; `unknown` when it has none. */
  status: RecoveryHrvStatus;
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
  /** One entry per charted night, in series order. The trend rail paints from this. */
  nights: NightMark[];
  /**
   * The days the BALANCE CHART draws — the tail of `days` beginning at the
   * oldest one with a complete rolling window behind it. Six days shorter than
   * `days` on a full payload, because the client is sent no lead-in and a
   * seven-night mean cannot be formed over the first six charted mornings.
   *
   * The chart's x-axis spans exactly this, so the curve fills the box. Spanning
   * all 31 days instead would leave the first fifth permanently blank, which
   * reads as missing data when it is really the window warming up.
   */
  series: RecoveryDayPoint[];
  /**
   * The rolling mean for each day of `series`, index-aligned with it. Null where
   * the window holds fewer than `MIN_ROLLING_NIGHTS` readings — a long enough
   * strap-off gap breaks the curve rather than drawing a chord over it.
   *
   * The LAST entry is the server's `short_avg` verbatim, carrying `week` as its
   * status. That is what makes the curve's endpoint, the 28px headline and the
   * gauge tick one figure in three registers instead of three that agree by
   * arithmetic coincidence.
   */
  rolling: (RollingPoint | null)[];
  /** Millisecond domain spanning every plotted mean and every band bound drawn
   *  beneath it, with headroom. Raw nightly readings are NOT in it — nothing
   *  draws them, and including them would squash the curve into the middle. */
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

  const week = weekStatus(hrv.shortAvg, balancedLow, balancedHigh);

  // The curve, and then its endpoint replaced by the server's own 7-day mean.
  // This is the tile's agreement contract made structural: the last mark is not
  // a client average that ought to equal `short_avg`, it IS `short_avg`, so the
  // dot the eye lands on and the 28px figure above it cannot come apart — nor
  // can its colour and the gauge tick's, which are both `week`.
  const rolling = rollingAverages(days);
  rolling[rolling.length - 1] = hrv.shortAvg === null ? null : { avg: hrv.shortAvg, status: week };

  // The drawn sub-window starts at the oldest day the curve reaches. Everything
  // before it is lead-in the client was never sent.
  const from = rolling.findIndex((p) => p !== null);
  const series = from === -1 ? [] : days.slice(from);
  const drawn = from === -1 ? [] : rolling.slice(from);

  // Every value that will be drawn against the vertical axis: the plotted means,
  // each drawn day's own band as it stood that morning, and today's scalar
  // bounds. A mean that sits outside the band must still be inside the box.
  const values: number[] = [balancedLow, balancedHigh];
  for (const p of drawn) {
    if (p !== null) values.push(p.avg);
  }
  for (const d of series) {
    if (d.balancedLow !== null) values.push(d.balancedLow);
    if (d.balancedHigh !== null) values.push(d.balancedHigh);
  }

  return {
    days,
    hrvAvg,
    balancedLow,
    balancedHigh,
    shortAvg: hrv.shortAvg,
    week,
    trend: hrv.trend,
    drift: baselineTrend,
    today: days[days.length - 1],
    nights: classifyNights(days),
    series,
    rolling: drawn,
    domain: [Math.min(...values) - 5, Math.max(...values) + 5],
  };
}

/**
 * The 7-day rolling mean of the nightly readings, one entry per day, aligned
 * with the series it was given.
 *
 * The rule is the server's, restated: the mean of every reading in the trailing
 * `ROLLING_WINDOW_NIGHTS` days INCLUDING this one, emitted only once that window
 * holds `MIN_ROLLING_NIGHTS` of them. Two consequences are deliberate.
 *
 * A missing morning does not break the curve — it is simply one fewer sample in
 * seven windows — which is exactly why the tile plots this rather than the raw
 * reading: the chart keeps its final mark at 7am, before today's webhook lands.
 * A LONG absence does break it, once a window falls under the sample floor, and
 * that break is honest: four readings out of seven is a mean, one is a night.
 *
 * The first `ROLLING_WINDOW_NIGHTS - 1` days are null however many readings they
 * have. Their windows extend back into history the client was not sent, and a
 * four-day mean drawn beside a seven-day one is a different statistic wearing
 * the same dot.
 */
export function rollingAverages(days: RecoveryDayPoint[]): (RollingPoint | null)[] {
  return days.map((d, i) => {
    if (i < ROLLING_WINDOW_NIGHTS - 1) return null;
    // flatMap NARROWS the nullable reading, which is what avoids an `as number`.
    const readings = days
      .slice(i - ROLLING_WINDOW_NIGHTS + 1, i + 1)
      .flatMap((w) => (w.hrv === null ? [] : [w.hrv]));
    if (readings.length < MIN_ROLLING_NIGHTS) return null;

    const avg = readings.reduce((sum, v) => sum + v, 0) / readings.length;
    const { balancedLow, balancedHigh } = d;
    if (balancedLow === null || balancedHigh === null) return { avg, status: "unknown" };
    return { avg, status: weekStatus(avg, balancedLow, balancedHigh) };
  });
}

/**
 * Split a rolling series into runs of consecutive days that HAVE a mean, so the
 * curve breaks where the window went too sparse instead of drawing a straight
 * chord across a week the athlete has no readings for. The ORIGINAL index
 * travels with each point so the polyline stays registered with the band drawn
 * from the same series — the same contract `bandRuns` keeps, for the same reason.
 */
export function rollingRuns(rolling: (RollingPoint | null)[]): { i: number; p: RollingPoint }[][] {
  const runs: { i: number; p: RollingPoint }[][] = [];
  let run: { i: number; p: RollingPoint }[] = [];
  rolling.forEach((p, i) => {
    if (p === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ i, p });
    }
  });
  if (run.length) runs.push(run);
  return runs;
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
