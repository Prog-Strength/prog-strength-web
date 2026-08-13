/**
 * One day's rows: a heading, up to five `time · title` rows, and honest
 * overflow lines. All-day events pin to the top with no time column.
 *
 * The tile must not lie about a day it has clipped, so `+2 earlier` and
 * `+3 more` are both rendered — as muted lines that open the week panel on
 * this day. An empty day renders "Nothing scheduled." and NOTHING ELSE: no
 * CTA, no suggestion. The tile does not nag a user for having a free
 * afternoon, and it must not become a surface that sells planning a workout.
 *
 * Presentational and clock-free: `now` arrives as a prop rather than being read
 * here, so the slide renders the same day twice for the same inputs and the
 * tile stays the one place that owns the current instant.
 */
"use client";

import type { CalendarDay } from "@/lib/api";
import { EventRow } from "./event-row";
import { formatDayHeading, hasEnded, visibleEvents } from "./shared";

export function DaySlide({
  label,
  date,
  day,
  now,
  timeZone,
  onOpenDay,
}: {
  /** "Today" | "Tomorrow" — the slide's own name, not the date's. */
  label: string;
  /** YYYY-MM-DD. Passed rather than read off `day`, which may be absent. */
  date: string;
  day: CalendarDay | undefined;
  now: Date;
  /** The calendar's zone — every clock on this slide is read on it. */
  timeZone: string;
  /** Opens the week panel scrolled to this date. */
  onOpenDay: (date: string) => void;
}) {
  const events = day?.events ?? [];
  const { visible, earlierCount, laterCount } = visibleEvents(events, now);
  // The server's own per-day cap folds into the SAME line as the client-side
  // window's remainder. Two overflow counters on one day would be a puzzle;
  // one number that is the true remainder is the honest reading, and it is the
  // reason a capped day cannot quietly under-report.
  const truncated = day?.truncated ?? 0;
  const moreCount = laterCount + truncated;

  return (
    <div className="flex flex-col gap-1">
      {/* `tabular-nums` on a heading that is mostly words: the numeral is a
          date, and paging Today → Tomorrow swaps one for another in place. A
          proportional "11" and "12" are different widths, so the heading would
          shift under the pager on the way past the 10th of a month. */}
      <p className="text-xs tabular-nums text-[var(--muted)]">
        {label} · {formatDayHeading(date)}
      </p>

      {/* `truncated` is in the guard as well as the count. A day of
          `{events: [], truncated: 3}` should not exist — the server caps at 50
          and cannot cut three from nothing — but if it ever did, gating on
          `events.length` alone would print "Nothing scheduled." over three
          events the API admits it withheld, which is the one thing this slide
          promises never to do. */}
      {events.length === 0 && truncated === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing scheduled.</p>
      ) : (
        <>
          {earlierCount > 0 && (
            <OverflowLine
              count={earlierCount}
              word="earlier"
              label={label}
              date={date}
              onOpenDay={onOpenDay}
            />
          )}
          <ul className="flex flex-col">
            {visible.map((event) => (
              <EventRow
                key={event.id}
                timeZone={timeZone}
                event={event}
                ended={hasEnded(event, now)}
              />
            ))}
          </ul>
          {moreCount > 0 && (
            <OverflowLine
              count={moreCount}
              word="more"
              label={label}
              date={date}
              onOpenDay={onOpenDay}
            />
          )}
        </>
      )}
    </div>
  );
}

/**
 * `+2 earlier` / `+3 more` — a way into the panel, never a bare label.
 *
 * The visible text is the whole point of the line and stays short. The
 * accessible name cannot: "+3 more" says neither which day it is about nor that
 * pressing it opens anything, and Today and Tomorrow would otherwise offer two
 * identically-named buttons in the same tile.
 */
function OverflowLine({
  count,
  word,
  label,
  date,
  onOpenDay,
}: {
  count: number;
  word: "earlier" | "more";
  /** The slide's own name — "Today" | "Tomorrow". */
  label: string;
  date: string;
  onOpenDay: (date: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenDay(date)}
      aria-label={`Show ${count} ${word} ${count === 1 ? "event" : "events"} on ${label} in the week agenda`}
      className="self-start text-[11px] tabular-nums text-[var(--faint)] transition hover:text-[var(--muted)]"
    >
      +{count} {word}
    </button>
  );
}
