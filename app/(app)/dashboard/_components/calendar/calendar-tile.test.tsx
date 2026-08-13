/// <reference types="vitest/globals" />

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CalendarEventsResponse } from "@/lib/api";
import { config } from "@/lib/config";
import { CalendarCard } from "./calendar-tile";
import {
  allDayOnly,
  busyDay,
  type CalendarFixture,
  defaultDay,
  degraded,
  emptyDay,
  emptyWeek,
  lateEvening,
  PLANNED_WORKOUT_ID,
  sunday,
} from "./fixtures";
import { addDays, fetchWindow, localDateKey } from "./shared";

/** The zone the tile guesses with before a response names the calendar's. */
const BROWSER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const getCalendarEventsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getCalendarEvents: getCalendarEventsMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

/**
 * `shouldAdvanceTime` because the tile is asynchronous and Testing Library's
 * `findBy*` polls: a frozen clock with a mocked `setTimeout` would leave every
 * await hanging. The system time is still pinned per test — that is what makes
 * "6pm on a busy Wednesday" a thing a test can assert on at all.
 */
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  getCalendarEventsMock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Render the tile at the instant its fixture is meant to be read at. */
function mount(fixture: CalendarFixture) {
  vi.setSystemTime(fixture.now);
  getCalendarEventsMock.mockResolvedValue(fixture.response);
  return render(<CalendarCard />);
}

/** The tile's body, which is also the swipe/arrow-key target. */
function body(): HTMLElement {
  return screen.getByRole("group", { name: "Calendar" });
}

/** Page forward `n` times with the pager button. */
function pageForward(n: number) {
  for (let i = 0; i < n; i++) {
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));
  }
}

