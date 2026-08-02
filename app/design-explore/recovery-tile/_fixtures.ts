/**
 * Static fixtures for the recovery-tile Design Exploration (DX).
 *
 * THROWAWAY. These are hand-built RecoveryView shapes that look real, so the
 * five variants can be compared across the states that actually matter on this
 * surface — suppressed, balanced, calibrating, and no-reading-yet. Nothing here
 * is wired to a live recovery service; the DX ticket calls for realistic static
 * fixtures and forbids touching production data flows.
 *
 * The `days` series is the honest, date-aligned history (nulls preserved, one
 * interior all-null gap so charts must break the line). Server figures
 * (`hrvAvg`, `balancedLow/High`, `zScore`, `restingHrAvg`, …) are supplied as
 * received — no variant recomputes them.
 */

import type { RecoveryView, RecoveryDayPoint } from "@/lib/dashboard";

/** 31 local dates, oldest → newest, ending "today" (2026-08-01). */
const DATES: readonly string[] = [
  "2026-07-02",
  "2026-07-03",
  "2026-07-04",
  "2026-07-05",
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
  "2026-07-13",
  "2026-07-14",
  "2026-07-15",
  "2026-07-16",
  "2026-07-17",
  "2026-07-18",
  "2026-07-19",
  "2026-07-20",
  "2026-07-21",
  "2026-07-22",
  "2026-07-23",
  "2026-07-24",
  "2026-07-25",
  "2026-07-26",
  "2026-07-27",
  "2026-07-28",
  "2026-07-29",
  "2026-07-30",
  "2026-07-31",
  "2026-08-01",
];

/**
 * Zip three metric columns into date-aligned RecoveryDayPoint[]. A `null` in
 * any column is preserved (a strap on the charger reads null across all three).
 */
function zip(
  hrv: (number | null)[],
  restingHr: (number | null)[],
  recoveryScore: (number | null)[],
): RecoveryDayPoint[] {
  return DATES.map((date, i) => ({
    date,
    hrv: hrv[i] ?? null,
    restingHr: restingHr[i] ?? null,
    recoveryScore: recoveryScore[i] ?? null,
  }));
}

// ── Suppressed history (the headline case) ───────────────────────────────────
// HRV drawn from ~mean-91 / SD-12.6, drifting down over the final week toward
// today's 74. One interior all-null day (2026-07-15, index 13). Ends today.
const HRV_SUPPRESSED: (number | null)[] = [
  96,
  103,
  88,
  91,
  99,
  84,
  107,
  90,
  95,
  82,
  100,
  93,
  87,
  null,
  98,
  89,
  94,
  108,
  86,
  97,
  91,
  83,
  100,
  88,
  89,
  92,
  95,
  null,
  86,
  81,
  74,
];
const RHR_SUPPRESSED: (number | null)[] = [
  52,
  50,
  54,
  53,
  51,
  55,
  49,
  52,
  51,
  54,
  50,
  52,
  53,
  null,
  51,
  53,
  52,
  49,
  54,
  51,
  52,
  55,
  50,
  53,
  52,
  53,
  52,
  null,
  52,
  51,
  51,
];
const SCORE_SUPPRESSED: (number | null)[] = [
  72,
  80,
  61,
  66,
  78,
  55,
  84,
  68,
  74,
  52,
  81,
  70,
  63,
  null,
  77,
  66,
  71,
  85,
  58,
  76,
  69,
  54,
  82,
  64,
  70,
  71,
  74,
  null,
  69,
  66,
  58,
];

// ── Balanced history (an ordinary Tuesday — most days) ───────────────────────
// The same shape of variability, but the final week holds near baseline and
// today lands at 94 (z ≈ +0.22). Same interior gap so the gap case still shows.
const HRV_BALANCED: (number | null)[] = [
  96,
  103,
  88,
  91,
  99,
  84,
  107,
  90,
  95,
  82,
  100,
  93,
  87,
  null,
  98,
  89,
  94,
  108,
  86,
  97,
  91,
  83,
  100,
  88,
  89,
  92,
  90,
  null,
  88,
  93,
  94,
];
const RHR_BALANCED: (number | null)[] = [
  52,
  50,
  54,
  53,
  51,
  55,
  49,
  52,
  51,
  54,
  50,
  52,
  53,
  null,
  51,
  53,
  52,
  49,
  54,
  51,
  52,
  55,
  50,
  53,
  52,
  53,
  51,
  null,
  52,
  51,
  51,
];
const SCORE_BALANCED: (number | null)[] = [
  72,
  80,
  61,
  66,
  78,
  55,
  84,
  68,
  74,
  52,
  81,
  70,
  63,
  null,
  77,
  66,
  71,
  85,
  58,
  76,
  69,
  54,
  82,
  64,
  70,
  71,
  72,
  null,
  70,
  73,
  71,
];

