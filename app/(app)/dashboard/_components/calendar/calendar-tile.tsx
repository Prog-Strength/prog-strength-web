/**
 * CalendarCard — the self-fetching calendar tile.
 *
 * THREE SLIDES: Today, Tomorrow, and a week-at-a-glance density strip, behind
 * the paging idiom weather established. The ⤢ affordance opens the week agenda
 * panel — every day, every event, untruncated — which is what makes the
 * density strip useful: the strip says Wednesday is packed, the panel says
 * with what.
 *
 * WHY IT SELF-FETCHES. Like weather, this is third-party data with its own
 * auth and failure modes, and it has no business inside the single
 * /dashboard/summary round-trip where a slow Google would delay every other
 * tile on the grid.
 *
 * WHY ONE REQUEST COVERS EVERYTHING. The server returns the window grouped by
 * LOCAL DATE, so the client never re-derives a day boundary, and the window is
 * the union of what the three slides need (see requestWindow). Today,
 * Tomorrow, the strip, and the panel all read the same payload; the panel
 * fetches nothing.
 *
 * WHY THERE IS NO GEAR. weather's gear manages saved locations. This tile
 * reads `primary` and only `primary` — which is exactly why it ships with no
 * new OAuth scope and no re-consent — so there is nothing to manage.
 *
 * NOT A MiniCard: this tile has pager buttons, an expand button, and per-row
 * links, and a button inside MiniCard's anchor is invalid markup that swallows
 * its own clicks. mini-card.tsx exports MINI_CARD_PANEL for precisely this.
 *
 * Every degradation is a calm muted line or a CTA — never an error banner.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCalendarEvents, type CalendarEventsResponse } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { MINI_CARD_PANEL, MiniCardSkeleton, MiniCardTitle } from "../mini-card";
import { CalendarWeekModal } from "./calendar-week-modal";
import { DaySlide } from "./day-slide";
import { WeekStrip } from "./week-strip";
import {
  addDaysToKey,
  fetchWindow,
  nextUpcoming,
  requestWindow,
  weekColumns,
  zonedDateKey,
} from "./shared";

/**
 * The zone to read the calendar on until the server names one.
 *
 * A guess, and labelled as one. Google renders a calendar's grid in the
 * CALENDAR's zone, which only the server can tell us — the browser's zone is
 * merely the best thing available before the first response lands, and the
 * request window is padded by a day either side so a wrong guess still covers
 * the days the tile renders.
 */
function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Horizontal travel below which a touch is a tap, not a page swipe. */
const SWIPE_THRESHOLD_PX = 40;

/** Today, Tomorrow, the week. Always three — there is nothing to page past. */
const SLIDE_COUNT = 3;

/**
 * The connect flow, spelled exactly as the Settings page spells it
 * (`app/(app)/settings/page.tsx`): the API owns the OAuth dance and takes the
 * page to come back to.
 *
 * `config.appUrl` rather than `window.location.href` — this href is computed
 * during render, and this is a client component that Next still prerenders on
 * the server, where `window` does not exist. `config.appUrl` IS
 * `window.location.origin` in the browser (see lib/config.ts) with a
 * server-safe default, and pinning the path keeps a stray query string or hash
 * out of an OAuth redirect parameter.
 */
const CONNECT_HREF = `${config.apiUrl}/auth/google/calendar/connect?return_to=${encodeURIComponent(
  `${config.appUrl}/dashboard`,
)}`;

