import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarDay, CalendarEvent } from "@/lib/api";
import {
  formatDayHeading,
  formatEventTime,
  localDateKey,
  nextUpcoming,
  requestWindow,
  stripHeights,
  visibleEvents,
  weekColumns,
} from "./shared";

/**
 * Pin a NON-UTC zone for this file. The local-vs-UTC assertions below are the
 * whole point of localDateKey and formatDayHeading, and on a UTC runner (which
 * is what CI is) local and UTC agree — so those tests would pass against the
 * very bugs they exist to catch. America/New_York is UTC-4 in August, so a
 * late-evening local instant lands on the NEXT UTC date. Every other test here
 * builds and compares local dates, so the pin does not change their meaning.
 */
const realTZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = "America/New_York";
});
afterAll(() => {
  process.env.TZ = realTZ;
});

/** A timed event at the given local hour on 2026-08-12. */
function ev(id: string, hour: number, minutes = 0): CalendarEvent {
  const start = new Date(2026, 7, 12, hour, minutes);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    id,
    title: `Event ${id}`,
    start: start.toISOString(),
    end: end.toISOString(),
    all_day: false,
    source: "google",
  };
}

function allDay(id: string): CalendarEvent {
  return {
    id,
    title: `All day ${id}`,
    start: new Date(2026, 7, 12, 0, 0).toISOString(),
    end: new Date(2026, 7, 13, 0, 0).toISOString(),
    all_day: true,
    source: "google",
  };
}

