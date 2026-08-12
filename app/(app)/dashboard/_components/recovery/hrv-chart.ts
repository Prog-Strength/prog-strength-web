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
 * How much narrower the band for a 7-DAY MEAN is than the band for ONE NIGHT.
 *
 * The server emits one band, `hrv_avg ± balanced_z × sd`, and it is sized for a
 * single morning's reading. Every week-scale register on this tile — the curve,
 * the ribbon behind it, the gauge's zones and `week` itself — is about a mean of
 * seven of those readings, and a mean is a far steadier quantity than the thing
 * it averages. Judging it against the nightly band asks whether a week is as
 * unusual as one bad night, which it essentially never is: the ribbon reads
 * enormous, the curve idles down the middle of it, and a genuinely bad week
 * never trips a threshold. That is the "band is too wide" complaint, and it is a
 * units mismatch rather than a matter of taste.
 *
 * √7 is the standard error of a mean of seven samples, and it assumes those
 * samples are INDEPENDENT — which nightly HRV is not, being autocorrelated
 * across a week. The true spread of a 7-day mean therefore sits somewhere
 * between `sd/√7` and `sd`, and this constant is the aggressive end of that
 * range: it will call a week unusual sooner than a perfectly-specified model
 * would. It is one named constant precisely so it can be dialled toward 1 after
 * looking at real weeks.
 *
 * The honest home for this is the server, beside the band it narrows — the
 * engine has the raw series and could emit a `short_avg` band directly, with the
 * autocorrelation measured rather than assumed. Until it does, this is a display
 * transform of two figures the payload already carries, applied in ONE place so
 * that the chart, the gauge and `week` cannot disagree about where the line is.
 */
export const WEEK_BAND_DIVISOR = Math.sqrt(ROLLING_WINDOW_NIGHTS);

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
  /** Today's NIGHTLY band, proven non-null. Both are server figures, and the
   *  gauge's ±2-half-width scale is still built from them — only the zone
   *  boundaries inside that scale moved. */
  balancedLow: number;
  balancedHigh: number;
  /** Today's band narrowed for a 7-day mean (`weekBand`). The threshold every
   *  week-scale register is drawn against: the ribbon, the marks' status, the
   *  gauge's coloured zones and its printed labels, and `week`. */
  weekLow: number;
  weekHigh: number;
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
 * from the emitted band bounds rather than from the SD (see `gaugePct`), so
 * demanding an SD here would gate the whole tile on a figure it never reads.
 */
export function prepareHrvChart(view: RecoveryView): HrvChart | null {
  const { days, baseline, hrv, baselineTrend } = view;
  if (!days || !baseline || !hrv || !baselineTrend) return null;
  if (days.length === 0) return null;

  const { hrvAvg } = baseline;
  const { balancedLow, balancedHigh } = hrv;
  if (hrvAvg === null || balancedLow === null || balancedHigh === null) return null;

  // Every week-scale register is judged against the WEEK's band, narrowed here
  // once so the ribbon, the marks, the gauge's zones and `week` are one line.
  const [weekLow, weekHigh] = weekBand(balancedLow, balancedHigh);
  const week = weekStatus(hrv.shortAvg, weekLow, weekHigh);

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
  // each drawn day's own WEEK band as it stood that morning, and today's. The
  // nightly bounds are not in it — nothing draws them any more, and letting them
  // set the axis is what squashed the curve into the middle of the box.
  const values: number[] = [weekLow, weekHigh];
  for (const p of drawn) {
    if (p !== null) values.push(p.avg);
  }
  for (const d of series) {
    if (d.balancedLow === null || d.balancedHigh === null) continue;
    values.push(...weekBand(d.balancedLow, d.balancedHigh));
  }

  return {
    days,
    hrvAvg,
    balancedLow,
    balancedHigh,
    weekLow,
    weekHigh,
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
    // Against that morning's WEEK band, not its nightly one — the mark is a mean
    // and must be judged on the scale means live at.
    return { avg, status: weekStatus(avg, ...weekBand(balancedLow, balancedHigh)) };
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
 * Narrow a nightly band to the band for a 7-day mean, about the same centre.
 *
 * Taken from the two BOUNDS rather than from `baselineAvg`, so a day whose
 * baseline is null but whose bounds are not still narrows correctly, and so the
 * centre is the midpoint the server actually drew — no assumption that the band
 * is symmetric about a figure this function was not given.
 */
export function weekBand(low: number, high: number): [number, number] {
  const mid = (low + high) / 2;
  const half = (high - low) / 2 / WEEK_BAND_DIVISOR;
  return [mid - half, mid + half];
}

/**
 * Where a 7-day mean sits against a band — the SAME two bounds the caller draws
 * it against, so a mark outside the ribbon and a non-balanced status are one
 * fact rather than two that usually coincide.
 *
 * Always handed a WEEK band (`weekBand`), never the nightly one: every caller is
 * classifying a mean. Called once per plotted mark with that morning's own
 * bounds, and once for `week` with today's.
 *
 * Deliberately about the WEEK, not last night: it colors the trend view's delta,
 * the balance view's gauge tick and the curve's marks, all of which are figures
 * about a mean. Last night's verdict has its own source (`today.status`).
 */
export function weekStatus(
  shortAvg: number | null,
  weekLow: number,
  weekHigh: number,
): RecoveryHrvStatus {
  if (shortAvg === null) return "unknown";
  if (shortAvg < weekLow) return "suppressed";
  if (shortAvg > weekHigh) return "elevated";
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
 * Position a millisecond value on the gauge's ±2-NIGHTLY-half-width scale.
 *
 * One mapper for all three things the gauge draws — the tick, the two coloured
 * zone boundaries, and the labels under them — because a tick placed by one
 * formula and a boundary placed by another is exactly how a tile ends up with a
 * `suppressed` week whose tick sits in the green.
 *
 * The half-width is read off the EMITTED bounds, not off `hrv_std_dev`, and that
 * distinction is the whole point. The server's band is
 * `hrv_avg ± balanced_z × max(sd, min_std_dev_ms)`: it uses a floored deviation
 * and a multiplier the client never receives. Scaling by the raw `hrv_std_dev`
 * therefore silently assumes `balanced_z == 1` and no SD floor, and would put
 * the tick somewhere the bound labels say it should not be — visible only for an
 * athlete with a near-flat history, or the first time `balanced_z` is retuned.
 * Deriving the half-width from the bounds makes tick and labels agree by
 * construction, whatever those two constants are.
 *
 * The SCALE stays nightly on purpose even though the ZONES inside it are now the
 * week's. A scale of ±2 week-half-widths would span barely ±9 ms for a typical
 * athlete, and any week worth worrying about would pin to an end of the bar and
 * lose its magnitude. Keeping the nightly scale keeps the range generous and
 * simply moves the colour boundaries inward to where the week's thresholds
 * actually fall — which is why those boundaries are computed rather than
 * hard-coded at 25% and 75% as they were when the two bands were one.
 *
 * Null when the value is absent or the band is degenerate. The clamp pins a
 * wildly atypical week to an end of the bar rather than letting it escape.
 */
export function gaugePct(
  value: number | null,
  hrvAvg: number,
  balancedHigh: number,
): number | null {
  const half = balancedHigh - hrvAvg;
  if (value === null || half <= 0) return null;
  const u = (value - hrvAvg) / half;
  return Math.min(100, Math.max(0, ((u + 2) / 4) * 100));
}
