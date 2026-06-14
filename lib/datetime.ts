/**
 * Conversions between RFC3339 timestamps (what the API stores/returns) and
 * the value shape an `<input type="datetime-local">` control expects
 * (local-tz "YYYY-MM-DDTHH:MM"). Shared by the WorkoutModal edit form and
 * the live-workout review screen so the two never drift.
 */

/**
 * RFC3339 (UTC, e.g. "2026-05-17T14:30:00Z") → `<input type="datetime-local">`
 * value (local-tz "YYYY-MM-DDTHH:MM").
 *
 * The input control is implicitly local-tz, so we format using the
 * browser's local time. Going the other direction (localInputToRFC3339)
 * just lets `new Date()` parse the local string back into a Date and
 * serialize as ISO/UTC.
 */
export function rfc3339ToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function localInputToRFC3339(local: string): string {
  // `new Date("2026-05-17T14:30")` (no timezone) is interpreted as
  // local time. toISOString() then serializes as UTC, which is exactly
  // the RFC3339 shape the API expects.
  return new Date(local).toISOString();
}
