"use client";

/**
 * The deck — register 3, and the composition's whole argument in one object.
 *
 * Three metrics, ONE TIME AXIS, ONE CROSSHAIR. The tiles on the dashboard
 * already answer *how am I this morning?*; the question a history page is for is
 * *what happened to all three at once* — did the score fall on the morning the
 * resting HR jumped, or two days after it? Three panels with independent x-axes
 * cannot answer that, because the eye has to carry a date from one plot to
 * another and it will not. So the three rows are one bordered instrument
 * separated by hairlines with no gaps, drawn over one list of mornings, and a
 * single accent rule crosses all of them at the same pixel.
 *
 * ── CORRECTION 1, AND WHY THIS FILE CANNOT TRIM IT.
 *
 * `prepareDeck` hands `prepareHrvChart` `windowLength + LEAD_IN` mornings — SIX
 * MORE THAN ARE DRAWN — because a seven-night rolling mean cannot be formed over
 * the first six charted mornings, so the chart's `series` comes back that much
 * shorter than what it was given. The lead-in is what makes `series` come out
 * EQUAL to the visible window: one HRV point per score column, by construction.
 * Without it the leftmost HRV point sits above a score column six mornings newer
 * than itself, the error tapering to zero at the right edge, and the crosshair
 * quietly names the wrong morning at the left of every window. A future reader
 * who trims the lead-in — "we only draw 30 days, why prepare 36?" — silently
 * re-introduces that six-day skew: nothing throws, nothing looks broken, the
 * deck just lies. `deck.test.tsx` pins the contract for all three windows.
 *
 * `prepareDeck` is therefore called EXACTLY ONCE here, and its `days` IS
 * `chart.series` — the same day objects the HRV curve was drawn from, handed
 * straight to the score columns and the resting-HR bars. A second
 * `prepareHrvChart` call inside `hrv-panel.tsx` would be a second chance to
 * disagree about the very axis this correction exists to fix.
 *
 * ── WHY THE SELECTION IS A DATE, AND WHY IT PINS.
 *
 * The page owns the selected morning as an ISO DATE, not an index: the ledger
 * highlights the same morning from the same string, and switching windows clamps
 * naturally — a date that is not in the current window resolves to "nothing
 * selected" here without being cleared behind the user's back, so switching back
 * to 1y restores it.
 *
 * The pin is not a flourish. `pointerleave` fires the instant a finger lifts, so
 * an unpinned crosshair on a phone would clear at the end of every drag and the
 * selected morning could never be read in the ledger below — the selection would
 * be unreachable on the exact surface the SOW requires it to be reachable on.
 * Hence: `pointerdown` pins, a second `pointerdown` on the same morning unpins
 * and clears, `pointerleave` clears only when nothing is pinned, `Escape`
 * always clears. Keyboard selection pins for the same reason. SIMPLIFYING THE
 * PIN AWAY BREAKS THE PHONE.
 *
 * `pointercancel` is the other half of that bargain and is NOT optional. With
 * `touch-action: pan-y`, a finger that starts on the deck and moves down the
 * page is a SCROLL: the browser takes the gesture, and the way it tells us so is
 * to fire `pointercancel` on the `pointerdown` we already acted on. Treating
 * that as a commit is how a page turns scrolling into selecting — a user
 * swiping *past* the deck arrives at the bottom of the page having pinned an
 * arbitrary morning, highlighted in the ledger and offering a jump link they
 * never asked for. So a cancelled press is rolled back to whatever was selected
 * before it, `null` included. A gesture the browser took was never a selection.
 *
 * Nothing here recomputes a server figure. The arithmetic is an index ↔ pixel
 * mapping, which is what a crosshair is.
 */

import { useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import {
  recoveryBand,
  recoveryBandColor,
  round,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { useIsMobile } from "@/lib/use-is-mobile";
import { HrvCalibrating, HrvPanel } from "./hrv-panel";
import { RhrCalibrating, RhrPlot } from "./rhr-plot";
import { ScorePlot } from "./score-plot";
import { isMissingNight, longDate, PLOT_INSET, prepareDeck, shortDate } from "./shared";

/** The page's 10px uppercase label, shared with the strip and the ledger. */
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]";

/**
 * Plot heights, desktop and mobile, in pixels.
 *
 * The three are deliberately unequal: HRV carries a drifting ribbon, a curve and
 * a shape per mark and needs the room; the score columns need enough height for
 * the two zone hairlines to separate; the resting-HR bars diverge about a line
 * and read at half the height of either. Mobile shrinks all three by roughly a
 * quarter rather than hiding a row — this is the history surface, and a phone
 * gets the same three metrics on the same axis.
 *
 * The switch is `useIsMobile()`, which subscribes to `(max-width: 639px)` — the
 * pixel below Tailwind's `sm:` — and the grid below collapses with a plain `sm:`
 * class, so the JS-chosen height and the CSS-chosen layout change on the same
 * pixel and never disagree for a frame.
 *
 * EXPORTED BECAUSE THE LOADING SKELETON DRAWS THE SAME SIX NUMBERS. `page.tsx`'s
 * `DeckSkeleton` exists to be the deck's own geometry rather than a spinner, so
 * that the payload lands into a page the same shape — a promise a second copy of
 * these literals would be free to quietly stop keeping.
 */
export const PLOT_HEIGHTS = { hrv: 170, score: 120, rhr: 100 } as const;
export const PLOT_HEIGHTS_MOBILE = { hrv: 130, score: 90, rhr: 72 } as const;

export type DeckProps = {
  /** The whole payload — the deck windows it itself, via `prepareDeck`. */
  view: RecoveryView;
  /** Mornings to draw, from `WINDOWS`. */
  windowLength: number;
  /** The window's own prose, e.g. "Last 90 days", for the deck's header strip. */
  caption: string;
  /** The selected morning's ISO date, owned by the page. */
  selected: string | null;
  onSelect: (date: string | null) => void;
};

export function Deck({ view, windowLength, caption, selected, onSelect }: DeckProps) {
  const isMobile = useIsMobile();
  const heights = isMobile ? PLOT_HEIGHTS_MOBILE : PLOT_HEIGHTS;
  /**
   * The one call, and the one place on the page that makes it — see correction
   * 1 at the top of this file before moving it.
   *
   * The memo is not a micro-optimisation. Every pointer move re-renders this
   * component, and `prepareDeck` runs `prepareHrvChart` over the window plus
   * its lead-in — up to 371 mornings of rolling means, band runs and
   * classification — so an unmemoised call would do that work on every frame of
   * every drag. The dependency that matters is `view`: it is the page's own
   * `useState` value and is a STABLE REFERENCE between loads. A caller that
   * rebuilt it per render (`{ ...view, days }`, a fresh literal in JSX) would
   * defeat this memo without changing a line here.
   */
  const { chart, days } = useMemo(() => prepareDeck(view, windowLength), [view, windowLength]);
  const n = days.length;

  /**
   * The pin, and the only state this component owns. Everything else about the
   * selection lives on the page, because the ledger reads it too.
   */
  const [pinned, setPinned] = useState(false);

  /**
   * THE GUTTER IS MEASURED, NOT ASSUMED.
   *
   * The ref sits on ONE plot cell — all three share a grid column, so one
   * measurement serves all three — and the rect is read INSIDE the pointer
   * handler rather than snapshotted into state. That is what keeps the index
   * true across a window resize and across the mobile breakpoint, where the
   * 132px gutter this deck has on desktop stops existing entirely. A `GUTTER`
   * pixel constant (the DX mockup's `rect.left + 132`) is a copy of a CSS value
   * that is free to stop being true, and does, silently.
   */
  const plotCell = useRef<HTMLDivElement>(null);

  /**
   * What the selection was immediately BEFORE the current press — the undo
   * `pointercancel` needs, and a ref rather than state because nothing renders
   * from it and writing it must not cost a frame in the middle of a drag.
   *
   * Written on every `pointerdown`, so it can only ever describe the gesture in
   * flight: a `pointercancel` is always preceded by the `pointerdown` for that
   * same pointer, which is what makes one slot enough.
   */
  const beforePress = useRef<{ date: string | null; pinned: boolean } | null>(null);

  /**
   * The selected morning as an index into THIS window's days, or null.
   *
   * A date the current window does not contain resolves to null — the readouts
   * fall back to the latest morning with a value and no crosshair is drawn —
   * and the page's `selected` is deliberately LEFT ALONE. Clearing it from here
   * would throw away a selection the user made at 1y the moment they glanced at
   * 30d. This is also the clamp: no index derived here can point past the end of
   * a shorter array.
   */
  const selectedIdx = useMemo(() => {
    if (selected === null) return null;
    const i = days.findIndex((d) => d.date === selected);
    return i < 0 ? null : i;
  }, [days, selected]);

  // A fraction rather than a percentage, so the rule can be positioned with the
  // SAME inset the plots draw with and land exactly on the morning at either end.
  const crosshair = selectedIdx === null ? null : n <= 1 ? 0.5 : selectedIdx / (n - 1);

  /**
   * A pointer's `clientX` → the morning under it, using the same `PLOT_INSET`
   * and the same mapping `xAt` gives the plots — this is that function inverted,
   * and any change to one is a change to both.
   */
  function indexAt(clientX: number): number | null {
    const el = plotCell.current;
    if (el === null || n === 0) return null;
    const rect = el.getBoundingClientRect();
    const span = rect.width - 2 * PLOT_INSET;
    if (span <= 0) return null;
    // One morning has no span to spread across; it owns the whole cell.
    if (n === 1) return 0;
    const idx = Math.round(((clientX - rect.left - PLOT_INSET) / span) * (n - 1));
    return Math.min(n - 1, Math.max(0, idx));
  }

  function select(idx: number, pin: boolean) {
    setPinned(pin);
    const date = days[idx].date;
    if (date !== selected) onSelect(date);
  }

  function clear() {
    setPinned(false);
    if (selected !== null) onSelect(null);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const idx = indexAt(event.clientX);
    // The crosshair follows the pointer whether or not a morning is pinned: a
    // pin is a selection that OUTLIVES the pointer, not a lock on it.
    if (idx !== null) select(idx, pinned);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    // Recorded before anything is changed, and before the early return, so the
    // snapshot describes the page as the user left it rather than as this press
    // found it half-applied.
    beforePress.current = { date: selected, pinned };
    const idx = indexAt(event.clientX);
    if (idx === null) return;
    // A second press on the morning already pinned is the way back out.
    if (pinned && days[idx].date === selected) {
      clear();
      return;
    }
    select(idx, true);
  }

  /**
   * The browser has taken the gesture — this was a scroll, not a tap.
   *
   * Everything the press (and any moves inside it) did is undone: the selection
   * goes back to what it was before `pointerdown`, `null` included, and the pin
   * goes back with it. See the header — a `pointercancel` treated as a commit is
   * how a vertical swipe past the deck pins an arbitrary morning on a phone.
   */
  function onPointerCancel() {
    const before = beforePress.current;
    if (before === null) return;
    beforePress.current = null;
    setPinned(before.pinned);
    if (before.date !== selected) onSelect(before.date);
  }

  function onPointerLeave() {
    // Only an unpinned crosshair follows the pointer out of the deck. On touch
    // this fires the moment the finger lifts — see the header.
    if (!pinned) clear();
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      clear();
      return;
    }
    if (n === 0) return;
    // Stepping starts from the NEWEST morning, which is where the readouts are
    // already pointing when nothing is selected.
    const from = selectedIdx ?? n - 1;
    const next =
      event.key === "ArrowLeft"
        ? Math.max(0, from - 1)
        : event.key === "ArrowRight"
          ? Math.min(n - 1, from + 1)
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? n - 1
              : null;
    if (next === null) return;
    // Without this the arrow keys scroll the page out from under the selection
    // the user is reading.
    event.preventDefault();
    // Keyboard selection always pins: there is no pointer to leave, and an
    // unpinned keyboard selection would be cleared by the next stray hover.
    select(next, true);
  }

  const hrvRead = readoutOf(days, selectedIdx, (d) => d.hrv);
  const scoreRead = readoutOf(days, selectedIdx, (d) => d.recoveryScore);
  const rhrRead = readoutOf(days, selectedIdx, (d) => d.restingHr);

  const baseline = view.baseline;
  const rhrAvg = baseline?.restingHrAvg ?? null;

  /**
   * The morning the header strip names — and it must be a morning the deck has
   * something to SAY about.
   *
   * With a selection that is the selected morning, unarguably. Without one the
   * readouts have already reached back to the latest morning carrying a value,
   * so the header reaches back with them: the newest morning in the window with
   * ANY reading, and only when there is none does it fall back to the newest
   * slot. Naming the newest slot unconditionally is what produced "Wed 12 Aug"
   * in 11px mono above three readouts all saying `latest · 11 Aug` on the
   * morning a webhook had not landed — a header naming a morning the page has
   * nothing to report for is the dead hero of Fixed Decision 5 in a smaller
   * font. `readoutOf` falls back per METRIC and this falls back per MORNING, so
   * on a partial-null morning the header still names it while the one empty
   * metric honestly names an older one.
   */
  const heading =
    selectedIdx !== null
      ? days[selectedIdx]
      : n === 0
        ? null
        : (latestRecorded(days) ?? days[n - 1]);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
        <span className={LABEL}>{caption} · one axis</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--foreground)]">
          {heading === null ? "No mornings in window" : longDate(heading.date)}
        </span>
      </div>

      {/*
        The deck body is the instrument: the focusable group, the pointer
        surface, and the live region all at once.

        `aria-live="polite"` sits here because the three readouts are the only
        text inside it that moves with the selection — the plots' `aria-label`
        summaries are fixed for a given window and the crosshair rule carries no
        text at all — so a screen-reader user hears the morning they stepped to
        and nothing else. Each plot keeps its own `role="img"` for the
        non-interactive read.

        `touch-action: pan-y` is what lets a finger do both jobs: a horizontal
        drag scrubs the crosshair, a vertical one still scrolls the page.
      */}
      <div
        role="group"
        tabIndex={0}
        aria-label={`Recovery deck, ${caption}. Three metrics on one time axis — arrow keys select a morning, Escape clears.`}
        aria-live="polite"
        className="divide-y divide-[var(--border)] outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
        style={{ touchAction: "pan-y" }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
      >
        <DeckRow
          name="HRV"
          figure={round(hrvRead.value)}
          unit="ms"
          when={whenLabel(hrvRead)}
          // The one measured cell. All three rows share this grid column.
          measureRef={plotCell}
          // No chart, no third series to bind — the crosshair honestly spans the
          // two rows that do have one.
          crosshair={chart === null ? null : crosshair}
        >
          {chart === null ? (
            <HrvCalibrating nights={baseline?.hrvDays ?? 0} />
          ) : (
            <HrvPanel chart={chart} height={heights.hrv} />
          )}
        </DeckRow>

        <DeckRow
          name="Recovery"
          figure={round(scoreRead.value)}
          unit="%"
          when={whenLabel(scoreRead)}
          // The one readout on the deck that takes band colour — the score is
          // the page's three-band metric and this is where the colour budget is
          // spent. The other two are `--foreground`.
          tone={recoveryBandColor(recoveryBand(scoreRead.value))}
          crosshair={crosshair}
        >
          <ScorePlot days={days} height={heights.score} />
        </DeckRow>

        <DeckRow
          name="Resting HR"
          figure={round(rhrRead.value)}
          unit="bpm"
          when={whenLabel(rhrRead)}
          // No trailing average, no zero line, nothing drawn — so nothing for a
          // crosshair to point at either.
          crosshair={rhrAvg === null ? null : crosshair}
        >
          {baseline && baseline.restingHrAvg !== null ? (
            <RhrPlot
              days={days}
              avg={baseline.restingHrAvg}
              windowDays={baseline.windowDays}
              height={heights.rhr}
            />
          ) : (
            <RhrCalibrating nights={baseline?.restingHrDays ?? 0} />
          )}
        </DeckRow>
      </div>
    </div>
  );
}

