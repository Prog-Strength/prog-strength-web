/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { HrvBalanceCard } from "./balance-band";
import {
  bandGapView,
  calibratingView,
  DRIFT_HRV_SERIES_GAPLESS,
  fallingView,
  legacyView,
  noReadingDriftView,
  noReadingView,
  partialBandView,
  risingView,
  steadyDriftView,
  suppressedDriftView,
} from "./fixtures";

const HREF = "/recovery";

/** The component's own geometry, restated so the assertions can check it. */
const R_MAX = 3.6; // DOT_R (2.6) + 1 — today's mark is the largest drawn.
const CHART_H = 62;

function circles(container: HTMLElement): SVGCircleElement[] {
  return Array.from(container.querySelectorAll("circle"));
}

/** The gauge tick, by the handle the component publishes for it. */
function gaugeTick(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="gauge-tick"]');
}

function polygons(container: HTMLElement): SVGPolygonElement[] {
  return Array.from(container.querySelectorAll("polygon"));
}

/** Read one declaration off an element's inline style attribute. React writes
 *  `var(--token)` through verbatim, so this compares TOKENS, not resolved hex. */
function inlineStyle(el: Element | null, prop: string): string | null {
  const match = new RegExp(`${prop}:\\s*([^;]+)`).exec(el?.getAttribute("style") ?? "");
  return match ? match[1].trim() : null;
}

/** The x of every point in a `points` attribute. */
function pointXs(polygon: SVGPolygonElement): number[] {
  return (polygon.getAttribute("points") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => Number(pair.split(",")[0]));
}

