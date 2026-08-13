/**
 * Test fixtures for the `/recovery` page. Test-only; never imported by
 * production code, exactly as the recovery tiles' own `fixtures.ts` is.
 *
 * These are `RecoveryView`s at PAGE scale — fourteen months of date-aligned
 * mornings rather than a tile's 31-day window — so the ledger really pages, the
 * 1y window is full end to end, and `prepareDeck`'s lead-in has history to take
 * a lead-in from. Ported from the DX mockup's generator, which is why the
 * headline numbers below are the ticket's own.
 *
 * THE GENERATOR PLAYS THE SERVER, and that is the point of building the fixture
 * this way rather than hand-authoring four hundred rows. Per-day bands, the
 * trailing baselines, the spread, the z-scores, the 7-day mean and the baseline
 * drift are all computed ONCE, here, and every component then reads them as
 * RECEIVED — which is what keeps the standing rule ("nothing recomputes a server
 * figure") true of a fixture with no server behind it. A component that wanted a
 * figure the wire does not carry would have to invent it in front of a test that
 * can see it was invented, instead of quietly averaging something.
 *
 * The window is deliberately UNKIND. Today is a 13 on a 69 bpm morning: the page
 * has to be legible when the news is bad, and a fixture full of green weeks
 * proves nothing. The values named below are contract — `_components/shared.test.ts`
 * asserts them, so an edit to this generator that moves one fails loudly rather
 * than silently invalidating another test's premise.
 */

import type {
  RecoveryDayPoint,
  RecoveryHrvStatus,
  RecoveryTrendDirection,
  RecoveryView,
} from "@/lib/dashboard";
import {
  MIN_ROLLING_NIGHTS,
  ROLLING_WINDOW_NIGHTS,
} from "@/app/(app)/dashboard/_components/recovery/hrv-chart";
import { MIN_BASELINE_DAYS } from "@/app/(app)/dashboard/_components/recovery/shared";
import { addDays, isMissingNight, mean } from "./_components/shared";

/** The fixture "today" — Wed 12 Aug 2026, the last stored morning. */
export const FIXTURE_TODAY = "2026-08-12";

/** Fourteen months of stored mornings — deep enough that the ledger pages ~21
 *  times and a 1-year window is populated end to end. */
const HISTORY_DAYS = 428;
const START = addDays(FIXTURE_TODAY, -(HISTORY_DAYS - 1));

/** The trailing window every baseline figure is computed over. */
const BASELINE_WINDOW = 30;
/** Half-width of the nightly balanced band, in standard deviations. */
const BALANCED_Z = 1;
/**
 * The three sample floors and the rolling window are IMPORTED rather than
 * retyped, even though this generator is playing the server and could pick its
 * own. They are the client's mirrors of the API's `[recovery]` config, and they
 * are the numbers the code under test gates on: a fixture that emitted a
 * fourteen-night average while the strip's gate had moved to twenty-one, or a
 * seven-night `shortAvg` while `prepareHrvChart` was rolling over ten, would be
 * a fixture quietly describing a different server from the one the page speaks
 * to. Retuning the mirror retunes the fixture with it.
 */
const MIN_BASELINE_READINGS = MIN_BASELINE_DAYS;
const SHORT_WINDOW = ROLLING_WINDOW_NIGHTS;
const MIN_SHORT_READINGS = MIN_ROLLING_NIGHTS;
/** The HRV level the athlete's own baseline sits at before the closing rise,
 *  and the size of that rise. Together they are what make the drift tag read
 *  `▲ +7 ms · 4w` and the ribbon drift under the curve. */
const HRV_FLOOR = 71;
const RISE_MS = 30;
/** How far back the baseline-drift tag looks. */
const DRIFT_DAYS = 28;

// ── A deterministic wobble ────────────────────────────────────────────────────

/**
 * Seeded, so every run of the suite sees the same fourteen months. A fixture
 * that re-randomised would make an assertion about a band count or a suppressed
 * run true on Tuesday and false on Wednesday, which is the one thing a fixture
 * cannot afford.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Two uniforms, summed — a cheap bell without importing anything. */
function wobble(next: () => number, spread: number): number {
  return (next() + next() - 1) * spread;
}

// ── The default fourteen months ───────────────────────────────────────────────

/** Mornings Whoop never recorded: a long strap-off stretch, a short one, and
 *  the Friday before today. Absent dates, not zeroes — the ledger drops them
 *  and all three plots keep the slot. */
