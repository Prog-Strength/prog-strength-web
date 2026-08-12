/**
 * Pins the one invariant these fixtures exist to model: a view's LAST day
 * agrees exactly with its scalar `hrv` block — same bounds, same z, same
 * status — and its `baselineAvg` matches the `baseline` block's `hrvAvg`.
 *
 * Server-side this is structural: `ComputeSeries` and `Compute` derive both
 * blocks from the same `band`/`classify` helpers, so they cannot disagree. A
 * fixture where they DO disagree therefore describes a payload the API cannot
 * emit — and the drifting-band tile is being built against these exact views,
 * so such a fixture would render a plausible-looking tile asserting an
 * impossible state rather than failing loudly. The four original views
 * duplicate the numbers by hand in fixtures.ts (once in `days[last]`, once in
 * `hrv`); this test is what keeps the two copies honest. The drift views derive
 * the scalar blocks from their generated last day and so satisfy it by
 * construction — they are in the table anyway, because "by construction" is a
 * property of today's `driftView` and not a law of nature.
 *
 * The file's second remit is `driftingDays` itself. That generator hand-authors
 * per-day bands, which is the thing `makeDays` deliberately refuses to do, so
 * the shape of what it authors — where the band starts, where it breaks, what a
 * missing morning keeps — is pinned here rather than discovered by the tile.
 *
 * `legacyView` is deliberately EXCLUDED from the table: it is the
 * pre-derived-blocks payload and has no `days` and no `hrv`, so the invariant
 * does not apply to it. Please do not "helpfully" add it.
 *
 * The file's third remit is the resting-HR generation's own invariant: each of
 * those views states a `restingHrAvg` that is the true MEAN of its own thirty
 * pre-today readings, over a `restingHrDays` that is the count behind it. The
 * tile positions an average tick against the strip's own values, so a view
 * whose stated baseline is not the mean of the series beneath it would render a
 * plausible card asserting a payload the API cannot emit. `restingView` derives
 * both figures today, which is precisely why they are pinned here too — the
 * `driftView` argument above, applied to a different generation.
 *
 * Those seven views are absent from `VIEWS` as well, for the reason the log
 * views are: `restingDays` leaves every per-day band field null, so their last
 * day has no bounds, no z and no status to agree with the scalar `hrv` block,
 * and the last-day invariant does not apply to them any more than it does to
 * `legacyView`. Please do not "helpfully" add them either.
 */

import { describe, expect, it } from "vitest";
import {
  balancedView,
  bandedDays,
  bandGapView,
  calibratingView,
  creepingUpView,
  DRIFT_GAP_INDEX,
  DRIFT_HRV_SERIES,
  DRIFT_HRV_SERIES_GAPLESS,
  driftingDays,
  fallingView,
  flatMonthView,
  noMorningsView,
  noReadingDriftView,
  noReadingView,
  partialBandView,
  partialMorningView,
  RECOVERY_LOG_TODAY,
  recoveryLogView,
  RESTING_HR_TODAY,
  restingCalibratingView,
  restingDays,
  restingHrView,
  restingNoReadingView,
  restingSparseView,
  risingView,
  sparseView,
  steadyDriftView,
  suppressedDriftView,
  suppressedView,
} from "./fixtures";

/**
 * The generator's rounding, mirrored so the recomputations below compare like
 * with like. The `-0` normalisation is the load-bearing half: `toBe` is
 * `Object.is`, so a day whose z rounds to `-0` would fail against a bare
 * `Math.round` result even though the two are numerically equal. Mirroring keeps
 * the assertion exact instead of softening it to `toBeCloseTo`.
 */
function round(n: number, dp: number): number {
  const f = 10 ** dp;
  const r = Math.round(n * f) / f;
  return r === 0 ? 0 : r;
}

