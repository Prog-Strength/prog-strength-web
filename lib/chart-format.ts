/**
 * Formatting helpers shared by the activity charts (workout duration /
 * volume, running mileage / time, combined). Lifted out of
 * workout-duration-chart so all chart families render identical axes,
 * tooltips, and summary values.
 */

/** "0h" / "45m" / "2h" / "2h 30m" from a minute count. */
export function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** Y-axis tick for a minutes series: "0" / "45m" / "2h" / "1.5h". */
export function formatYTick(minutes: number): string {
  if (minutes <= 0) return "0";
  if (minutes >= 60) {
    const h = minutes / 60;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  return `${Math.round(minutes)}m`;
}

/** "May 12 – 18" / "May 26 – Jun 1" from a Monday date. */
export function formatWeekRangeFromMonday(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sameMonth = monday.getMonth() === sunday.getMonth();
  const monStr = monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const sunStr = sameMonth
    ? String(sunday.getDate())
    : sunday.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
  return `${monStr} – ${sunStr}`;
}