export function CalendarCard() {
  const [data, setData] = useState<CalendarEventsResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  // Ephemeral by design — the tile always opens on Today. A user who left it
  // on the week strip yesterday wants today's events today.
  const [page, setPage] = useState(0);
  const [panelDate, setPanelDate] = useState<string | null>(null);
  // The local date this render is about. State because changing it has to
  // re-render the slides — that is how "Today" stops meaning yesterday.
  const [renderedDate, setRenderedDate] = useState(() => zonedDateKey(new Date(), browserZone()));

  // Focus home for the panel: every close path returns focus here.
  const expandRef = useRef<HTMLButtonElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  // The same date again, synchronously. Returning to a tab fires
  // `visibilitychange` AND `focus` in one tick, and both handlers would close
  // over the pre-update `renderedDate` — two fetches for one rollover, and the
  // tile's one-request-per-day claim quietly broken. The ref is updated inside
  // the check, so the second call in the tick already sees the new date.
  const dateRef = useRef(renderedDate);
  // The zone the last response was bucketed in. A ref, not state: `load` reads
  // it to build the next window and must not be re-created when it changes, or
  // the effect that calls `load` would refetch on every zone update.
  const zoneRef = useRef(browserZone());

  const load = useCallback(async () => {
    // A failed read renders the SAME calm line an "unavailable" status does —
    // the user does not care which side of the wire gave up.
    //
    // DELIBERATELY UNLIKE weather (see weather-tile.tsx's loadLocations, which
    // keeps its last-good list on a failed REFETCH): a retained calendar window
    // lies. `DaySlide` prints "Nothing scheduled." for a date it has no entry
    // for, so after a Sunday→Monday rollover whose refetch failed, the Tomorrow
    // slide would assert a free Tuesday it never fetched. A stale temperature
    // is a shrug; a day claimed empty is not.
    //
    // Closing the panel is part of failing: it is a view onto a payload we no
    // longer have, and leaving it open renders the old week in a dialog over an
    // unavailable tile whose ⤢ — the focus home every close path returns to —
    // has just unmounted.
    const fail = () => {
      setFailed(true);
      setLoading(false);
      setPanelDate(null);
    };
    const token = getToken();
    if (!token) {
      fail();
      return;
    }
    // Deliberately no loading flag on a refetch: the rollover path below keeps
    // the day already on screen until the new window lands, rather than
    // flashing the skeleton over data the union window usually already covers.
    // Padded, and built on the zone the last response named (the browser's
    // until one has). Both are best-effort: the pad is what makes a wrong
    // guess harmless. The `timezone` PARAM stays the browser's throughout —
    // it tells the server which days are being asked for, which is a
    // different question from which zone the answers are read on.
    const { startDate, endDate } = fetchWindow(new Date(), zoneRef.current);
    try {
      const next = await getCalendarEvents(token, browserZone(), startDate, endDate);
      if (!next) {
        fail();
        return;
      }
      zoneRef.current = next.timezone ?? browserZone();
      setData(next);
      setFailed(false);
      setLoading(false);
      // Same reasoning as fail(): a refetch that comes back degraded (or `ok`
      // with no days) has taken the week away too.
      if (!next.days) setPanelDate(null);
    } catch {
      fail();
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A dashboard left open past local midnight would otherwise show yesterday
  // as "Today" indefinitely. No interval timer — a tile that polls a clock
  // every minute to catch one transition a day is a background cost for a
  // foreground problem.
  useEffect(() => {
    function check() {
      if (document.visibilityState === "hidden") return;
      const today = zonedDateKey(new Date(), zoneRef.current);
      if (today === dateRef.current) return;
      dateRef.current = today;
      setRenderedDate(today);
      setPage(0);
      void load();
    }
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [renderedDate, load]);

  const closePanel = useCallback(() => {
    setPanelDate(null);
    expandRef.current?.focus();
  }, []);

  const openDay = useCallback((date: string) => setPanelDate(date), []);

  const pagePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), []);
  const pageNext = useCallback(() => setPage((p) => Math.min(SLIDE_COUNT - 1, p + 1)), []);

  function onBodyKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      pagePrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      pageNext();
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) pageNext();
    else pagePrev();
  }

  // The first request is still in flight: the house skeleton, same as the
  // grid's other cards. No header yet — there is nothing to expand into.
  if (loading && !failed && !data) {
    return <MiniCardSkeleton />;
  }

  // The instant this render is about. Read once here so the slides, the strip
  // and the panel cannot disagree about what "now" is mid-render.
  const now = new Date();
  // Keyed off the PRESENCE of the days, not the status alone — weather's rule.
  // `ok` with no `days` is a contract violation, and a `?? []` here would
  // render it as a legitimately free week: seven empty strip columns and two
  // days claimed clear. Falling through to the calm unavailable line is the
  // honest reading of a payload that told us nothing.
  // The zone every clock and day key on this tile is read on. The calendar's,
  // as the server bucketed it; the browser's only until it has said.
  const timeZone = data?.timezone ?? browserZone();
  const allDays = !failed && data?.status === "ok" ? data.days : undefined;
  // Back down to the window the tile actually renders. `fetchWindow` asks for
  // a day either side to survive a wrong zone guess; nothing downstream should
  // see those, or "Next" could reach past the end of the week.
  const render = requestWindow(now, timeZone);
  const days =
    allDays === undefined
      ? undefined
      : allDays.filter((d) => d.date >= render.startDate && d.date <= render.endDate);
  const status = failed || !data ? "unavailable" : data.status;
  const canExpand = days !== undefined;

  let body: React.ReactNode;
  if (status === "not_connected" || status === "reconnect_needed") {
    body = <ConnectLine label={status === "not_connected" ? "Connect" : "Reconnect"} />;
  } else if (status === "disabled") {
    body = <QuietLine text="Calendar is off." />;
  } else if (days === undefined) {
    body = <QuietLine text="Calendar is unavailable." />;
  } else {
    const todayKey = zonedDateKey(now, timeZone);
    const tomorrowKey = addDaysToKey(todayKey, 1);
    const byDate = new Map(days.map((d) => [d.date, d]));
    body = (
      <div
        role="group"
        aria-label="Calendar"
        tabIndex={0}
        onKeyDown={onBodyKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="flex flex-1 flex-col gap-1.5 rounded-md outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        {page === 0 && (
          <DaySlide
            label="Today"
            date={todayKey}
            day={byDate.get(todayKey)}
            now={now}
            timeZone={timeZone}
            onOpenDay={openDay}
          />
        )}
        {page === 1 && (
          <DaySlide
            label="Tomorrow"
            date={tomorrowKey}
            day={byDate.get(tomorrowKey)}
            now={now}
            timeZone={timeZone}
            onOpenDay={openDay}
          />
        )}
        {page === 2 && (
          <WeekStrip
            columns={weekColumns(days, now, timeZone)}
            next={nextUpcoming(days, now)}
            timeZone={timeZone}
            onOpenDay={openDay}
          />
        )}
        <div className="mt-auto flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            aria-label="Previous slide"
            onClick={pagePrev}
            disabled={page === 0}
            className="px-1 text-sm leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
          >
            ‹
          </button>
          <span className="flex items-center gap-1.5">
            {Array.from({ length: SLIDE_COUNT }, (_, i) => (
              <span
                key={i}
                data-testid="pager-dot"
                className={`h-1.5 w-1.5 rounded-full ${
                  i === page ? "bg-[var(--foreground)]" : "bg-[var(--faint)]"
                }`}
              />
            ))}
          </span>
          <button
            type="button"
            aria-label="Next slide"
            onClick={pageNext}
            disabled={page === SLIDE_COUNT - 1}
            className="px-1 text-sm leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
          >
            ›
          </button>
        </div>
      </div>
    );
  }

  // Hand-composed rather than a MiniCard: see the header. The panel string is
  // MiniCard's own, so this tile still looks like every other one on the grid.
  return (
    <div className={`${MINI_CARD_PANEL} relative flex flex-col gap-3`}>
      <div className="flex items-center justify-between gap-1.5">
        <MiniCardTitle title="Calendar" />
        {canExpand && (
          <button
            ref={expandRef}
            type="button"
            aria-label="Open the week agenda"
            onClick={() => setPanelDate(zonedDateKey(now, timeZone))}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            <ExpandIcon />
          </button>
        )}
      </div>
      {body}
      {panelDate !== null && days !== undefined && (
        <CalendarWeekModal
          days={days}
          initialDate={panelDate}
          now={now}
          timeZone={timeZone}
          onClose={closePanel}
        />
      )}
    </div>
  );
}

/**
 * Corners-out arrows — "show me this in full". A deliberate second copy of
 * `weather-tile.tsx`'s local icon: it is unexported there, and a shared icon
 * module for one 12-line path shared by two tiles would cost more than the
 * duplication does.
 */
function ExpandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
    </svg>
  );
}

/** Every degraded state renders as this — a calm muted line, no banner. */
function QuietLine({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center">
      <p className="text-sm text-[var(--muted)]">{text}</p>
    </div>
  );
}

/**
 * The one degradation the user can act on, in `MiniCardEmpty`'s clothes: a
 * missing connection is an invitation, not an error.
 *
 * A plain `<a>` and not `next/link` — the destination is the API's OAuth
 * entrypoint on another origin, which the client router has no business trying
 * to prefetch or handle.
 */
function ConnectLine({ label }: { label: "Connect" | "Reconnect" }) {
  return (
    <div className="flex flex-1 items-center">
      <a href={CONNECT_HREF} className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        {label} Google Calendar <span className="text-[var(--accent)]">→</span>
      </a>
    </div>
  );
}