const MISSING_NIGHTS = new Set<string>([
  "2026-08-07",
  ...Array.from({ length: 6 }, (_, i) => addDays("2025-11-14", i)),
  ...Array.from({ length: 3 }, (_, i) => addDays("2026-03-05", i)),
  "2026-01-19",
  "2026-05-23",
]);

/** Mornings with a score but no HRV — an em-dash in the ledger, a gap in the
 *  HRV row only, never a zero. */
const NO_HRV_NIGHTS = new Set<string>(["2026-06-18", "2026-02-11", "2025-09-30"]);

/** The suppressed run the ticket asks for: five consecutive below-band nights
 *  from 21 Jul, so the ribbon's out-of-band marks have something true to say. */
const SUPPRESSED_RUN = new Set<string>(
  Array.from({ length: 5 }, (_, i) => addDays("2026-07-21", i)),
);

/** A rough week in February — hot, flat and red for seven mornings, so the
 *  banded score columns have a genuinely bad stretch and not just one bad
 *  morning at the end. */
const ROUGH_WEEK = new Set<string>(Array.from({ length: 7 }, (_, i) => addDays("2026-02-14", i)));

/** And a good one in June, for the same reason in the other direction. */
const GREEN_STRETCH = new Set<string>(
  Array.from({ length: 12 }, (_, i) => addDays("2026-06-01", i)),
);

/** The recent mornings the ticket pins by hand. Everything else is generated. */
const PINNED: Record<string, { score: number | null; rhr: number | null; hrv: number | null }> = {
  "2026-08-12": { score: 13, rhr: 69, hrv: 45 },
  "2026-08-11": { score: 78, rhr: 50, hrv: 106 },
  "2026-08-10": { score: 52, rhr: 47, hrv: 96 },
  "2026-08-09": { score: null, rhr: 51, hrv: 88 },
  "2026-08-08": { score: 64, rhr: 52, hrv: 91 },
  "2026-08-06": { score: 71, rhr: 51, hrv: 97 },
  "2026-08-05": { score: 44, rhr: 56, hrv: 79 },
};

type RawMorning = { date: string; score: number | null; rhr: number | null; hrv: number | null };

/**
 * The raw readings: what the strap recorded, before anything is derived from
 * them.
 *
 * Four components, and each exists to make a state on the ticket's list TRUE
 * rather than asserted:
 *
 *  - `mu`, the athlete's own HRV level — a slow seasonal wander that RISES over
 *    the closing ten weeks, which is what makes the drift tag read `▲ … · 4w`
 *    and the ribbon drift visibly instead of sitting flat at today's bounds.
 *    The wander is damped over that stretch so the rise is legible under it.
 *  - `load`, a ~14-week training-block wave that pushes the SCORE around without
 *    moving the HRV baseline much — which is what produces a green stretch, a
 *    mixed one and a rough one rather than 428 yellow days.
 *  - the suppressed run: five consecutive late-July nights driven well under the
 *    band.
 *  - noise, seeded.
 */
function rawSeries(): RawMorning[] {
  const next = rng(0x5eed_1234);
  const out: RawMorning[] = [];

  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    const date = addDays(START, i);

    if (MISSING_NIGHTS.has(date)) {
      out.push({ date, score: null, rhr: null, hrv: null });
      continue;
    }

    // The closing rise, and the taper that lets it read through the wander.
    const rise = RISE_MS * Math.min(1, Math.max(0, (i - (HISTORY_DAYS - 60)) / 45));
    const taper = i > HISTORY_DAYS - 75 ? 0.4 : 1;
    const wander =
      taper *
      (5 * Math.sin((2 * Math.PI * (i + 40)) / 240) + 2.5 * Math.sin((2 * Math.PI * i) / 47));
    const mu = HRV_FLOOR + wander + rise;

    let hrv = mu + wobble(next, 9);
    if (SUPPRESSED_RUN.has(date)) hrv -= 26;
    if (ROUGH_WEEK.has(date)) hrv -= 17;
    if (GREEN_STRETCH.has(date)) hrv += 8;

    // Resting HR reads inversely — a suppressed morning is usually a hot one.
    const rhrMu = 54 - 0.12 * (mu - 82);
    let rhr = rhrMu - 0.05 * (hrv - mu) + wobble(next, 2.6);
    if (ROUGH_WEEK.has(date)) rhr += 7;
    if (GREEN_STRETCH.has(date)) rhr -= 2;
    // The score follows how far this morning sits from the athlete's own norm,
    // shifted by where the training block is.
    const load = 12 * Math.sin((2 * Math.PI * (i + 32)) / 97);
    let score = 65 + 1.25 * (hrv - mu) - 2.4 * (rhr - rhrMu) - load + wobble(next, 11);
    if (ROUGH_WEEK.has(date)) score -= 12;
    if (GREEN_STRETCH.has(date)) score += 10;

    hrv = Math.round(hrv);
    rhr = Math.round(rhr);
    score = Math.min(99, Math.max(3, Math.round(score)));

    const pinned = PINNED[date];
    out.push(
      pinned
        ? { date, score: pinned.score, rhr: pinned.rhr, hrv: pinned.hrv }
        : { date, score, rhr, hrv: NO_HRV_NIGHTS.has(date) ? null : hrv },
    );
  }

  return out;
}

