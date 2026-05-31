"use client";

import { useMemo, useState } from "react";

/**
 * Horizontal row of date tiles for picking which day's nutrition log
 * to view. Replaces the prior chevron + <input type="date"> + Today
 * combo — tiles are a more "at a glance" UI for a tracker where
 * users primarily skim the past week.
 *
 * The strip shows a sliding window of `daysVisible` consecutive
 * dates. Default mounts with today as the rightmost tile. Chevron
 * buttons flanking the strip slide the window one full row at a
 * time (forward toward today, backward without bound) so the user
 * can scroll back as far as they want to read older logs. The
 * forward chevron disables when today is already in view — there
 * are no future nutrition logs to navigate to. A separate "Today"
 * pill appears whenever today is outside the visible window so
 * users don't have to multi-click `›` to get back; one tap snaps
 * the window AND selects today.
 *
 * Window state lives in the strip itself. The selected `value`
 * stays put when the window shifts — sliding around to look at
 * older dates doesn't deselect the user's prior pick. The strip
 * just doesn't highlight any tile when the selection is offscreen.
 */
export function DateTileStrip({
  value,
  onChange,
  daysVisible = 7,
}: {
  /** The currently-selected local date. Compared by y/m/d, not by Date instance identity. */
  value: Date;
  onChange: (d: Date) => void;
  /** How many consecutive days the strip renders. Default 7 = a week at a glance. */
  daysVisible?: number;
}) {
  const today = startOfLocalDay(new Date());
  const todayKey = ymd(today);

  // `windowEnd` is the rightmost-visible date. Default to today on
  // mount so users land on the current week. Chevrons mutate this
  // state; tile clicks do not — selecting a date and shifting the
  // window are two different actions.
  const [windowEnd, setWindowEnd] = useState<Date>(today);
  const windowEndKey = ymd(windowEnd);

  const dates = useMemo(() => {
    const out: Date[] = [];
    for (let i = daysVisible - 1; i >= 0; i--) {
      out.push(addDays(windowEnd, -i));
    }
    return out;
    // Both windowEnd and today are fresh Date instances each render;
    // the *Key strings collapse to the same identifier on the same
    // local day so the memo stays stable across re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowEndKey, daysVisible]);

  const todayInWindow = sameLocalDay(windowEnd, today);

  function shiftBack() {
    // Backwards is unbounded — users can scroll as far back as they
    // care to. Shift by the full window so each click is "show me
    // the previous row of dates" rather than a 1-day nudge.
    setWindowEnd(addDays(windowEnd, -daysVisible));
  }
  function shiftForward() {
    // Cap at today on the right edge so we never present future
    // tiles users can't have logged anything against. minDate keeps
    // the cap honest even when the user's gone back several rows.
    setWindowEnd(minDate(addDays(windowEnd, daysVisible), today));
  }
  function jumpToToday() {
    setWindowEnd(today);
    onChange(today);
  }

  return (
    <div className="flex items-center gap-2">
      <NavButton onClick={shiftBack} ariaLabel="Previous week">
        <ChevronLeftIcon />
      </NavButton>

      <div
        className="grid flex-1 gap-2"
        style={{ gridTemplateColumns: `repeat(${daysVisible}, minmax(0, 1fr))` }}
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

      <NavButton
        onClick={shiftForward}
        disabled={todayInWindow}
        ariaLabel="Next week"
      >
        <ChevronRightIcon />
      </NavButton>

      {!todayInWindow && (
        // Snap-to-today affordance. Only renders when today is
        // offscreen so the strip stays visually quiet during the
        // dominant "looking at this week" case. Clicking it both
        // shifts the window AND selects today — clicking "Today"
        // when you can't see today is almost always shorthand for
        // "show me today's log," so we collapse the two actions.
        <button
          type="button"
          onClick={jumpToToday}
          className="ml-1 inline-flex items-center text-sm font-medium text-[var(--foreground)] transition hover:opacity-70"
        >
          Today
        </button>
      )}
      {/* todayKey is referenced so the strip re-renders when the
          calendar day rolls over even if no props/state changed —
          a long-idle tab sitting open past midnight should pick up
          the new "today" without a manual refresh. */}
      <span className="hidden" aria-hidden="true">
        {todayKey}
      </span>
    </div>
  );
}

function NavButton({
  onClick,
  disabled,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  // Same surface bg + border as default tiles so the chevrons read
  // as part of the strip rather than floating controls. Disabled
  // state dims to 30% opacity and disables pointer events so the
  // forward chevron at today-rightmost feels inert.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--background)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-[var(--surface)]"
    >
      {children}
    </button>
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

// --- Inline icons ---------------------------------------------------

function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
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

function minDate(a: Date, b: Date): Date {
  return a.getTime() <= b.getTime() ? a : b;
}

/** y-m-d string for memo keys + React list keys; collapses two Date instances on the same local day to the same identifier. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
