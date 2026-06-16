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

/**
 * The planned-workout form models a session as a local date + start time +
 * duration rather than two full datetimes. These helpers convert between
 * that shape and the RFC3339 start/end the API stores.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** A Date → `<input type="date">` value, "YYYY-MM-DD" in local time. */
export function dateToDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** A Date → "HH:MM" (24h) in local time, for a time picker value. */
export function dateToTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Combine a local date ("YYYY-MM-DD"), start time ("HH:MM"), and a duration
 * in minutes into the RFC3339 start/end the API expects. The date+time are
 * parsed as local; end = start + duration.
 */
export function scheduleToRFC3339(
  date: string,
  time: string,
  durationMin: number,
): { start: string; end: string } {
  const start = new Date(`${date}T${time}`);
  const end = new Date(start.getTime() + durationMin * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Inverse of {@link scheduleToRFC3339}: split an RFC3339 start/end into the
 * form's local date + start time + duration (minutes). Duration is floored at
 * 15 minutes so a degenerate or inverted window still yields a usable value.
 */
export function rfc3339ToSchedule(
  startISO: string,
  endISO: string,
): { date: string; time: string; durationMin: number } {
  const start = new Date(startISO);
  const end = new Date(endISO);
  const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
  return { date: dateToDateValue(start), time: dateToTimeValue(start), durationMin };
}
