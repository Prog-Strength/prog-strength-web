/// <reference types="vitest/globals" />

import { useState } from "react";
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { calibratingView, defaultView, FIXTURE_TODAY, noReadingYetView } from "../fixtures";
import { addDays, LEAD_IN, prepareDeck, shortDate, WINDOWS } from "./shared";
import { Deck } from "./deck";

// jsdom doesn't implement matchMedia; `useIsMobile` subscribes to it for its
// mobile/desktop snapshot. A minimal, non-matching stub gives every test below
// the DESKTOP rendering — the 132px gutter and the tall plots. The mobile half
// is exercised by flipping `matches` in its own test at the bottom.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * The global stub in `vitest.setup.ts` reports every element as 260px wide at
 * left 0, and the deck reads the plot cell's own rect at pointer time. Mirrored
 * rather than imported, because these tests exist to catch a change to the
 * pointer arithmetic and so must not move with it.
 */
const STUB_LEFT = 0;
/** `PLOT_INSET`, mirrored for the same reason. The drawable span is 260 − 2×4.6. */
const INSET = 4.6;

/** The deck body: the focusable group, the pointer surface and the live region. */
function deckBody(): HTMLElement {
  return screen.getByRole("group", { name: /Recovery deck/ });
}

/**
 * jsdom has no real `PointerEvent`, so testing-library falls back to a plain
 * `Event` and `clientX` is silently dropped — every pointer event would look
 * like a press at x=0, which is exactly the coordinate that makes the index
 * inversion look like it works while asserting nothing. Pin it onto the event,
 * as `RecapChart.test.tsx` does for the same reason.
 */
function firePointer(el: Element, type: "pointerDown" | "pointerMove", clientX: number) {
  const event = createEvent[type](el);
  Object.defineProperty(event, "clientX", { value: clientX });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(el, event);
}

/** A key press whose `defaultPrevented` the caller can read afterwards. */
function fireKey(el: Element, key: string): Event {
  const event = createEvent.keyDown(el, { key });
  fireEvent(el, event);
  return event;
}

function crosshairs(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[data-testid="deck-crosshair"]'));
}

function label(name: RegExp): string {
  return screen.getByRole("img", { name }).getAttribute("aria-label") ?? "";
}

const HRV_LABEL = /7-day average HRV/;
const SCORE_LABEL = /mornings of recovery score/;
const RHR_LABEL = /of resting heart rate/;

function renderDeck(opts: {
  view: RecoveryView;
  windowLength: number;
  selected?: string | null;
  onSelect?: (date: string | null) => void;
}) {
  return render(
    <Deck
      view={opts.view}
      windowLength={opts.windowLength}
      caption="Last 90 days"
      selected={opts.selected ?? null}
      onSelect={opts.onSelect ?? vi.fn()}
    />,
  );
}

/**
 * The page's own ownership of the selection, mirrored: the date lives above the
 * deck so the ledger can highlight the same morning. The pin tests need it
 * because a pin is only observable across two interactions.
 */
function ControlledDeck({
  view,
  windowLength,
  onSelect,
}: {
  view: RecoveryView;
  windowLength: number;
  onSelect?: (date: string | null) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Deck
      view={view}
      windowLength={windowLength}
      caption="Last 30 days"
      selected={selected}
      onSelect={(date) => {
        setSelected(date);
        onSelect?.(date);
      }}
    />
  );
}

// ── A view with nothing missing ───────────────────────────────────────────────

/**
 * The default fixture is deliberately unkind — missing nights, mornings with a
 * score but no HRV — so its three rows draw DIFFERENT numbers of elements over
 * the same list of mornings, which is correct and is each plot's own contract.
 * The "one mark, one column, one bar per morning" reading of the alignment
 * contract is only meaningful over a window where every morning was recorded,
 * so these tests build one.
 */
function denseDay(date: string, i: number): RecoveryDayPoint {
  return {
    date,
    restingHr: 50 + (i % 3),
    recoveryScore: 40 + (i % 40),
    hrv: 90 + (i % 5),
    baselineAvg: 90,
    balancedLow: 78,
    balancedHigh: 102,
    zScore: 0,
    status: "balanced",
  };
}