describe("HrvBalanceCard", () => {
  it("rising: the drift tag carries the glyph, the magnitude and the window", () => {
    render(<HrvBalanceCard section={risingView()} href={HREF} />);
    // 6.4 ms over 28 days → "▲ +6 ms · 4w". Asserted on text, never on color.
    const tag = screen.getByText(/▲/);
    expect(tag.textContent).toContain("+6");
    expect(tag.textContent).toContain("4w");
  });

  it("falling: a down glyph and a unicode-minus delta, not an ASCII hyphen", () => {
    render(<HrvBalanceCard section={fallingView()} href={HREF} />);
    const tag = screen.getByText(/▼/);
    expect(tag.textContent).toContain("−8"); // U+2212
    expect(tag.textContent).not.toContain("-8"); // U+002D
  });

  it("steady: still prints the magnitude rather than a bare verdict word", () => {
    // `steadyDriftView` pairs deltaMs 6.4 with direction "steady" because this
    // athlete's SD (20.1) puts the engine's threshold at 7.0 ms. The card must
    // show the number anyway — this is the behaviour the SOW's whole threshold
    // discussion turns on, and it must not be "simplified" into a bare word.
    render(<HrvBalanceCard section={steadyDriftView()} href={HREF} />);
    const tag = screen.getByText(/▬/);
    expect(tag.textContent).toContain("+6");
    expect(tag.textContent).toContain("4w");
  });

  it("suppressed: the status dot and today's mark carry the SAME token", () => {
    const { container } = render(<HrvBalanceCard section={suppressedDriftView()} href={HREF} />);
    // The dot is read off days[last], the same object the last mark is coloured
    // from, so the two cannot disagree. Pin that, not the literal warning.
    const dot = screen.getByText("Suppressed").previousElementSibling;
    const marks = circles(container);
    const today = marks[marks.length - 1];
    expect(inlineStyle(dot, "background-color")).toBe("var(--warning)");
    expect(today.getAttribute("fill")).toBe("var(--warning)");
    expect(inlineStyle(dot, "background-color")).toBe(today.getAttribute("fill"));
  });

  it("suppressed: the gauge tick sits below the balanced-low boundary", () => {
    const { container } = render(<HrvBalanceCard section={suppressedDriftView()} href={HREF} />);
    // shortAvg 77.0 against a band of 91.2 ± 12.6 → 21.8%, under the 25% mark
    // where `balancedLow` is printed.
    const left = Number.parseFloat(inlineStyle(gaugeTick(container), "left") ?? "");
    expect(left).toBeGreaterThan(20);
    expect(left).toBeLessThan(25);
  });

  it("no reading yet, legacy-shaped payload: the word, the figure and the tick", () => {
    // The LEGACY shape of the 7am state: `noReadingView` is built on `makeDays`,
    // whose interior days carry no band of their own, so its single banded day
    // is a run with no area and zero polygons is the honest rendering. What this
    // pins is that the three text registers survive a payload with no per-day
    // band at all. The drifting-band 7am state — the one the SOW actually
    // describes, band and all — is the test below.
    const { container } = render(<HrvBalanceCard section={noReadingView()} href={HREF} />);
    expect(screen.getByText("No reading yet")).toBeInTheDocument();
    // shortAvg 82.3 survives the missing morning.
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(gaugeTick(container)).not.toBeNull();
    expect(container.textContent).not.toContain("—");
    expect(polygons(container)).toHaveLength(0);
  });

  it("no reading yet, drifting band: the band holds and only today's mark is gone", () => {
    // The SOW's pass/fail criterion for the whole idiom: at 7am the word reads
    // "No reading yet", the 28px figure still prints the 7-day average, the
    // gauge still has its tick — and the chart simply has no FINAL mark. The
    // band underneath it is untouched, because a missing reading moves no
    // baseline.
    const { container } = render(<HrvBalanceCard section={noReadingDriftView()} href={HREF} />);
    expect(screen.getByText("No reading yet")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument(); // shortAvg 92.8, rounded
    expect(gaugeTick(container)).not.toBeNull();
    expect(container.textContent).not.toContain("—");
    expect(polygons(container)).toHaveLength(1);

    // Same view with this morning's reading present: exactly one more mark.
    const withReading = render(<HrvBalanceCard section={risingView()} href={HREF} />);
    expect(circles(container)).toHaveLength(circles(withReading.container).length - 1);
  });

  it("partial band: one polygon that visibly starts part-way across", () => {
    const { container } = render(<HrvBalanceCard section={partialBandView()} href={HREF} />);
    const bands = polygons(container);
    expect(bands).toHaveLength(1);
    // The five oldest days carry no band, so the polygon's leftmost point is
    // well right of the left inset rather than hugging it.
    expect(Math.min(...pointXs(bands[0]))).toBeGreaterThan(R_MAX + 30);
  });

  it("partial band: the unbanded days still render marks, at 0.45 opacity", () => {
    const { container } = render(<HrvBalanceCard section={partialBandView()} href={HREF} />);
    const faint = circles(container).filter((c) => c.getAttribute("fill-opacity") === "0.45");
    expect(faint.length).toBeGreaterThanOrEqual(5);
    // Its baseline drift cannot be computed from a part-banded window.
    expect(screen.getByText("drift not yet known")).toBeInTheDocument();
  });

  it("band gap: an interior null baseline splits the polygon in two", () => {
    const gapped = render(<HrvBalanceCard section={bandGapView()} href={HREF} />);
    expect(polygons(gapped.container)).toHaveLength(2);
    gapped.unmount();

    const whole = render(<HrvBalanceCard section={risingView()} href={HREF} />);
    expect(polygons(whole.container)).toHaveLength(1);
  });

  it("one mark per night that has a reading, and no mark for one that does not", () => {
    const section = risingView();
    const readings = section.days!.filter((d) => d.hrv !== null).length;

    const gapped = render(<HrvBalanceCard section={section} href={HREF} />);
    const gaplessSection = risingView(DRIFT_HRV_SERIES_GAPLESS);
    const gaplessMarks = render(
      <HrvBalanceCard section={gaplessSection} href={HREF} />,
    ).container.querySelectorAll("circle").length;

    expect(circles(gapped.container)).toHaveLength(readings);
    // The band comes from the baseline walk, not from the readings, so filling
    // the interior gap buys exactly one mark and changes no polygon.
    expect(gaplessMarks).toBe(readings + 1);
    expect(polygons(gapped.container)).toHaveLength(1);
  });

  it("no circle is ever scaled: viewBox equals the rendered pixel size", () => {
    const { container } = render(<HrvBalanceCard section={risingView()} href={HREF} />);
    const svg = container.querySelector("svg");
    const viewBox = (svg?.getAttribute("viewBox") ?? "").split(" ");
    expect(svg?.getAttribute("width")).toBe(viewBox[2]);
    expect(container.innerHTML).not.toContain("preserveAspectRatio");
  });

  it("marks are inset by EXACTLY their own radius at both ends", () => {
    const { container } = render(<HrvBalanceCard section={risingView()} href={HREF} />);
    const width = Number(container.querySelector("svg")?.getAttribute("width"));
    const marks = circles(container);
    const first = Number(marks[0].getAttribute("cx"));
    const today = Number(marks[marks.length - 1].getAttribute("cx"));

    // Both ends are pinned to the inset itself, not merely to "inside the box":
    // an over-large inset wastes chart width and is just as wrong as none at
    // all. `toBeCloseTo` absorbs the float noise, which is all the tolerance
    // this ever needed.
    expect(width).toBeGreaterThan(0);
    expect(first).toBeCloseTo(R_MAX);
    expect(today).toBeCloseTo(width - R_MAX);
  });

  it("mobile breakpoint: a wider box moves the SVG, the viewBox and both insets", () => {
    // `vitest.setup.ts` pins every element to 260px — the desktop one-third
    // column every other test in this file measures. The tile also renders at
    // the mobile full-bleed width, so that breakpoint gets its own measurement.
    // Restored in `finally`: leaking this override would silently re-size every
    // later test in the file.
    const WIDE = 330;
    const stub = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getBoundingClientRect")!;
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      writable: true,
      value(): DOMRect {
        const rect = {
          width: WIDE,
          height: CHART_H,
          top: 0,
          left: 0,
          bottom: CHART_H,
          right: WIDE,
          x: 0,
          y: 0,
        };
        return { ...rect, toJSON: () => ({ ...rect }) };
      },
    });

    try {
      const { container } = render(<HrvBalanceCard section={risingView()} href={HREF} />);
      const svg = container.querySelector("svg");
      const marks = circles(container);

      expect(svg?.getAttribute("width")).toBe(String(WIDE));
      expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${WIDE} ${CHART_H}`);
      expect(Number(marks[0].getAttribute("cx"))).toBeCloseTo(R_MAX);
      expect(Number(marks[marks.length - 1].getAttribute("cx"))).toBeCloseTo(WIDE - R_MAX);
    } finally {
      Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", stub);
    }
  });

  it("headline: integer milliseconds, never the raw Whoop float", () => {
    const section = risingView();
    section.hrv = { ...section.hrv!, shortAvg: 84.9143 };

    const { container } = render(<HrvBalanceCard section={section} href={HREF} />);

    expect(screen.getByText("85")).toBeInTheDocument();
    expect(container.textContent).not.toContain("84.9143");
  });

  it("calibrating: honest n-of-14 progress and no chart frame around nothing", () => {
    const { container } = render(<HrvBalanceCard section={calibratingView()} href={HREF} />);
    expect(screen.getByText(/9 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("legacy payload: the top-of-card guard holds, nothing throws", () => {
    const { container } = render(<HrvBalanceCard section={legacyView()} href={HREF} />);
    expect(screen.getByText(/0 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
