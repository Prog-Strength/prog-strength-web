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

import Link from "next/link";
import type { CalendarDay, CalendarEvent } from "@/lib/api";
import { formatDayHeading, formatEventTime, visibleEvents } from "./shared";

/**
 * The time column's width, shared by the row's time and by the spacer an
 * all-day row puts in its place — the titles line up in a column whether or not
 * the day starts with a holiday marker.
 */
const TIME_COL = "w-[3.5rem] shrink-0";

export function DaySlide({
  label,
  date,
  day,
  now,
  onOpenDay,
}: {
  /** "Today" | "Tomorrow" — the slide's own name, not the date's. */
  label: string;
  /** YYYY-MM-DD. Passed rather than read off `day`, which may be absent. */
  date: string;
  day: CalendarDay | undefined;
  now: Date;
  /** Opens the week panel scrolled to this date. */
  onOpenDay: (date: string) => void;
}) {
  const events = day?.events ?? [];
  const { visible, earlierCount, laterCount } = visibleEvents(events, now);
  // The server's own per-day cap folds into the SAME line as the client-side
  // window's remainder. Two overflow counters on one day would be a puzzle;
  // one number that is the true remainder is the honest reading, and it is the
  // reason a capped day cannot quietly under-report.
  const moreCount = laterCount + (day?.truncated ?? 0);

  return (
    <div className="flex flex-col gap-1">
      {/* `tabular-nums` on a heading that is mostly words: the numeral is a
          date, and paging Today → Tomorrow swaps one for another in place. A
          proportional "11" and "12" are different widths, so the heading would
          shift under the pager on the way past the 10th of a month. */}
      <p className="text-xs tabular-nums text-[var(--muted)]">
        {label} · {formatDayHeading(date)}
      </p>

      {events.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Nothing scheduled.</p>
      ) : (
        <>
          {earlierCount > 0 && (
            <OverflowLine count={earlierCount} word="earlier" date={date} onOpenDay={onOpenDay} />
          )}
          <ul className="flex flex-col">
            {visible.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                ended={new Date(event.end).getTime() <= now.getTime()}
              />
            ))}
          </ul>
          {moreCount > 0 && (
            <OverflowLine count={moreCount} word="more" date={date} onOpenDay={onOpenDay} />
          )}
        </>
      )}
    </div>
  );
}

/** `+2 earlier` / `+3 more` — a way into the panel, never a bare label. */
function OverflowLine({
  count,
  word,
  date,
  onOpenDay,
}: {
  count: number;
  word: "earlier" | "more";
  date: string;
  onOpenDay: (date: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpenDay(date)}
      className="self-start text-[11px] tabular-nums text-[var(--faint)] transition hover:text-[var(--muted)]"
    >
      +{count} {word}
    </button>
  );
}

/**
 * One event, as `time · title`.
 *
 * Exported because the week panel prints the same row with the same provenance
 * mark and the same deep link — the SOW asks for exactly that, and a second
 * hand-written row is how the two surfaces start disagreeing about what an
 * all-day event looks like.
 *
 * `--accent` marks WHOSE event this is and nothing else. It is not a status:
 * a planned workout is not painted warm for being imminent or green for being
 * done, and an ended row differs only in text weight.
 */
export function EventRow({
  event,
  ended = false,
  allDayLabel = false,
}: {
  event: CalendarEvent;
  /** Renders the row in `--muted`. The row is never hidden — the day reads as
   *  a whole, including the part of it that is over. */
  ended?: boolean;
  /** The panel spells out "All day"; the tile's narrow slide leaves the column
   *  blank so five rows of titles stay readable. */
  allDayLabel?: boolean;
}) {
  const ours = event.source === "prog_strength";
  // The link is the API's, not a path this component guesses at: `activity`
  // links exist on the wire too and are deliberately NOT rendered as links
  // here, because a synced activity's row is already where the user is.
  const plannedId = event.link?.kind === "planned_workout" ? event.link.id : null;

  return (
    <li className={`flex h-6 items-center gap-2 text-sm ${ended ? "text-[var(--muted)]" : ""}`}>
      {event.all_day ? (
        allDayLabel ? (
          <span className={`${TIME_COL} text-xs text-[var(--faint)]`}>All day</span>
        ) : (
          // A spacer, not a blank string: it holds the column open so an
          // all-day row's title starts where every other row's title does.
          <span aria-hidden="true" className={TIME_COL} />
        )
      ) : (
        <span className={`${TIME_COL} text-xs tabular-nums text-[var(--faint)]`}>
          {formatEventTime(event.start)}
        </span>
      )}

      {ours && (
        <span
          aria-hidden="true"
          data-testid="ours-dot"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]"
        />
      )}

      {plannedId ? (
        <Link
          href={`/planned-workouts/${plannedId}`}
          className="truncate underline-offset-2 hover:underline"
        >
          {event.title}
        </Link>
      ) : (
        <span className="truncate">{event.title}</span>
      )}
    </li>
  );
}
