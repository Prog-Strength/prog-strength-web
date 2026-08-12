/**
 * Static fixtures for the `resting-hr-tile` exploration — THROWAWAY.
 *
 * Six states, exactly the ones the ticket names, driven from one switcher so
 * every variant is judged on the same morning. Nothing here touches a data
 * service: these are hand-built `RecoveryView`s that look like a real payload.
 *
 * Two properties every fixture holds, because the variants depend on them:
 *
 *  - `days` is ALWAYS 31 entries, oldest→newest, DATE-ALIGNED with nulls
 *    preserved — every calendar date between 2026-07-13 and 2026-08-12 is
 *    present whether or not Whoop had a reading. `spark` is carried only
 *    because the wire carries it; it omits missing days and no variant reads
 *    it. See the ticket: it is legacy and it is a trap.
 *  - `baseline.restingHrAvg` / `restingHrDays` are RESTING HR's own sample,
 *    gated independently of HRV's. Every fixture's average is the true mean of
 *    its own 30 pre-today readings, so a variant that prints the baseline and a
 *    variant that plots against it cannot disagree.
 */

import type { RecoveryBaselineView, RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { addDays } from "./_shared";

/**
 * The window every fixture spans: 31 date-aligned days ending "today".
 * 2026-07-13 is a Monday and 2026-08-12 a Wednesday, which is what lets
 * `month-grid` lay the window out as whole Mon–Sun calendar weeks.
 */
const FIRST_DAY = "2026-07-13";
export const TODAY = "2026-08-12";
const WINDOW_DAYS = 31;

const DATES = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(FIRST_DAY, i));

/**
 * One morning. The HRV block is filled plausibly — derived from the resting HR
 * so the numbers move together the way a real morning's do — and then never
 * read: this is an RHR-only tile, and HRV's band, z-score and status are
 * deliberately left `unknown` rather than invented, because resting heart rate
 * has no equivalent of any of them and no variant is allowed to borrow one.
 */
function day(date: string, restingHr: number | null): RecoveryDayPoint {
  const has = restingHr !== null;
  return {
    date,
    restingHr,
    recoveryScore: has ? Math.max(5, Math.min(99, Math.round(190 - restingHr * 2.6))) : null,
    hrv: has ? Math.round((150 - restingHr * 1.15) * 1000) / 1000 : null,
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
  };
}

/** Zip a 31-long series of bpm readings onto the fixed date window. */
function series(values: (number | null)[]): RecoveryDayPoint[] {
  return DATES.map((date, i) => day(date, values[i] ?? null));
}

function baseline(restingHrAvg: number | null, restingHrDays: number): RecoveryBaselineView {
  return {
    windowDays: 30,
    restingHrAvg,
    restingHrDays,
    // HRV's and recovery's own samples. Present, different sizes, and never
    // consulted by this tile — reading `hrvDays` to gate an RHR calibrating
    // state is the exact bug the recovery_log SOW had to correct.
    hrvAvg: 88.2,
    hrvStdDev: 20.1,
    hrvDays: 27,
    recoveryScoreAvg: 57.6,
    recoveryScoreDays: 28,
  };
}

// ── The six series ────────────────────────────────────────────────────────────

/**
 * default — an ordinary week with one bump. Agrees with the shipped
 * `recovery_log` in the screenshot that prompted this DX: 30-day average 53,
 * Sunday 59, Monday 47, today 50. Note `49.6` on the 11th — a FLOAT on the
 * wire, and a variant that prints `49.6 bpm` has failed before it is compared.
 *
 * Laid out one Mon–Sun week per line, because that is how `month-grid` reads it
 * and because a 31-number column is unreviewable. Hence the prettier-ignore.
 */
// prettier-ignore
const DEFAULT_SERIES: (number | null)[] = [
  52, 54, 51, 53, 55, 57, 56,      // Jul 13–19
  52, 51, null, 53, 52, 55, 58,    // Jul 20–26  (strap off Wed the 22nd)
  54, 51, 50, 52, 54, 56, 57,      // Jul 27 – Aug 2
  53, 52, 51, null, 54, 57, 59,    // Aug 3–9    (Sunday the 9th runs high)
  47, 49.6, 50,                    // Aug 10–12  (Monday's rebound, the float, today)
];

/**
 * creeping-up — THE fixture this tile exists for. Three weeks flat around 48,
 * then five days climbing to 58, with the 30-day average still reading 49
 * because the climb has not yet dragged a mean built from thirty mornings.
 */
// prettier-ignore
const CREEPING_SERIES: (number | null)[] = [
  48, 47, 49, 48, 47, 49, 50,
  48, 47, 48, 49, 48, 47, 50,
  48, 47, 48, 49, 48, 47, 49,
  48, 47, 48, 49, 48, 53, 54,      // the climb starts Sat Aug 8
  56, 57, 58,                      // …and does not stop
];

