import { describe, expect, test } from "vitest";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { bandRuns, gaugeTickPct, prepareHrvChart, scaler } from "./hrv-chart";

/**
 * Fixtures are hand-authored here rather than imported from `./fixtures`: every
 * number in this file is load-bearing for an exact assertion, so the assertion
 * and the figure it turns on should be readable side by side.
 */
function day(over: Partial<RecoveryDayPoint> = {}): RecoveryDayPoint {
  return {
    date: "2026-08-01",
    restingHr: 52,
    recoveryScore: 71,
    hrv: 88,
    baselineAvg: 88,
    balancedLow: 76,
    balancedHigh: 100,
    zScore: 0,
    status: "balanced",
    ...over,
  };
}

/** A day with no band of its own — the pre-calibration case. With no band there
 *  is nothing to classify against, so the status is `unknown`, as the engine
 *  emits it. */
function unbanded(over: Partial<RecoveryDayPoint> = {}): RecoveryDayPoint {
  return day({
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
    ...over,
  });
}

function view(over: Partial<RecoveryView> = {}): RecoveryView {
  return {
    restingToday: 52,
    recoveryScore: 71,
    hrvToday: 94,
    spark: [52, 51, 53],
    days: [
      day({ date: "2026-07-30", hrv: 85 }),
      day({ date: "2026-07-31", hrv: 91 }),
      day({ date: "2026-08-01", hrv: 94 }),
    ],
    baseline: {
      windowDays: 30,
      restingHrAvg: 52,
      restingHrDays: 30,
      hrvAvg: 88,
      hrvStdDev: 12.6,
      hrvDays: 30,
      recoveryScoreAvg: 70,
      recoveryScoreDays: 30,
    },
    hrv: {
      status: "balanced",
      balancedLow: 76,
      balancedHigh: 100,
      zScore: 0.48,
      trend: "rising",
      shortAvg: 90.5,
    },
    baselineTrend: { direction: "rising", deltaMs: 6.4, fromAvg: 84.8, overDays: 28 },
    ...over,
  };
}

describe("gaugeTickPct — the bounds-derived scale", () => {
  // THE REGRESSION TEST FOR THE CORRECTION. The band's half-width is 20 ms while
  // the raw SD is 5 ms, because the server emits hrv_avg ± balanced_z ×
  // max(sd, min_std_dev_ms) and the client never receives balanced_z or the
  // floor. The mockup's (shortAvg − hrvAvg) / hrvStdDev formula fails this:
  // it reads −4 and +4 half-widths instead of −1 and +1, so the clamp pins it
  // to 0 and 100 where the printed bound labels sit at 25 and 75.
  test("the printed bounds land exactly on 25% and 75%, whatever the SD is", () => {
    const hrvAvg = 88;
    const balancedHigh = 108; // half-width 20, not the notional hrvStdDev of 5
    const balancedLow = 68;

    expect(gaugeTickPct(balancedLow, hrvAvg, balancedHigh)).toBe(25);
    expect(gaugeTickPct(balancedHigh, hrvAvg, balancedHigh)).toBe(75);

    // Spelled out: scaling by the raw SD would put the same two averages here.
    const bySd = (v: number) => Math.min(100, Math.max(0, (((v - hrvAvg) / 5 + 2) / 4) * 100));
    expect(bySd(balancedLow)).toBe(0);
    expect(bySd(balancedHigh)).toBe(100);
  });

  test("the baseline mean itself sits dead centre", () => {
    expect(gaugeTickPct(88, 88, 108)).toBe(50);
  });

  test("clamps to 0 below −2 half-widths and to 100 above +2", () => {
    // ±2 half-widths from 88 with a half-width of 20 is 48 and 128.
    expect(gaugeTickPct(48, 88, 108)).toBe(0);
    expect(gaugeTickPct(128, 88, 108)).toBe(100);
    expect(gaugeTickPct(10, 88, 108)).toBe(0);
    expect(gaugeTickPct(400, 88, 108)).toBe(100);
  });

  test("null when there is no 7-day mean", () => {
    expect(gaugeTickPct(null, 88, 108)).toBeNull();
  });

  test("null for a degenerate or inverted band rather than dividing by zero", () => {
    expect(gaugeTickPct(90, 88, 88)).toBeNull();
    expect(gaugeTickPct(90, 88, 80)).toBeNull();
  });
});

describe("bandRuns", () => {
  test("a fully banded series is one run carrying every index", () => {
    const days = [day(), day(), day()];
    const runs = bandRuns(days);
    expect(runs).toHaveLength(1);
    expect(runs[0].map((p) => p.i)).toEqual([0, 1, 2]);
    expect(runs[0][2].d).toBe(days[2]);
  });

  test("an interior null baseline splits the run and preserves original indices", () => {
    const days = [day(), day(), unbanded(), day(), day()];
    const runs = bandRuns(days);
    expect(runs).toHaveLength(2);
    expect(runs[0].map((p) => p.i)).toEqual([0, 1]);
    expect(runs[1].map((p) => p.i)).toEqual([3, 4]);
    // The index is the position in the ORIGINAL series, not in the run — that is
    // what keeps a polygon registered with the marks.
    expect(runs[1][0].d).toBe(days[3]);
  });

  test("a half-null band breaks the run just as a wholly null one does", () => {
    const lowOnly = day({ balancedHigh: null });
    const highOnly = day({ balancedLow: null });
    expect(bandRuns([day(), lowOnly, day()]).map((r) => r.map((p) => p.i))).toEqual([[0], [2]]);
    expect(bandRuns([day(), highOnly, day()]).map((r) => r.map((p) => p.i))).toEqual([[0], [2]]);
  });

  test("a band that starts part-way across is still one run, offset", () => {
    const runs = bandRuns([unbanded(), unbanded(), day(), day()]);
    expect(runs).toHaveLength(1);
    expect(runs[0].map((p) => p.i)).toEqual([2, 3]);
  });

  test("a wholly unbanded series yields no runs", () => {
    expect(bandRuns([unbanded(), unbanded()])).toEqual([]);
  });

  test("an empty series yields no runs", () => {
    expect(bandRuns([])).toEqual([]);
  });
});