/**
 * One row: a metric's name and readout, and its plot.
 *
 * DESKTOP is `[132px, 1fr]` — a left gutter carrying the name, a 16px mono
 * readout with its unit and a 9px `when` line, beside the plot. MOBILE collapses
 * the grid to one column and turns that gutter into a compact header row ABOVE
 * the plot, because 132px of a 360px screen spent on a label is a third of the
 * chart. The collapse is a plain `sm:` class rather than a JS branch so it
 * switches on the same 640px `useIsMobile` reads.
 */
function DeckRow({
  name,
  figure,
  unit,
  when,
  tone,
  crosshair,
  measureRef,
  children,
}: {
  name: string;
  figure: string;
  unit: string;
  when: string;
  tone?: string;
  /** `idx / (n - 1)`, or null when this row has no series to bind. */
  crosshair: number | null;
  measureRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 py-3 sm:grid-cols-[132px_minmax(0,1fr)]">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 sm:flex-col sm:items-start sm:gap-1.5 sm:pr-3 sm:pl-4">
        <span className={LABEL}>{name}</span>
        <div className="flex items-baseline gap-1">
          <span
            className="font-mono text-[16px] leading-none font-semibold tabular-nums"
            style={{ color: tone ?? "var(--foreground)" }}
          >
            {figure}
          </span>
          <span className="text-[10px] text-[var(--muted)]">{unit}</span>
        </div>
        <span className="text-[9px] tracking-[0.08em] text-[var(--faint)] uppercase">{when}</span>
      </div>

      <div className="mt-2 px-4 sm:mt-0 sm:px-0 sm:pr-4">
        {/*
          The measured box. Padding lives on the cell OUTSIDE this element, so
          its width is exactly the width the plots inside it measure for
          themselves — the crosshair, the columns and the HRV marks then agree
          about where morning `i` is.
        */}
        <div ref={measureRef} className="relative">
          {children}
          {crosshair !== null && (
            <span
              data-testid="deck-crosshair"
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 w-px bg-[var(--accent-line)]"
              style={{
                left: `calc(${PLOT_INSET}px + ${crosshair} * (100% - ${PLOT_INSET * 2}px))`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Readouts ──────────────────────────────────────────────────────────────────

type Readout = { value: number | null; date: string | null; selected: boolean };

/**
 * The selected morning's value, or — when nothing is selected — the most recent
 * morning in the window that HAS one.
 *
 * Falling back per-metric rather than to "today" is the point: on a morning
 * whose webhook has not landed, or a partial-null one, the HRV readout can name
 * a different morning from the score readout, and both are true. What is never
 * allowed is a stale number wearing today's label, which is why `whenLabel`
 * always says WHICH morning the figure came from.
 */
function readoutOf(
  days: RecoveryDayPoint[],
  idx: number | null,
  get: (d: RecoveryDayPoint) => number | null,
): Readout {
  if (days.length === 0) return { value: null, date: null, selected: false };
  if (idx !== null) {
    const d = days[idx];
    return { value: get(d), date: d.date, selected: true };
  }
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const v = get(days[i]);
    if (v !== null) return { value: v, date: days[i].date, selected: false };
  }
  return { value: null, date: null, selected: false };
}

/**
 * The newest morning in the window Whoop actually recorded something for, or
 * null when it recorded nothing at all.
 *
 * `isMissingNight` — all three metrics null — is the same test the ledger drops
 * a row on, so the header can only ever name a morning the ledger below it also
 * has something to show for.
 */
function latestRecorded(days: RecoveryDayPoint[]): RecoveryDayPoint | null {
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if (!isMissingNight(days[i])) return days[i];
  }
  return null;
}

/** `12 Aug` under the crosshair, `latest · 11 Aug` without one — never `today`. */
function whenLabel(r: Readout): string {
  if (r.date === null) return "no reading";
  return r.selected ? shortDate(r.date) : `latest · ${shortDate(r.date)}`;
}