// ── The server's own arithmetic, done once ────────────────────────────────────

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** The trailing readings of one metric at index `i`, inclusive of that day. */
function trailing(raw: RawMorning[], i: number, pick: (m: RawMorning) => number | null): number[] {
  // flatMap NARROWS the nullable reading, which is what avoids an `as number` —
  // and calls `pick` once per morning rather than twice.
  return raw.slice(Math.max(0, i - BASELINE_WINDOW + 1), i + 1).flatMap((m) => {
    const v = pick(m);
    return v === null ? [] : [v];
  });
}

function classify(hrv: number | null, low: number | null, high: number | null): RecoveryHrvStatus {
  if (hrv === null || low === null || high === null) return "unknown";
  if (hrv < low) return "suppressed";
  if (hrv > high) return "elevated";
  return "balanced";
}

/**
 * Turn raw readings into the date-aligned day points the wire carries, each with
 * the band as it stood THAT morning — which is what lets the HRV ribbon drift
 * instead of sitting flat at today's bounds.
 */
function toDayPoints(raw: RawMorning[]): RecoveryDayPoint[] {
  return raw.map((m, i) => {
    const window = trailing(raw, i, (r) => r.hrv);
    const calibrated = window.length >= MIN_BASELINE_READINGS;
    const avg = calibrated ? window.reduce((s, v) => s + v, 0) / window.length : null;
    const sd = avg === null ? null : stdDev(window, avg);
    const low = avg === null || sd === null ? null : avg - BALANCED_Z * sd;
    const high = avg === null || sd === null ? null : avg + BALANCED_Z * sd;
    return {
      date: m.date,
      restingHr: m.rhr,
      recoveryScore: m.score,
      hrv: m.hrv,
      baselineAvg: avg,
      balancedLow: low,
      balancedHigh: high,
      zScore: m.hrv === null || avg === null || !sd ? null : (m.hrv - avg) / sd,
      status: classify(m.hrv, low, high),
    };
  });
}

function direction(delta: number | null, deadband: number): RecoveryTrendDirection {
  if (delta === null) return "unknown";
  if (delta > deadband) return "rising";
  if (delta < -deadband) return "falling";
  return "steady";
}

/**
 * The derived blocks, assembled from the day points exactly as the API's
 * recovery section is. Every figure the page prints comes from here.
 */
