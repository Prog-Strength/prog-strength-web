/**
 * The calendar tile's states, as wire payloads. Each is paired with the `now`
 * it is meant to be read at, because half of them are only distinguishable by
 * where the clock sits inside the day: `busyDay` and `lateEvening` differ in
 * nothing a payload can express — only in whether the day is half spent.
 *
 * EVERY INSTANT IS BUILT FROM LOCAL CALENDAR PARTS and then serialised with
 * `toISOString()`, never from a literal `Z` string and never from `Date.now()`.
 * That is what makes these fixtures zone-independent: the UTC text in `start`
 * and `end` moves with the ambient zone, but the LOCAL time each event renders
 * at, and the local date it is grouped under, do not. A hand-written
 * `"2026-08-12T17:30:00Z"` would be a 5:30pm workout in UTC and a 1:30pm one in
 * New York, and the same fixture would then describe two different days.
 *
 * The window each fixture carries is DENSE and matches `requestWindow(now)`
 * exactly, as the server's contract promises — one entry per date, `events: []`
 * for a free day — so a component reading these cannot accidentally be written
 * against a sparser payload than it will get.
 *
 * Test-only; never imported by production code.
 */

import type {
  CalendarDay,
  CalendarEvent,
  CalendarEventsResponse,
  CalendarEventsStatus,
} from "@/lib/api";
import { addDays, localDateKey, mondayOffset, requestWindow, startOfLocalDay } from "./shared";

/** A state, and the clock it is meant to be rendered at. */
export type CalendarFixture = { now: Date; response: CalendarEventsResponse };

/**
 * The weekday fixtures' "today" — Wednesday 12 August 2026. A midweek day so
 * the Monday-first strip has columns on both sides of today, and a Wednesday
 * specifically so `requestWindow`'s Sunday branch is exercised only by
 * `sunday()`, which is what that branch is about.
 */
export const CALENDAR_FIXTURE_TODAY = "2026-08-12";

/**
 * The planned workout `defaultDay` marks as ours. Exported so a test asserting
 * the deep link's href states the id once rather than copying it out of this
 * file and going stale.
 */
export const PLANNED_WORKOUT_ID = "pw_1042";

/** Wednesday 2026-08-12, at a local wall-clock time. */
function anchor(hour: number, minute = 0): Date {
  return new Date(2026, 7, 12, hour, minute);
}

/** Sunday 2026-08-16, at a local wall-clock time. */
function sundayAnchor(hour: number, minute = 0): Date {
  return new Date(2026, 7, 16, hour, minute);
}

/** "HH:MM" on `day`, in the browser's own zone, as the wire's UTC instant. */
function at(day: Date, time: string): string {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute).toISOString();
}

function timed(
  day: Date,
  from: string,
  to: string,
  id: string,
  title: string,
  extra: Partial<Pick<CalendarEvent, "source" | "link">> = {},
): CalendarEvent {
  return {
    id,
    title,
    start: at(day, from),
    end: at(day, to),
    all_day: false,
    source: "google",
    ...extra,
  };
}

/** A Prog Strength-authored event: our provenance mark plus its deep link. */
function ours(
  day: Date,
  from: string,
  to: string,
  id: string,
  title: string,
  plannedId: string,
): CalendarEvent {
  return timed(day, from, to, id, title, {
    source: "prog_strength",
    link: { kind: "planned_workout", id: plannedId },
  });
}

/**
 * An all-day marker. Its bounds are the LOCAL day's midnights expressed in UTC,
 * which is what the API states all-day events carry — not a bare date.
 */
function allDay(day: Date, id: string, title: string): CalendarEvent {
  return {
    id,
    title,
    start: at(day, "0:00"),
    end: new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString(),
    all_day: true,
    source: "google",
  };
}

/** One date's entry in the map `denseWindow` reads. */
function on(day: Date, events: CalendarEvent[]): [string, CalendarEvent[]] {
  return [localDateKey(day), events];
}

/**
 * The dense day list for `requestWindow(now)` — Monday through the later of the
 * week's end and tomorrow — filling in an empty day wherever the caller named
 * none. Driven by `requestWindow` itself rather than by a hard-coded length, so
 * a fixture's window is the window the tile will actually ask for, including on
 * the Sunday where it is eight days rather than seven.
 */
