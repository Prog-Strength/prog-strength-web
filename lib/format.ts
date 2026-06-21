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

/**
 * Format an elapsed duration given in seconds as a clock string:
 * `m:ss` under an hour, `h:mm:ss` at or above one hour. Seconds (and
 * minutes, in the hour case) are zero-padded to two digits so a column
 * of run durations stays aligned. Non-finite or negative input yields
 * an em-dash. Used by the Running UI for run durations.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Format a 0..1 fraction as a whole-number percent, em-dash for
 * non-finite. Used by the running heart-rate-zones widget for each
 * zone's time-in-zone share.
 */
export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${Math.round(fraction * 100)}%`;
}