/** `n` consecutive fully-recorded mornings, the newest on the fixture's today. */
function denseView(n: number): RecoveryView {
  const days = Array.from({ length: n }, (_, i) =>
    denseDay(addDays(FIXTURE_TODAY, i - (n - 1)), i),
  );
  const today = days[days.length - 1];
  return {
    restingToday: today.restingHr,
    recoveryScore: today.recoveryScore,
    hrvToday: today.hrv,
    spark: days.flatMap((d) => (d.restingHr === null ? [] : [d.restingHr])),
    days,
    baseline: {
      windowDays: 30,
      restingHrAvg: 51,
      restingHrDays: 30,
      hrvAvg: 92,
      hrvStdDev: 6,
      hrvDays: 30,
      recoveryScoreAvg: 60,
      recoveryScoreDays: 30,
    },
    hrv: {
      status: "balanced",
      balancedLow: 78,
      balancedHigh: 102,
      zScore: 0,
      trend: "steady",
      shortAvg: 92,
    },
    baselineTrend: { direction: "steady", deltaMs: 0, fromAvg: 92, overDays: 28 },
  };
}

/**
 * The same view with no HRV band established yet — the field `prepareHrvChart`
 * refuses to draw without. It is the state a user whose resting HR has
 * calibrated but whose HRV has not is actually in, and the only way to see the
 * crosshair bind two rows while the other two still have a series.
 */
function withoutHrvBand(view: RecoveryView): RecoveryView {
  const { hrv } = view;
  if (hrv === undefined) throw new Error("fixture carries no hrv block");
  return { ...view, hrv: { ...hrv, balancedLow: null } };
}

function num(el: Element, attr: string): number {
  return Number.parseFloat(el.getAttribute(attr) ?? "");
}

/** A `<g transform="translate(x y)">` mark's x. */
function markX(mark: Element): number {
  const match = /translate\(([-\d.]+) /.exec(mark.getAttribute("transform") ?? "");
  return Number.parseFloat(match?.[1] ?? "");
}

/** A column's or bar's centre — the point the crosshair and the marks share. */
function centre(rect: Element): number {
  return num(rect, "x") + num(rect, "width") / 2;
}

// ── Alignment: the correction-1 contract ──────────────────────────────────────

describe("Deck — one time axis", () => {
  it.each(WINDOWS.map((w) => [w.key, w.days] as const))(
    "draws all three rows over one list of mornings at %s",
    (_key, windowLength) => {
      const view = defaultView();
      const { chart, days } = prepareDeck(view, windowLength);
      // The lead-in has done its work: the chart's series IS the deck's days,
      // the same objects, so the three rows cannot describe different stretches.
      expect(chart).not.toBeNull();
      expect(chart?.series.map((d) => d.date)).toEqual(days.map((d) => d.date));
      expect(days).toHaveLength(windowLength);

      renderDeck({ view, windowLength });

      // Each plot states its own extent in its `role="img"` summary; all three
      // must state the same count, and the HRV axis the same two end dates.
      const first = shortDate(days[0].date);
      const last = shortDate(days[days.length - 1].date);
      expect(label(HRV_LABEL)).toContain(
        `${days.length} mornings of 7-day average HRV, ${first} to ${last},`,
      );
      expect(label(SCORE_LABEL)).toContain(`${days.length} mornings of recovery score`);
      expect(label(RHR_LABEL)).toContain(`${days.length} mornings of resting heart rate`);
    },
  );

  it.each(WINDOWS.map((w) => [w.key, w.days] as const))(
    "puts one mark, one column and one bar per recorded morning at %s",
    (_key, windowLength) => {
      const view = denseView(windowLength + LEAD_IN);
      const { days } = prepareDeck(view, windowLength);
      expect(days).toHaveLength(windowLength);

      const { container } = renderDeck({ view, windowLength });

      const marks = Array.from(container.querySelectorAll('[data-testid="hrv-mark"]'));
      const columns = Array.from(
        screen.getByRole("img", { name: SCORE_LABEL }).querySelectorAll("rect"),
      );
      const bars = Array.from(container.querySelectorAll('[data-testid="rhr-bar"]'));

      expect(marks).toHaveLength(windowLength);
      expect(columns).toHaveLength(marks.length);
      expect(bars).toHaveLength(marks.length);

      // And the same morning is at the same pixel in all three rows, at both
      // ends of the window — which is what the crosshair depends on and what a
      // trimmed lead-in would break by six mornings at the left edge.
      expect(centre(columns[0])).toBeCloseTo(markX(marks[0]), 5);
      expect(centre(bars[0])).toBeCloseTo(markX(marks[0]), 5);
      expect(centre(columns[columns.length - 1])).toBeCloseTo(markX(marks[marks.length - 1]), 5);
      expect(centre(bars[bars.length - 1])).toBeCloseTo(markX(marks[marks.length - 1]), 5);
    },
  );

  it("narrows all three rows together when history is shorter than the window", () => {
    const stored = 20;
    const view = denseView(stored);
    const { days } = prepareDeck(view, 90);
    // 20 stored mornings, six of them spent as lead-in before the curve starts.
    expect(days).toHaveLength(stored - LEAD_IN);

    renderDeck({ view, windowLength: 90 });

    const first = shortDate(days[0].date);
    const last = shortDate(days[days.length - 1].date);
    expect(label(HRV_LABEL)).toContain(
      `${days.length} mornings of 7-day average HRV, ${first} to ${last},`,
    );
    expect(label(SCORE_LABEL)).toContain(`${days.length} mornings of recovery score`);
    expect(label(RHR_LABEL)).toContain(`${days.length} mornings of resting heart rate`);
  });

  it("calibrates the HRV row alone and still draws the other two over the window", () => {
    const view = calibratingView();
    const { chart, days } = prepareDeck(view, 30);
    // Nine mornings, no baseline: there is no chart to draw, and the window is
    // simply everything stored.
    expect(chart).toBeNull();
    expect(days).toHaveLength((view.days ?? []).length);

    const { container } = renderDeck({ view, windowLength: 30 });

    expect(screen.getByText("Calibrating your band")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: HRV_LABEL })).toBeNull();
    expect(label(SCORE_LABEL)).toContain(`${days.length} mornings of recovery score`);
    // This fixture has no resting-HR average either, so that row prints its own
    // honest sentence rather than bars against a number that does not exist.
    expect(screen.getByTestId("rhr-calibrating")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="rhr-bar"]')).toHaveLength(0);
  });

  it("binds the crosshair to the two rows that have a series when HRV is calibrating", () => {
    // A user whose resting HR is calibrated but whose HRV band is not: the
    // chart is null, the bars still draw, and the crosshair honestly spans two
    // rows rather than pretending there is a third series to bind.
    const view = withoutHrvBand(denseView(40));
    const { chart, days } = prepareDeck(view, 30);
    expect(chart).toBeNull();

    const { container } = renderDeck({ view, windowLength: 30, selected: days[5].date });

    expect(screen.getByText("Calibrating your band")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="rhr-bar"]')).toHaveLength(days.length);
    expect(crosshairs(container)).toHaveLength(2);
  });
});