const VIEWS = [
  ["suppressedView", suppressedView],
  ["balancedView", balancedView],
  ["calibratingView", calibratingView],
  ["noReadingView", noReadingView],
  ["risingView", risingView],
  ["fallingView", fallingView],
  ["steadyDriftView", steadyDriftView],
  ["partialBandView", partialBandView],
  ["bandGapView", bandGapView],
  ["noReadingDriftView", noReadingDriftView],
  ["suppressedDriftView", suppressedDriftView],
] as const;

describe.each(VIEWS)("%s — last day agrees with the scalar blocks", (_name, build) => {
  const view = build();
  const last = view.days?.at(-1);

  it("has a last day, an hrv block, and a baseline block", () => {
    expect(last).toBeDefined();
    expect(view.hrv).toBeDefined();
    expect(view.baseline).toBeDefined();
  });

  it("matches the hrv block's band bounds", () => {
    expect(last!.balancedLow).toBe(view.hrv!.balancedLow);
    expect(last!.balancedHigh).toBe(view.hrv!.balancedHigh);
  });

  it("matches the hrv block's z-score and status", () => {
    expect(last!.zScore).toBe(view.hrv!.zScore);
    expect(last!.status).toBe(view.hrv!.status);
  });

  it("matches the baseline block's hrv average", () => {
    expect(last!.baselineAvg).toBe(view.baseline!.hrvAvg);
  });
});

describe("driftingDays", () => {
  it("walks the baseline from fromAvg to toAvg", () => {
    const days = driftingDays({ fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6 });
    expect(days[0].baselineAvg).toBe(84.8);
    expect(days.at(-1)!.baselineAvg).toBe(91.2);
    // Monotone in between, so the polygon slopes rather than wanders.
    const walk = days.map((d) => d.baselineAvg!);
    expect(walk.every((v, i) => i === 0 || v >= walk[i - 1])).toBe(true);
  });

  it("hangs each day's band off that day's own baseline", () => {
    const days = driftingDays({ fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6 });
    for (const d of days) {
      expect(d.balancedLow).toBe(round(d.baselineAvg! - 12.6, 1));
      expect(d.balancedHigh).toBe(round(d.baselineAvg! + 12.6, 1));
    }
  });

  it("classifies each z-score against that day's own band", () => {
    const days = driftingDays({ fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6 });
    for (const d of days) {
      if (d.hrv === null) continue;
      expect(d.zScore).toBe(round((d.hrv - d.baselineAvg!) / 12.6, 2));
      const expected =
        d.zScore! > 1 ? "elevated" : d.zScore! < -1 ? "suppressed" : ("balanced" as const);
      expect(d.status).toBe(expected);
    }
  });

  it("leaves every day before bandFrom unbanded and unknown", () => {
    const days = driftingDays({ fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6, bandFrom: 5 });
    for (const d of days.slice(0, 5)) {
      expect(d.baselineAvg).toBeNull();
      expect(d.balancedLow).toBeNull();
      expect(d.balancedHigh).toBeNull();
      expect(d.zScore).toBeNull();
      expect(d.status).toBe("unknown");
    }
    for (const d of days.slice(5)) expect(d.baselineAvg).not.toBeNull();
    // The unbanded days keep their readings — they are marks, not holes.
    expect(days[0].hrv).toBe(DRIFT_HRV_SERIES[0]);
  });

  it("nulls exactly one interior baseline for bandGapAt", () => {
    const days = driftingDays({ fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6, bandGapAt: 15 });
    const unbanded = days.flatMap((d, i) => (d.baselineAvg === null ? [i] : []));
    expect(unbanded).toEqual([15]);
    expect(days[15].status).toBe("unknown");
    expect(days[15].hrv).toBe(DRIFT_HRV_SERIES[15]);
  });

  it("keeps the band on a missing morning but drops the z and the status", () => {
    const days = driftingDays({ fromAvg: 84.8, toAvg: 91.2, halfWidth: 12.6 });
    const gap = days[DRIFT_GAP_INDEX];
    expect(gap.hrv).toBeNull();
    expect(gap.baselineAvg).not.toBeNull();
    expect(gap.balancedLow).not.toBeNull();
    expect(gap.balancedHigh).not.toBeNull();
    expect(gap.zScore).toBeNull();
    expect(gap.status).toBe("unknown");
  });
});

