/**
 * Format a numeric value for display: at most one decimal place, no
 * trailing zero on integers, em-dash for non-finite. Used by the
 * Nutrition log subtotals, pantry/recipe rows, and the recipe form's
 * macro preview tiles.
 */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
