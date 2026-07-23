/**
 * Chart palette for the activities charts (overview, trend, and steps).
 * recharts renders SVG presentation attributes, which can't resolve
 * `var(--token)`, so these hex values are hardcoded here to MIRROR the
 * design-system tokens (oura-calm-minimal). Keep them in sync with
 * app/globals.css.
 */
export const CHART_LIFT_LINE = "#9aa6d6"; // --accent / --discipline-lift
export const CHART_RUN_LINE = "#7fae9e"; // --accent-2 / --discipline-run
export const CHART_AXIS = "#565a63"; // --faint
export const CHART_GRID = "rgba(255, 255, 255, 0.06)"; // --border (hairline)
export const CHART_TOOLTIP_BG = "#15171b"; // --surface
export const CHART_TOOLTIP_BORDER = "rgba(255, 255, 255, 0.1)"; // --border-strong
export const CHART_TOOLTIP_RADIUS = "0.875rem"; // --radius-card (14px)
export const CHART_CURSOR = "#565a63"; // --faint
export const CHART_STEPS_MET = "#86b39f"; // --success (day met/over goal)
export const CHART_STEPS_UNDER = "#5b6168"; // muted neutral, intentionally not a token (day under goal)

// --- Recovery (Whoop) page ---------------------------------------------
// The three metric lines are the calm neutral --foreground: meaning comes from
// the score chart's band zones and the RHR/HRV average reference lines, not a
// per-series hue (the accent stays interactive-only; status colors are
// semantic). The band fills mirror --success/--warning/--danger, drawn
// translucent by ReferenceArea (see RECOVERY_BAND_FILL_OPACITY).
export const CHART_RECOVERY_SCORE = "#c8cad0"; // --foreground (score line, over color bands)
export const CHART_RECOVERY_RHR = "#c8cad0"; // --foreground (resting-HR line)
export const CHART_RECOVERY_HRV = "#c8cad0"; // --foreground (HRV line)
export const CHART_RECOVERY_BAND_SUCCESS = "#86b39f"; // --success (score >= 67)
export const CHART_RECOVERY_BAND_WARNING = "#d6b87f"; // --warning (score 34-66)
export const CHART_RECOVERY_BAND_DANGER = "#c79292"; // --danger (score <= 33)
export const RECOVERY_BAND_FILL_OPACITY = 0.1; // translucent zone fill
export const CHART_RECOVERY_AVG = "#565a63"; // --faint (dashed average reference line)
