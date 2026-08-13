/**
 * One calendar event, as `time · title` — the row shared by the tile's day
 * slide and the week agenda panel.
 *
 * It lives in its own module because it is a CONTRACT rather than a detail of
 * either surface: the accent provenance dot, the `planned_workout` deep link,
 * and the width of the time column are three things the two surfaces must agree
 * on exactly, and a second hand-written row is how they would start disagreeing
 * about what an all-day event looks like.
 *
 * `--accent` marks WHOSE event this is and nothing else. It is not a status:
 * a planned workout is not painted warm for being imminent or green for being
 * done, and an ended row differs only in text colour.
 */
"use client";

import Link from "next/link";
import type { CalendarEvent } from "@/lib/api";
import { formatEventTime } from "./shared";

/**
 * The time column's width, shared by the row's time, by the "All day" label,
 * and by the spacer an all-day row puts in their place — the titles line up in
 * a column whether or not the day starts with a holiday marker.
 */
const TIME_COL = "w-[3.5rem] shrink-0";

export function EventRow({
  event,
  timeZone,
  ended = false,
  allDayLabel = false,
}: {
  event: CalendarEvent;
  /**
   * The CALENDAR's zone, from the events payload — the clock this row is read
   * on. Google renders a calendar's grid in its own zone, so formatting with
   * the reader's instead prints a different time than Google does for the same
   * event. The instant is the same either way; only the clock differs.
   */
  timeZone: string;
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
          {formatEventTime(event.start, timeZone)}
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
