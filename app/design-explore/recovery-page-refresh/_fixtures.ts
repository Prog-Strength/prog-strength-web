/**
 * Static fixtures for the `recovery-page-refresh` exploration — THROWAWAY.
 *
 * Nothing here touches a data service. These are hand-built `RecoveryView`s at
 * PAGE scale — fourteen months of date-aligned mornings rather than a tile's
 * 31-day window — shaped to the ticket's representative fixture so every
 * variant is judged on the same history.
 *
 * The generator plays the SERVER. Per-day bands, the trailing baselines, the
 * spread, the z-scores, the 7-day mean and the baseline drift are all computed
 * ONCE here and then read as received by the variants, exactly as the real
 * payload is. That is what keeps the standing rule ("nothing recomputes a
 * server figure") true of a mockup with no server behind it: the fixture is the
 * server, and a variant that wanted a figure the wire does not carry — a
 * resting-HR band, say — would have to declare prerequisite P2 rather than
 * quietly average something.
 *
 * The window is deliberately unkind. Today is a 13 on a 69 bpm morning: the
 * page has to be legible when the news is bad, and a fixture full of green
 * weeks proves nothing.
 */

import type {
  RecoveryDayPoint,
  RecoveryHrvStatus,
  RecoveryTrendDirection,
  RecoveryView,
} from "@/lib/dashboard";
import { addDays, isMissingNight, mean } from "./_shared";

export const TODAY = "2026-08-12";

/** Fourteen months of stored mornings — deep enough that the ledger pages ~21
 *  times and a 1-year range is populated end to end. */
const HISTORY_DAYS = 428;
const START = addDays(TODAY, -(HISTORY_DAYS - 1));

/** The trailing window every baseline figure is computed over. */
const BASELINE_WINDOW = 30;
/** Readings a window must hold before it emits an average at all. */
const MIN_BASELINE_READINGS = 14;
/** Half-width of the nightly balanced band, in standard deviations. */
const BALANCED_Z = 1;
/** The rolling mean the tile headlines, and its own sample floor. */
const SHORT_WINDOW = 7;
const MIN_SHORT_READINGS = 4;
/** The HRV level the athlete's own baseline sits at before the closing rise,
 *  and the size of that rise. Together they are what make the drift tag read
 *  `▲ +6 ms · 4w` and the ribbon drift under the curve. */
const HRV_FLOOR = 71;
const RISE_MS = 30;
/** How far back the baseline-drift tag looks. */
const DRIFT_DAYS = 28;

// ── A deterministic wobble ────────────────────────────────────────────────────

/**
 * Seeded so the server render and the client render agree. A fixture that
 * re-randomised on hydration would flicker every panel on the page and make two
 * variants disagree about the same morning, which is the one thing a comparison
 * surface cannot afford.
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
 *  the Friday before today. Absent dates, not zeroes. */
const MISSING_NIGHTS = new Set<string>([
  "2026-08-07",
  ...Array.from({ length: 6 }, (_, i) => addDays("2025-11-14", i)),
  ...Array.from({ length: 3 }, (_, i) => addDays("2026-03-05", i)),
  "2026-01-19",
  "2026-05-23",
]);

/** Mornings with a score but no HRV — an em-dash in the ledger, a gap in the
 *  chart, never a zero. */
const NO_HRV_NIGHTS = new Set<string>(["2026-06-18", "2026-02-11", "2025-09-30"]);

/** The suppressed run the ticket asks for: five consecutive below-band nights
 *  in late July, so the ribbon's out-of-band marks have something true to say. */
const SUPPRESSED_RUN = new Set<string>(
  Array.from({ length: 5 }, (_, i) => addDays("2026-07-21", i)),
);