describe("the drift views", () => {
  it("keeps the interior HRV gap by default", () => {
    expect(DRIFT_HRV_SERIES[DRIFT_GAP_INDEX]).toBeNull();
    expect(risingView().days![DRIFT_GAP_INDEX].hrv).toBeNull();
  });

  it("swaps in a gapless series without moving the band", () => {
    const gapped = risingView().days!;
    const gapless = risingView(DRIFT_HRV_SERIES_GAPLESS).days!;
    expect(gapless.map((d) => d.baselineAvg)).toEqual(gapped.map((d) => d.baselineAvg));
    expect(gapless.filter((d) => d.hrv !== null)).toHaveLength(
      gapped.filter((d) => d.hrv !== null).length + 1,
    );
  });

  it("moves the band in the direction each view claims", () => {
    const delta = (view: ReturnType<typeof risingView>) =>
      view.days!.at(-1)!.baselineAvg! - view.days![0].baselineAvg!;
    expect(delta(risingView())).toBeCloseTo(6.4, 5);
    expect(delta(fallingView())).toBeCloseTo(-8.1, 5);
    expect(delta(steadyDriftView())).toBeCloseTo(6.4, 5);
  });

  it("reports a steady drift whose magnitude the SD alone would not license", () => {
    // 0.35 × 20.1 = 7.035 ms, which 6.4 does not clear — the tile must still
    // print the 6.4.
    const view = steadyDriftView();
    expect(view.baseline!.hrvStdDev).toBe(20.1);
    expect(view.baselineTrend).toEqual({
      direction: "steady",
      deltaMs: 6.4,
      fromAvg: 84.8,
      overDays: 28,
    });
  });

  it("puts the suppressed view's 7-day average in the gauge's lower quarter", () => {
    const view = suppressedDriftView();
    const hrvAvg = view.baseline!.hrvAvg!;
    const half = view.hrv!.balancedHigh! - hrvAvg;
    const pct = (((view.hrv!.shortAvg! - hrvAvg) / half + 2) / 4) * 100;
    expect(pct).toBeLessThan(25);
    expect(pct).toBeCloseTo(21.8, 1);
  });

  it("gives every view a baselineTrend, which the chart guard requires", () => {
    for (const [, build] of VIEWS) expect(build().baselineTrend).toBeDefined();
  });
});

/**
 * The score-bearing fixtures, added for the recovery-log rail. They exist
 * because `makeDays` derives its score as `48 + (i % 30)` and therefore never
 * produces a red morning — the one thing the log's headline fixture is about.
 * Pinned here for the same reason `driftingDays` is: a generator that
 * hand-authors a series is a thing the tile should not have to discover.
 *
 * These three views are deliberately ABSENT from the `VIEWS` table above: their
 * per-day bands are null by construction, so the "last day agrees with the
 * scalar blocks" invariant does not apply to them any more than it does to
 * `legacyView`. Please do not "helpfully" add them.
 */
