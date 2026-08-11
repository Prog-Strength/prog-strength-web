/**
 * DX fixtures for the `recovery-log-tile` exploration — THROWAWAY.
 *
 * Six static `RecoveryView`s, one per state the ticket asks the comparison to
 * be drivable across. Every one is a full 31-entry, date-aligned window
 * (oldest→newest, nulls preserved) so the wider-window variants have real
 * history behind them and the narrow ones can just slice the tail.
 *
 * `day()` derives each night's band bounds and z-score from its own
 * `baselineAvg` and the population sd (20.1 ms), which is how the ticket's own
 * printed rows were built — 61.0 ms against an 87.4 baseline is `suppressed`
 * because 61.0 < 67.3, and so on. Deriving rather than hand-typing means a
 * fixture can never claim a status its numbers disagree with. This is FIXTURE
 * AUTHORING, not display logic: no variant recomputes anything, they all read
 * `status` / `baselineAvg` as given.
 *
 * Not imported by production code. Deleted with the branch.
 */

import type { RecoveryBaselineView, RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";

/** The fixture "today" — the last date in every window below. */
export const FIXTURE_TODAY = "2026-08-11";

/** Population sd behind every band bound here; matches the ticket's ±20.1. */
const SD = 20.1;

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * One night. `baseAvg === null` is the uncalibrated case — no band, no z, and
 * `status: "unknown"` — which is what a day carries before it has 30 nights
 * behind it. A night with no reading keeps its band (the band existed; the
 * strap was on the charger) but has no verdict.
 */
function day(
  date: string,
  restingHr: number | null,
  recoveryScore: number | null,
  hrv: number | null,
  baseAvg: number | null,
): RecoveryDayPoint {
  if (baseAvg === null) {
    return {
      date,
      restingHr,
      recoveryScore,
      hrv,
      baselineAvg: null,
      balancedLow: null,
      balancedHigh: null,
      zScore: null,
      status: "unknown",
    };
  }
  const low = round1(baseAvg - SD);
  const high = round1(baseAvg + SD);
  if (hrv === null) {
    return {
      date,
      restingHr,
      recoveryScore,
      hrv,
      baselineAvg: baseAvg,
      balancedLow: low,
      balancedHigh: high,
      zScore: null,
      status: "unknown",
    };
  }
  return {
    date,
    restingHr,
    recoveryScore,
    hrv,
    baselineAvg: baseAvg,
    balancedLow: low,
    balancedHigh: high,
    zScore: round2((hrv - baseAvg) / SD),
    status: hrv < low ? "suppressed" : hrv > high ? "elevated" : "balanced",
  };
}

/** The 31 window dates, 2026-07-12 → 2026-08-11, oldest→newest. */
const DATES: string[] = [
  ...Array.from({ length: 20 }, (_, i) => `2026-07-${String(i + 12).padStart(2, "0")}`),
  ...Array.from({ length: 11 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`),
];

/** `[restingHr, recoveryScore, hrv, baselineAvg]` for one night. */
type Row = [number | null, number | null, number | null, number | null];

const build = (rows: Row[]): RecoveryDayPoint[] =>
  DATES.map((date, i) => day(date, rows[i][0], rows[i][1], rows[i][2], rows[i][3]));

/**
 * The 23 nights of lead-in every fixture shares (2026-07-12 → 2026-08-03) —
 * an ordinary three weeks, baseline walking 85.0 → 87.3. The fixtures differ
 * only in the eight nights on screen.
 */
const LEAD_IN: Row[] = [
  [54, 62, 92.3, 85.0],
  [53, 71, 101.24418, 85.1],
  [52, 74, 96.7, 85.2],
  [55, 58, 88.10233, 85.3],
  [57, 44, 63.2, 85.4],
  [56, 49, 71.8, 85.5],
  [53, 68, 94.61, 85.6],
  [52, 73, 108.9, 85.8],
  [51, 77, 110.34712, 85.9],
  [54, 60, 89.4, 86.0],
  [55, 55, 82.06, 86.2],
  [null, null, null, 86.3],
  [53, 66, 93.71904, 86.4],
  [52, 70, 99.2, 86.5],
  [54, 63, 86.5, 86.6],
  [56, 47, 68.9, 86.7],
  [55, 53, 79.44, 86.8],
  [53, 69, 97.3, 86.9],
  [51, 76, 109.82, 87.0],
  [52, 72, 95.6, 87.1],
  [54, 64, 88.03761, 87.2],
  [56, 50, 74.2, 87.2],
  [58, 43, 70.11, 87.3],
];

/** The ticket's headline eight: a bad weekend, a strong Monday, nothing today. */
const DEFAULT_TAIL: Row[] = [
  [61, 41, 61.0, 87.4],
  [51, 78, 112.44031, 87.6],
  [null, null, null, 87.8], // strap off
  [54, 66, 90.5127, 87.9],
  [57, 35, 83.242966, 87.9],
  [59, 29, 77.39185, 88.0],
  [47, 52, 96.10188, 88.2],
  [null, null, null, 88.2], // today, 7am
];

const baseline = (over: Partial<RecoveryBaselineView> = {}): RecoveryBaselineView => ({
  windowDays: 30,
  restingHrAvg: 53.4,
  restingHrDays: 28,
  hrvAvg: 88.2,
  hrvStdDev: SD,
  hrvDays: 27,
  recoveryScoreAvg: 57.6,
  recoveryScoreDays: 28,
  ...over,
});

/** Everything on a `RecoveryView` that is not the day series or the baseline. */
const REST = {
  restingToday: null,
  recoveryScore: null,
  hrvToday: null,
  spark: [61, 51, 54, 57, 59, 47],
  hrv: {
    status: "unknown" as const,
    balancedLow: 68.1,
    balancedHigh: 108.3,
    zScore: null,
    trend: "steady" as const,
    shortAvg: 86.7,
  },
  baselineTrend: {
    direction: "steady" as const,
    deltaMs: 1.2,
    fromAvg: 87.0,
    overDays: 28,
  },
};

/**
 * THE DEFAULT — the 7am screenshot that prompted the DX. Sunday's 29 is the
 * story: a red morning on a resting HR six beats over baseline, with Saturday's
 * 35 saying it was two days rather than one, then Monday's 52 on 47 bpm as the
 * rebound. Nothing dramatic; this is most mornings.
 */
const defaultView: RecoveryView = {
  ...REST,
  days: build([...LEAD_IN, ...DEFAULT_TAIL]),
  baseline: baseline(),
};

/**
 * FULL WEEK — today has landed and no night in the window is missing. The clean
 * case; every variant should be good here, so it is not where they separate.
 */
const fullWeekView: RecoveryView = {
  ...REST,
  restingToday: 49,
  recoveryScore: 71,
  hrvToday: 94.0,
  days: build([
    ...LEAD_IN.map((r, i) => (i === 11 ? ([55, 57, 84.9, 86.3] as Row) : r)),
    [61, 41, 61.0, 87.4],
    [51, 78, 112.44031, 87.6],
    [56, 51, 80.6, 87.8],
    [54, 66, 90.5127, 87.9],
    [57, 35, 83.242966, 87.9],
    [59, 29, 77.39185, 88.0],
    [47, 52, 96.10188, 88.2],
    [49, 71, 94.0, 88.2],
  ]),
  baseline: baseline({ hrvDays: 30, restingHrDays: 30, recoveryScoreDays: 30 }),
};

/**
 * RED MORNING — today at 22 on 63 bpm, following two yellows. The `--danger`
 * stress test: it has to read as true and worth noticing, and never as an alarm
 * on a dashboard that also shows Steps and Weather.
 */
const redMorningView: RecoveryView = {
  ...REST,
  restingToday: 63,
  recoveryScore: 22,
  hrvToday: 58.0,
  days: build([
    ...LEAD_IN,
    [61, 41, 61.0, 87.4],
    [51, 78, 112.44031, 87.6],
    [55, 58, 89.4, 87.8],
    [54, 66, 90.5127, 87.9],
    [57, 61, 86.3, 87.9],
    [58, 44, 79.55192, 88.0],
    [60, 38, 72.61, 88.2],
    [63, 22, 58.0, 88.2],
  ]),
  baseline: baseline(),
};

/**
 * SPARSE — three readings in the last eight days (travel, strap on the
 * charger). The fixture the ticket expects to eliminate a variant on: going
 * from four rows to seven-plus quadruples the chance of a mostly-empty tile,
 * and absence has to look like absence rather than like breakage.
 */
const sparseView: RecoveryView = {
  ...REST,
  days: build([
    ...LEAD_IN,
    [61, 41, 61.0, 87.4],
    [null, null, null, 87.6],
    [null, null, null, 87.8],
    [54, 66, 90.5127, 87.9],
    [null, null, null, 87.9],
    [null, null, null, 88.0],
    [47, 52, 96.10188, 88.2],
    [null, null, null, 88.2],
  ]),
  baseline: baseline({ hrvDays: 21, restingHrDays: 22, recoveryScoreDays: 22 }),
};

/**
 * CALIBRATING — nine nights in. Readings exist and print, every baseline
 * average is null, every day is `unknown`, and no comparison is drawn anywhere.
 * Every new Whoop user lives here for a fortnight: no NaN, no empty frame, no
 * colour on the HRV column.
 */
const calibratingView: RecoveryView = {
  ...REST,
  days: build([
    ...Array.from({ length: 21 }, () => [null, null, null, null] as Row),
    [55, 59, 91.4, null],
    [54, 64, 96.30112, null],
    [56, 48, 78.9, null],
    [53, 70, 103.2, null],
    [57, 42, 74.55, null],
    [55, 57, 88.61904, null],
    [52, 73, 99.8, null],
    [54, 61, 85.2, null],
    [56, 46, 80.44, null],
    [null, null, null, null],
  ]),
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
  hrv: { ...REST.hrv, balancedLow: null, balancedHigh: null, shortAvg: null },
  baselineTrend: { direction: "unknown", deltaMs: null, fromAvg: null, overDays: 9 },
};

/**
 * PARTIAL BAND — 40 nights of history, so the 30-day header baseline is solid
 * while the OLDEST nights in this window have no band of their own yet
 * (2026-07-12 → 07-31 predate that day's own thirtieth night). Only bites the
 * wider-window variants; they must not draw an uncalibrated night as a
 * different KIND of row.
 */
const partialBandView: RecoveryView = {
  ...REST,
  days: build([
    ...LEAD_IN.map(([hr, score, hrv]) => [hr, score, hrv, null] as Row),
    [61, 41, 61.0, 87.4],
    [51, 78, 112.44031, 87.6],
    [null, null, null, 87.8],
    [54, 66, 90.5127, 87.9],
    [57, 35, 83.242966, 87.9],
    [59, 29, 77.39185, 88.0],
    [47, 52, 96.10188, 88.2],
    [null, null, null, 88.2],
  ]),
  baseline: baseline({ hrvDays: 38, restingHrDays: 39, recoveryScoreDays: 39 }),
};

export type FixtureKey =
  | "default"
  | "full-week"
  | "red-morning"
  | "sparse"
  | "calibrating"
  | "partial-band";

export const FIXTURES: { key: FixtureKey; label: string; note: string; view: RecoveryView }[] = [
  {
    key: "default",
    label: "default",
    note: "A bad weekend, a strong Monday, no reading yet today — the 7am screenshot that prompted this DX.",
    view: defaultView,
  },
  {
    key: "full-week",
    label: "full week",
    note: "Today has landed and nothing is missing. Every variant should look good here.",
    view: fullWeekView,
  },
  {
    key: "red-morning",
    label: "red morning",
    note: "Today at 22 on 63 bpm after two yellows — the --danger stress test. True and worth noticing, never an alarm.",
    view: redMorningView,
  },
  {
    key: "sparse",
    label: "sparse",
    note: "Three readings in eight days. Absence must look like absence, not like breakage.",
    view: sparseView,
  },
  {
    key: "calibrating",
    label: "calibrating",
    note: "Nine nights in. Readings print, no baseline exists, nothing is compared to anything.",
    view: calibratingView,
  },
  {
    key: "partial-band",
    label: "partial band",
    note: "40 nights of history — the oldest days in a wide window carry no band of their own.",
    view: partialBandView,
  },
];
