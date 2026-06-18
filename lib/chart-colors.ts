/**
 * Chart palette for the activities trend charts. recharts renders SVG
 * presentation attributes, which can't resolve `var(--token)`, so these
 * hex values are hardcoded here to MIRROR the design-system tokens
 * (oura-calm-minimal). Keep them in sync with app/globals.css.
 */
export const CHART_LIFT_LINE = "#9aa6d6"; // --accent / --discipline-lift
export const CHART_RUN_LINE = "#7fae9e"; // --accent-2 / --discipline-run
export const CHART_AXIS = "#565a63"; // --faint
export const CHART_GRID = "rgba(255, 255, 255, 0.06)"; // hairline
export const CHART_TOOLTIP_BG = "#15171b"; // --surface
export const CHART_TOOLTIP_BORDER = "rgba(255, 255, 255, 0.1)"; // --border-strong
export const CHART_TOOLTIP_RADIUS = "0.875rem"; // --radius-card (14px)
export const CHART_CURSOR = "#565a63"; // --faint
