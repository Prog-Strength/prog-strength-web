/**
 * Chart SVG colors for the bodyweight trend chart.
 *
 * Recharts writes stroke/fill as SVG attributes, where CSS `var(--token)`
 * does NOT resolve — so these literals MIRROR the design-system tokens in
 * `app/globals.css` / `prog-strength-docs/design-system.md`. They are not a
 * new palette: keep them in sync with those tokens. They exist only because
 * SVG attributes can't read CSS variables.
 */
export const CHART_COLORS = {
  trend: "#8b7cf6", // --accent (violet) — the EWMA trend line, the subject
  bandTop: "rgba(139, 124, 246, 0.22)", // accent fill, gradient top
  bandBottom: "rgba(139, 124, 246, 0.04)", // accent fill, gradient bottom
  bandLegend: "rgba(139, 124, 246, 0.18)", // flat swatch for the legend
  rawDot: "#6b7280", // --faint slate — demoted raw readings
  goal: "#9aa1ad", // --muted slate — quiet dashed goal marker
  grid: "rgba(255, 255, 255, 0.06)", // hairline cartesian grid
  axis: "#9aa1ad", // --muted — axis ticks + text
  tooltipSurface: "#1e2128", // --surface — tooltip background
  tooltipBorder: "rgba(255, 255, 255, 0.1)", // --border-strong — tooltip border
} as const;