describe("visibleEvents", () => {
  it("anchors on the first upcoming event and reports both counts", () => {
    const events = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => ev(`e${h}`, h));
    const now = new Date(2026, 7, 12, 11, 30); // after the 11:00, before the 12:00
    const { visible, earlierCount, laterCount } = visibleEvents(events, now);

    expect(visible.map((e) => e.id)).toEqual(["e12", "e13", "e14", "e15", "e16"]);
    expect(earlierCount).toBe(6);
    expect(laterCount).toBe(0);
  });

  it("backfills when the day is over, reporting earlier with later zero", () => {
    const events = [6, 7, 8, 9, 10, 11, 12, 13].map((h) => ev(`e${h}`, h));
    const now = new Date(2026, 7, 12, 21, 0);
    const { visible, earlierCount, laterCount } = visibleEvents(events, now);

    expect(visible.map((e) => e.id)).toEqual(["e9", "e10", "e11", "e12", "e13"]);
    expect(earlierCount).toBe(3);
    expect(laterCount).toBe(0);
  });

  it("returns the first five when now is before everything — the Tomorrow case", () => {
    const events = [6, 7, 8, 9, 10, 11, 12].map((h) => ev(`e${h}`, h));
    const now = new Date(2026, 7, 11, 5, 0);
    const { visible, earlierCount, laterCount } = visibleEvents(events, now);

    expect(visible.map((e) => e.id)).toEqual(["e6", "e7", "e8", "e9", "e10"]);
    expect(earlierCount).toBe(0);
    expect(laterCount).toBe(2);
  });

  it("returns everything with both counts zero for a day of five or fewer", () => {
    const events = [8, 9, 12].map((h) => ev(`e${h}`, h));
    const { visible, earlierCount, laterCount } = visibleEvents(
      events,
      new Date(2026, 7, 12, 20, 0),
    );
    expect(visible).toHaveLength(3);
    expect(earlierCount).toBe(0);
    expect(laterCount).toBe(0);
  });

  it("counts an event in progress as upcoming, not a past one", () => {
    // FOUR events, not three, and deliberately so: with only [a, b, c] the
    // backfill step pulls "b" into frame under EITHER predicate, so the test
    // passes even when isUpcoming is reverted to `start > now`. The fourth
    // event gives the window somewhere to slide, which is what makes this
    // discriminating: end-based yields [b, c], start-based yields [c, d].
    const events = [ev("a", 9), ev("b", 11), ev("c", 13), ev("d", 15)];
    // 11:15 — "b" started at 11:00 and ends at 11:30.
    const { visible } = visibleEvents(events, new Date(2026, 7, 12, 11, 15), 2);
    expect(visible.map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("pins all-day events above the window and spends their row budget", () => {
    const events = [allDay("h"), ...[6, 7, 8, 9, 10, 11].map((h) => ev(`e${h}`, h))];
    const { visible, earlierCount } = visibleEvents(events, new Date(2026, 7, 12, 9, 30));
    expect(visible[0].id).toBe("h");
    expect(visible).toHaveLength(5);
    // One pin spends a row, so the timed budget is 4. At 09:30 the 09:00 event
    // has just ended, so the anchor is e10; backfill pulls e8 and e9 in front.
    expect(visible.slice(1).map((e) => e.id)).toEqual(["e8", "e9", "e10", "e11"]);
    expect(earlierCount).toBe(2);
  });
});

describe("stripHeights", () => {
  it("normalises against the busiest day", () => {
    expect(stripHeights([0, 1, 4, 2, 0, 0, 0])).toEqual([0, 0.25, 1, 0.5, 0, 0, 0]);
  });

  it("returns zeros, not NaN, for an all-zero week", () => {
    const heights = stripHeights([0, 0, 0, 0, 0, 0, 0]);
    expect(heights).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(heights.every((h) => Number.isFinite(h))).toBe(true);
  });
});

describe("localDateKey", () => {
  it("names the LOCAL day, not the UTC one", () => {
    // 23:30 local on the 12th is 03:30 UTC on the 13th in a UTC-4 zone, so
    // toISOString().slice(0, 10) — the tempting one-liner — answers "13".
    const lateEvening = new Date(2026, 7, 12, 23, 30);
    expect(lateEvening.toISOString().slice(0, 10)).toBe("2026-08-13");
    expect(localDateKey(lateEvening)).toBe("2026-08-12");
  });

  it("zero-pads single-digit months and days", () => {
    expect(localDateKey(new Date(2026, 0, 5, 12, 0))).toBe("2026-01-05");
  });
});

describe("requestWindow", () => {
  it("is the Monday-to-Sunday union with today and tomorrow", () => {
    // Wednesday 2026-08-12.
    expect(requestWindow(new Date(2026, 7, 12, 9, 0))).toEqual({
      startDate: "2026-08-10",
      endDate: "2026-08-16",
    });
  });

  it("extends to the FOLLOWING Monday on a Sunday", () => {
    // Sunday 2026-08-16 — "tomorrow" is next Monday, outside this week. A
    // window of just the week would render an empty Tomorrow slide one day in
    // seven.
    expect(requestWindow(new Date(2026, 7, 16, 9, 0))).toEqual({
      startDate: "2026-08-10",
      endDate: "2026-08-17",
    });
  });
});

describe("formatEventTime", () => {
  it("does not print 12:00p for noon", () => {
    const noon = new Date(2026, 7, 12, 12, 0).toISOString();
    const formatted = formatEventTime(noon);
    expect(formatted).not.toMatch(/^0[:.]/);
    expect(formatted).toMatch(/12/);
  });

  it("formats an afternoon time in the browser locale", () => {
    // Locale-agnostic on purpose: the production call passes `undefined` to
    // respect the browser, so a 12-hour locale prints "2:30 PM" and a 24-hour
    // one prints "14:30". Both are correct; asserting only the former fails
    // the suite under LC_ALL=en_GB.
    expect(formatEventTime(new Date(2026, 7, 12, 14, 30).toISOString())).toMatch(
      /(^|\D)(2|14)[:.]30/,
    );
  });
});

describe("formatDayHeading", () => {
  it("reads the date string as LOCAL, not as a UTC instant", () => {
    // new Date("2026-08-12") parses as UTC midnight, which is Aug 11 in a
    // UTC-4 zone — a heading a whole day wrong for half the planet.
    expect(new Date("2026-08-12").getDate()).toBe(11);
    const heading = formatDayHeading("2026-08-12");
    expect(heading).toMatch(/12/);
    expect(heading).not.toMatch(/11/);
  });
});

describe("weekColumns", () => {
  it("returns seven Monday-first columns with counts including truncation", () => {
    const days: CalendarDay[] = [
      { date: "2026-08-10", truncated: 0, events: [] },
      { date: "2026-08-11", truncated: 3, events: [ev("a", 9)] },
      {
        date: "2026-08-12",
        truncated: 0,
        events: [{ ...ev("b", 9), source: "prog_strength" }, ev("c", 10)],
      },
      { date: "2026-08-13", truncated: 0, events: [] },
      { date: "2026-08-14", truncated: 0, events: [] },
      { date: "2026-08-15", truncated: 0, events: [] },
      { date: "2026-08-16", truncated: 0, events: [] },
      { date: "2026-08-17", truncated: 0, events: [ev("d", 9)] },
    ];
    const cols = weekColumns(days, new Date(2026, 7, 16, 9, 0));
    expect(cols).toHaveLength(7);
    expect(cols[0].date).toBe("2026-08-10");
    expect(cols[6].date).toBe("2026-08-16");
    // The cap is never silent: the count is events.length + truncated.
    expect(cols[1].count).toBe(4);
    // Provenance drives the strip's accent mark: only Wednesday has one of ours.
    expect(cols.map((c) => c.hasOurs)).toEqual([false, false, true, false, false, false, false]);
    // `now` is Sunday the 16th — the LAST Monday-first column, not the first.
    expect(cols.map((c) => c.isToday)).toEqual([false, false, false, false, false, false, true]);
  });
});

describe("nextUpcoming", () => {
  it("finds the next event anywhere in the remaining week", () => {
    const days = [
      { date: "2026-08-12", truncated: 0, events: [ev("past", 8)] },
      { date: "2026-08-13", truncated: 0, events: [ev("next", 9)] },
    ];
    // ev() builds everything on 2026-08-12, so build the day-2 event by hand.
    const later = { ...ev("next", 9), start: new Date(2026, 7, 13, 9, 0).toISOString() };
    days[1].events = [later];
    expect(nextUpcoming(days, new Date(2026, 7, 12, 10, 0))?.id).toBe("next");
  });

  it("returns null when nothing is left", () => {
    const days = [{ date: "2026-08-12", truncated: 0, events: [ev("past", 8)] }];
    expect(nextUpcoming(days, new Date(2026, 7, 12, 23, 0))).toBeNull();
  });
});
