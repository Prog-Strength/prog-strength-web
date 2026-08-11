/**
 * Test fixtures for the sleep tile. Hand-authored rather than generated,
 * because every number here exists to exercise one specific branch:
 *
 * - `scoredNightView()` — a complete, SCORED night. Its stage durations sum
 *   EXACTLY to `inBedMilli` (deep + light + REM + awake = in bed), so the
 *   stacked bar's segments have to add to 100% for the fixture to be
 *   self-consistent, and `asleepMilli` (in bed − awake − no-data) is a real
 *   figure rather than a coincidence. Its `nights` window carries an interior
 *   all-null night (index 3) so the date-aligned gap contract is exercised by
 *   default: a night with no data and a night of zero sleep are different facts.
 * - `partialNightView()` — SCORED but incomplete: no `awakeMilli`, no need
 *   components, no performance percentage. This is the "prints — not NaN"
 *   fixture; every derived figure on the tile has to degrade to an em dash.
 * - `noDataView()` — connected, scoped, and nothing ingested yet: `lastNight`
 *   null over a window of all-null nights. The tile's own empty state.
 * - `noStagesNight()` — a night whose stage summary is entirely absent, for the
 *   stage bar's own empty treatment (four NaN widths is the bug it guards).
 *
 * Durations are MILLISECONDS, as stored and as the view model carries them —
 * the tile formats, nothing here pre-rounds. Test-only; never imported by
 * production code.
 */

import type { SleepNightView, SleepView } from "@/lib/dashboard";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** The fixture "today" — the last of the seven window dates. */
export const FIXTURE_TODAY = "2026-08-11";

/** The interior missing night the default window carries (2026-08-08). */
export const FIXTURE_GAP_INDEX = 3;

const WINDOW_DATES = [
  "2026-08-05",
  "2026-08-06",
  "2026-08-07",
  "2026-08-08",
  "2026-08-09",
  "2026-08-10",
  FIXTURE_TODAY,
];

/** A night with a date and nothing else — the shape of a gap in the window. */
export function emptyNight(date: string): SleepNightView {
  return {
    date,
    inBedMilli: null,
    awakeMilli: null,
    lightSleepMilli: null,
    slowWaveSleepMilli: null,
    remSleepMilli: null,
    noDataMilli: null,
    sleepCycleCount: null,
    disturbanceCount: null,
    needBaselineMilli: null,
    needFromSleepDebtMilli: null,
    needFromStrainMilli: null,
    needFromNapMilli: null,
    respiratoryRate: null,
    performancePct: null,
    consistencyPct: null,
    efficiencyPct: null,
  };
}

/**
 * The headline night: 8h 05m in bed, of which 42m awake, so 7h 23m asleep,
 * against a computed need of 8h 17m. The need's nap component is NEGATIVE
 * (−15m) on purpose — a nap discharges sleep need, and a fixture that only
 * ever adds would let a clamp-to-zero bug through.
 */
export function scoredNight(over: Partial<SleepNightView> = {}): SleepNightView {
  return {
    ...emptyNight(FIXTURE_TODAY),
    inBedMilli: 8 * HOUR + 5 * MIN, // 29,100,000
    awakeMilli: 42 * MIN, // 2,520,000
    noDataMilli: 0,
    lightSleepMilli: 3 * HOUR + 55 * MIN, // 14,100,000
    slowWaveSleepMilli: 1 * HOUR + 32 * MIN, // 5,520,000
    remSleepMilli: 1 * HOUR + 56 * MIN, // 6,960,000
    sleepCycleCount: 5,
    disturbanceCount: 9,
    needBaselineMilli: 8 * HOUR,
    needFromSleepDebtMilli: 20 * MIN,
    needFromStrainMilli: 12 * MIN,
    needFromNapMilli: -15 * MIN,
    respiratoryRate: 14.6,
    performancePct: 89.2,
    consistencyPct: 74.5,
    efficiencyPct: 91.3,
    ...over,
  };
}

/** In bed − awake − no data = 7h 23m. Exported so tests assert one number. */
export const SCORED_ASLEEP_MILLI = 7 * HOUR + 23 * MIN;
/** baseline + debt + strain + (−nap) = 8h 17m. */
export const SCORED_NEED_MILLI = 8 * HOUR + 17 * MIN;

/** A SCORED night missing half its score — the em-dash fixture. */
export function partialNight(): SleepNightView {
  return {
    ...emptyNight(FIXTURE_TODAY),
    inBedMilli: 7 * HOUR + 30 * MIN,
    // No awake and no no-data reading, so "asleep" is not derivable at all.
    lightSleepMilli: 4 * HOUR,
    remSleepMilli: 1 * HOUR + 30 * MIN,
    sleepCycleCount: 4,
    // A need with a hole in it is not a need — the tile must not print a
    // partial sum as if it were WHOOP's figure.
    needBaselineMilli: 8 * HOUR,
    efficiencyPct: 88.4,
  };
}

/** A night with no stage summary at all — the stage bar's empty treatment. */
export function noStagesNight(): SleepNightView {
  return { ...emptyNight(FIXTURE_TODAY), inBedMilli: 7 * HOUR, performancePct: 71.0 };
}

/** The default window: seven date-aligned nights with an interior gap. */
export function nightsWindow(last: SleepNightView): SleepNightView[] {
  return WINDOW_DATES.map((date, i) => {
    if (i === WINDOW_DATES.length - 1) return { ...last, date };
    if (i === FIXTURE_GAP_INDEX) return emptyNight(date);
    return {
      ...scoredNight(),
      date,
      // Vary the night a little so a test that reads the window sees a series,
      // not seven identical rows.
      inBedMilli: 7 * HOUR + (30 + i * 5) * MIN,
      performancePct: 80 + i,
    };
  });
}

/** Connected, scoped, and last night is fully scored. */
export function scoredNightView(): SleepView {
  const last = scoredNight();
  return { lastNight: last, nights: nightsWindow(last) };
}

/** Connected, scoped, last night scored but half its fields absent. */
export function partialNightView(): SleepView {
  const last = partialNight();
  return { lastNight: last, nights: nightsWindow(last) };
}

/** Connected and scoped, nothing ingested yet — every date, no metrics. */
export function noDataView(): SleepView {
  return { lastNight: null, nights: WINDOW_DATES.map(emptyNight) };
}