/**
 * flat-month — the auto-scale trap. 48–50 for the entire window. A chart fitted
 * to its own data range turns 2 bpm of noise into a mountain range; this is the
 * fixture that should eliminate any variant which cries wolf on a healthy month.
 */
// prettier-ignore
const FLAT_SERIES: (number | null)[] = [
  49, 48, 50, 49, 48, 49, 50,
  48, 49, 48, 50, 49, 48, 49,
  50, 48, 49, 50, 48, 49, 48,
  50, 49, 48, 49, 50, 48, 49,
  48, 49, 49,
];

/** no-reading-yet — 7am, before the morning webhook lands. Today is null. */
const PENDING_SERIES: (number | null)[] = [...DEFAULT_SERIES.slice(0, 30), null];

/** sparse — strap off for a stretch: only 3 readings in the last 8 days. */
const SPARSE_SERIES: (number | null)[] = DEFAULT_SERIES.map((v, i) =>
  [23, 26, 28, 29].includes(i) ? null : v,
);

/** calibrating — a new user. Readings start Aug 3; 9 of 14 mornings, no average. */
// prettier-ignore
const CALIBRATING_SERIES: (number | null)[] = [
  ...Array<number | null>(21).fill(null),   // Jul 13 – Aug 2: before the strap arrived
  53, 52, 51, 54, 54, 57, 59, 47, 49.6, 50, // Aug 3–12
];

// ── The views ─────────────────────────────────────────────────────────────────

function view(
  values: (number | null)[],
  restingHrAvg: number | null,
  restingHrDays: number,
): RecoveryView {
  const days = series(values);
  const today = days[days.length - 1];
  return {
    restingToday: today.restingHr,
    recoveryScore: today.recoveryScore,
    hrvToday: today.hrv,
    // Legacy. Built exactly the way the wire builds it — by DROPPING missing
    // mornings — so it silently loses the date alignment every variant here
    // depends on. Carried only because the payload carries it. DO NOT DRAW FROM THIS.
    spark: days.map((d) => d.restingHr).filter((v): v is number => v !== null),
    days,
    baseline: baseline(restingHrAvg, restingHrDays),
    hrv: {
      status: "unknown",
      balancedLow: null,
      balancedHigh: null,
      zScore: null,
      trend: "unknown",
      shortAvg: null,
    },
  };
}

export type FixtureKey =
  | "default"
  | "creeping-up"
  | "flat-month"
  | "no-reading-yet"
  | "sparse"
  | "calibrating";

export type Fixture = {
  key: FixtureKey;
  label: string;
  note: string;
  view: RecoveryView;
};

export const FIXTURES: Fixture[] = [
  {
    key: "default",
    label: "default",
    note: "The ordinary morning. 30-day average 53 bpm, Sunday's 59 six over it, Monday's 47 the rebound, today an unremarkable 50. Nothing here is alarming and no variant should make it look alarming. Note the 49.6 on the 11th — every variant must print 50.",
    view: view(DEFAULT_SERIES, 53.4, 28),
  },
  {
    key: "creeping-up",
    label: "creeping-up",
    note: "The fixture this tile exists for. Three weeks flat around 48, then 53 · 54 · 56 · 57 · 58 over the last five mornings, average still reading 49. Can you see the climb in under a second?",
    view: view(CREEPING_SERIES, 49.0, 30),
  },
  {
    key: "flat-month",
    label: "flat-month",
    note: "48–50 for the whole window. The auto-scale trap: a chart fitted to its own range renders 2 bpm of noise as a mountain. This one should look boring, and a variant that makes it look dramatic will cry wolf every day of a healthy month.",
    view: view(FLAT_SERIES, 48.9, 30),
  },
  {
    key: "no-reading-yet",
    label: "no-reading-yet",
    note: "7am, before the morning webhook lands. Today is null. The history is intact and must still read — and yesterday must not be promoted into today's slot.",
    view: view(PENDING_SERIES, 53.4, 28),
  },
  {
    key: "sparse",
    label: "sparse",
    note: "Strap off for a stretch — 3 readings in the last 8 days. Gaps must read as gaps, not as breakage. A calendar with holes and a chart with holes fail very differently.",
    view: view(SPARSE_SERIES, 53.8, 24),
  },
  {
    key: "calibrating",
    label: "calibrating",
    note: "restingHrAvg is null with 9 of 14 mornings behind it. Readings exist and print; there is no average, so THERE IS NO DEVIATION TO DRAW. No NaN, no empty frame — and note this gates on restingHrDays, never on hrvDays.",
    view: view(CALIBRATING_SERIES, null, 9),
  },
];
