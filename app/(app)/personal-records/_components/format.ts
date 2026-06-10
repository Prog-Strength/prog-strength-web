/**
 * Small display helpers shared across the personal-records cards. Lifted
 * verbatim out of the original flat `page.tsx` so the Lifts and Running
 * cards can both reach them without each duplicating the logic.
 */

/** Weight + unit, one optional decimal, em-dash when either is null. */
export function formatWeight(value: number | null, unit: string | null): string {
  if (value === null || unit === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${unit}`;
}

/** "Mon D, YYYY" for an RFC3339 string; em-dash for null/empty. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
