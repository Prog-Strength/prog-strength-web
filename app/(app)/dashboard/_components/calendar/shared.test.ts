import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/lib/api";
import {
  formatEventTime,
  nextUpcoming,
  requestWindow,
  stripHeights,
  visibleEvents,
  weekColumns,
} from "./shared";

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

  it("counts an event in progress as upcoming", () => {
    const events = [ev("a", 9), ev("b", 11), ev("c", 13)];
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
    expect(formatEventTime(new Date(2026, 7, 12, 14, 30).toISOString())).toMatch(/2[:.]30/);
  });
});

describe("weekColumns", () => {
  it("returns seven Monday-first columns with counts including truncation", () => {
    const days = [
      { date: "2026-08-10", truncated: 0, events: [] },
      { date: "2026-08-11", truncated: 3, events: [ev("a", 9)] },
      { date: "2026-08-12", truncated: 0, events: [ev("b", 9), ev("c", 10)] },
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
