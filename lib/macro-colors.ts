/**
 * Single source of truth for the macro palette. The rings chart, the
 * log view's meal totals + column headers, and the pantry / recipe
 * catalog item lines all import from here so a one-line tweak retints
 * every surface uniformly.
 *
 * Colors mirror Tailwind's pastel-300 ramp so the values read well
 * against both surface tones used on the nutrition page.
 *
 * Calories has no ring color: it renders in the page foreground in the
 * rings chart, and column headers / labels for calories stay muted in
 * the catalog and log views. Don't add a calorie color here without a
 * design review — it's a deliberate non-allocation.
 */
export const MACRO_COLORS = {
  protein: "#6ee7b7", // emerald-300
  carbs: "#fcd34d", // amber-300
  fat: "#f9a8d4", // pink-300
} as const;
