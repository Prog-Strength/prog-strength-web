import type { WhoopRecoveryDay } from "@/lib/api";
import { recoveryBand, type RecoveryBand } from "@/lib/recovery";

/**
 * Static recovery fixtures for the recovery-page Design Exploration.
 *
 * Mirrors the representative fixture from dx/recovery-page.md: a 30-day window
 * ending Thu Jul 23 2026 with *no row for today yet* (the morning webhook
 * hasn't landed) — this is the whole reason the DX exists. It also seeds every
 * required visual state so each variant is exercised by the same data:
 *
 *   - No data yet today ....... no Jul 23 row → variants render the window value.
 *   - Each band ............... Jul 21 green (93), Jul 22 yellow (56), Jul 15 red (28).
 *   - Partial-null day ........ Jul 17 has a score but null HRV.
 *   - Missing days ............ no row at all for Jul 12 / Jul 8 / Jun 28.
 *   - Sparse 90d .............. RECOVERY_90D leaves the first ~two months empty.
 *   - Deep log ................ 26 rows in the 30d window → the ledger paginates.
 *
 * These are throwaway mockups: static values that read as a real month of Whoop
 * ingestion. Nothing here touches a live service. Window averages computed off
 * this data land at ~64 / 53 / 95 (score in the *yellow* band on purpose — the
 * fallback hero must prove the banding isn't always the happy color).
 */

export const TODAY_ISO = "2026-07-23"; // Thu — no row yet (webhook pending)

/** The 30-day window, newest first. Jul 23 (today) is intentionally absent. */
export const RECOVERY_30D: WhoopRecoveryDay[] = [
  { date: "2026-07-22", recovery_score: 56, resting_heart_rate: 56, hrv_rmssd_milli: 88 },
  { date: "2026-07-21", recovery_score: 93, resting_heart_rate: 50, hrv_rmssd_milli: 129 },
  { date: "2026-07-20", recovery_score: 89, resting_heart_rate: 46, hrv_rmssd_milli: 118 },
  { date: "2026-07-19", recovery_score: 71, resting_heart_rate: 51, hrv_rmssd_milli: 104 },
  { date: "2026-07-18", recovery_score: 58, resting_heart_rate: 54, hrv_rmssd_milli: 79 },
  { date: "2026-07-17", recovery_score: 62, resting_heart_rate: 55, hrv_rmssd_milli: null }, // null HRV
  { date: "2026-07-16", recovery_score: 55, resting_heart_rate: 57, hrv_rmssd_milli: 82 },
  { date: "2026-07-15", recovery_score: 28, resting_heart_rate: 61, hrv_rmssd_milli: 54 }, // red
  { date: "2026-07-14", recovery_score: 74, resting_heart_rate: 49, hrv_rmssd_milli: 110 },
  { date: "2026-07-13", recovery_score: 81, resting_heart_rate: 48, hrv_rmssd_milli: 121 },
  // Jul 12 — missing entirely (Whoop skipped the night)
  { date: "2026-07-11", recovery_score: 67, resting_heart_rate: 52, hrv_rmssd_milli: 99 },
  { date: "2026-07-10", recovery_score: 59, resting_heart_rate: 53, hrv_rmssd_milli: 90 },
  { date: "2026-07-09", recovery_score: 44, resting_heart_rate: 58, hrv_rmssd_milli: 71 },
  // Jul 8 — missing entirely
  { date: "2026-07-07", recovery_score: 85, resting_heart_rate: 47, hrv_rmssd_milli: 116 },
  { date: "2026-07-06", recovery_score: 52, resting_heart_rate: 55, hrv_rmssd_milli: 84 },
  { date: "2026-07-05", recovery_score: 63, resting_heart_rate: 52, hrv_rmssd_milli: 95 },
  { date: "2026-07-04", recovery_score: 77, resting_heart_rate: 49, hrv_rmssd_milli: 112 },
  { date: "2026-07-03", recovery_score: 39, resting_heart_rate: 60, hrv_rmssd_milli: 66 },
  { date: "2026-07-02", recovery_score: 66, resting_heart_rate: 51, hrv_rmssd_milli: 98 },
  { date: "2026-07-01", recovery_score: 70, resting_heart_rate: 50, hrv_rmssd_milli: 106 },
  { date: "2026-06-30", recovery_score: 72, resting_heart_rate: 50, hrv_rmssd_milli: 108 },
  { date: "2026-06-29", recovery_score: 49, resting_heart_rate: 57, hrv_rmssd_milli: 76 },
  // Jun 28 — missing entirely
  { date: "2026-06-27", recovery_score: 61, resting_heart_rate: 53, hrv_rmssd_milli: 94 },
  { date: "2026-06-26", recovery_score: 68, resting_heart_rate: 51, hrv_rmssd_milli: 101 },
  { date: "2026-06-25", recovery_score: 54, resting_heart_rate: 56, hrv_rmssd_milli: 83 },
  { date: "2026-06-24", recovery_score: 48, resting_heart_rate: 59, hrv_rmssd_milli: 75 },
];