describe("prepareHrvChart — the single guard", () => {
  test("null when days are missing", () => {
    expect(prepareHrvChart(view({ days: undefined }))).toBeNull();
  });

  test("null when the baseline block is missing", () => {
    expect(prepareHrvChart(view({ baseline: undefined }))).toBeNull();
  });

  test("null when the hrv block is missing", () => {
    expect(prepareHrvChart(view({ hrv: undefined }))).toBeNull();
  });

  test("null when the baseline-trend block is missing", () => {
    expect(prepareHrvChart(view({ baselineTrend: undefined }))).toBeNull();
  });

  test("null for an empty day series", () => {
    expect(prepareHrvChart(view({ days: [] }))).toBeNull();
  });

  test("null when the baseline mean is not yet calibrated", () => {
    const v = view();
    expect(prepareHrvChart(view({ baseline: { ...v.baseline!, hrvAvg: null } }))).toBeNull();
  });

  test("null when either scalar band bound is null", () => {
    const v = view();
    expect(prepareHrvChart(view({ hrv: { ...v.hrv!, balancedLow: null } }))).toBeNull();
    expect(prepareHrvChart(view({ hrv: { ...v.hrv!, balancedHigh: null } }))).toBeNull();
  });

  test("a missing SD does NOT gate the tile — the gauge never reads it", () => {
    const v = view();
    const prepared = prepareHrvChart(view({ baseline: { ...v.baseline!, hrvStdDev: null } }));
    expect(prepared).not.toBeNull();
  });

  test("carries the narrowed figures and the last day as today", () => {
    const prepared = prepareHrvChart(view());
    expect(prepared).not.toBeNull();
    expect(prepared!.hrvAvg).toBe(88);
    expect(prepared!.balancedLow).toBe(76);
    expect(prepared!.balancedHigh).toBe(100);
    expect(prepared!.shortAvg).toBe(90.5);
    expect(prepared!.drift.direction).toBe("rising");
    expect(prepared!.days).toHaveLength(3);
    expect(prepared!.today.date).toBe("2026-08-01");
    expect(prepared!.today.hrv).toBe(94);
  });

  test("today is the last day even when the morning webhook has not landed", () => {
    const days = [day({ date: "2026-07-31", hrv: 91 }), day({ date: "2026-08-01", hrv: null })];
    const prepared = prepareHrvChart(view({ days }));
    expect(prepared!.today.date).toBe("2026-08-01");
    expect(prepared!.today.hrv).toBeNull();
  });

  test("the domain spans marks outside the band at BOTH ends, with 5 ms headroom", () => {
    const days = [
      day({ date: "2026-07-30", hrv: 60, balancedLow: 72, balancedHigh: 104 }),
      day({ date: "2026-07-31", hrv: 130, balancedLow: 71, balancedHigh: 105 }),
      unbanded({ date: "2026-08-01", hrv: 90 }),
    ];
    const prepared = prepareHrvChart(view({ days }));
    expect(prepared!.domain).toEqual([55, 135]);
  });

  test("the domain follows the per-day band bounds when no mark is extreme", () => {
    const days = [
      day({ date: "2026-07-31", hrv: 88, balancedLow: 65, balancedHigh: 111 }),
      day({ date: "2026-08-01", hrv: 90, balancedLow: 70, balancedHigh: 106 }),
    ];
    const prepared = prepareHrvChart(view({ days }));
    expect(prepared!.domain).toEqual([60, 116]);
  });

  test("the domain includes the scalar bounds even when no day carries a band", () => {
    const days = [
      unbanded({ date: "2026-07-31", hrv: 88 }),
      unbanded({ date: "2026-08-01", hrv: 90 }),
    ];
    // Scalar band 76 / 100 from the fixture's hrv block.
    const prepared = prepareHrvChart(view({ days }));
    expect(prepared!.domain).toEqual([71, 105]);
  });
});

describe("scaler", () => {
  test("maps the domain low to the bottom of the box and the high to the top", () => {
    const y = scaler([50, 150], 4, 60);
    expect(y(50)).toBe(64); // bottom = top + height
    expect(y(150)).toBe(4); // top — it is a top-down box, so high ms is small y
    expect(y(100)).toBe(34);
  });

  test("a zero-span domain does not divide by zero", () => {
    const y = scaler([90, 90], 0, 60);
    expect(Number.isFinite(y(90))).toBe(true);
    expect(y(90)).toBe(60);
  });
});
