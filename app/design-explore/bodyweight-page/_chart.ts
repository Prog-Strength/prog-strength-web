/**
 * Shared chart color literals for the bodyweight DX.
 *
 * Recharts writes stroke/fill as SVG attributes, where CSS `var(--token)`
 * does NOT resolve — so the design-system tokens are mirrored here as literal
 * hex/rgba. These are the SAME values as globals.css (violet accent + slate
 * ramp); they are not a new palette. Per the ticket's palette-reconcile note,
 * the violet accent owns the trend (the page's subject), raw readings drop to
 * a muted slate, and the goal gets a quiet neutral marker — the legacy blue
 * (#3b82f6) / amber / green chart colors are retired.
 */

export const ACCENT = "#8b7cf6"; // --accent (violet) — owns the trend
export const ACCENT_DARK = "#7765ec"; // --accent-dark
export const ACCENT_BAND = "rgba(139,124,246,0.16)"; // spread band fill
export const ACCENT_SOFT = "rgba(139,124,246,0.30)"; // --accent-line

export const RAW_DOT = "#6b7280"; // --faint slate — demoted raw readings
export const RAW_DOT_SOFT = "rgba(154,161,173,0.45)"; // muted, low-contrast

export const GOAL_LINE = "#9aa1ad"; // --muted slate — quiet goal marker
export const GRID = "rgba(255,255,255,0.06)";
export const AXIS = "#6b7280"; // --faint
export const AXIS_TEXT = "#9aa1ad"; // --muted

export const TOOLTIP_STYLE = {
  backgroundColor: "#1e2128", // --surface
  border: "1px solid rgba(255,255,255,0.10)", // --border-strong
  borderRadius: "0.75rem",
  padding: "8px 12px",
  fontSize: "12px",
  color: "#eef0f4",
} as const;
