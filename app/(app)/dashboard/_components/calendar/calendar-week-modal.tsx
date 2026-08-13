/**
 * The week agenda panel — every day, every event, untruncated.
 *
 * This is what makes the density strip useful: the strip says Wednesday is
 * packed, the panel says with what. It FETCHES NOTHING; the tile already holds
 * the week from the single request that feeds all three slides, so opening this
 * is free and can never disagree with the tile behind it.
 *
 * NO WINDOWING HAPPENS HERE. The tile's five-row budget and its `+N earlier` /
 * `+N more` lines exist because a mini-card has five rows; a panel does not,
 * and re-applying the tile's rule here would leave the user with no surface
 * that shows a whole day. The one number this panel does still print is the
 * SERVER's per-day cap — that overflow is real, and it stays visible here too.
 *
 * The modal idiom (dialog role, scrim, Escape, the close button focused on
 * mount) is `weather-forecast-modal`'s verbatim, including its limits: there is
 * no focus trap, and returning focus to the opener is the TILE's job on close,
 * not this component's. Diverging on either would be a bigger a11y decision
 * than this feature's remit, and one taken in the wrong place.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CalendarDay } from "@/lib/api";
import { EventRow } from "./day-slide";
import { formatDayHeading, localDateKey } from "./shared";

export function CalendarWeekModal({
  days,
  initialDate,
  onClose,
}: {
  /** The whole window the tile holds — dense, one entry per date. */
  days: CalendarDay[];
  /** The date the user opened the panel on; scrolled into view on mount. */
  initialDate: string;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const initialRef = useRef<HTMLElement | null>(null);
  // Read once, on mount, rather than on every render: this only decides which
  // heading is at full strength, and a panel that re-derived "today" mid-render
  // would be doing clock work the tile already owns.
  const [todayKey] = useState(() => localDateKey(new Date()));

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    // `block: "start"` and not "center": the day the user asked for belongs at
    // the top of the scroll, with the rest of the week readable beneath it.
    // Optional-called because jsdom implements no layout and therefore no
    // scrollIntoView, and a panel that throws under test is worse than one that
    // opens unscrolled.
    initialRef.current?.scrollIntoView?.({ block: "start" });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-week-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="calendar-week-title" className="text-base font-semibold">
              This week
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Every day in view, every event — nothing clipped.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            {days.map((day) => (
              <section
                key={day.date}
                ref={day.date === initialDate ? initialRef : undefined}
                className="flex flex-col gap-1"
              >
                {/* `tabular-nums` because these headings stack into a column
                    of dates, and a column of dates that does not line up is
                    the one place proportional figures are obviously wrong. */}
                <h3
                  className={`text-xs font-medium tabular-nums ${
                    day.date === todayKey ? "text-[var(--foreground)]" : "text-[var(--muted)]"
                  }`}
                >
                  {formatDayHeading(day.date)}
                </h3>

                {day.events.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Nothing scheduled.</p>
                ) : (
                  <ul className="flex flex-col">
                    {day.events.map((event) => (
                      <EventRow key={event.id} event={event} allDayLabel />
                    ))}
                  </ul>
                )}

                {/* The server's cap, still stated. The panel's promise is that
                    it shows everything it HAS; where the API kept something
                    back, saying so is the only honest version of that promise. */}
                {day.truncated > 0 && (
                  <p className="text-[11px] tabular-nums text-[var(--faint)]">
                    +{day.truncated} more not shown
                  </p>
                )}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