function denseWindow(now: Date, events: Map<string, CalendarEvent[]> = new Map()): CalendarDay[] {
  const today = startOfLocalDay(now);
  const { endDate } = requestWindow(now, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const days: CalendarDay[] = [];
  for (
    let d = addDays(today, -mondayOffset(today));
    localDateKey(d) <= endDate;
    d = addDays(d, 1)
  ) {
    const date = localDateKey(d);
    days.push({ date, truncated: 0, events: events.get(date) ?? [] });
  }
  return days;
}

function ok(now: Date, events: Map<string, CalendarEvent[]> = new Map()): CalendarFixture {
  return { now, response: { status: "ok", days: denseWindow(now, events) } };
}

/**
 * **default** — a mixed Wednesday morning, and the state the tile is judged
 * calm on. One all-day marker, two meetings, and this evening's planned workout
 * carrying the accent dot and its deep link. Four rows of a five-row budget, so
 * neither overflow line renders: nothing is clipped and nothing is claimed to
 * be.
 */
export function defaultDay(): CalendarFixture {
  const now = anchor(9, 0);
  const today = startOfLocalDay(now);
  const mon = addDays(today, -2);
  const tue = addDays(today, -1);
  const thu = addDays(today, 1);
  const fri = addDays(today, 2);
  return ok(
    now,
    new Map([
      on(mon, [timed(mon, "09:00", "09:30", "mon-standup", "Standup")]),
      on(tue, [
        timed(tue, "09:00", "09:30", "tue-standup", "Standup"),
        ours(tue, "17:30", "18:30", "tue-plan", "Lower Body Pull", "pw_1039"),
      ]),
      on(today, [
        allDay(today, "wed-birthday", "Ada's birthday"),
        timed(today, "10:00", "10:30", "wed-standup", "Standup"),
        timed(today, "12:30", "13:15", "wed-lunch", "Lunch with Dana"),
        ours(today, "17:30", "18:30", "wed-plan", "Upper Body Push", PLANNED_WORKOUT_ID),
      ]),
      on(thu, [
        timed(thu, "08:00", "08:45", "thu-physio", "Physio"),
        timed(thu, "15:00", "15:30", "thu-one-to-one", "1:1 with Sam"),
      ]),
      on(fri, [ours(fri, "07:00", "08:00", "fri-plan", "Intervals", "pw_1051")]),
    ]),
  );
}

/**
 * **empty-day** — today is free. The rest of the week is not, so the strip
 * still has something to draw and the empty day reads as *this day*, not as a
 * broken tile. Today's slide says "Nothing scheduled." and stops there.
 */
export function emptyDay(): CalendarFixture {
  const now = anchor(9, 0);
  const today = startOfLocalDay(now);
  const mon = addDays(today, -2);
  const tue = addDays(today, -1);
  const thu = addDays(today, 1);
  return ok(
    now,
    new Map([
      on(mon, [timed(mon, "09:00", "09:30", "mon-standup", "Standup")]),
      on(tue, [
        timed(tue, "09:00", "09:30", "tue-standup", "Standup"),
        ours(tue, "17:30", "18:30", "tue-plan", "Lower Body Pull", "pw_1039"),
      ]),
      on(thu, [timed(thu, "15:00", "15:30", "thu-one-to-one", "1:1 with Sam")]),
    ]),
  );
}

/**
 * **busy-day** — eleven events at 2pm, six of them already over.
 *
 * The seventh is deliberately IN PROGRESS (13:45–14:30, over `now`): the
 * windowing rule anchors on the first event that has not ENDED, so this event
 * is the anchor and the tile's top row. An implementation that anchored on
 * `start` instead would push the meeting the user is sitting in into the
 * `+N earlier` bucket at exactly the moment it matters most, and this fixture
 * is what makes that visible. Six earlier, five shown, none later — so
 * "+6 earlier" renders and no zero-valued "+0 more" line does.
 */
export function busyDay(): CalendarFixture {
  const now = anchor(14, 0);
  const today = startOfLocalDay(now);
  return ok(
    now,
    new Map([
      on(today, [
        timed(today, "07:00", "07:30", "busy-1", "Overnight build triage"),
        timed(today, "08:00", "08:30", "busy-2", "Standup"),
        timed(today, "08:45", "09:15", "busy-3", "Design review"),
        timed(today, "09:30", "10:00", "busy-4", "Sprint planning"),
        timed(today, "10:30", "11:00", "busy-5", "1:1 with Sam"),
        timed(today, "11:30", "12:15", "busy-6", "Lunch with Dana"),
        timed(today, "13:45", "14:30", "busy-7", "Roadmap sync"),
        timed(today, "15:00", "15:30", "busy-8", "Vendor call"),
        timed(today, "15:45", "16:15", "busy-9", "Hiring debrief"),
        timed(today, "16:30", "17:00", "busy-10", "Retro"),
        ours(today, "17:30", "18:30", "busy-11", "Upper Body Push", PLANNED_WORKOUT_ID),
      ]),
    ]),
  );
}

/**
 * **late-evening** — 9:30pm, and every one of today's eight events is over.
 *
 * There is no anchor to find, so the window falls back to the LAST five rows
 * rather than going blank: a 9pm tile that says nothing happened today is worse
 * than one that shows the evening it just had. Three earlier, none later, and
 * every visible row is muted because every visible row has ended.
 */
export function lateEvening(): CalendarFixture {
  const now = anchor(21, 30);
  const today = startOfLocalDay(now);
  return ok(
    now,
    new Map([
      on(today, [
        timed(today, "07:00", "07:30", "late-1", "Overnight build triage"),
        timed(today, "08:00", "08:30", "late-2", "Standup"),
        timed(today, "09:00", "09:45", "late-3", "Design review"),
        timed(today, "11:00", "11:30", "late-4", "1:1 with Sam"),
        timed(today, "12:30", "13:15", "late-5", "Lunch with Dana"),
        timed(today, "14:00", "15:00", "late-6", "Roadmap sync"),
        timed(today, "16:00", "16:30", "late-7", "Retro"),
        ours(today, "17:30", "18:30", "late-8", "Upper Body Push", PLANNED_WORKOUT_ID),
      ]),
    ]),
  );
}

/**
 * **sunday** — the union window's edge case, one day in seven.
 *
 * On a Sunday "tomorrow" is next Monday, which falls OUTSIDE the current week,
 * so the window runs Monday 10th through Monday 17th — eight days, not seven —
 * and the Tomorrow slide is populated from a date the week strip never shows.
 * A tile whose window was merely "this week" would render an empty Tomorrow
 * every Sunday, which is the day people most often look at it.
 */
export function sunday(): CalendarFixture {
  const now = sundayAnchor(10, 0);
  const today = startOfLocalDay(now);
  const mon = addDays(today, -6);
  const wed = addDays(today, -4);
  const fri = addDays(today, -2);
  const nextMon = addDays(today, 1);
  return ok(
    now,
    new Map([
      on(mon, [timed(mon, "09:00", "09:30", "sun-mon-standup", "Standup")]),
      on(wed, [
        timed(wed, "12:30", "13:15", "sun-wed-lunch", "Lunch with Dana"),
        ours(wed, "17:30", "18:30", "sun-wed-plan", "Upper Body Push", PLANNED_WORKOUT_ID),
      ]),
      on(fri, [timed(fri, "15:00", "15:30", "sun-fri-one-to-one", "1:1 with Sam")]),
      on(today, [
        ours(today, "08:00", "09:30", "sun-long-run", "Long run", "pw_1058"),
        timed(today, "16:00", "17:00", "sun-dinner", "Dinner with the Hallidays"),
      ]),
      on(nextMon, [
        timed(nextMon, "09:00", "09:30", "sun-next-standup", "Standup"),
        timed(nextMon, "12:00", "13:00", "sun-next-lunch", "Team lunch"),
        ours(nextMon, "18:00", "19:00", "sun-next-plan", "Lower Body Pull", "pw_1061"),
      ]),
    ]),
  );
}

/**
 * **all-day-only** — a public holiday and nothing else. One pinned row with no
 * time column, and a strip that counts the day as one event: an all-day marker
 * is an event, and a strip that ignored it would show a blank Wednesday on a
 * day the user is away.
 */
export function allDayOnly(): CalendarFixture {
  const now = anchor(9, 0);
  const today = startOfLocalDay(now);
  return ok(now, new Map([on(today, [allDay(today, "holiday", "Public holiday")])]));
}

/**
 * **empty-week** — every day zero, which is a real state (a new user's first
 * Sunday) and not a failure. The strip still draws seven columns, at a hairline
 * each, and the caption reads "Nothing left this week." rather than going
 * blank.
 */
export function emptyWeek(): CalendarFixture {
  return ok(anchor(9, 0));
}

/**
 * A degradation: the status alone, with no `days` at all — which is what the
 * server sends for every one of these, and therefore the shape the tile has to
 * survive. Paired with the same weekday `now` as the rest, so a test can set
 * one clock for every fixture it drives.
 */
export function degraded(status: Exclude<CalendarEventsStatus, "ok">): CalendarFixture {
  return { now: anchor(9, 0), response: { status } };
}