/** A rough week in February — hot, flat, and red for seven mornings, so a
 *  band-coloured rail has a genuinely bad stretch in it and not just one bad
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
 * Four components, and each one exists to make a state on the ticket's list
 * true rather than asserted:
 *
 *  - `mu`, the athlete's own HRV level — a slow seasonal wander that RISES over
 *    the closing ten weeks, which is what makes the drift tag read `▲ … · 4w`
 *    and the ribbon drift visibly instead of sitting flat at today's bounds.
 *    The wander is damped over that stretch so the rise is legible under it.
 *  - `load`, a ~14-week training block wave that pushes the SCORE around
 *    without moving the HRV baseline much — which is what produces a green
 *    stretch, a mixed one and a rough one rather than 428 yellow days.
 *  - the suppressed run: five consecutive late-July nights driven well under
 *    the band.
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
  return raw
    .slice(Math.max(0, i - BASELINE_WINDOW + 1), i + 1)
    .flatMap((m) => (pick(m) === null ? [] : [pick(m) as number]));
}

function classify(hrv: number | null, low: number | null, high: number | null): RecoveryHrvStatus {
  if (hrv === null || low === null || high === null) return "unknown";
  if (hrv < low) return "suppressed";
  if (hrv > high) return "elevated";
  return "balanced";
}

/**
 * Turn raw readings into the date-aligned day points the wire carries, each
 * with the band as it stood THAT morning — which is what lets the HRV ribbon
 * drift instead of sitting flat at today's bounds.
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
 * recovery section is. Every figure a variant prints comes from here.
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
    // mornings, which loses the date alignment every variant depends on.
    // Carried because the payload carries it. Nothing here draws from it.
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

// ── The four states the variants are driven across ────────────────────────────

const DEFAULT_RAW = rawSeries();

/** 7am, before the morning webhook lands. Today's slot exists and is empty. */
function pendingRaw(): RawMorning[] {
  const raw = DEFAULT_RAW.map((m) => ({ ...m }));
  raw[raw.length - 1] = { date: TODAY, score: null, rhr: null, hrv: null };
  return raw;
}

/** A new user: nine mornings, no band, no averages. */
function calibratingRaw(): RawMorning[] {
  return DEFAULT_RAW.slice(-9).map((m) => ({ ...m }));
}

/**
 * A month of data on a 1-year range — long empty lead-ins, averages over what
 * exists. The date alignment is a full year; only the last 34 mornings recorded.
 */
function sparseRaw(): RawMorning[] {
  const year = DEFAULT_RAW.slice(-365).map((m) => ({ ...m }));
  return year.map((m, i) =>
    i < year.length - 34 ? { date: m.date, score: null, rhr: null, hrv: null } : m,
  );
}

function viewOf(raw: RawMorning[]): RecoveryView {
  return deriveView(toDayPoints(raw));
}

export type FixtureKey = "default" | "no-reading-yet" | "calibrating" | "sparse-year";

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
    note: "Fourteen months of mornings ending on a bad one — Wed 12 Aug is a 13 on 69 bpm and 45 ms, the worst morning on the page. Tue 78, Mon 52, Sunday's score never scored, no row at all for Friday the 7th, and five consecutive below-band HRV nights in late July. The ledger pages ~21 times; the 30-day baseline sits near 61 · 54 bpm · 89 ms with the HRV baseline drifting up from four weeks ago.",
    view: viewOf(DEFAULT_RAW),
  },
  {
    key: "no-reading-yet",
    label: "no-reading-yet",
    note: "The same history at 7am, before today's webhook lands. Per Fixed Decision 1 the page should barely flinch — its subject is the window, not the morning — and per Fixed Decision 5 nothing may promote yesterday into today's slot or print an em-dash where a window figure would do.",
    view: viewOf(pendingRaw()),
  },
  {
    key: "calibrating",
    label: "calibrating",
    note: "Nine mornings, below the baseline floor. No band, no averages, honest counts. The HRV panel already handles this; what is being judged here is whether the REST of the page manages to sit beside it without printing a confident number.",
    view: viewOf(calibratingRaw()),
  },
  {
    key: "sparse-year",
    label: "sparse-year",
    note: "A month of readings on a full-year range: a long empty lead-in, averages over what exists. A variant that scrubs or rails across all stored history has to make the emptiness read as history-not-yet-recorded rather than as breakage.",
    view: viewOf(sparseRaw()),
  },
];

/** Handy for a variant that wants to talk about the window it is drawing. */
export function recordedMornings(view: RecoveryView): number {
  return (view.days ?? []).filter((d) => !isMissingNight(d)).length;
}