describe("CalendarCard", () => {
  it("renders today's mixed day, with the planned workout marked and linked", async () => {
    mount(defaultDay());

    // The comma is toLocaleDateString's, not a typo: "Wed, Aug 12".
    expect(await screen.findByText("Today · Wed, Aug 12")).toBeInTheDocument();
    expect(screen.getByText("Ada's birthday")).toBeInTheDocument();
    expect(screen.getByText("Standup")).toBeInTheDocument();
    expect(screen.getByText("Lunch with Dana")).toBeInTheDocument();

    // Ours: the provenance dot and the deep link, on one row and only one.
    const workout = screen.getByRole("link", { name: "Upper Body Push" });
    expect(workout).toHaveAttribute("href", `/planned-workouts/${PLANNED_WORKOUT_ID}`);
    expect(screen.getAllByTestId("ours-dot")).toHaveLength(1);

    // Four events in a five-row budget: nothing is clipped, so nothing claims
    // to be. And nothing shouts.
    expect(screen.queryByText(/^\+\d+ (earlier|more)$/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says a free day is free, and nothing else", async () => {
    mount(emptyDay());

    expect(await screen.findByText("Nothing scheduled.")).toBeInTheDocument();
    // No nag, no CTA, no invitation to plan a workout.
    expect(screen.queryByText(/plan|add|connect|log/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("reports the morning it clipped on a busy day, and claims no remainder it does not have", async () => {
    mount(busyDay());

    // Six past, the in-progress 13:45 meeting anchoring the window, five rows
    // shown, none left over.
    expect(await screen.findByText("+6 earlier")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show 6 earlier events on Today in the week agenda" }),
    ).toBeInTheDocument();
    // A zero overflow line is noise, not honesty.
    expect(screen.queryByText(/^\+\d+ more$/)).not.toBeInTheDocument();
    expect(screen.getByText("Roadmap sync")).toBeInTheDocument();
  });

  it("shows the evening it just had at 9:30pm, muted rather than blank", async () => {
    mount(lateEvening());

    expect(await screen.findByText("+3 earlier")).toBeInTheDocument();
    expect(screen.queryByText(/^\+\d+ more$/)).not.toBeInTheDocument();
    // Every visible row has ended, so every visible row is muted — the day
    // still reads as a whole.
    for (const title of ["1:1 with Sam", "Lunch with Dana", "Roadmap sync", "Retro"]) {
      expect(screen.getByText(title).closest("li")?.className).toContain("text-[var(--muted)]");
    }
  });

  it("fills Sunday's Tomorrow slide from next Monday, outside the week", async () => {
    mount(sunday());
    await screen.findByText("Today · Sun, Aug 16");

    pageForward(1);

    expect(screen.getByText("Tomorrow · Mon, Aug 17")).toBeInTheDocument();
    expect(screen.getByText("Team lunch")).toBeInTheDocument();
    expect(screen.getByText("Lower Body Pull")).toBeInTheDocument();
    expect(screen.queryByText("Nothing scheduled.")).not.toBeInTheDocument();
  });

  it("pins an all-day marker with no time column, and counts it in the strip", async () => {
    mount(allDayOnly());

    const row = (await screen.findByText("Public holiday")).closest("li");
    // The time column is a spacer, not a time: the row's whole text is the
    // title.
    expect(row?.textContent).toBe("Public holiday");

    pageForward(2);
    const wednesday = screen.getByRole("button", { name: "Open Wednesday in the week agenda" });
    expect(within(wednesday).getByText("1")).toBeInTheDocument();
    // An all-day event is an event; a strip that ignored it would show a blank
    // Wednesday on a day the user is away.
    expect(screen.getByRole("group", { name: /Wednesday 1 event/ })).toBeInTheDocument();
  });

  it("draws seven columns and a calm caption for an empty week", async () => {
    mount(emptyWeek());
    await screen.findByText("Today · Wed, Aug 12");

    pageForward(2);

    expect(screen.getAllByTestId("strip-bar")).toHaveLength(7);
    expect(screen.getByText("Nothing left this week.")).toBeInTheDocument();
  });

  it("invites a connection when there is none, with the Settings page's own call", async () => {
    mount(degraded("not_connected"));

    const cta = await screen.findByRole("link", { name: /Connect Google Calendar/ });
    expect(cta).toHaveAttribute(
      "href",
      `${config.apiUrl}/auth/google/calendar/connect?return_to=${encodeURIComponent(
        `${config.appUrl}/dashboard`,
      )}`,
    );
    // A degradation is never an error, and there is nothing to expand into.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open the week agenda" })).not.toBeInTheDocument();
  });

  it("asks for a reconnection in the same shape", async () => {
    mount(degraded("reconnect_needed"));

    const cta = await screen.findByRole("link", { name: /Reconnect Google Calendar/ });
    expect(cta).toHaveAttribute(
      "href",
      `${config.apiUrl}/auth/google/calendar/connect?return_to=${encodeURIComponent(
        `${config.appUrl}/dashboard`,
      )}`,
    );
  });

  it("states an outage as a calm line, not a banner", async () => {
    mount(degraded("unavailable"));

    expect(await screen.findByText("Calendar is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("treats a thrown fetch as the same calm line", async () => {
    vi.setSystemTime(defaultDay().now);
    getCalendarEventsMock.mockRejectedValue(new Error("network"));
    render(<CalendarCard />);

    expect(await screen.findByText("Calendar is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says so plainly when the reader is switched off", async () => {
    mount(degraded("disabled"));

    expect(await screen.findByText("Calendar is off.")).toBeInTheDocument();
  });

  it("shows the house skeleton while the first request is in flight", () => {
    vi.setSystemTime(defaultDay().now);
    getCalendarEventsMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<CalendarCard />);

    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText("Calendar")).not.toBeInTheDocument();
  });

  it("has no gear — there is nothing to manage on a primary-only tile", async () => {
    mount(defaultDay());
    await screen.findByText("Today · Wed, Aug 12");

    expect(screen.queryByRole("button", { name: /manage/i })).not.toBeInTheDocument();
  });

  it("pages Today → Tomorrow → Week by button, with the dots tracking and the ends disabled", async () => {
    mount(defaultDay());
    await screen.findByText("Today · Wed, Aug 12");

    const active = () =>
      screen.getAllByTestId("pager-dot").findIndex((d) => d.className.includes("--foreground"));
    expect(active()).toBe(0);
    expect(screen.getByRole("button", { name: "Previous slide" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next slide" })).toBeEnabled();

    pageForward(1);
    expect(screen.getByText("Tomorrow · Thu, Aug 13")).toBeInTheDocument();
    expect(active()).toBe(1);

    pageForward(1);
    expect(screen.getAllByTestId("strip-bar")).toHaveLength(7);
    expect(active()).toBe(2);
    expect(screen.getByRole("button", { name: "Next slide" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous slide" }));
    expect(screen.getByText("Tomorrow · Thu, Aug 13")).toBeInTheDocument();
    expect(active()).toBe(1);
  });

  it("pages with the arrow keys on the focused body", async () => {
    mount(defaultDay());
    await screen.findByText("Today · Wed, Aug 12");

    fireEvent.keyDown(body(), { key: "ArrowRight" });
    expect(screen.getByText("Tomorrow · Thu, Aug 13")).toBeInTheDocument();

    fireEvent.keyDown(body(), { key: "ArrowLeft" });
    expect(screen.getByText("Today · Wed, Aug 12")).toBeInTheDocument();
  });

  it("pages on a swipe past the threshold, and not on a tap that wandered", async () => {
    mount(defaultDay());
    await screen.findByText("Today · Wed, Aug 12");

    // 20px of travel is a tap with a shaky thumb, not a page.
    fireEvent.touchStart(body(), { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(body(), { changedTouches: [{ clientX: 180 }] });
    expect(screen.getByText("Today · Wed, Aug 12")).toBeInTheDocument();

    fireEvent.touchStart(body(), { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(body(), { changedTouches: [{ clientX: 140 }] });
    expect(screen.getByText("Tomorrow · Thu, Aug 13")).toBeInTheDocument();
  });

  it("always opens on Today — the page is ephemeral by design", async () => {
    const { unmount } = mount(defaultDay());
    await screen.findByText("Today · Wed, Aug 12");
    pageForward(2);
    expect(screen.getAllByTestId("strip-bar")).toHaveLength(7);

    unmount();
    render(<CalendarCard />);

    // A user who left it on the week strip yesterday wants today's events
    // today.
    expect(await screen.findByText("Today · Wed, Aug 12")).toBeInTheDocument();
  });

  it("refetches when the local date has rolled over, and only then", async () => {
    const fixture = defaultDay();
    mount(fixture);
    await screen.findByText("Today · Wed, Aug 12");
    expect(getCalendarEventsMock).toHaveBeenCalledTimes(1);

    // Same day, tab returned: nothing has changed, so nothing is spent.
    fireEvent(document, new Event("visibilitychange"));
    fireEvent(window, new Event("focus"));
    expect(getCalendarEventsMock).toHaveBeenCalledTimes(1);

    // Past local midnight. A dashboard left open would otherwise show
    // yesterday as "Today" indefinitely.
    const tomorrow = addDays(fixture.now, 1);
    vi.setSystemTime(
      new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 5),
    );
    const tomorrowWindow = fetchWindow(new Date(), BROWSER_TZ);
    // Returning to a tab fires BOTH events in ONE tick, with no render in
    // between — one act() block, not two fireEvents, is what reproduces that.
    // It is still one rollover, so it must still be one request: a pair of
    // handlers closing over the pre-update date would spend two.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(getCalendarEventsMock).toHaveBeenCalledTimes(2));
    expect(getCalendarEventsMock).toHaveBeenLastCalledWith(
      "test-token",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      tomorrowWindow.startDate,
      tomorrowWindow.endDate,
    );
    expect(await screen.findByText("Today · Thu, Aug 13")).toBeInTheDocument();

    // And the new date is now the rendered one: a second visit spends nothing.
    fireEvent(document, new Event("visibilitychange"));
    expect(getCalendarEventsMock).toHaveBeenCalledTimes(2);
  });

  it("treats an ok payload with no days as unavailable, not as a free week", async () => {
    vi.setSystemTime(defaultDay().now);
    // A contract violation, not a quiet week: rendering it as seven empty
    // columns would claim two days are clear on no evidence at all.
    getCalendarEventsMock.mockResolvedValue({ status: "ok" });
    render(<CalendarCard />);

    expect(await screen.findByText("Calendar is unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("Nothing scheduled.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open the week agenda" })).not.toBeInTheDocument();
  });

  it("closes the panel when a rollover refetch takes the week away", async () => {
    const fixture = defaultDay();
    mount(fixture);
    await screen.findByText("Today · Wed, Aug 12");
    fireEvent.click(screen.getByRole("button", { name: "Open the week agenda" }));
    await screen.findByRole("dialog");

    getCalendarEventsMock.mockRejectedValue(new Error("network"));
    const tomorrow = addDays(fixture.now, 1);
    vi.setSystemTime(
      new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 0, 5),
    );
    fireEvent(document, new Event("visibilitychange"));

    // The dialog is a view onto a payload the tile no longer has, and the ⤢ it
    // would hand focus back to has unmounted with it.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Calendar is unavailable.")).toBeInTheDocument();

    // And it stays closed: the open date was forgotten, not merely hidden, so
    // a later successful load does not pop a dialog the user never asked for.
    getCalendarEventsMock.mockResolvedValue(fixture.response);
    const dayAfter = addDays(fixture.now, 2);
    vi.setSystemTime(
      new Date(dayAfter.getFullYear(), dayAfter.getMonth(), dayAfter.getDate(), 0, 5),
    );
    fireEvent(document, new Event("visibilitychange"));

    await screen.findByText("Today · Fri, Aug 14");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the week agenda on the day asked for, closes on Escape, and returns focus", async () => {
    mount(busyDay());
    await screen.findByText("+6 earlier");
    // The clipped morning is not on the tile.
    expect(screen.queryByText("Overnight build triage")).not.toBeInTheDocument();

    const expand = screen.getByRole("button", { name: "Open the week agenda" });
    fireEvent.click(expand);

    const dialog = await screen.findByRole("dialog");
    // The panel is what makes the clipping honest: everything, untruncated.
    expect(within(dialog).getByText("Overnight build triage")).toBeInTheDocument();
    expect(within(dialog).getByText("Roadmap sync")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(expand).toHaveFocus();
  });

  it("opens the panel from an overflow line and from a strip column", async () => {
    mount(busyDay());
    await screen.findByText("+6 earlier");

    fireEvent.click(screen.getByText("+6 earlier"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    pageForward(2);
    fireEvent.click(screen.getByRole("button", { name: "Open Friday in the week agenda" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("spends exactly one request on all three slides and the panel", async () => {
    const fixture = defaultDay();
    mount(fixture);
    await screen.findByText("Today · Wed, Aug 12");

    // fetchWindow, not requestWindow: the tile asks for a day either side so a
    // first-load zone guess cannot leave the Today slide uncovered, then slices
    // back to requestWindow before rendering.
    const window_ = fetchWindow(fixture.now, BROWSER_TZ);
    expect(getCalendarEventsMock).toHaveBeenCalledWith(
      "test-token",
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      window_.startDate,
      window_.endDate,
    );
    // The window is the union of what the three slides need — Monday through
    // the later of the week's end and tomorrow.
    expect(window_.startDate).toBe(localDateKey(addDays(fixture.now, -3)));

    pageForward(2);
    expect(screen.getAllByTestId("strip-bar")).toHaveLength(7);
    fireEvent.click(screen.getByRole("button", { name: "Open the week agenda" }));
    await screen.findByRole("dialog");

    // The panel fetches nothing; the tile already holds the week.
    expect(getCalendarEventsMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * The reported bug, end to end.
 *
 * A Southwest flight at 4:45 PM Eastern rendered as 1:45 PM on a machine in
 * Pacific, because the tile formatted a correct UTC instant with the reader's
 * own zone while Google Calendar formatted it with the calendar's. The instant
 * was never wrong; the clock it was read on was.
 */
describe("the calendar's zone, not the reader's", () => {
  // 2026-08-13T20:45:00Z — 4:45 PM Eastern, 1:45 PM Pacific.
  const flightAt = "2026-08-13T20:45:00Z";

  function easternCalendar(): CalendarEventsResponse {
    return {
      status: "ok",
      timezone: "America/New_York",
      days: [
        {
          date: "2026-08-13",
          truncated: 0,
          events: [
            {
              id: "flight",
              title: "Southwest Airlines Confirmation CFPBP8",
              start: flightAt,
              end: "2026-08-13T23:45:00Z",
              all_day: false,
              source: "google",
            },
          ],
        },
      ],
    };
  }

  it("prints the time Google Calendar prints, not the browser's", async () => {
    // Noon Pacific on the 12th, so the flight is Tomorrow either way and the
    // only thing under test is the clock.
    vi.setSystemTime(new Date("2026-08-12T19:00:00Z"));
    getCalendarEventsMock.mockResolvedValue(easternCalendar());
    render(<CalendarCard />);

    await screen.findByText(/Today ·/);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

    await screen.findByText("Southwest Airlines Confirmation CFPBP8");
    expect(screen.getByText("4:45 PM")).toBeInTheDocument();
    expect(screen.queryByText("1:45 PM")).not.toBeInTheDocument();
  });

  it("falls back to the browser's zone when the API names none", async () => {
    vi.setSystemTime(new Date("2026-08-12T19:00:00Z"));
    const { timezone: _dropped, ...noZone } = easternCalendar();
    getCalendarEventsMock.mockResolvedValue(noZone as CalendarEventsResponse);
    render(<CalendarCard />);

    await screen.findByText(/Today ·/);
    fireEvent.click(screen.getByRole("button", { name: "Next slide" }));

    // An older API build must degrade to the PREVIOUS behavior — the reader's
    // own zone — rather than to a blank row or to UTC. Derived rather than
    // hardcoded: a literal here would only be true on the runner that wrote
    // it, which is the same mistake the tile itself was making.
    await screen.findByText("Southwest Airlines Confirmation CFPBP8");
    const inBrowserZone = new Date(flightAt).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      timeZone: BROWSER_TZ,
    });
    expect(screen.getByText(inBrowserZone)).toBeInTheDocument();
  });
});
