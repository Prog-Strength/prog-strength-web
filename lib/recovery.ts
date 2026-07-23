import type { WhoopRecoveryDay } from "./api";

/**
 * Recovery zone bands, mirroring Whoop's green/yellow/red convention so the
 * numbers agree with the user's Whoop app: success >= 67, warning 34..66,
 * danger <= 33.
 */
export type RecoveryBand = "success" | "warning" | "danger";

export function recoveryBand(score: number): RecoveryBand {
  if (score >= 67) return "success";
  if (score >= 34) return "warning";
  return "danger";
}

/** The CSS variable for a band's semantic status color (for non-recharts UI). */
export function recoveryBandColor(band: RecoveryBand): string {
  return `var(--${band})`;
}

/**
 * Shape fetched rows for the trend charts: ascending by date, with null metrics
 * left null so recharts renders them as gaps (never zeros). Non-mutating.
 */
export function toChartRows(rows: WhoopRecoveryDay[]): WhoopRecoveryDay[] {
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Today's recovery row, or null when there is none for `today`. Yesterday's row
 * is never promoted — an absent morning webhook must read as "no data yet
 * today", not as stale readiness. `today` is a local YYYY-MM-DD date.
 */
export function latestForToday(rows: WhoopRecoveryDay[], today: string): WhoopRecoveryDay | null {
  return rows.find((r) => r.date === today) ?? null;
}
