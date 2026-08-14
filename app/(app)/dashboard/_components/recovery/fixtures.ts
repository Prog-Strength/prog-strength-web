/**
 * Test fixtures for the recovery tile family. Four generations live here, and
 * the first two differ only in how much of a day's own band they claim to know:
 *
 * 1. `makeDays` + the four original views (suppressed / balanced / calibrating /
 *    no-reading-yet) — a full 31-day date-aligned window with an interior
 *    all-null day (2026-07-29, index 27) so the gap contract is exercised by
 *    default, and per-day band fields left null because a day's own trailing
 *    band could not be known without recomputing 30-day means. Values mirror
 *    the DX's headline fixture: baseline 91.2 ± 12.6 ms, band 78.6–103.8.
 * 2. `driftingDays` + the drift views — a window whose baseline WALKS, each day
 *    carrying the band as it stood that morning. The redesigned HRV balance
 *    tile draws a band polygon, so a series with no per-day bands cannot drive
 *    it at all; the DX's instruction for exactly this case is to "hand-author
 *    the numbers so the band moves the way the fixture claims", which is what
 *    the generator does. It is arithmetic over a stated straight line, not a
 *    reimplementation of the server's rolling baseline.
 * 3. `bandedDays` + the log views — explicit per-day recovery scores, anchored
 *    on `RECOVERY_LOG_TODAY` (2026-08-11) rather than `FIXTURE_TODAY`, because
 *    `makeDays`' `48 + (i % 30)` sawtooth never produces a red morning. Per-day
 *    bands are null as in (1).
 * 4. `restingDays` + the resting-HR views — a window taking an EXPLICIT resting
 *    heart-rate series, anchored on `RESTING_HR_TODAY` (2026-08-12, a
 *    Wednesday, so the recent rows read Today / Tue / Mon / Sun), built to the DX's
 *    own numbers so the tile and the DX preview cannot disagree. Each view's
 *    `restingHrAvg` is DERIVED as the true mean of its own thirty pre-today
 *    readings, because the tile positions the average tick against the strip's
 *    own values and a stated-but-wrong baseline would render a plausible card
 *    asserting an impossible payload. Per-day HRV band fields are null as in
 *    (1) and (3) — this tile reads none of them.
 *
 * The original four keep their day series byte-for-byte — the other recovery
 * tiles' tests read them — and gain only a `baselineTrend` block, which the new
 * tile's guard requires. That block is a SCALAR summary and is truthful as one;
 * it is NOT re-derivable from those four views' own `days[]`, whose interiors
 * are deliberately unbanded, so the engine's drift rule (today's baseline
 * against the baseline `overDays` back) would say `unknown` if run over them.
 * Views whose `days[]` must sustain the drift rule use `driftingDays` instead.
 * Test-only; never imported by production code.
 */

import type {
  RecoveryBaselineTrendView,
  RecoveryBaselineView,
  RecoveryDayPoint,
  RecoveryHrvStatus,
  RecoveryTrendDirection,
  RecoveryView,
} from "@/lib/dashboard";

/** The fixture "today" — the last of the 31 window dates. */
export const FIXTURE_TODAY = "2026-08-01";

/**
 * The interior missing night (2026-07-29) that both default series carry, so
 * every fixture exercises the gap contract without opting in. Named because
 * tests assert against this index rather than against a bare 27.
 */
export const DRIFT_GAP_INDEX = 27;

// Index 27 (2026-07-29) is the interior gap; index 30 is today.
const HRV_SERIES: (number | null)[] = [
  95,
  88,
  102,
  91,
  84,
  97,
  90,
  79,
  105,
  93,
  87,
  99,
  92,
  81,
  96,
  89,
  101,
  94,
  85,
  98,
  90,
  83,
  100,
  92,
  89,
  95,
  86,
  null,
  86,
  81,
  74,
];

/**
 * The drift views' default nightly series: 31 readings ending on 94 ms — the
 * "today" every drift view but `suppressedDriftView` states — with the same
 * interior gap at index 27, so the missing-night case is exercised by default
 * as the DX asks. Exported so the tile's tests can pass it explicitly.
 */
export const DRIFT_HRV_SERIES: (number | null)[] = [
  82,
  91,
  76,
  88,
  95,
  79,
  86,
  93,
  71,
  84,
  97,
  80,
  89,
  92,
  78,
  87,
  105,
  83,
  90,
  94,
  81,
  88,
  102,
  85,
  92,
  96,
  87,
  null,
  90,
  98,
  94,
];

/**
 * `DRIFT_HRV_SERIES` with the interior gap filled in. The band is generated
 * from the baseline walk and not from the readings, so a view built on this
 * series has exactly the same band as the same view built on the gapped one
 * and exactly one more nightly mark — which is the comparison the tile's
 * "an interior gap costs a mark but not a polygon" test needs.
 */
export const DRIFT_HRV_SERIES_GAPLESS: (number | null)[] = DRIFT_HRV_SERIES.map((v, i) =>
  i === DRIFT_GAP_INDEX ? 88 : v,
);

