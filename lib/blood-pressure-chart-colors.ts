/**
 * Chart SVG colors for the blood-pressure trend chart. Recharts writes
 * stroke/fill as SVG attributes where CSS var(--token) does not resolve, so
 * these literals MIRROR the current design-system tokens (app/globals.css /
 * design-system.md). Not a new palette — keep in sync with those tokens.
 *
 * Intentionally NOT sourced from bodyweight-chart-colors.ts, which still
 * carries the retired violet accent (pre-v0.4 re-tone).
 */
export const BP_CHART_COLORS = {
  systolic: "#9aa6d6", // --accent (periwinkle) — primary series
  diastolic: "#7d818c", // --muted — subordinate, neutral
  bandFill: "rgba(134, 179, 159, 0.10)", // --success at low alpha — healthy band
  reference: "#7d818c", // --muted, dashed — the 130 / 80 reference lines
  grid: "rgba(255, 255, 255, 0.06)", // --border hairline
  axis: "#7d818c", // --muted — axis ticks + text
  tooltipSurface: "#15171b", // --surface
  tooltipBorder: "rgba(255, 255, 255, 0.10)", // --border
} as const;