describe("the score-bearing fixtures", () => {
  it("dates a banded series so its last day is the log fixtures' today", () => {
    const days = bandedDays([61, 52, 44]);
    expect(days.map((d) => d.date)).toEqual(["2026-08-09", "2026-08-10", RECOVERY_LOG_TODAY]);
  });

  it("keeps a null score as a fully absent morning", () => {
    const [day] = bandedDays([null]);
    expect(day.recoveryScore).toBeNull();
    expect(day.restingHr).toBeNull();
    expect(day.hrv).toBeNull();
  });

  it("leaves every per-day band field unset — the log reads none of them", () => {
    for (const day of bandedDays([61, null, 44])) {
      expect(day.baselineAvg).toBeNull();
      expect(day.balancedLow).toBeNull();
      expect(day.balancedHigh).toBeNull();
      expect(day.zScore).toBeNull();
      expect(day.status).toBe("unknown");
    }
  });

  it("tells the DX's story: a red weekend, a rebound Monday, no reading yet today", () => {
    const days = recoveryLogView().days!;
    expect(days).toHaveLength(31);
    expect(days.slice(-4).map((d) => d.recoveryScore)).toEqual([35, 29, 52, null]);
    expect(days.slice(-4).map((d) => d.date)).toEqual([
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(days.slice(-4).map((d) => d.restingHr)).toEqual([57, 59, 47, null]);
    expect(days[0].date).toBe("2026-07-12");
  });

  it("carries the deliberately ugly Whoop floats verbatim — they are the wrap", () => {
    const days = recoveryLogView().days!;
    expect(days.slice(-5).map((d) => d.hrv)).toEqual([
      90.5127,
      83.242966,
      77.39185,
      96.10188,
      null,
    ]);
  });

  it("puts exactly two ghost slots in the log fixture's fortnight", () => {
    // The strap-off day and this morning, which has not landed yet. The rail's
    // own test computes this from the payload; pinned here so a fixture tweak
    // that quietly removes the gap is caught in the file that caused it.
    const window = recoveryLogView().days!.slice(-14);
    expect(window.filter((d) => d.recoveryScore === null)).toHaveLength(2);
    expect(window.filter((d) => d.recoveryScore !== null)).toHaveLength(12);
  });

  it("gives the sparse view three readings in its last eight days", () => {
    const days = sparseView().days!;
    expect(days.slice(-8).filter((d) => d.recoveryScore !== null)).toHaveLength(3);
    // The three most recent calendar days are all empty — the detail register's
    // worst state, and the one the idiom was selected on.
    expect(days.slice(-3).every((d) => d.recoveryScore === null)).toBe(true);
    // A week ago there IS history, so the rail is visibly not an empty tile.
    expect(days.slice(-14, -8).every((d) => d.recoveryScore !== null)).toBe(true);
  });

  it("gives the partial morning a resting HR and an HRV but no score", () => {
    const today = partialMorningView().days!.at(-1)!;
    expect(today.recoveryScore).toBeNull();
    expect(today.restingHr).toBe(54);
    expect(today.hrv).toBe(90.5127);
  });
});

describe("the resting-HR fixtures", () => {
  const views = {
    restingHrView: restingHrView(),
    creepingUpView: creepingUpView(),
    flatMonthView: flatMonthView(),
    restingNoReadingView: restingNoReadingView(),
    restingSparseView: restingSparseView(),
    restingCalibratingView: restingCalibratingView(),
    noMorningsView: noMorningsView(),
  };

  /**
   * The two views that state NO mean, and the two unrelated reasons for it:
   * `restingCalibratingView` models a server that has a sample but will not
   * average it yet, and `noMorningsView` has nothing to average at all. Named
   * here rather than inferred from the payload, so that a view which quietly
   * stopped stating its mean would fail rather than be waved through.
   */
  const NO_MEAN = new Set(["restingCalibratingView", "noMorningsView"]);

  // `restingDays` is exported and has no production consumer, so its three
  // documented promises are pinned here — the same three `bandedDays` pins
  // above, and for the same reason: a generator that hand-authors a series is a
  // thing the tile should not have to discover.
  it("steps restingDays' dates one day back from RESTING_HR_TODAY, oldest first", () => {
    const days = restingDays([52, 51, 50]);
    expect(days.map((d) => d.date)).toEqual(["2026-08-10", "2026-08-11", RESTING_HR_TODAY]);
  });

  it("keeps a null resting HR as a fully absent morning", () => {
    const [day] = restingDays([null]);
    expect(day.restingHr).toBeNull();
    expect(day.recoveryScore).toBeNull();
    expect(day.hrv).toBeNull();
  });

  it("leaves every per-day band field unset — this tile reads none of them", () => {
    for (const day of restingDays([52, null, 50])) {
      expect(day.baselineAvg).toBeNull();
      expect(day.balancedLow).toBeNull();
      expect(day.balancedHigh).toBeNull();
      expect(day.zScore).toBeNull();
      expect(day.status).toBe("unknown");
    }
  });

  it.each(Object.entries(views))(
    "%s carries a full 31-day window ending on RESTING_HR_TODAY",
    (_name, view) => {
      expect(view.days).toHaveLength(31);
      expect(view.days![0].date).toBe("2026-07-13");
      expect(view.days![30].date).toBe(RESTING_HR_TODAY);
    },
  );

  // The property most likely to rot when a series is edited: the tile positions
  // the average tick against the strip's own values, so a fixture whose stated
  // baseline is not the mean of its own history would render a plausible card
  // asserting an impossible payload.
  it.each(Object.entries(views))(
    "%s states restingHrAvg as the true mean of its own thirty pre-today readings",
    (name, view) => {
      // Branching on the view rather than on the value under test, and asserting
      // the null rather than skipping it. A mean taken over an empty sample is
      // `NaN`, `NaN` typechecks as the `number` this field accepts, and
      // `expect(NaN).toBe(NaN)` PASSES — so a bare `continue` here would let
      // `noMorningsView` ship `restingHrAvg: NaN` to the card with a green suite.
      if (NO_MEAN.has(name)) {
        expect(view.baseline!.restingHrAvg).toBeNull();
        return;
      }
      const pre = view
        .days!.slice(0, 30)
        .map((d) => d.restingHr)
        .filter((v): v is number => v !== null);
      const mean = round(pre.reduce((a, b) => a + b, 0) / pre.length, 1);
      expect(view.baseline!.restingHrAvg).toBe(mean);
    },
  );

  it.each(Object.entries(views))(
    "%s counts restingHrDays as the readings behind that mean",
    (_name, view) => {
      const readings = view.days!.slice(0, 30).filter((d) => d.restingHr !== null).length;
      expect(view.baseline!.restingHrDays).toBe(readings);
    },
  );

  it.each(Object.entries(views))(
    "%s agrees restingToday with the last day, so hero and rank cannot disagree",
    (_name, view) => {
      expect(view.restingToday).toBe(view.days![30].restingHr);
    },
  );

  // The DX put 49.6 on the 11th on purpose: a card that prints `49.6 bpm` has
  // failed before it is compared, and a card that RANKS it apart from a 50 has
  // failed just as badly.
  it("the default view carries the DX's float on the 11th", () => {
    const eleventh = restingHrView().days![29];
    expect(eleventh.date).toBe("2026-08-11");
    expect(eleventh.restingHr).toBe(49.6);
  });

  it("the calibrating view has no average and nine mornings behind it", () => {
    const view = restingCalibratingView();
    expect(view.baseline!.restingHrAvg).toBeNull();
    expect(view.baseline!.restingHrDays).toBe(9);
    // Gating on hrvDays instead is the exact bug the recovery_log SOW had to
    // correct, so the two counts are deliberately different here.
    expect(view.baseline!.hrvDays).not.toBe(9);
  });

  it("the sparse view has three readings in its last eight mornings", () => {
    const last8 = restingSparseView()
      .days!.slice(-8)
      .filter((d) => d.restingHr !== null);
    expect(last8).toHaveLength(3);
  });

  it("the no-mornings view has a window but not one reading in it", () => {
    const view = noMorningsView();
    expect(view.days).toHaveLength(31);
    expect(view.days!.every((d) => d.restingHr === null)).toBe(true);
  });
});
