import { describe, expect, test } from "vitest";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import {
  bandRuns,
  classifyNights,
  gaugePct,
  MIN_ROLLING_NIGHTS,
  prepareHrvChart,
  rollingAverages,
  rollingRuns,
  ROLLING_WINDOW_NIGHTS,
  scaler,
  weekBand,
  WEEK_BAND_DIVISOR,
  weekStatus,
} from "./hrv-chart";

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

/**
 * A dated run of days from a reading series, banded like `day()` unless told
 * otherwise. Long enough series matter here: the rolling mean needs seven
 * mornings behind it before it emits anything at all.
 */
function run(hrv: (number | null)[], over: Partial<RecoveryDayPoint> = {}): RecoveryDayPoint[] {
  return hrv.map((v, i) =>
    day({ date: `2026-07-${String(i + 1).padStart(2, "0")}`, hrv: v, ...over }),
  );
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

describe("weekBand — the nightly band narrowed for a mean", () => {
  test("keeps the centre and divides the half-width by √7", () => {
    const [low, high] = weekBand(76, 100);
    expect((low + high) / 2).toBeCloseTo(88, 10);
    expect(high - low).toBeCloseTo(24 / WEEK_BAND_DIVISOR, 10);
    // The band a mean is judged against is well inside the one a night is.
    expect(low).toBeGreaterThan(76);
    expect(high).toBeLessThan(100);
  });

  test("reads the centre off the BOUNDS, not off a baseline it was not given", () => {
    // An asymmetric band narrows about its own midpoint rather than about a
    // figure this function has no access to, so a day with a null `baselineAvg`
    // and live bounds still narrows correctly.
    const [low, high] = weekBand(80, 120);
    expect((low + high) / 2).toBeCloseTo(100, 10);
  });

  test("a degenerate band stays degenerate rather than inverting", () => {
    expect(weekBand(90, 90)).toEqual([90, 90]);
  });
});

describe("gaugePct — the bounds-derived scale", () => {
  // THE REGRESSION TEST FOR THE CORRECTION. The band's half-width is 20 ms while
  // the raw SD is 5 ms, because the server emits hrv_avg ± balanced_z ×
  // max(sd, min_std_dev_ms) and the client never receives balanced_z or the
  // floor. The mockup's (shortAvg − hrvAvg) / hrvStdDev formula fails this:
  // it reads −4 and +4 half-widths instead of −1 and +1, so the clamp pins it
  // to 0 and 100 where the NIGHTLY bounds sit at 25 and 75.
  test("the nightly bounds land exactly on 25% and 75%, whatever the SD is", () => {
    const hrvAvg = 88;
    const balancedHigh = 108; // half-width 20, not the notional hrvStdDev of 5
    const balancedLow = 68;

    expect(gaugePct(balancedLow, hrvAvg, balancedHigh)).toBe(25);
    expect(gaugePct(balancedHigh, hrvAvg, balancedHigh)).toBe(75);

    // Spelled out: scaling by the raw SD would put the same two averages here.
    const bySd = (v: number) => Math.min(100, Math.max(0, (((v - hrvAvg) / 5 + 2) / 4) * 100));
    expect(bySd(balancedLow)).toBe(0);
    expect(bySd(balancedHigh)).toBe(100);
  });

  test("the baseline mean itself sits dead centre", () => {
    expect(gaugePct(88, 88, 108)).toBe(50);
  });

  test("clamps to 0 below −2 half-widths and to 100 above +2", () => {
    // ±2 half-widths from 88 with a half-width of 20 is 48 and 128.
    expect(gaugePct(48, 88, 108)).toBe(0);
    expect(gaugePct(128, 88, 108)).toBe(100);
    expect(gaugePct(10, 88, 108)).toBe(0);
    expect(gaugePct(400, 88, 108)).toBe(100);
  });

  test("null when there is no value to place", () => {
    expect(gaugePct(null, 88, 108)).toBeNull();
  });

  test("the WEEK bounds land inside the nightly ones, which is the whole point", () => {
    // The gauge's coloured zones start and end here rather than at 25 / 75: the
    // scale stays nightly so a bad week keeps its magnitude, and only the
    // thresholds move inward to where a MEAN's band actually falls.
    const [weekLow, weekHigh] = weekBand(68, 108);
    expect(gaugePct(weekLow, 88, 108)!).toBeGreaterThan(25);
    expect(gaugePct(weekHigh, 88, 108)!).toBeLessThan(75);
    // Still centred, so the green zone is symmetric about the baseline mean.
    expect(gaugePct(weekLow, 88, 108)! + gaugePct(weekHigh, 88, 108)!).toBeCloseTo(100, 10);
  });

  test("null for a degenerate or inverted band rather than dividing by zero", () => {
    expect(gaugePct(90, 88, 88)).toBeNull();
    expect(gaugePct(90, 88, 80)).toBeNull();
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

  test("a wild NIGHT does not stretch the domain — only the means are drawn", () => {
    // Six ordinary 60 ms nights, then two of 130. Nothing plots 130: the two
    // rolling means it lands in are 60 and 70, and a domain stretched to 135 for
    // a reading no longer on the chart would squash the curve into a fifth of
    // the box. The scalar bounds (76 / 100) hold the top; the 60 ms mean the
    // bottom.
    const days = run([60, 60, 60, 60, 60, 60, 60, 130, 130]);
    const prepared = prepareHrvChart(view({ days, hrv: { ...view().hrv!, shortAvg: 90 } }));
    expect(prepared!.rolling.map((p) => p?.avg)).toEqual([60, 70, 90]);
    // Low end is the 60 ms mean less 5 ms headroom; the top is the week band's
    // upper bound, not the 130 ms night and not the 100 ms nightly bound.
    expect(prepared!.domain[0]).toBe(55);
    expect(prepared!.domain[1]).toBeCloseTo(prepared!.weekHigh + 5, 10);
    expect(prepared!.domain[1]).toBeLessThan(100);
  });

  test("the domain follows the DRAWN days' bands, not the lead-in's", () => {
    // The first six days are lead-in — never drawn — so the freakishly wide band
    // they carry must not open the axis under a curve drawn beside a narrow one.
    const days = run(Array(9).fill(90)).map((d, i) =>
      i < 6 ? { ...d, balancedLow: 40, balancedHigh: 140 } : d,
    );
    const prepared = prepareHrvChart(view({ days, hrv: { ...view().hrv!, shortAvg: 90 } }));
    expect(prepared!.domain[0]).toBeCloseTo(prepared!.weekLow - 5, 10);
    expect(prepared!.domain[1]).toBeCloseTo(prepared!.weekHigh + 5, 10);
  });

  test("the series is the tail the rolling window reaches, and its dates align", () => {
    const days = run([80, 82, 84, 86, 88, 90, 92, 94, 96, 98]);
    const prepared = prepareHrvChart(view({ days, hrv: { ...view().hrv!, shortAvg: 95 } }));

    // Ten days in, six of lead-in, four drawn — and `days` is untouched, because
    // the trend rail still paints every night of it.
    expect(prepared!.days).toHaveLength(10);
    expect(prepared!.series).toHaveLength(days.length - (ROLLING_WINDOW_NIGHTS - 1));
    expect(prepared!.rolling).toHaveLength(prepared!.series.length);
    expect(prepared!.series[0].date).toBe(days[6].date);
    expect(prepared!.series.at(-1)!.date).toBe(days.at(-1)!.date);
  });

  test("the curve ENDS on short_avg itself — never on a client re-average", () => {
    // The last seven readings average 95, but the server says the 7-day mean is
    // 88.4. The server wins, and the mark takes the WEEK's status with it, so
    // the dot the eye lands on, the 28px headline and the gauge tick are one
    // figure rather than three that ought to agree.
    const days = run([80, 82, 84, 86, 88, 90, 92, 94, 96, 98]);
    const prepared = prepareHrvChart(view({ days, hrv: { ...view().hrv!, shortAvg: 88.4 } }));

    expect(prepared!.rolling.at(-1)).toEqual({ avg: 88.4, status: "balanced" });
    expect(prepared!.rolling.at(-1)!.status).toBe(prepared!.week);
    expect(prepared!.shortAvg).toBe(88.4);
  });

  test("no 7-day mean means no final mark, rather than one the server disowns", () => {
    const days = run([80, 82, 84, 86, 88, 90, 92, 94, 96, 98]);
    const prepared = prepareHrvChart(view({ days, hrv: { ...view().hrv!, shortAvg: null } }));
    expect(prepared!.rolling.at(-1)).toBeNull();
    // The earlier points are unaffected — only the endpoint is the server's.
    expect(prepared!.rolling.filter((p) => p !== null)).toHaveLength(3);
  });

  test("a window too short for any mean draws nothing rather than throwing", () => {
    // The three-day view every guard test uses. Its last day still carries the
    // server's mean, so the series is exactly that one day.
    const prepared = prepareHrvChart(view());
    expect(prepared).not.toBeNull();
    expect(prepared!.series).toHaveLength(1);
    expect(prepared!.rolling.at(-1)!.avg).toBe(90.5);
  });

  test("the domain includes today's week band even when no day carries one", () => {
    const days = [
      unbanded({ date: "2026-07-31", hrv: 88 }),
      unbanded({ date: "2026-08-01", hrv: 90 }),
    ];
    // Scalar band 76 / 100 from the fixture's hrv block, narrowed.
    const prepared = prepareHrvChart(view({ days }));
    expect([prepared!.weekLow, prepared!.weekHigh]).toEqual(weekBand(76, 100));
    expect(prepared!.domain[0]).toBeCloseTo(prepared!.weekLow - 5, 10);
    expect(prepared!.domain[1]).toBeCloseTo(prepared!.weekHigh + 5, 10);
  });

  test("every week-scale register is judged against the SAME narrowed band", () => {
    // The pin for the tightening: `week`, the marks' statuses and the bounds the
    // gauge prints all come from `weekLow`/`weekHigh`. A `shortAvg` between the
    // week band and the nightly one must read suppressed — under the old nightly
    // threshold it read balanced, and the ribbon it sits outside of would have
    // been drawing the opposite story.
    const days = run(Array(9).fill(80));
    const prepared = prepareHrvChart(view({ days, hrv: { ...view().hrv!, shortAvg: 80 } }));

    expect(prepared!.weekLow).toBeGreaterThan(80); // inside the nightly low of 76
    expect(prepared!.week).toBe("suppressed");
    expect(prepared!.rolling.at(-1)!.status).toBe("suppressed");
    expect(prepared!.rolling.every((p) => p!.status === "suppressed")).toBe(true);
    // The nightly band is still carried — the gauge's SCALE is built from it.
    expect([prepared!.balancedLow, prepared!.balancedHigh]).toEqual([76, 100]);
  });
});

describe("rollingAverages — the series the balance chart plots", () => {
  test("the mean is the trailing seven nights INCLUDING this one", () => {
    const avgs = rollingAverages(run([10, 20, 30, 40, 50, 60, 70, 80]));
    // days[0..6] → 40, days[1..7] → 50. Arithmetic stated in whole numbers so
    // the window's edges are readable off the expectation.
    expect(avgs.map((p) => (p === null ? null : p.avg))).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      40,
      50,
    ]);
  });

  test("the first six mornings have no mean, however many readings they hold", () => {
    const avgs = rollingAverages(run(Array(ROLLING_WINDOW_NIGHTS).fill(90)));
    // Their windows reach back into history the client was never sent, and a
    // four-day mean drawn beside a seven-day one is a different statistic.
    expect(avgs.slice(0, ROLLING_WINDOW_NIGHTS - 1).every((p) => p === null)).toBe(true);
    expect(avgs.at(-1)!.avg).toBe(90);
  });

  test("a missing morning is one fewer sample, not a break in the curve", () => {
    // THE REASON THE TILE PLOTS THIS AT ALL. The raw chart lost its final mark
    // every morning until the webhook landed; the mean simply averages six.
    const avgs = rollingAverages(run([84, 84, 84, 84, 84, 84, null]));
    expect(avgs.at(-1)!.avg).toBe(84);
  });

  test("a window under the sample floor is a hole, not a mean of one night", () => {
    const sparse = run([90, 90, 90, null, null, null, null]);
    expect(rollingAverages(sparse).at(-1)).toBeNull();
    // One more reading clears the floor and the mark returns.
    expect(MIN_ROLLING_NIGHTS).toBe(4);
    expect(rollingAverages(run([90, 90, 90, 90, null, null, null])).at(-1)!.avg).toBe(90);
  });

  test("each mean is judged against ITS OWN day's band", () => {
    const days = run(Array(7).fill(60)).map((d, i) =>
      // A band that has sunk far enough by the last morning to contain a week
      // the earlier bands would have called suppressed.
      i === 6 ? { ...d, balancedLow: 50, balancedHigh: 70 } : d,
    );
    expect(rollingAverages(days).at(-1)).toEqual({ avg: 60, status: "balanced" });
  });

  test("never inherits the raw night's verdict, which is a different question", () => {
    // Every night is `suppressed` against its own band as a READING, yet the
    // week's mean sits inside the band. Painting the mean with the night's
    // verdict is how a smoothed chart contradicts its own smoothing.
    const days = run([70, 106, 70, 106, 70, 106, 70], { status: "suppressed" });
    expect(rollingAverages(days).at(-1)!.status).toBe("balanced");
  });

  test("a day with no band of its own yields a mean with no verdict", () => {
    const avgs = rollingAverages(
      run(Array(7).fill(90)).map((d) => ({ ...d, balancedLow: null, balancedHigh: null })),
    );
    expect(avgs.at(-1)).toEqual({ avg: 90, status: "unknown" });
  });

  test("a series shorter than the window yields nothing at all", () => {
    expect(rollingAverages(run([90, 90, 90]))).toEqual([null, null, null]);
    expect(rollingAverages([])).toEqual([]);
  });
});

describe("rollingRuns", () => {
  const p = (avg: number) => ({ avg, status: "balanced" as const });

  test("an unbroken series is one run carrying every index", () => {
    expect(rollingRuns([p(80), p(81), p(82)]).map((r) => r.map((x) => x.i))).toEqual([[0, 1, 2]]);
  });

  test("a hole splits the run and preserves the ORIGINAL indices", () => {
    // The index is what keeps the polyline registered with the band beneath it.
    const runs = rollingRuns([p(80), p(81), null, p(83), p(84)]);
    expect(runs.map((r) => r.map((x) => x.i))).toEqual([
      [0, 1],
      [3, 4],
    ]);
  });

  test("leading and trailing holes offset a run rather than emptying it", () => {
    expect(rollingRuns([null, null, p(80)]).map((r) => r.map((x) => x.i))).toEqual([[2]]);
    expect(rollingRuns([p(80), null, null]).map((r) => r.map((x) => x.i))).toEqual([[0]]);
  });

  test("a wholly empty series yields no runs", () => {
    expect(rollingRuns([null, null])).toEqual([]);
    expect(rollingRuns([])).toEqual([]);
  });
});

describe("weekStatus — where the 7-day mean sits in today's band", () => {
  test("inside the bounds is balanced; outside picks the side it left", () => {
    expect(weekStatus(88, 76, 100)).toBe("balanced");
    expect(weekStatus(75.9, 76, 100)).toBe("suppressed");
    expect(weekStatus(100.1, 76, 100)).toBe("elevated");
  });

  test("the bounds themselves are inside the band, as the gauge draws them", () => {
    expect(weekStatus(76, 76, 100)).toBe("balanced");
    expect(weekStatus(100, 76, 100)).toBe("balanced");
  });

  test("no 7-day mean is no verdict — never a default of balanced", () => {
    expect(weekStatus(null, 76, 100)).toBe("unknown");
  });

  test("agrees with the gauge's zone boundary, wherever that boundary now sits", () => {
    // The green zone starts where `weekLow` maps to, so a week that reads
    // suppressed must put the tick left of that boundary and a balanced one must
    // not. The two are computed independently; this is what pins them together —
    // and it is why the boundary is derived rather than left at 25%.
    const [avg, nightHigh] = [88, 100];
    const [weekLow, weekHigh] = weekBand(76, 100);
    const boundary = gaugePct(weekLow, avg, nightHigh)!;

    expect(gaugePct(weekLow - 0.1, avg, nightHigh)!).toBeLessThan(boundary);
    expect(weekStatus(weekLow - 0.1, weekLow, weekHigh)).toBe("suppressed");
    expect(gaugePct(weekLow + 0.1, avg, nightHigh)!).toBeGreaterThan(boundary);
    expect(weekStatus(weekLow + 0.1, weekLow, weekHigh)).toBe("balanced");
  });
});

describe("classifyNights — the one classification both views paint from", () => {
  test("passes the server's own per-day status through, untouched", () => {
    const nights = classifyNights([
      day({ status: "balanced" }),
      day({ status: "elevated" }),
      unbanded(),
    ]);
    expect(nights.map((n) => n.status)).toEqual(["balanced", "elevated", "unknown"]);
    expect(nights.every((n) => n.hasReading)).toBe(true);
  });

  test("never re-tests a reading against another day's band", () => {
    // A night the payload calls balanced against ITS OWN band sits outside a
    // later day's band. Re-comparing would report it suppressed; the whole
    // agreement contract is that this does not happen.
    const nights = classifyNights([day({ hrv: 78, balancedLow: 70, balancedHigh: 94 })]);
    expect(nights[0].status).toBe("balanced");
  });

  test("a missing morning is an absence, not a status", () => {
    const nights = classifyNights([day({ hrv: null, status: "unknown" })]);
    expect(nights[0].hasReading).toBe(false);
    expect(nights[0].sustained).toBe(false);
  });

  test("three consecutive suppressed nights all read as a sustained dip", () => {
    const dip = day({ status: "suppressed", hrv: 60 });
    const nights = classifyNights([day(), dip, dip, dip, day()]);
    expect(nights.map((n) => n.sustained)).toEqual([false, true, true, true, false]);
  });

  test("two is not a run, and a gap does not extend one", () => {
    const dip = day({ status: "suppressed", hrv: 60 });
    const absent = day({ hrv: null, status: "unknown" });
    const nights = classifyNights([dip, dip, absent, dip, dip]);
    expect(nights.some((n) => n.sustained)).toBe(false);
  });

  test("a run at the very end of the window still counts", () => {
    const dip = day({ status: "suppressed", hrv: 60 });
    const nights = classifyNights([day(), dip, dip, dip]);
    expect(nights[3].sustained).toBe(true);
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