function isoDate(offset: number): string {
  const d = new Date(2026, 6, 2 + offset); // 2026-07-02 + offset, local
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * `anchor` (YYYY-MM-DD) minus `back` days, as YYYY-MM-DD, from local date parts.
 *
 * Shared by the two ANCHORED generations, (3) and (4): a series that ends on a
 * named "today" and counts backwards is the same arithmetic whichever today it
 * is, and the reason those generations do not share a day BUILDER — a modulus
 * sawtooth cannot state a shape — says nothing about date arithmetic.
 *
 * `isoDate` above stays separate on purpose. It steps FORWARD from a fixed
 * start rather than backward from an anchor, which is a genuinely different
 * thing, and folding the two together would only disguise that.
 */
function isoBefore(anchor: string, back: number): string {
  const [y, m, d] = anchor.split("-").map(Number);
  const date = new Date(y, m - 1, d - back);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

/** Round to `dp` decimals, normalising `-0` so fixture figures compare cleanly. */
function round(value: number, dp: number): number {
  const f = 10 ** dp;
  const r = Math.round(value * f) / f;
  return r === 0 ? 0 : r;
}

/**
 * Build the 31-day window from an HRV series; a null HRV ⇒ a fully-null day.
 * The interior days' band fields are deliberately left null / "unknown": a
 * day's own trailing band cannot be known without recomputing it, so inventing
 * one HERE would be fixture fiction — this helper is handed nothing but the
 * readings. The calibrated views below overwrite the LAST day with figures that
 * agree with their `hrv` block, mirroring the server, where the scalar and
 * series bands come from the same helpers. Views that need a band on every day
 * state the baseline's path explicitly and use `driftingDays` instead.
 */
export function makeDays(hrv: (number | null)[] = HRV_SERIES): RecoveryDayPoint[] {
  return hrv.map((v, i) => ({
    date: isoDate(i),
    hrv: v,
    restingHr: v === null ? null : 49 + (i % 6),
    recoveryScore: v === null ? null : 48 + (i % 30),
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
  }));
}

function baseline(): RecoveryBaselineView {
  return {
    windowDays: 30,
    restingHrAvg: 52.4,
    restingHrDays: 27,
    hrvAvg: 91.2,
    hrvStdDev: 12.6,
    hrvDays: 26,
    recoveryScoreAvg: 68.1,
    recoveryScoreDays: 27,
  };
}

export type DriftingDaysOptions = {
  /** The nightly readings, oldest→newest. Its length is the window length. */
  hrv?: (number | null)[];
  /** The baseline on day 0 and on the last day; it walks linearly between them. */
  fromAvg: number;
  toAvg: number;
  /** Half the band's width. Each day's band is `baselineAvg ± halfWidth`. */
  halfWidth: number;
  /** Index of the first day that HAS a band; earlier days carry a null one. */
  bandFrom?: number;
  /** A single interior index whose baseline is null, breaking the polygon. */
  bandGapAt?: number;
};

/**
 * A day series whose baseline walks in a straight line from `fromAvg` to
 * `toAvg`, each day carrying the band as it stood that morning and a z-score
 * classified against **its own** band.
 *
 * Two contracts are modelled deliberately, because the tile has to render both:
 *
 * - Days before `bandFrom` carry a null baseline, null bounds, a null z and
 *   `status: "unknown"` — the real state of a morning whose own trailing window
 *   holds fewer than 14 readings. Same for `bandGapAt`, in the interior.
 * - **A null HRV keeps the band and drops the z and the status.** The absent
 *   reading must not erase the band that morning sat in; this is the engine's
 *   contract for a missing morning and `noReadingView` models it too.
 *
 * The baseline is rounded to 0.1 ms and the z to 0.01 before either is stored,
 * and the status is classified from the ROUNDED z, so the numbers a test reads
 * are the numbers the arithmetic was done on — as they are in a real payload.
 */
export function driftingDays({
  hrv = DRIFT_HRV_SERIES,
  fromAvg,
  toAvg,
  halfWidth,
  bandFrom = 0,
  bandGapAt,
}: DriftingDaysOptions): RecoveryDayPoint[] {
  const lastIndex = Math.max(1, hrv.length - 1);
  return hrv.map((v, i): RecoveryDayPoint => {
    const day = {
      date: isoDate(i),
      hrv: v,
      restingHr: v === null ? null : 49 + (i % 6),
      recoveryScore: v === null ? null : 48 + (i % 30),
    };
    if (i < bandFrom || i === bandGapAt) {
      return {
        ...day,
        baselineAvg: null,
        balancedLow: null,
        balancedHigh: null,
        zScore: null,
        status: "unknown",
      };
    }
    const baselineAvg = round(fromAvg + ((toAvg - fromAvg) * i) / lastIndex, 1);
    const band = {
      ...day,
      baselineAvg,
      balancedLow: round(baselineAvg - halfWidth, 1),
      balancedHigh: round(baselineAvg + halfWidth, 1),
    };
    if (v === null) return { ...band, zScore: null, status: "unknown" };
    const zScore = round((v - baselineAvg) / halfWidth, 2);
    const status: RecoveryHrvStatus =
      zScore > 1 ? "elevated" : zScore < -1 ? "suppressed" : "balanced";
    return { ...band, zScore, status };
  });
}

type DriftViewOptions = {
  days: RecoveryDayPoint[];
  /** The emitted SD. Set it to the generator's `halfWidth` unless a fixture is
   *  specifically about the two disagreeing. */
  hrvStdDev: number;
  /**
   * The 7-day mean, which is what the tile heroes.
   *
   * STATED, not derived from `hrv` — and worth knowing before reading a rendered
   * chart. The balance view's curve is the rolling mean of the series and
   * terminates on this figure, so in a fixture where the two disagree the last
   * mark visibly steps off the curve. That is fixture fiction, not tile
   * behaviour: on the wire `short_avg` IS the mean of the last seven days of
   * `days`, and the curve runs smoothly into it.
   */
  shortAvg: number | null;
  /** `RecoveryHrvView.trend` — the recent mean against its window, NOT the
   *  baseline's own drift. The two may legitimately point opposite ways. */
  trend: RecoveryTrendDirection;
  baselineTrend: RecoveryBaselineTrendView;
  spark?: number[];
};

/**
 * Assemble a `RecoveryView` around a generated series, deriving the scalar
 * `hrv` block and `baseline.hrvAvg` FROM the last generated day. The
 * "last day agrees with the scalar blocks" invariant that `fixtures.test.ts`
 * pins then holds by construction, rather than by two hand-copied number sets
 * that can drift apart the next time a figure is tweaked.
 */
function driftView({
  days,
  hrvStdDev,
  shortAvg,
  trend,
  baselineTrend,
  spark = [53, 52, 51, 52],
}: DriftViewOptions): RecoveryView {
  const last = days[days.length - 1];
  return {
    restingToday: last.restingHr,
    recoveryScore: last.recoveryScore,
    hrvToday: last.hrv,
    spark,
    days,
    // The shared baseline block, with only the two figures a drift view
    // genuinely owns overridden: the mean comes from the generated last day and
    // the spread is the fixture's subject. Every other count and average is the
    // same athlete as the original four, so it is spread rather than retyped.
    baseline: { ...baseline(), hrvAvg: last.baselineAvg, hrvStdDev },
    hrv: {
      status: last.status,
      balancedLow: last.balancedLow,
      balancedHigh: last.balancedHigh,
      zScore: last.zScore,
      trend,
      shortAvg,
    },
    baselineTrend,
  };
}

/** Calibrated + suppressed — the DX's headline fixture. Today 74 ms, z −1.37. */
export function suppressedView(): RecoveryView {
  const days = makeDays();
  // Band agrees with the `hrv` block below — the server derives both together.
  days[days.length - 1] = {
    date: FIXTURE_TODAY,
    hrv: 74,
    restingHr: 51,
    recoveryScore: 58,
    baselineAvg: 91.2,
    balancedLow: 78.6,
    balancedHigh: 103.8,
    zScore: -1.37,
    status: "suppressed",
  };
  return {
    restingToday: 51,
    recoveryScore: 58,
    hrvToday: 74,
    spark: [53, 52, 51, 51],
    days,
    baseline: baseline(),
    hrv: {
      status: "suppressed",
      balancedLow: 78.6,
      balancedHigh: 103.8,
      zScore: -1.37,
      trend: "falling",
      shortAvg: 82.3,
    },
    // 96.8 → 91.2 over four weeks. `falling` is honest against this view's own
    // SD: the engine needs |Δ| > 0.35 × 12.6 = 4.4 ms and 5.6 clears it.
    baselineTrend: { direction: "falling", deltaMs: -5.6, fromAvg: 96.8, overDays: 28 },
  };
}

/** Calibrated + balanced — the boring good day. Today 94 ms, z +0.22. */
export function balancedView(): RecoveryView {
  const days = makeDays();
  // Band agrees with the `hrv` block below — the server derives both together.
  days[days.length - 1] = {
    date: FIXTURE_TODAY,
    hrv: 94,
    restingHr: 52,
    recoveryScore: 71,
    baselineAvg: 91.2,
    balancedLow: 78.6,
    balancedHigh: 103.8,
    zScore: 0.22,
    status: "balanced",
  };
  return {
    restingToday: 52,
    recoveryScore: 71,
    hrvToday: 94,
    spark: [53, 52, 51, 52],
    days,
    baseline: baseline(),
    hrv: {
      status: "balanced",
      balancedLow: 78.6,
      balancedHigh: 103.8,
      zScore: 0.22,
      trend: "steady",
      shortAvg: 92.8,
    },
    // 89.1 → 91.2: a 2.1 ms move, inside this view's 4.4 ms threshold, so
    // `steady` is what the engine would say about it.
    baselineTrend: { direction: "steady", deltaMs: 2.1, fromAvg: 89.1, overDays: 28 },
  };
}

/** Calibrating — 9 of 14 nights in; averages, bounds, z all null. */
export function calibratingView(): RecoveryView {
  const days = makeDays(HRV_SERIES.map((v, i) => (i < 21 ? null : v)));
  return {
    restingToday: 51,
    recoveryScore: 58,
    hrvToday: 74,
    spark: [53, 52, 51],
    days,
    baseline: {
      windowDays: 30,
      restingHrAvg: null,
      restingHrDays: 9,
      hrvAvg: null,
      hrvStdDev: null,
      hrvDays: 9,
      recoveryScoreAvg: null,
      recoveryScoreDays: 9,
    },
    hrv: {
      status: "unknown",
      balancedLow: null,
      balancedHigh: null,
      zScore: null,
      trend: "unknown",
      shortAvg: null,
    },
    // No baseline yet, so no drift to measure — every figure null, direction
    // `unknown`. The window length is still known and still reported.
    baselineTrend: { direction: "unknown", deltaMs: null, fromAvg: null, overDays: 28 },
  };
}

/** No reading yet today — 7am before the webhook; baseline and trend intact. */
export function noReadingView(): RecoveryView {
  const days = makeDays();
  // A missing morning drops the z-score and the status but KEEPS the band: the
  // absent reading must not erase the band that morning sat in.
  days[days.length - 1] = {
    date: FIXTURE_TODAY,
    hrv: null,
    restingHr: null,
    recoveryScore: null,
    baselineAvg: 91.2,
    balancedLow: 78.6,
    balancedHigh: 103.8,
    zScore: null,
    status: "unknown",
  };
  return {
    restingToday: null,
    recoveryScore: null,
    hrvToday: null,
    spark: [53, 52, 51],
    days,
    baseline: baseline(),
    hrv: {
      status: "unknown",
      balancedLow: 78.6,
      balancedHigh: 103.8,
      zScore: null,
      trend: "falling",
      shortAvg: 82.3,
    },
    // Same baseline and same history as `suppressedView`; only this morning's
    // reading is missing, and a missing reading moves no baseline.
    baselineTrend: { direction: "falling", deltaMs: -5.6, fromAvg: 96.8, overDays: 28 },
  };
}

/**
 * Balanced morning inside a CLIMBING baseline — the headline case, and the
 * state the shipped tile cannot express. Baseline 84.8 → 91.2, band ±12.6,
 * today 94 ms and comfortably balanced (z +0.22) while the range underneath it
 * has moved 6.4 ms in four weeks. `rising` is what the engine would say:
 * 0.35 × 12.6 = 4.4 ms and the move clears it.
 *
 * Every drift view takes the nightly series as an argument so a test can swap
 * in `DRIFT_HRV_SERIES_GAPLESS` (or any other series of the same length) and
 * get the same band with different marks.
 */
export function risingView(hrv: (number | null)[] = DRIFT_HRV_SERIES): RecoveryView {
  return driftView({
    days: driftingDays({ hrv, fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6 }),
    hrvStdDev: 12.6,
    shortAvg: 92.8,
    trend: "rising",
    baselineTrend: { direction: "rising", deltaMs: 6.4, fromAvg: 84.8, overDays: 28 },
  });
}

/**
 * The mirror case, and the one with product weight: today's 94 ms still reads
 * `balanced`, but only because the band has SUNK to meet it — 99.3 → 91.2, an
 * 8.1 ms fall over four weeks. A tile that says "Balanced" here and nothing
 * else is the failure mode this redesign exists to prevent.
 */
export function fallingView(hrv: (number | null)[] = DRIFT_HRV_SERIES): RecoveryView {
  return driftView({
    days: driftingDays({ hrv, fromAvg: 99.3, toAvg: 91.2, halfWidth: 12.6 }),
    hrvStdDev: 12.6,
    shortAvg: 92.8,
    trend: "falling",
    baselineTrend: { direction: "falling", deltaMs: -8.1, fromAvg: 99.3, overDays: 28 },
  });
}

/**
 * The threshold fixture, and the reason it exists is worth stating in full.
 *
 * The baseline walks the same 84.8 → 91.2 as `risingView` — `deltaMs: 6.4`,
 * plainly visible as a sloping band — but this athlete's spread is wider:
 * SD 20.1. The engine's `baseline_drift_z = 0.35` therefore demands
 * |Δ| > 0.35 × 20.1 = 7.03 ms before it will say `rising`, and 6.4 does not
 * clear it. The honest verdict is `steady`.
 *
 * The tile must still PRINT the magnitude: `▬ +6 ms · 4w`, not a bare
 * "steady". This fixture is what pins that, so nobody "simplifies" the number
 * away on the grounds that the verdict is steady.
 */
export function steadyDriftView(hrv: (number | null)[] = DRIFT_HRV_SERIES): RecoveryView {
  return driftView({
    days: driftingDays({ hrv, fromAvg: 84.8, toAvg: 91.2, halfWidth: 20.1 }),
    hrvStdDev: 20.1,
    shortAvg: 92.8,
    trend: "steady",
    baselineTrend: { direction: "steady", deltaMs: 6.4, fromAvg: 84.8, overDays: 28 },
  });
}

/**
 * `risingView` with 40 nights of history behind only part of the window: the
 * `bandFrom` oldest charted days have too few readings in their own trailing
 * windows to carry a band, so they arrive with `baselineAvg: null` and
 * `status: "unknown"`. The polygon must start part-way across and the earliest
 * marks must still render, uncoloured — nothing may look clipped.
 *
 * `bandFrom` is a parameter because the balance chart draws only the days its
 * seven-night rolling window reaches, which is `days[6:]`: a prefix shorter than
 * that is entirely inside the lead-in the chart never draws, so a test about
 * unbanded MARKS has to push the prefix past it. The default of 5 stays where it
 * was for the tests about the POLYGON, which the lead-in does not hide.
 *
 * The drift is `unknown`, and that is forced rather than chosen: the engine
 * differences today's baseline against the baseline `overDays` ago, which for a
 * 31-day series at `overDays: 28` is `days[2]` — inside the unbanded prefix, so
 * the figure it would subtract does not exist yet. A band that starts part-way
 * across cannot support a four-week drift verdict. This therefore doubles as
 * the fixture that exercises the tile's `drift not yet known` branch.
 */
export function partialBandView(
  hrv: (number | null)[] = DRIFT_HRV_SERIES,
  bandFrom = 5,
): RecoveryView {
  return driftView({
    days: driftingDays({ hrv, fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6, bandFrom }),
    hrvStdDev: 12.6,
    shortAvg: 92.8,
    trend: "rising",
    baselineTrend: { direction: "unknown", deltaMs: null, fromAvg: null, overDays: 28 },
  });
}

/**
 * `risingView` with an INTERIOR null baseline (index 15). The band is defined
 * on days that have a baseline, so its polygon has to break here rather than
 * close across the hole — which is a different case from `partialBandView`,
 * where the band is merely absent at the start and the remainder is still one
 * unbroken run.
 */
export function bandGapView(hrv: (number | null)[] = DRIFT_HRV_SERIES): RecoveryView {
  return driftView({
    days: driftingDays({ hrv, fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6, bandGapAt: 15 }),
    hrvStdDev: 12.6,
    shortAvg: 92.8,
    trend: "rising",
    baselineTrend: { direction: "rising", deltaMs: 6.4, fromAvg: 84.8, overDays: 28 },
  });
}

/**
 * The 7am state, on a DRIFTING band — `risingView` with this morning's reading
 * missing, and nothing else changed.
 *
 * This is the state the SOW singles out as the idiom's pass/fail criterion, and
 * it describes it with the band present: "the word reads *No reading yet*, the
 * 28px figure still prints the 7-day average, the gauge still has its tick, and
 * the chart simply has no final mark". `noReadingView` cannot pin that — it is
 * built on `makeDays`, whose interior days carry no band of their own, so its
 * chart honestly draws no polygon at all and would pass a tile that had lost
 * the band entirely. Here every day carries its own band, so the polygon is
 * REQUIRED to survive the missing morning.
 *
 * The generator supplies the shape: a null reading keeps the band and drops the
 * z and the status, which is the engine's contract for a morning before the
 * webhook lands. `driftView` then derives the scalar `hrv` block from that last
 * day — `status: "unknown"`, `zScore: null`, the band still there — so the
 * fixtures' "last day agrees with the scalar blocks" invariant holds by
 * construction rather than by hand-copied numbers. `shortAvg` stays 92.8, as in
 * `risingView`: the 7-day mean is computed over a window that includes today
 * but does not require it, so a missing morning leaves it intact.
 */
export function noReadingDriftView(hrv: (number | null)[] = DRIFT_HRV_SERIES): RecoveryView {
  const beforeThisMorning = hrv.map((v, i) => (i === hrv.length - 1 ? null : v));
  return driftView({
    days: driftingDays({ hrv: beforeThisMorning, fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6 }),
    hrvStdDev: 12.6,
    shortAvg: 92.8,
    trend: "rising",
    baselineTrend: { direction: "rising", deltaMs: 6.4, fromAvg: 84.8, overDays: 28 },
  });
}

/**
 * A suppressed morning under an essentially flat baseline: 90.8 → 91.2, a
 * 0.4 ms move that is nowhere near the 4.4 ms this view's SD demands, so the
 * verdict is `steady` and the band draws as a level ribbon. Today is 74 ms —
 * z −1.37, well under the band.
 *
 * `shortAvg` is 77.0, which puts the gauge tick in the LOWER QUARTER of the
 * bar: `gaugePct` reads the half-width off the emitted bounds
 * (103.8 − 91.2 = 12.6), so the tick lands at
 * `((((77.0 − 91.2) / 12.6) + 2) / 4) × 100 = 21.8%` — below the 25% mark that
 * carries the `balancedLow` label. Defaults to `HRV_SERIES`, whose last
 * reading is already the 74 ms this view describes.
 */
export function suppressedDriftView(hrv: (number | null)[] = HRV_SERIES): RecoveryView {
  return driftView({
    days: driftingDays({ hrv, fromAvg: 90.8, toAvg: 91.2, halfWidth: 12.6 }),
    hrvStdDev: 12.6,
    shortAvg: 77.0,
    trend: "falling",
    spark: [53, 52, 51, 51],
    baselineTrend: { direction: "steady", deltaMs: 0.4, fromAvg: 90.8, overDays: 28 },
  });
}

/** A legacy payload with no derived blocks — exercises the top-of-card guard. */
export function legacyView(): RecoveryView {
  return { restingToday: 51, recoveryScore: 58, spark: [53, 52, 51] };
}

/**
 * The recovery-log fixtures' "today" — 2026-08-11, a TUESDAY, and the DX's own
 * headline date. These views are anchored here rather than on `FIXTURE_TODAY`
 * (2026-08-01, a Saturday) because the log's story is told in weekday labels:
 * a bad Saturday and Sunday, a rebound Monday, and no reading yet today. On a
 * Saturday "today" the tests would assert on the wrong weekend.
 */
export const RECOVERY_LOG_TODAY = "2026-08-11";

/**
 * A date-aligned day series taking EXPLICIT recovery scores, oldest→newest and
 * ending on `RECOVERY_LOG_TODAY`, so a test can state the band sequence it is
 * asserting on rather than reading it out of a modulus. `makeDays`'s
 * `48 + (i % 30)` sawtooth never produces a red morning, which is precisely the
 * state the recovery log exists to make legible.
 *
 * The "band" in the name is the COLOUR band a recovery score falls in —
 * `recoveryBand` in `shared.ts`, red / yellow / green — and NOT the HRV balance
 * band that `bandFrom`, `bandGapAt` and `partialBandView` above are about. This
 * generator leaves every per-day balance field null / "unknown", exactly as
 * `makeDays` does and for the same reason: a day's own trailing band cannot be
 * known without recomputing it, and this tile reads none of them anyway.
 *
 * A null score is a fully absent morning — no resting HR, no HRV — which is
 * what a strap-off day looks like on the wire.
 */
export function bandedDays(scores: (number | null)[]): RecoveryDayPoint[] {
  const last = scores.length - 1;
  return scores.map((score, i) => ({
    date: isoBefore(RECOVERY_LOG_TODAY, last - i),
    hrv: score === null ? null : 80 + (i % 11),
    restingHr: score === null ? null : 49 + (i % 6),
    recoveryScore: score,
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
  }));
}

/**
 * The 23 days of history behind the DX fixture's eight hand-authored mornings.
 * An unbroken run — no nulls, hence `number[]` — which is what makes the sparse
 * view's "a week ago there IS history" assertion hold.
 */
const LOG_HISTORY: number[] = [
  62, 58, 71, 49, 55, 64, 70, 44, 59, 66, 53, 61, 74, 47, 57, 63, 51, 68, 60, 45, 56, 72, 54,
];

/**
 * The DX's eight hand-authored mornings — the three READINGS verbatim. The DX
 * gives each of them a band and a status too; those are dropped on purpose, for
 * the reason `bandedDays` states — this tile reads none of them.
 *
 * The deliberately ugly floats (`112.44031`, `83.242966`, `96.10188`) are real
 * Whoop values and they are here on purpose: a tile that wraps on them has
 * failed before it is compared.
 *
 * Read as: Sunday's 29 is the story. A red morning, resting HR six beats above
 * a 53 baseline, HRV ordinary — the classic under-recovered-but-not-sick
 * signature — and Saturday's 35 says it was two days, not one. Monday's 52 with
 * a 47 bpm resting HR is the rebound, and today has not landed yet.
 */
const LOG_TAIL: ReadonlyArray<Pick<RecoveryDayPoint, "restingHr" | "recoveryScore" | "hrv">> = [
  { restingHr: 61, recoveryScore: 41, hrv: 61.0 },
  { restingHr: 51, recoveryScore: 78, hrv: 112.44031 },
  { restingHr: null, recoveryScore: null, hrv: null }, // strap off
  { restingHr: 54, recoveryScore: 66, hrv: 90.5127 },
  { restingHr: 57, recoveryScore: 35, hrv: 83.242966 }, // Sat
  { restingHr: 59, recoveryScore: 29, hrv: 77.39185 }, // Sun — the story
  { restingHr: 47, recoveryScore: 52, hrv: 96.10188 }, // Mon — the rebound
  { restingHr: null, recoveryScore: null, hrv: null }, // today, 7am
];

/** The baseline behind the log fixtures — the DX's own figures. */
function logBaseline(): RecoveryBaselineView {
  return {
    windowDays: 30,
    restingHrAvg: 53.4,
    restingHrDays: 28,
    hrvAvg: 88.2,
    hrvStdDev: 20.1,
    hrvDays: 27,
    recoveryScoreAvg: 57.6,
    recoveryScoreDays: 28,
  };
}

/**
 * Assemble a log view around a day series, deriving the scalar today-figures
 * from its last day so the two cannot disagree.
 */
function logView(days: RecoveryDayPoint[]): RecoveryView {
  const last = days[days.length - 1];
  return {
    restingToday: last.restingHr,
    recoveryScore: last.recoveryScore,
    hrvToday: last.hrv,
    // Legacy and gap-omitting — the rail must never draw from this.
    spark: [61, 51, 54, 57, 59, 47],
    days,
    baseline: logBaseline(),
    hrv: {
      status: "unknown",
      balancedLow: 68.1,
      balancedHigh: 108.3,
      zScore: null,
      trend: "steady",
      shortAvg: 86.7,
    },
    baselineTrend: { direction: "steady", deltaMs: 1.2, fromAvg: 87.0, overDays: 28 },
  };
}

/**
 * The DX's default fixture and the recovery log's headline state: 31 days
 * ending in a red weekend (35, 29), a rebound Monday (52), and no reading yet
 * today. This is what the tile looks like most mornings — nothing broken, no
 * empty state, no calibrating gate — and it is what the redesign is judged on.
 */
export function recoveryLogView(): RecoveryView {
  const scored = bandedDays([...LOG_HISTORY, ...LOG_TAIL.map((m) => m.recoveryScore)]);
  // The generator supplies the last eight days' DATES and null bands; their three
  // readings are then replaced wholesale by the DX's own, which is why the scores
  // are stated once, here, and not duplicated into LOG_TAIL's own literals.
  const days = scored.map((day, i) =>
    i < LOG_HISTORY.length ? day : { ...day, ...LOG_TAIL[i - LOG_HISTORY.length] },
  );
  return logView(days);
}

/**
 * Three readings in the last eight days — travel, or the strap on the charger.
 * **This is the fixture the idiom was selected on.** The three most recent
 * calendar days are all empty, so the detail register is at its worst — mostly
 * `no reading`, whatever its row count — while the rail still shows a week of
 * readings behind them: the tile has to look intentional here rather than
 * broken.
 */
export function sparseView(): RecoveryView {
  return logView(bandedDays([...LOG_HISTORY, 58, null, 41, null, 63, null, null, null]));
}

/**
 * A morning with a resting HR and an HRV but NO recovery score — the three
 * readings are independently nullable and Whoop does produce this state. The
 * row must print `—` for the score and NO band word, rather than the words
 * "No reading" beside two perfectly good figures.
 *
 * The scalar `hrv` block is deliberately left in its no-reading state — a null
 * z and `status: "unknown"` beside live bounds — even though this morning now
 * HAS an HRV. This fixture is about the recovery score's absence, not about
 * HRV, and the tile reads `days[]` only; inventing a z-score here would be
 * fixture fiction of exactly the kind `makeDays` refuses.
 */
export function partialMorningView(): RecoveryView {
  const days = [...recoveryLogView().days!];
  days[days.length - 1] = {
    ...days[days.length - 1],
    restingHr: 54,
    recoveryScore: null,
    hrv: 90.5127,
  };
  return logView(days);
}

/**
 * The resting-HR fixtures' "today" — 2026-08-12, a WEDNESDAY and the DX's own
 * headline date, so the tile's recent rows read `Today / Tue / Mon / Sun`.
 */
export const RESTING_HR_TODAY = "2026-08-12";

/**
 * A date-aligned 31-day window taking EXPLICIT resting heart rates,
 * oldest→newest and ending on `RESTING_HR_TODAY`.
 *
 * Explicit rather than generated because the resting-HR tile's whole subject is
 * the SHAPE of a month — flat, climbing, sparse — and a modulus sawtooth cannot
 * state any of them. `makeDays`' `49 + (i % 6)` is a fine filler for a tile that
 * reads resting HR incidentally and useless for the tile that ranks it.
 *
 * A null resting HR is a fully absent morning (no score, no HRV), which is what
 * a strap-off day looks like on the wire. Per-day HRV band fields are left
 * null / "unknown" for the reason `bandedDays` states: a day's own trailing
 * band cannot be known without recomputing it, and this tile reads none of them.
 */
export function restingDays(restingHr: (number | null)[]): RecoveryDayPoint[] {
  const last = restingHr.length - 1;
  return restingHr.map((v, i) => ({
    date: isoBefore(RESTING_HR_TODAY, last - i),
    hrv: v === null ? null : 80 + (i % 11),
    restingHr: v,
    recoveryScore: v === null ? null : 48 + (i % 30),
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
  }));
}

/**
 * The 23 mornings of history behind the DX's own eight recent ones. Hand-
 * authored rather than generated so the default view's baseline lands on the
 * DX's 53.4 and its extremes on the DX's 47 / 59.
 */
const RESTING_HISTORY: number[] = [
  55, 54, 52, 57, 51, 56, 53, 48, 55, 58, 50, 54, 57, 52, 49, 56, 51, 55, 53, 54, 56, 52, 53,
];

/**
 * The DX's eight recent mornings, verbatim. Sunday's 59 is six beats over the
 * average and Monday's 47 is the rebound; today's 50 is unremarkable, which is
 * the point — this is what the tile looks like most days and it should read
 * calm.
 *
 * `49.6` on the 11th is the DX's deliberate float. A card that prints
 * `49.6 bpm` has failed before it is compared, and a card that ranks it apart
 * from the 50 beside it has failed just as badly.
 */
const RESTING_TAIL: ReadonlyArray<number | null> = [51, null, 54, 57, 59, 47, 49.6, 50];

/**
 * Assemble a resting-HR view around a day series, DERIVING `restingHrAvg` and
 * `restingHrDays` from the thirty pre-today mornings so the two cannot disagree
 * with the series the strip is drawn from — the invariant `fixtures.test.ts`
 * pins.
 *
 * THE AVERAGE IS NULL FOR TWO UNRELATED REASONS and both are load-bearing.
 * `calibrating` is a modelled SERVER state: the sample is too small to average,
 * so the API states the count and withholds the mean — which is why the count
 * stays honest rather than going null with it. An empty `pre` is arithmetic:
 * there is no mean of no readings, which is why `noMorningsView` reaches the
 * same null WITHOUT passing the flag. Do not fold the second test into the
 * first — `sum / 0` is `NaN`, `NaN` typechecks as the `number` this field
 * accepts, and the card would print it.
 *
 * Built ON `logView` rather than beside it. Every non-RHR figure is the same
 * athlete as the log fixtures, and spreading that view's result is what makes
 * the claim true BY CONSTRUCTION instead of by a comment sitting over a second
 * hand-copied set of HRV blocks — a copy that goes silently stale the day
 * `logView` is edited. Only `spark` and the two RHR baseline figures are
 * overridden; this tile reads none of the rest.
 */
function restingView(
  days: RecoveryDayPoint[],
  { calibrating = false }: { calibrating?: boolean } = {},
): RecoveryView {
  const pre = days
    .slice(0, 30)
    .map((d) => d.restingHr)
    .filter((v): v is number => v !== null);
  const base = logView(days);
  return {
    ...base,
    // Legacy and gap-omitting — the strip must never draw from this.
    spark: [51, 54, 57, 59, 47, 50],
    baseline: {
      ...base.baseline!,
      restingHrAvg:
        calibrating || pre.length === 0
          ? null
          : round(pre.reduce((a, b) => a + b, 0) / pre.length, 1),
      restingHrDays: pre.length,
    },
  };
}

/*
 * NAMING, so the next reader does not have to infer the rule. `restingHrView`
 * is the default and is named for the payload field the tile is about. The
 * other six prefix `resting` only where generation 1 or 3 already owns the bare
 * name — `calibratingView`, `sparseView` and `noReadingView` are all taken —
 * which is why `creepingUpView`, `flatMonthView` and `noMorningsView` do not.
 * `resting-rank.test.tsx` imports all seven, so a rename here is a two-file
 * change, not a one-file one.
 */

/**
 * **default** — an ordinary week with one bump, and the state the tile is
 * judged calm on. Baseline 53.4 over 29 mornings, today 50, extremes 47 and 59.
 * Today ranks 4th lowest of 29 and the card spends NO colour: 50 against a 53.4
 * average rounds to −3, and colour is licensed only upward.
 */
export function restingHrView(): RecoveryView {
  return restingView(restingDays([...RESTING_HISTORY, ...RESTING_TAIL]));
}

/**
 * **creeping-up** — the fixture the tile exists for. Twenty-seven mornings flat
 * around 48 (47–50, mean 48.3), then 54 / 56 / 57 / 58, and the 30-day average
 * still reads 49 because the climb has not yet dragged it. Today's 58 is the
 * HIGHEST tick: hard against the right end, well right of the dashed average
 * tick, warm, and captioned `30th lowest of your last 30`. The recent rows
 * beneath — 58 / 57 / 56 — supply the "and it has been climbing" that a rank
 * alone cannot.
 */
export function creepingUpView(): RecoveryView {
  const flat = [
    48, 47, 49, 48, 50, 47, 48, 49, 48, 47, 49, 48, 48, 50, 47, 49, 48, 48, 49, 47, 50, 48, 49, 48,
    47, 49, 48,
  ];
  return restingView(restingDays([...flat, 54, 56, 57, 58]));
}

/**
 * **flat-month** — 48–50 for the whole window, and the variant's structural
 * advantage. There is no axis to auto-scale, so the endpoints read `48 lowest`
 * / `50 highest` and two beats of range are instantly readable as *nothing is
 * happening*. Today's 49 is exactly the average, so no colour is spent.
 */
export function flatMonthView(): RecoveryView {
  const month = [
    49, 48, 50, 48, 50, 49, 48, 50, 48, 50, 49, 48, 50, 48, 50, 49, 48, 50, 48, 50, 49, 48, 50, 48,
    50, 49, 48, 50, 49, 49,
  ];
  return restingView(restingDays([...month, 49]));
}

/**
 * **no-reading-yet** — 7am, before the morning webhook lands. The default month
 * with today's reading missing and NOTHING else changed: the baseline stands,
 * the strip and its average tick still draw from the remaining mornings, and
 * yesterday is never promoted into today — the recent rows carry it explicitly
 * one register below, which is where it belongs.
 */
export function restingNoReadingView(): RecoveryView {
  return restingView(restingDays([...RESTING_HISTORY, ...RESTING_TAIL.slice(0, 7), null]));
}

/**
 * **sparse** — three readings in the last eight days, plus one older gap:
 * travel, or the strap on the charger. `n` drops to 24, so the caption must say
 * `of your last 24` rather than claiming thirty, the tick pitch widens
 * accordingly, and two of the four recent rows print `no reading`. Gaps must
 * read as gaps.
 */
export function restingSparseView(): RecoveryView {
  const history = RESTING_HISTORY.map((v, i) => (i === 10 ? null : v));
  return restingView(restingDays([...history, null, 52, null, null, 48, null, null, 50]));
}

/**
 * **calibrating** — `restingHrAvg: null`, `restingHrDays: 9`, and the state this
 * variant was partly selected on: a rank needs no baseline, only a
 * distribution, so the STRIP RENDERS INTACT. No average tick, no average label,
 * no colour, and the caption's reserved second line reads
 * `no avg yet, 9 of 14 mornings`.
 *
 * `hrvDays` is deliberately left at the shared 27. The counts are separate
 * samples on the wire and a tile that borrows the wrong one is the exact bug
 * the recovery_log SOW had to correct in its mockup.
 *
 * That argument covers `restingHrDays !== hrvDays`. It does NOT cover the
 * inherited `hrvAvg: 88.2` over `hrvDays: 27`, which no longer describes the
 * window beneath it: `restingDays` nulls the HRV wherever the resting HR is
 * null, so this series carries ten HRV mornings, not 27. That is knowingly out
 * of scope rather than overlooked — nothing on this card reads either field,
 * and generation 1's `calibratingView` is where a fully emittable calibrating
 * payload lives. Anything that starts reading them must state them here.
 */
export function restingCalibratingView(): RecoveryView {
  const series = [...RESTING_HISTORY, ...RESTING_TAIL].map((v, i) => (i < 20 ? null : v));
  return restingView(restingDays(series), { calibrating: true });
}

/**
 * **no mornings at all** — `days` present and every `restingHr` null. There is
 * no distribution to rank within and no `n` to divide by, so the card renders a
 * one-line muted body rather than a zero-width strip.
 *
 * `restingHrAvg` goes null here through the empty-sample guard rather than
 * through `calibrating`: there is no mean of no readings, and the flag models a
 * different state. As in `restingCalibratingView`, the inherited `hrvAvg` /
 * `hrvDays` describe a month this window does not show — knowingly out of
 * scope, for the same reason: nothing on this card reads them.
 */
export function noMorningsView(): RecoveryView {
  return restingView(restingDays(Array.from({ length: 31 }, () => null)));
}
