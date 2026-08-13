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

/**
 * Weekday initials for the strip, in the same MONDAY-FIRST order as
 * /calendar's `WEEKDAYS`. Only the ORDERING is shared — that constant holds
 * "Mon", "Tue", … and there is no common array to import, so do not go hunting
 * for one. The initials repeat ("T", "S") and are display-only: never key by
 * them.
 */
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
 * YYYY-MM-DD for an instant, read in `timeZone`.
 *
 * THE ZONE IS AN ARGUMENT BECAUSE IT IS A DECISION. Google Calendar renders
 * its grid in the CALENDAR's zone, and the server now names that zone beside
 * the days it bucketed in it. A client that reaches for its own zone instead
 * prints a different clock than Google does for the same event — a reader in
 * Pacific whose calendar is set to Eastern saw a 4:45 PM flight as 1:45 PM,
 * and a 1:30 AM event land on the previous day.
 *
 * `en-CA` is not a locale choice, it is a format one: it is the locale whose
 * short date IS YYYY-MM-DD, so this needs no part-reassembly.
 */
export function zonedDateKey(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * A date key stepped by whole days.
 *
 * The arithmetic runs at UTC NOON, where no DST transition can reach it. A
 * spring-forward day is 23 hours long, so stepping a local midnight by
 * `+24h` lands on the same calendar date and a week's worth of columns
 * silently repeats a day. Noon is twelve hours from either edge.
 */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  at.setUTCDate(at.getUTCDate() + n);
  return at.toISOString().slice(0, 10);
}

/**
 * Days since Monday for a date key. Same Monday-first convention as
 * `mondayOffset`, over a key rather than a local Date.
 */
export function mondayOffsetOfKey(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay() + 6) % 7;
}

/**
 * YYYY-MM-DD for a Date in the BROWSER's local zone. Not toISOString().slice —
 * that is UTC, and would name the wrong day for most of the world for part of
 * every day.
 *
 * The browser's zone is the right answer for exactly one thing now: the zone
 * to GUESS with before the server has told us the calendar's. Anything reading
 * an event's clock or day wants `zonedDateKey` with the served zone.
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
 * The `end` ternary is the one that earns its keep: on Sunday "tomorrow" is
 * next Monday and falls OUTSIDE the current week, so a window of just the week
 * would render an empty Tomorrow slide one day in seven. The start needs no
 * such guard — `weekStart` is today minus a non-negative offset, so it is
 * always on or before today.
 */
export function requestWindow(now: Date, timeZone: string): { startDate: string; endDate: string } {
  const today = zonedDateKey(now, timeZone);
  const tomorrow = addDaysToKey(today, 1);
  const weekStart = addDaysToKey(today, -mondayOffsetOfKey(today));
  const weekEnd = addDaysToKey(weekStart, 6);
  // Both are YYYY-MM-DD, so lexicographic order IS chronological order.
  return { startDate: weekStart, endDate: weekEnd > tomorrow ? weekEnd : tomorrow };
}

/**
 * The window to ASK for: `requestWindow` plus a day either side.
 *
 * The calendar's zone is only learned FROM a response, so the first request of
 * a session is built on the browser's zone as a guess. When the two disagree
 * the guessed window can be a day — and on a Sunday night, a whole WEEK — off
 * from the one the tile ends up rendering, which would leave the Today slide
 * asking for a date the response never covered.
 *
 * One day of padding closes it completely: no two zones on earth disagree
 * about the current date by more than a day. The tile slices back down to
 * `requestWindow` before rendering, so the pad changes what is fetched and
 * nothing about what is shown.
 */
export function fetchWindow(now: Date, timeZone: string): { startDate: string; endDate: string } {
  const { startDate, endDate } = requestWindow(now, timeZone);
  return { startDate: addDaysToKey(startDate, -1), endDate: addDaysToKey(endDate, 1) };
}

/**
 * Whether an event is OVER.
 *
 * The windowing rule and the day slide's row styling are one judgement seen
 * from two sides — an event is upcoming until it has ENDED, because a meeting
 * you are currently in is the most relevant row on the tile, not a past one —
 * so the comparison lives here once and `isUpcoming` is its negation rather
 * than a second boundary written the other way round. A row that recomputed
 * `end <= now` inline would be free to drift to `start <= now` and grey out the
 * meeting the user is sitting in, while the window above still called it the
 * top row.
 */
export function hasEnded(e: CalendarEvent, now: Date): boolean {
  return new Date(e.end).getTime() <= now.getTime();
}

function isUpcoming(e: CalendarEvent, now: Date): boolean {
  return !hasEnded(e, now);
}

/**
 * Which rows of a day's events to show.
 *
 * All-day events pin to the top and spend row budget; the anchor/backfill rule
 * runs over the timed remainder. With `now` before every event the anchor is
 * index 0, so Tomorrow — which has no past — needs no special case.
 *
 * ASSUMES `events` ARRIVES SORTED: all-day first, then ascending by start. The
 * server guarantees that ordering and applies it BEFORE its per-day cap, so the
 * contiguous slice below clips exactly the tail the cap already clips. Nothing
 * here re-sorts on purpose — a client-side sort would duplicate a server rule
 * and quietly paper over a contract break instead of showing it.
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

/** The seven Monday-first columns for the week containing `now`, in `timeZone`. */
export function weekColumns(days: CalendarDay[], now: Date, timeZone: string): WeekColumn[] {
  const todayKey = zonedDateKey(now, timeZone);
  const weekStart = addDaysToKey(todayKey, -mondayOffsetOfKey(todayKey));
  const byDate = new Map(days.map((d) => [d.date, d]));

  return WEEKDAY_INITIALS.map((initial, i) => {
    const date = addDaysToKey(weekStart, i);
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

/**
 * The next event that HAS NOT STARTED yet, anywhere in `days`.
 *
 * Note the deliberate split from `isUpcoming` above, which this module also
 * calls "upcoming": there it means has not ENDED (a meeting in progress is
 * still the row worth showing), here it means has not STARTED (a meeting in
 * progress is not the one coming next). All-day events are excluded outright —
 * they have no start instant to be next at.
 */
export function nextUpcoming(days: CalendarDay[], now: Date): CalendarEvent | null {
  const candidates = days
    .flatMap((d) => d.events)
    .filter((e) => !e.all_day && new Date(e.start).getTime() > now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  return candidates[0] ?? null;
}

/**
 * A time in the browser's LOCALE, on the calendar's ZONE. The two are separate
 * choices and this function makes both explicitly: `undefined` locale is the
 * reader's own formatting habits (12- vs 24-hour), `timeZone` is the clock the
 * event is being read on, which belongs to the calendar and not to the reader.
 *
 * toLocaleTimeString, not a hand-rolled `h % 12` — that is precisely the
 * formatter that prints "0:00p" for noon.
 */
export function formatEventTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
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
