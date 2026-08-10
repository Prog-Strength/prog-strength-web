/**
 * Test fixtures for the recovery tile family — the four states the DX
 * enumerated (suppressed / balanced / calibrating / no-reading-yet), each with
 * a full 31-day date-aligned window and an interior all-null day (2026-07-29,
 * index 27) so the gap contract is exercised by default. Values mirror the
 * DX's headline fixture: baseline 91.2 ± 12.6 ms, band 78.6–103.8. Test-only;
 * never imported by production code.
 */

import type { RecoveryBaselineView, RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";

/** The fixture "today" — the last of the 31 window dates. */
export const FIXTURE_TODAY = "2026-08-01";

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

function isoDate(offset: number): string {
  const d = new Date(2026, 6, 2 + offset); // 2026-07-02 + offset, local
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Build the 31-day window from an HRV series; a null HRV ⇒ a fully-null day.
 * The interior days' band fields are deliberately left null / "unknown": a
 * day's own trailing band cannot be known without recomputing it, so inventing
 * one would be fixture fiction. The calibrated views below overwrite the LAST
 * day with figures that agree with their `hrv` block, mirroring the server,
 * where the scalar and series bands come from the same helpers.
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
  };
}

/** A legacy payload with no derived blocks — exercises the top-of-card guard. */
export function legacyView(): RecoveryView {
  return { restingToday: 51, recoveryScore: 58, spark: [53, 52, 51] };
}
