/**
 * Pure logic for the calendar tile: the request window, the row-windowing
 * rule, week-strip normalisation, and time formatting. No React, so every rule
 * below is directly testable — this module is separated for the reason
 * `recovery/hrv-chart.ts` was.
 *
 * THE WINDOWING RULE IS THE POINT OF THIS FILE. A naive slice(0, 5) is
 * chronological and wrong after lunch: at 6pm it fills the tile with things
 * the user has already done and buries the one event they can still act on.
 * Anchoring on the first UPCOMING event keeps the tile about the rest of the
 * day, and backfilling means a 9pm view is not blank. Everything clipped is
 * REPORTED — a tile that silently drops half a day reads as an empty
 * afternoon.
 */
import type { CalendarDay, CalendarEvent } from "@/lib/api";

/** How many rows a day slide shows. */
export const DAY_ROW_LIMIT = 5;

/** Monday-first weekday initials, matching /calendar's WEEKDAYS constant. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;

/** Full weekday names, for the strip's composed accessible label. */
export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/**
 * YYYY-MM-DD for a Date in the BROWSER's local zone. Not toISOString().slice —
 * that is UTC, and would name the wrong day for most of the world for part of
 * every day.
 */
export function localDateKey(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Midnight local on the given date. */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Days since Monday. `(getDay() + 6) % 7` converts JS's Sunday-first weekday
 * to Monday-first — the same math /calendar's buildMonthGrid uses. A tile
 * whose week starts on Sunday sitting one click away from a month grid that
 * starts on Monday is drift that is invisible in review and jarring in use.
 */
export function mondayOffset(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * The one window that feeds all three slides and the panel.
 *
 * The max() matters on Sunday, when "tomorrow" is next Monday and falls
 * OUTSIDE the current week — a window of just the week would render an empty
 * Tomorrow slide one day in seven.
 */
export function requestWindow(now: Date): { startDate: string; endDate: string } {
  const today = startOfLocalDay(now);
  const tomorrow = addDays(today, 1);
  const weekStart = addDays(today, -mondayOffset(today));
  const weekEnd = addDays(weekStart, 6);
  const start = weekStart < today ? weekStart : today;
  const end = weekEnd > tomorrow ? weekEnd : tomorrow;
  return { startDate: localDateKey(start), endDate: localDateKey(end) };
}

/**
 * An event is upcoming until it has ENDED — a meeting you are currently in
 * is the most relevant row on the tile, not a past one.
 */
function isUpcoming(e: CalendarEvent, now: Date): boolean {
  return new Date(e.end).getTime() > now.getTime();
}

/**
 * Which rows of a day's events to show.
 *
 * All-day events pin to the top and spend row budget; the anchor/backfill rule
 * runs over the timed remainder. With `now` before every event the anchor is
 * index 0, so Tomorrow — which has no past — needs no special case.
 */
export function visibleEvents(
  events: CalendarEvent[],
  now: Date,
  limit: number = DAY_ROW_LIMIT,
): { visible: CalendarEvent[]; earlierCount: number; laterCount: number } {
  const pinned = events.filter((e) => e.all_day);
  const timed = events.filter((e) => !e.all_day);

  const shownPins = pinned.slice(0, limit);
  let laterCount = pinned.length - shownPins.length;
  const budget = limit - shownPins.length;
  if (budget <= 0) {
    return { visible: shownPins, earlierCount: 0, laterCount: laterCount + timed.length };
  }

  const anchor = timed.findIndex((e) => isUpcoming(e, now));
  let end = anchor === -1 ? timed.length : Math.min(timed.length, anchor + budget);
  const start = Math.max(0, end - budget);
  end = Math.min(timed.length, start + budget);

  laterCount += timed.length - end;
  return {
    visible: [...shownPins, ...timed.slice(start, end)],
    earlierCount: start,
    laterCount,
  };
}

/**
 * Bar heights (0..1), normalised against the week's busiest day rather than a
 * fixed ceiling. The strip answers "which days are heavy RELATIVE to my week" —
 * an absolute scale makes an ordinary week look empty and a conference week
 * look identical to a normal one.
 *
 * An all-zero week yields all-zero heights, not NaN. This is the guard the
 * division needs and it is a real state, not a defensive flourish: it is
 * exactly what a new user's first Sunday looks like.
 */
export function stripHeights(counts: number[]): number[] {
  const max = counts.reduce((a, b) => (b > a ? b : a), 0);
  if (max <= 0) return counts.map(() => 0);
  return counts.map((c) => c / max);
}

/** One column of the week strip. */
export type WeekColumn = {
  date: string;
  initial: string;
  name: string;
  /** events.length + truncated — the cap is never silent. */
  count: number;
  /** Whether the day carries a Prog Strength-authored event. */
  hasOurs: boolean;
  isToday: boolean;
};

/** The seven Monday-first columns for the week containing `now`. */
export function weekColumns(days: CalendarDay[], now: Date): WeekColumn[] {
  const today = startOfLocalDay(now);
  const weekStart = addDays(today, -mondayOffset(today));
  const todayKey = localDateKey(today);
  const byDate = new Map(days.map((d) => [d.date, d]));

  return WEEKDAY_INITIALS.map((initial, i) => {
    const date = localDateKey(addDays(weekStart, i));
    const day = byDate.get(date);
    return {
      date,
      initial,
      name: WEEKDAY_NAMES[i],
      count: (day?.events.length ?? 0) + (day?.truncated ?? 0),
      hasOurs: (day?.events ?? []).some((e) => e.source === "prog_strength"),
      isToday: date === todayKey,
    };
  });
}

/** The next event that has not started yet, anywhere in `days`. */
export function nextUpcoming(days: CalendarDay[], now: Date): CalendarEvent | null {
  const candidates = days
    .flatMap((d) => d.events)
    .filter((e) => !e.all_day && new Date(e.start).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return candidates[0] ?? null;
}

/**
 * A time in the browser's locale. toLocaleTimeString, not a hand-rolled
 * `h % 12` — that is precisely the formatter that prints "0:00p" for noon.
 */
export function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/** "Wed Aug 12" — the day slide's header date. */
export function formatDayHeading(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** The composed accessible label for the density strip. */
export function stripLabel(columns: WeekColumn[]): string {
  return columns
    .map((c) => `${c.name} ${c.count} ${c.count === 1 ? "event" : "events"}`)
    .join(", ");
}
