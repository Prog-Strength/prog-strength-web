/**
 * Shared formatting helpers and palette for the Progress page components.
 * Lifted out of the prior monolithic page.tsx unchanged so the chart,
 * tables, and tooltip all speak the same number language.
 */

// Distinct palette for exercise series. Eight colors covers every
// realistic movement pattern (which usually has a handful of tracked
// exercises) with room to spare. Chosen to be visually distinct on a dark
// background and to avoid clashing with the app's blue accent.
export const EXERCISE_COLORS = [
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#10b981", // emerald-500
  "#ec4899", // pink-500
  "#8b5cf6", // violet-500
  "#ef4444", // red-500
  "#06b6d4", // cyan-500
  "#84cc16", // lime-500
];

// Fallback series color and the reference line's neutral gray. The
// reference line at y=1.0 reads as "baseline anchor" rather than another
// data series.
export const COLOR_DEFAULT = "#3b82f6";
export const COLOR_REFERENCE = "#71717a";

export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Title-case a lowercase muscle-group slug for the "Showing:" caption. */
export function titleCase(s: string): string {
  return s
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
