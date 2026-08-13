/**
 * The seven-column density strip, Monday-first.
 *
 * THE STRIP IS DECORATION; THE MEANING IS THE CAPTION AND THE COUNTS.
 * Following morning-ledger's railLabel precedent the bars are `aria-hidden` and
 * a composed label carries the week, so a screen reader gets "Monday 1 event,
 * Tuesday 3 events, …" rather than seven unlabelled divs.
 *
 * That composed label sits on a `role="group"` rather than the `role="img"` the
 * ledger's static rail uses, and the difference is forced by this strip's
 * columns being BUTTONS: `img` takes presentational children, so a focusable
 * control inside one is unreachable to a screen reader while still being
 * reachable by Tab. A group keeps the one-sentence reading of the week AND
 * keeps each column operable, which is what the strip is for — it is the way
 * into the panel.
 *
 * `--accent` on a bar means Prog Strength wrote something that day. It is a
 * provenance mark and not a temperature: a heavy day is not painted warm, and
 * there is no red here for a full Wednesday. A busy day is not an alarm.
 */
"use client";

import type { CalendarEvent } from "@/lib/api";
import { formatEventTime, stripHeights, stripLabel, type WeekColumn } from "./shared";

/** The rail's height in px. A bar's fill is a fraction of this. */
const RAIL_H = 28;

/**
 * The floor, in px, under every bar including a zero one. A day with nothing on
 * it draws a hairline rather than nothing at all: an absent column would read
 * as a missing day rather than as a free one, and the week would look ragged.
 */
const BAR_FLOOR = 2;

export function WeekStrip({
  columns,
  next,
  onOpenDay,
}: {
  /** Seven Monday-first columns from `weekColumns()`. */
  columns: WeekColumn[];
  /** The next event that has not started, from `nextUpcoming()`. */
  next: CalendarEvent | null;
  onOpenDay: (date: string) => void;
}) {
  // Normalised against the week's own busiest day, so the strip answers "which
  // days are heavy relative to my week" rather than measuring the user against
  // an invented ceiling.
  const heights = stripHeights(columns.map((c) => c.count));

  return (
    <div className="flex flex-col gap-1.5">
      <div role="group" aria-label={stripLabel(columns)} className="flex items-end gap-1">
        {columns.map((column, i) => (
          <button
            key={column.date}
            type="button"
            onClick={() => onOpenDay(column.date)}
            aria-label={`${column.name}, ${column.count} ${column.count === 1 ? "event" : "events"}`}
            className="flex flex-1 flex-col items-center gap-1 rounded-sm transition hover:bg-[var(--surface-2)]"
          >
            <span
              aria-hidden="true"
              className="flex w-full items-end justify-center"
              style={{ height: RAIL_H }}
            >
              <span
                data-testid="strip-bar"
                className={`w-full rounded-[1px] ${
                  column.hasOurs ? "bg-[var(--accent)]" : "bg-[var(--surface-2)]"
                }`}
                style={{ height: Math.max(BAR_FLOOR, Math.round(heights[i] * RAIL_H)) }}
              />
            </span>
            {/* The initials repeat ("T", "S") and today's is the only one in
                full strength — position, not the letter, is what locates a
                column, and the button's own label carries the day's name. */}
            <span
              className={`text-[10px] ${
                column.isToday ? "text-[var(--foreground)]" : "text-[var(--faint)]"
              }`}
            >
              {column.initial}
            </span>
            <span className="text-[10px] tabular-nums text-[var(--faint)]">{column.count}</span>
          </button>
        ))}
      </div>

      {/* The one line that says what the strip cannot: which event is next.
          A single text node, `tabular-nums` across the whole line rather than
          on a nested span around the time — the figure is the only part that
          needs the metric and wrapping it would split the sentence into three
          nodes for no gain. */}
      <p className="truncate text-xs tabular-nums text-[var(--muted)]">
        {next ? `Next: ${formatEventTime(next.start)} ${next.title}` : "Nothing left this week."}
      </p>
    </div>
  );
}