/**
 * A 90-day range showing the sparse case: the same recent month of data with a
 * long empty lead-in (only ~one earlier cluster in mid-May), so lines start
 * late and averages are computed over what exists.
 */
export const RECOVERY_90D: WhoopRecoveryDay[] = [
  { date: "2026-05-14", recovery_score: 60, resting_heart_rate: 53, hrv_rmssd_milli: 92 },
  { date: "2026-05-15", recovery_score: 73, resting_heart_rate: 50, hrv_rmssd_milli: 107 },
  { date: "2026-05-16", recovery_score: 45, resting_heart_rate: 58, hrv_rmssd_milli: 72 },
  { date: "2026-05-17", recovery_score: 69, resting_heart_rate: 51, hrv_rmssd_milli: 100 },
  ...[...RECOVERY_30D].sort((a, b) => a.date.localeCompare(b.date)),
];

export type RangeKey = "7" | "30" | "90";

/** Ascending-by-date copy for charts (never mutates the fixture). */
export function ascending(rows: WhoopRecoveryDay[]): WhoopRecoveryDay[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

/** Descending-by-date copy for the log/ledger. */
export function descending(rows: WhoopRecoveryDay[]): WhoopRecoveryDay[] {
  return [...rows].sort((a, b) => b.date.localeCompare(a.date));
}

/** Mean of the non-null numbers, or null when there are none. */
export function mean(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export type WindowSummary = {
  score: number | null;
  scoreBand: RecoveryBand | null;
  restingHr: number | null;
  hrv: number | null;
  count: number;
};

/** Window averages + the score's band, used for the "no data yet" fallback. */
export function windowSummary(rows: WhoopRecoveryDay[]): WindowSummary {
  const score = mean(rows.map((r) => r.recovery_score));
  const restingHr = mean(rows.map((r) => r.resting_heart_rate));
  const hrv = mean(rows.map((r) => r.hrv_rmssd_milli));
  return {
    score: score === null ? null : Math.round(score),
    scoreBand: score === null ? null : recoveryBand(Math.round(score)),
    restingHr: restingHr === null ? null : Math.round(restingHr),
    hrv: hrv === null ? null : Math.round(hrv),
    count: rows.length,
  };
}

/** The most recent row (for variants that lead with "Yesterday · …"). */
export function mostRecent(rows: WhoopRecoveryDay[]): WhoopRecoveryDay | null {
  return descending(rows)[0] ?? null;
}

/** Human month/day, e.g. "Jul 22". Local-date parse (no UTC shift). */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Weekday · month · day, e.g. "Wed · Jul 22". */
export function weekdayDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** The three band CSS variables, for non-chart UI. */
export const BAND_VAR: Record<RecoveryBand, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

/** Band hex mirrors (recharts can't resolve CSS vars). Sync with globals.css. */
export const BAND_HEX: Record<RecoveryBand, string> = {
  success: "#86b39f",
  warning: "#d6b87f",
  danger: "#c79292",
};

/** Signed baseline delta for a value vs the window mean; null when either is null. */
export function baselineDelta(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null) return null;
  return value - baseline;
}