function deriveView(days: RecoveryDayPoint[]): RecoveryView {
  const today = days[days.length - 1];
  const recent = days.slice(-BASELINE_WINDOW);
  const count = (pick: (d: RecoveryDayPoint) => number | null) =>
    recent.filter((d) => pick(d) !== null).length;
  const avgOf = (pick: (d: RecoveryDayPoint) => number | null) =>
    count(pick) >= MIN_BASELINE_READINGS ? mean(recent.map(pick)) : null;

  const hrvWindow = recent.flatMap((d) => (d.hrv === null ? [] : [d.hrv]));
  const hrvAvg = avgOf((d) => d.hrv);
  const hrvSd = hrvAvg === null ? null : stdDev(hrvWindow, hrvAvg);

  const shortWindow = days.slice(-SHORT_WINDOW).flatMap((d) => (d.hrv === null ? [] : [d.hrv]));
  const shortAvg =
    shortWindow.length >= MIN_SHORT_READINGS
      ? shortWindow.reduce((s, v) => s + v, 0) / shortWindow.length
      : null;

  const past = days[days.length - 1 - DRIFT_DAYS];
  const fromAvg = past?.baselineAvg ?? null;
  const deltaMs =
    today.baselineAvg === null || fromAvg === null ? null : today.baselineAvg - fromAvg;

  return {
    restingToday: today.restingHr,
    recoveryScore: today.recoveryScore,
    hrvToday: today.hrv,
    // Legacy, and built the way the wire builds it — by dropping missing
    // mornings, which loses the date alignment the whole deck depends on.
    // Carried because the payload carries it. Nothing on the page draws it.
    spark: days.flatMap((d) => (d.restingHr === null ? [] : [d.restingHr])),
    days,
    baseline: {
      windowDays: BASELINE_WINDOW,
      restingHrAvg: avgOf((d) => d.restingHr),
      restingHrDays: count((d) => d.restingHr),
      hrvAvg,
      hrvStdDev: hrvSd,
      hrvDays: count((d) => d.hrv),
      recoveryScoreAvg: avgOf((d) => d.recoveryScore),
      recoveryScoreDays: count((d) => d.recoveryScore),
    },
    hrv: {
      status: today.status,
      balancedLow: today.balancedLow,
      balancedHigh: today.balancedHigh,
      zScore: today.zScore,
      trend: direction(shortAvg === null || hrvAvg === null ? null : shortAvg - hrvAvg, 2),
      shortAvg,
    },
    baselineTrend: {
      direction: direction(deltaMs, 1),
      deltaMs,
      fromAvg,
      overDays: DRIFT_DAYS,
    },
  };
}

// ── The four states the page is driven across ─────────────────────────────────

/** Generated once: `rawSeries` is deterministic, so a second call would only
 *  spend the same arithmetic again. Every builder copies before it edits. */
const DEFAULT_RAW = rawSeries();

function viewOf(raw: RawMorning[]): RecoveryView {
  return deriveView(toDayPoints(raw));
}

/**
 * **default** — fourteen months ending on a bad one. Wed 12 Aug is a 13 on
 * 69 bpm and 45 ms, the worst morning on the page; Tue 11 Aug is 78 · 50 · 106
 * and Mon 10 Aug 52 · 47 · 96; Sun 9 Aug was never scored; there is NO ROW AT
 * ALL for Fri 7 Aug; and five consecutive below-band HRV nights run from 21 Jul.
 * 428 mornings, 416 of them recorded, so the ledger pages 21 times and the 1y
 * window is full end to end.
 */
export function defaultView(): RecoveryView {
  return viewOf(DEFAULT_RAW);
}

/**
 * **no reading yet** — the same history at 7am, before today's webhook lands.
 * Today's slot is PRESENT and empty, which is the distinction that matters: the
 * page must fall back to the latest morning that has a value and label it
 * `latest · 11 Aug`, never promote yesterday into today's slot.
 */
export function noReadingYetView(): RecoveryView {
  const raw = DEFAULT_RAW.map((m) => ({ ...m }));
  raw[raw.length - 1] = { date: FIXTURE_TODAY, score: null, rhr: null, hrv: null };
  return viewOf(raw);
}

/**
 * **calibrating** — a new user with nine mornings, below the baseline floor. No
 * band, no averages, `prepareHrvChart` returns null. What is being judged here
 * is whether the rest of the page manages to sit beside a calibrating panel
 * without printing a confident number.
 */
export function calibratingView(): RecoveryView {
  return viewOf(DEFAULT_RAW.slice(-9).map((m) => ({ ...m })));
}

/**
 * **sparse year** — a full year of date alignment with only the last 34 mornings
 * recorded. The long empty lead-in has to read as history-not-yet-recorded
 * rather than as breakage, and all three deck rows must narrow together.
 */
export function sparseYearView(): RecoveryView {
  const year = DEFAULT_RAW.slice(-365).map((m) => ({ ...m }));
  return viewOf(
    year.map((m, i) =>
      i < year.length - 34 ? { date: m.date, score: null, rhr: null, hrv: null } : m,
    ),
  );
}

/** Mornings Whoop actually recorded — the count the page's header prints, and
 *  never the number of materialized date slots. */
export function recordedMornings(view: RecoveryView): number {
  return (view.days ?? []).filter((d) => !isMissingNight(d)).length;
}
