/// <reference types="vitest/globals" />
import { render, fireEvent, createEvent } from "@testing-library/react";
import { RecapChart, type RecapPoint } from "./RecapChart";

/**
 * jsdom has no real PointerEvent, so testing-library falls back to a plain
 * Event and BOTH `pointerType` and `clientX` are silently dropped — every event
 * would look like a hover at x=0, which is exactly the coordinate that makes
 * the scrub maths look like it works while asserting nothing. Pin them onto the
 * event so the touch paths and the client-x → index inversion are genuinely
 * exercised.
 */
function firePointer(
  el: Element,
  type: "pointerDown" | "pointerMove" | "pointerUp",
  init: { clientX?: number; pointerType?: string; pointerId?: number },
) {
  const ev = createEvent[type](el);
  Object.defineProperty(ev, "clientX", { value: init.clientX ?? 0 });
  Object.defineProperty(ev, "pointerType", { value: init.pointerType ?? "mouse" });
  Object.defineProperty(ev, "pointerId", { value: init.pointerId ?? 1 });
  fireEvent(el, ev);
}

// jsdom gives every element a zero-size rect, and the scrub maths divides by
// the rendered width. Pin a realistic box so client-x → chart-index inversion
// is exercised for real rather than short-circuiting on width 0.
const CHART_LEFT = 0;
const CHART_WIDTH = 860;
beforeAll(() => {
  Object.defineProperty(Element.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: CHART_LEFT,
      top: 0,
      width: CHART_WIDTH,
      height: 300,
      right: CHART_WIDTH,
      bottom: 300,
      x: CHART_LEFT,
      y: 0,
      toJSON: () => ({}),
    }),
  });
});

// The chart's internal margins, mirrored so the test can aim at a known point.
const M_LEFT = 56;
const M_RIGHT = 24;
const plotWidth = CHART_WIDTH - M_LEFT - M_RIGHT;

/** 11 points spanning 0..10 distance units. */
function points(): RecapPoint[] {
  return Array.from({ length: 11 }, (_, i) => ({ distanceUnit: i, value: 3000 + i * 10 }));
}

function base() {
  return {
    points: points(),
    color: "#c9a690",
    gradientId: "g",
    invertY: false,
    formatValue: (v: number) => `${v}`,
    unit: "mi" as const,
    ariaLabel: "Elevation recap",
  };
}

/** Client x for a given distance-unit value on the plotted axis. */
function xFor(distanceUnit: number, span = 10) {
  return M_LEFT + (distanceUnit / span) * plotWidth;
}

describe("RecapChart scrubbing", () => {
  // The opt-in contract: without onScrub the chart is what it always was, which
  // is why the pace and heart-rate recaps are untouched by this feature.
  it("renders no pointer surface when scrubbing is not opted into", () => {
    const { queryByTestId } = render(<RecapChart {...base()} />);
    expect(queryByTestId("recap-scrub-surface")).toBeNull();
  });

  it("renders a pointer surface when onScrub is supplied", () => {
    const { getByTestId } = render(<RecapChart {...base()} onScrub={vi.fn()} />);
    expect(getByTestId("recap-scrub-surface")).toBeTruthy();
  });

  it("reports the index of the nearest sample to the pointer", () => {
    const onScrub = vi.fn();
    const { getByTestId } = render(<RecapChart {...base()} onScrub={onScrub} />);

    firePointer(getByTestId("recap-scrub-surface"), "pointerMove", {
      clientX: xFor(7),
      pointerType: "mouse",
    });
    expect(onScrub).toHaveBeenCalledWith(7);
  });

  it("clears the cursor when the pointer leaves", () => {
    const onScrub = vi.fn();
    const { getByTestId } = render(<RecapChart {...base()} onScrub={onScrub} />);
    fireEvent.pointerLeave(getByTestId("recap-scrub-surface"));
    expect(onScrub).toHaveBeenCalledWith(null);
  });

  // There is no such thing as hovering a finger: a touch move without an
  // active drag must not scrub, or the cursor jumps on every page scroll.
  it("ignores a touch move that is not part of a drag", () => {
    const onScrub = vi.fn();
    const { getByTestId } = render(<RecapChart {...base()} onScrub={onScrub} />);

    firePointer(getByTestId("recap-scrub-surface"), "pointerMove", {
      clientX: xFor(4),
      pointerType: "touch",
    });
    expect(onScrub).not.toHaveBeenCalled();
  });

  it("scrubs on a touch drag once it has begun", () => {
    const onScrub = vi.fn();
    const { getByTestId } = render(<RecapChart {...base()} onScrub={onScrub} />);
    const surface = getByTestId("recap-scrub-surface");

    firePointer(surface, "pointerDown", { clientX: xFor(2), pointerType: "touch" });
    expect(onScrub).toHaveBeenCalledWith(2);

    firePointer(surface, "pointerMove", { clientX: xFor(6), pointerType: "touch" });
    expect(onScrub).toHaveBeenCalledWith(6);
  });

  // Skips over a null: the cursor must land on a sample the chart actually
  // drew, since the map marker derives from the same index.
  it("never reports the index of an unplottable sample", () => {
    const withGap = points().map((p, i) => (i === 5 ? { ...p, value: null } : p));
    const onScrub = vi.fn();
    const { getByTestId } = render(<RecapChart {...base()} points={withGap} onScrub={onScrub} />);

    firePointer(getByTestId("recap-scrub-surface"), "pointerMove", {
      clientX: xFor(5),
      pointerType: "mouse",
    });
    expect(onScrub).toHaveBeenCalled();
    expect(onScrub.mock.calls[0][0]).not.toBe(5);
  });

  it("draws a crosshair at the active cursor", () => {
    const { container, rerender } = render(<RecapChart {...base()} onScrub={vi.fn()} />);
    const before = container.querySelectorAll("line").length;

    rerender(<RecapChart {...base()} onScrub={vi.fn()} scrubIndex={4} />);
    expect(container.querySelectorAll("line").length).toBeGreaterThan(before);
  });

  it("survives an out-of-range cursor without drawing one", () => {
    const { container } = render(<RecapChart {...base()} onScrub={vi.fn()} scrubIndex={999} />);
    expect(container.querySelector("svg")).toBeTruthy();
  });

  // The pre-existing guard: fewer than two plottable samples renders nothing at
  // all, and adding hooks for scrubbing must not have changed that.
  it("still renders nothing for a series with under two plottable samples", () => {
    const { container } = render(
      <RecapChart {...base()} points={[{ distanceUnit: 0, value: 1 }]} onScrub={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