// ── Calibrating history (a new Whoop user, ~9 nights in) ─────────────────────
// Only the final ~two weeks carry readings; the window before the strap arrived
// is null. No baseline yet — averages, bounds and z are null; status unknown.
const HRV_CALIBRATING: (number | null)[] = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  84,
  96,
  88,
  91,
  null,
  79,
  93,
  87,
  90,
  85,
];
const RHR_CALIBRATING: (number | null)[] = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  53,
  50,
  52,
  51,
  null,
  54,
  51,
  52,
  51,
  52,
];
const SCORE_CALIBRATING: (number | null)[] = [
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  null,
  58,
  74,
  66,
  70,
  null,
  51,
  72,
  68,
  71,
  63,
];

// ── No-reading-yet-today (the every-morning state) ───────────────────────────
// Yesterday and before are the balanced history; today (the last entry) is
// null across the board because the webhook hasn't landed. Baseline + trend are
// still true and still printable — the whole point of this state.
const HRV_NOREAD: (number | null)[] = [...HRV_BALANCED.slice(0, 30), null];
const RHR_NOREAD: (number | null)[] = [...RHR_BALANCED.slice(0, 30), null];
const SCORE_NOREAD: (number | null)[] = [...SCORE_BALANCED.slice(0, 30), null];

/** Calibrated baseline shared by suppressed / balanced / no-reading. */
const CALIBRATED_BASELINE = {
  windowDays: 30,
  restingHrAvg: 52.4,
  restingHrDays: 27,
  hrvAvg: 91.2,
  hrvStdDev: 12.6,
  hrvDays: 26,
  recoveryScoreAvg: 68.1,
  recoveryScoreDays: 27,
};

/** The suppressed headline fixture — today 74 ms, 1.37 SD below baseline. */
export const suppressed: RecoveryView = {
  restingToday: 51,
  recoveryScore: 58,
  hrvToday: 74,
  spark: [53, 52, 51, 51],
  days: zip(HRV_SUPPRESSED, RHR_SUPPRESSED, SCORE_SUPPRESSED),
  baseline: CALIBRATED_BASELINE,
  hrv: {
    status: "suppressed",
    balancedLow: 78.6,
    balancedHigh: 103.8,
    zScore: -1.37,
    trend: "falling",
    shortAvg: 82.3,
  },
};

/** The boring good day — today 94 ms, z ≈ +0.22, inside the band, steady. */
export const balanced: RecoveryView = {
  restingToday: 51,
  recoveryScore: 71,
  hrvToday: 94,
  spark: [52, 51, 51, 51],
  days: zip(HRV_BALANCED, RHR_BALANCED, SCORE_BALANCED),
  baseline: CALIBRATED_BASELINE,
  hrv: {
    status: "balanced",
    balancedLow: 78.6,
    balancedHigh: 103.8,
    zScore: 0.22,
    trend: "steady",
    shortAvg: 90.6,
  },
};

/** The new-user state — 9 nights in, nothing calibrated yet. */
export const calibrating: RecoveryView = {
  restingToday: 52,
  recoveryScore: 63,
  hrvToday: 85,
  spark: [51, 52, 51, 52],
  days: zip(HRV_CALIBRATING, RHR_CALIBRATING, SCORE_CALIBRATING),
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
};

/** The every-morning state — no reading yet today, baseline + trend intact. */
export const noReadingYet: RecoveryView = {
  restingToday: null,
  recoveryScore: null,
  hrvToday: null,
  spark: [52, 51, 51, 51],
  days: zip(HRV_NOREAD, RHR_NOREAD, SCORE_NOREAD),
  baseline: CALIBRATED_BASELINE,
  hrv: {
    // The band still exists; the trend through the week is still true. Only
    // today's point is missing — status reflects the last known week, not today.
    status: "balanced",
    balancedLow: 78.6,
    balancedHigh: 103.8,
    zScore: null,
    trend: "steady",
    shortAvg: 90.6,
  },
};

export type FixtureKey = "suppressed" | "balanced" | "calibrating" | "noReadingYet";

export const FIXTURES: Record<FixtureKey, { label: string; blurb: string; view: RecoveryView }> = {
  suppressed: {
    label: "Suppressed",
    blurb: "Today's HRV below the band, trend falling — the headline case.",
    view: suppressed,
  },
  balanced: {
    label: "Balanced",
    blurb: "An ordinary Tuesday — inside the band, steady. Most days look like this.",
    view: balanced,
  },
  calibrating: {
    label: "Calibrating",
    blurb: "A new Whoop user, 9 of 14 nights in. No baseline yet.",
    view: calibrating,
  },
  noReadingYet: {
    label: "No reading yet",
    blurb: "Before the morning webhook lands — baseline and trend still true.",
    view: noReadingYet,
  },
};

export const FIXTURE_ORDER: FixtureKey[] = [
  "suppressed",
  "balanced",
  "calibrating",
  "noReadingYet",
];
