"use client";

import { useMemo } from "react";

/**
 * Horizontal row of date tiles for picking which day's nutrition log
 * to view. Replaces the prior chevron + <input type="date"> + Today
 * combo — tiles are a more "at a glance" UI for a tracker where
 * users primarily skim the past week.
 *
 * v1 scope: 7 tiles, today is always the rightmost, six days back
 * fill the rest. No chevron navigation, no future dates — going
 * further back than a week isn't a common nutrition-log flow and
 * adding chevrons can be a follow-up if anyone asks. Tapping a tile
 * selects that date; the selected tile gets a "pressed button"
 * treatment (accent fill, inset shadow, 1px down-translate).
 */
export function DateTileStrip({
  value,
  onChange,
  daysBack = 6,
}: {
  /** The currently-selected local date. Compared by y/m/d, not by Date instance identity. */
  value: Date;
  onChange: (d: Date) => void;
  /** Number of past days shown to the left of today. Default 6 → 7 tiles total. */
  daysBack?: number;
}) {
  // Build the list of dates once per render. `useMemo` keyed on the
  // today-string so a re-render at the same minute reuses the same
  // array (and same tile keys), and a re-render that crosses
  // midnight bumps it cleanly.
  const today = startOfLocalDay(new Date());
  const todayKey = ymd(today);

  const dates = useMemo(() => {
    const out: Date[] = [];
    for (let i = daysBack; i >= 0; i--) {
      out.push(addDays(today, -i));
    }
    return out;
    // todayKey is the actual data dependency; `today` is a fresh
    // Date instance each render and would defeat the memo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, daysBack]);

  return (
    <div
      className="grid grid-cols-7 gap-2"
      role="radiogroup"
      aria-label="Pick a date to view"
    >
      {dates.map((d) => {
        const selected = sameLocalDay(d, value);
        const isToday = sameLocalDay(d, today);
        return (
          <DateTile
            key={ymd(d)}
            date={d}
            selected={selected}
            isToday={isToday}
            onClick={() => onChange(d)}
          />
        );
      })}
    </div>
  );
}

function DateTile({
  date,
  selected,
  isToday,
  onClick,
}: {
  date: Date;
  selected: boolean;
  isToday: boolean;
  onClick: () => void;
}) {
  // Day-of-week ("Mon"), date number ("31"), and a month abbrev
  // prepended when this tile is day 1 (or otherwise mid-strip across
  // a month boundary). The month label only renders on day 1 so the
  // strip stays visually quiet most of the time — the user only
  // needs the month cue when context could be ambiguous.
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.getDate();
  const showMonth = day === 1;
  const monthAbbrev = date.toLocaleDateString("en-US", { month: "short" });

  // Selected = highlighted (accent fill) + depressed (inset shadow
  // + 1px down-translate). The composite reads as "this button is
  // currently pressed in" the way a physical hardware toggle would.
  // Default tiles use the surface bg + border so they read as
  // clickable cards. Today (when not selected) gets a small accent
  // dot under the date number so the user can spot it without
  // counting backwards from the right edge.
  const baseClasses =
    "relative flex flex-col items-center justify-center gap-0.5 rounded-md py-2 text-xs font-medium tabular-nums transition";
  const stateClasses = selected
    ? "bg-[var(--accent)] text-[var(--accent-fg)] shadow-[inset_0_1px_3px_rgba(0,0,0,0.45)] translate-y-px"
    : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--background)]";

  return (
    <button
      type="button"
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      aria-label={date.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      className={`${baseClasses} ${stateClasses}`}
    >
      <span
        className={`text-[10px] uppercase tracking-wider ${
          selected ? "opacity-80" : "text-[var(--muted)]"
        }`}
      >
        {weekday}
      </span>
      <span className="text-base font-semibold leading-none">
        {showMonth ? `${monthAbbrev} ${day}` : day}
      </span>
      {isToday && !selected && (
        <span
          className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--accent)]"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

// --- Date helpers (local copies; matching page.tsx's same helpers) --

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return startOfLocalDay(out);
}

/** y-m-d string for memo keys + React list keys; collapses two Date instances on the same local day to the same identifier. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