// ── Correction 4: pointer, keyboard, touch ────────────────────────────────────

describe("Deck — the crosshair", () => {
  it("reads the index off the plot cell's own box at pointer time", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const onSelect = vi.fn();
    renderDeck({ view, windowLength: 30, onSelect });

    // The stub's box is left 0, width 260, so the drawable span is 250.8px and
    // 30 mornings sit 29 steps apart across it. clientX 91 is
    // (91 − 0 − 4.6) / 250.8 = 0.3445 of the span, × 29 = 9.99 → morning 10.
    firePointer(deckBody(), "pointerMove", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenCalledWith(days[10].date);

    // Both ends clamp rather than running off the array.
    firePointer(deckBody(), "pointerMove", STUB_LEFT - 500);
    expect(onSelect).toHaveBeenLastCalledWith(days[0].date);
    firePointer(deckBody(), "pointerMove", STUB_LEFT + 5000);
    expect(onSelect).toHaveBeenLastCalledWith(days[days.length - 1].date);
  });

  it("measures the plot cell itself rather than assuming a gutter width", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const onSelect = vi.fn();
    const { container } = renderDeck({
      view,
      windowLength: 30,
      selected: days[0].date,
      onSelect,
    });

    // The measured box is the cell the crosshair sits inside — the HRV row's,
    // since all three rows share the grid column. Give it a box that is NOT the
    // deck body's: a 100px gutter and a 300px plot. A deck that derived the
    // index from its own rect plus a `GUTTER` constant would read this wrong,
    // which is exactly what happens at the mobile breakpoint where the gutter
    // stops existing.
    const cell = crosshairs(container)[0].parentElement;
    if (cell === null) throw new Error("no plot cell");
    Object.defineProperty(cell, "getBoundingClientRect", {
      configurable: true,
      value: () => ({ left: 100, width: 300, top: 0, height: 170, right: 400, bottom: 170 }),
    });

    // (305 − 100 − 4.6) / (300 − 9.2) = 0.689 of the span, × 29 = 19.98 → 20.
    firePointer(deckBody(), "pointerMove", 305);
    expect(onSelect).toHaveBeenLastCalledWith(days[20].date);
  });

  it("positions the rule with the same inset the plots draw with", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const { container } = renderDeck({ view, windowLength: 30, selected: days[10].date });

    const rules = crosshairs(container);
    expect(rules).toHaveLength(3);
    for (const rule of rules) {
      expect(rule.style.left).toBe(`calc(${INSET}px + ${10 / 29} * (100% - ${2 * INSET}px))`);
    }
  });

  it("steps, jumps and clears from the keyboard without scrolling the page", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const last = days.length - 1;
    const onSelect = vi.fn();
    const { rerender } = renderDeck({ view, windowLength: 30, onSelect });

    // Nothing selected: stepping starts from the newest morning, which is the
    // one the readouts are already pointing at.
    expect(fireKey(deckBody(), "ArrowLeft").defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(days[last - 1].date);
    expect(fireKey(deckBody(), "ArrowRight").defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(days[last].date);
    expect(fireKey(deckBody(), "Home").defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(days[0].date);
    expect(fireKey(deckBody(), "End").defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(days[last].date);

    // A key the deck does not handle is left to the page.
    onSelect.mockClear();
    expect(fireKey(deckBody(), "PageDown").defaultPrevented).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();

    rerender(
      <Deck
        view={view}
        windowLength={30}
        caption="Last 90 days"
        selected={days[10].date}
        onSelect={onSelect}
      />,
    );
    // From a selection, the arrows step one morning at a time.
    fireKey(deckBody(), "ArrowLeft");
    expect(onSelect).toHaveBeenLastCalledWith(days[9].date);
    expect(fireKey(deckBody(), "Escape").defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("keeps a pinned morning when the pointer leaves, and a second press clears it", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const onSelect = vi.fn();
    const { container } = render(
      <ControlledDeck view={view} windowLength={30} onSelect={onSelect} />,
    );

    // A press pins morning 10 — the same arithmetic as the move test.
    firePointer(deckBody(), "pointerDown", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenLastCalledWith(days[10].date);

    // On touch, `pointerleave` fires the instant the finger lifts. A pinned
    // selection has to survive it or the ledger below could never be read.
    onSelect.mockClear();
    fireEvent.pointerLeave(deckBody());
    expect(onSelect).not.toHaveBeenCalled();
    expect(crosshairs(container)).toHaveLength(3);

    // A second press on the SAME morning is the way back out.
    firePointer(deckBody(), "pointerDown", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(crosshairs(container)).toHaveLength(0);
  });

  it("rolls back a press the browser cancelled, from nothing selected", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const onSelect = vi.fn();
    const { container } = render(
      <ControlledDeck view={view} windowLength={30} onSelect={onSelect} />,
    );

    // A finger lands on the deck and then travels DOWN the page. `pan-y` hands
    // the gesture to the browser, which tells us so with `pointercancel` — on a
    // press we have already acted on.
    firePointer(deckBody(), "pointerDown", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenLastCalledWith(days[10].date);
    expect(crosshairs(container)).toHaveLength(3);

    // A scroll is not a selection. The user swiped PAST the deck and must not
    // arrive at the ledger with an arbitrary morning highlighted.
    fireEvent.pointerCancel(deckBody());
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(crosshairs(container)).toHaveLength(0);

    // The pin was rolled back with it, not merely the date: an unpinned
    // crosshair still leaves with the pointer.
    firePointer(deckBody(), "pointerMove", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenLastCalledWith(days[10].date);
    fireEvent.pointerLeave(deckBody());
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(crosshairs(container)).toHaveLength(0);
  });

  it("rolls back a cancelled press to the morning that was already pinned", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const onSelect = vi.fn();
    const { container } = render(
      <ControlledDeck view={view} windowLength={30} onSelect={onSelect} />,
    );

    // A deliberate tap pins morning 10 and that pin is the user's, not the
    // browser's — nothing below may take it away.
    firePointer(deckBody(), "pointerDown", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenLastCalledWith(days[10].date);

    // A later press starts on morning 20 and turns into a scroll.
    firePointer(deckBody(), "pointerDown", STUB_LEFT + 178);
    expect(onSelect).toHaveBeenLastCalledWith(days[20].date);
    fireEvent.pointerCancel(deckBody());
    expect(onSelect).toHaveBeenLastCalledWith(days[10].date);

    // Back exactly where it was — including pinned, so a leave still keeps it.
    onSelect.mockClear();
    fireEvent.pointerLeave(deckBody());
    expect(onSelect).not.toHaveBeenCalled();
    expect(crosshairs(container)).toHaveLength(3);
  });

  it("clears an unpinned crosshair when the pointer leaves", () => {
    const view = defaultView();
    const { days } = prepareDeck(view, 30);
    const onSelect = vi.fn();
    const { container } = render(
      <ControlledDeck view={view} windowLength={30} onSelect={onSelect} />,
    );

    firePointer(deckBody(), "pointerMove", STUB_LEFT + 91);
    expect(onSelect).toHaveBeenLastCalledWith(days[10].date);
    expect(crosshairs(container)).toHaveLength(3);

    fireEvent.pointerLeave(deckBody());
    expect(onSelect).toHaveBeenLastCalledWith(null);
    expect(crosshairs(container)).toHaveLength(0);
  });
});

// ── The readouts ──────────────────────────────────────────────────────────────

describe("Deck — the readouts", () => {
  function live(container: HTMLElement): HTMLElement {
    const region = container.querySelector('[aria-live="polite"]');
    if (region === null) throw new Error("no live region");
    return region as HTMLElement;
  }

  it("moves all three readouts to the selected morning, inside the live region", () => {
    const view = defaultView();
    // Tue 11 Aug — 78 on 50 bpm and 106 ms, the fixture's contract.
    const { container, rerender } = renderDeck({
      view,
      windowLength: 30,
      selected: "2026-08-11",
    });

    const region = within(live(container));
    expect(region.getByText("106")).toBeInTheDocument();
    expect(region.getByText("78")).toBeInTheDocument();
    expect(region.getByText("50")).toBeInTheDocument();
    // Every row names the morning it is reading, and none of them says `today`.
    expect(region.getAllByText("11 Aug")).toHaveLength(3);

    rerender(
      <Deck
        view={view}
        windowLength={30}
        caption="Last 90 days"
        selected="2026-08-10"
        onSelect={vi.fn()}
      />,
    );
    // Mon 10 Aug — 52 on 47 bpm and 96 ms. The readouts move together.
    expect(region.getByText("96")).toBeInTheDocument();
    expect(region.getByText("52")).toBeInTheDocument();
    expect(region.getByText("47")).toBeInTheDocument();
    expect(region.getAllByText("10 Aug")).toHaveLength(3);
  });

  it("falls back to the latest morning with a value, labelled `latest`", () => {
    const view = defaultView();
    const { container } = renderDeck({ view, windowLength: 30 });

    // Wed 12 Aug — 13 on 69 bpm and 45 ms, named as the latest morning rather
    // than as `today`, which is a word this page never prints (Fixed Decision 5:
    // a stale figure must never wear today's label).
    const region = within(live(container));
    expect(region.getByText("45")).toBeInTheDocument();
    expect(region.getByText("13")).toBeInTheDocument();
    expect(region.getByText("69")).toBeInTheDocument();
    expect(region.getAllByText("latest · 12 Aug")).toHaveLength(3);
    expect(screen.queryByText("today")).toBeNull();
  });

  it("names yesterday when today's webhook has not landed, and never promotes it", () => {
    // 7am on Wed 12 Aug: the slot exists and is empty. The deck must reach back
    // to the latest morning that HAS a value and SAY SO — the failure this
    // guards is the one Fixed Decision 5 names, where yesterday's figure is
    // promoted into today's slot and printed under today's label.
    const { container } = renderDeck({ view: noReadingYetView(), windowLength: 30 });

    // Tue 11 Aug — 78 on 50 bpm and 106 ms, the fixture's contract.
    const region = within(live(container));
    expect(region.getByText("106")).toBeInTheDocument();
    expect(region.getByText("78")).toBeInTheDocument();
    expect(region.getByText("50")).toBeInTheDocument();
    expect(region.getAllByText("latest · 11 Aug")).toHaveLength(3);
    expect(region.queryByText("latest · 12 Aug")).toBeNull();
    // The empty slot is still ON THE AXIS — the score row draws thirty mornings
    // and simply has no column in the last one, so the deck does not compress.
    expect(label(SCORE_LABEL)).toContain("30 mornings of recovery score");
  });

  /** The header strip's date — the span beside the caption, above the deck body. */
  function headerDate(container: HTMLElement): string {
    const strip = container.querySelector('[role="group"]')?.previousElementSibling;
    if (strip == null) throw new Error("no header strip");
    return strip.lastElementChild?.textContent ?? "";
  }

  it("names the same morning in the header as in the readouts", () => {
    // 7am on Wed 12 Aug: the newest SLOT exists and is empty. A header that
    // named it would print "Wed 12 Aug" above three readouts all saying
    // `latest · 11 Aug` — the deck naming a morning it has nothing to say about.
    const { container, rerender } = renderDeck({ view: noReadingYetView(), windowLength: 30 });

    expect(within(live(container)).getAllByText("latest · 11 Aug")).toHaveLength(3);
    expect(headerDate(container)).toBe("Tue 11 Aug");
    expect(headerDate(container)).not.toBe("Wed 12 Aug");

    // A selection still wins outright: the header names the pinned morning.
    rerender(
      <Deck
        view={noReadingYetView()}
        windowLength={30}
        caption="Last 90 days"
        selected="2026-08-10"
        onSelect={vi.fn()}
      />,
    );
    expect(headerDate(container)).toBe("Mon 10 Aug");
  });

  it("falls back per metric, so two rows may honestly name two mornings", () => {
    // A partial-null morning: Whoop scored the night and took a pulse but the
    // HRV is missing. The HRV readout reaches back a day and the other two do
    // not, and both readings are true — which is exactly why the label carries
    // the date rather than a bare `latest`.
    const view = defaultView();
    const days = view.days ?? [];
    const patched = days.map((d, i) => (i === days.length - 1 ? { ...d, hrv: null } : d));
    const { container } = renderDeck({ view: { ...view, days: patched }, windowLength: 30 });

    const region = within(live(container));
    expect(region.getAllByText("latest · 12 Aug")).toHaveLength(2);
    expect(region.getAllByText("latest · 11 Aug")).toHaveLength(1);
    expect(region.getByText("106")).toBeInTheDocument();
  });

  it("does not clear a selection the current window cannot show", () => {
    const view = defaultView();
    // A morning 200 days back: present at 1y, absent from the 30d window.
    const offWindow = addDays(FIXTURE_TODAY, -200);
    const onSelect = vi.fn();
    const { container } = renderDeck({
      view,
      windowLength: 30,
      selected: offWindow,
      onSelect,
    });

    // It resolves to "nothing selected" — no crosshair, readouts back on the
    // latest morning — WITHOUT the deck reaching past the end of the array or
    // clearing the page's state behind the user's back.
    expect(crosshairs(container)).toHaveLength(0);
    expect(within(live(container)).getAllByText("latest · 12 Aug")).toHaveLength(3);
    expect(onSelect).not.toHaveBeenCalled();
  });
});

// ── Correction 5: the mobile half ─────────────────────────────────────────────

describe("Deck — mobile", () => {
  function plotHeight(name: RegExp): string | null {
    return screen.getByRole("img", { name }).getAttribute("height");
  }

  it("draws the desktop plot heights above the breakpoint", () => {
    renderDeck({ view: defaultView(), windowLength: 30 });
    expect(plotHeight(HRV_LABEL)).toBe("170");
    expect(plotHeight(SCORE_LABEL)).toBe("120");
    expect(plotHeight(RHR_LABEL)).toBe("100");
  });

  it("shrinks all three rows below it rather than hiding one", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    renderDeck({ view: defaultView(), windowLength: 30 });
    expect(plotHeight(HRV_LABEL)).toBe("130");
    expect(plotHeight(SCORE_LABEL)).toBe("90");
    expect(plotHeight(RHR_LABEL)).toBe("72");
    // Nothing is dropped: the phone gets the same three metrics on the same axis.
    expect(screen.getAllByRole("img")).toHaveLength(3);
  });
});
