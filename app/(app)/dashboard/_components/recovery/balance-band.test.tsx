/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RecoveryView } from "@/lib/dashboard";
import { HrvBalanceView } from "./balance-band";
import { prepareHrvChart } from "./hrv-chart";
import {
  bandGapView,
  DRIFT_HRV_SERIES,
  DRIFT_HRV_SERIES_GAPLESS,
  fallingView,
  noReadingDriftView,
  noReadingView,
  partialBandView,
  risingView,
  steadyDriftView,
  suppressedDriftView,
} from "./fixtures";

/** The component's own geometry, restated so the assertions can check it. */
const R_MAX = 3.6; // DOT_R (2.6) + 1 — today's mark is the largest drawn.
const CHART_H = 62;

/**
 * Render the view the way the tile does: from a prepared chart. The guard lives
 * on the tile now (both views share it), so a fixture that cannot clear it is a
 * broken fixture rather than a calibrating state — the tile's own test covers
 * that path.
 */
function renderView(section: RecoveryView) {
  const chart = prepareHrvChart(section);
  if (!chart) throw new Error("fixture does not clear the tile's guard");
  return render(<HrvBalanceView chart={chart} />);
}

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

/** The rolling-average curve — one per unbroken run of the series. */
function polylines(container: HTMLElement): SVGPolylineElement[] {
  return Array.from(container.querySelectorAll("polyline"));
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

describe("HrvBalanceView", () => {
  it("rising: the drift tag carries the glyph, the magnitude and the window", () => {
    renderView(risingView());
    // 6.4 ms over 28 days → "▲ +6 ms · 4w". Asserted on text, never on color.
    const tag = screen.getByText(/▲/);
    expect(tag.textContent).toContain("+6");
    expect(tag.textContent).toContain("4w");
  });

  it("falling: a down glyph and a unicode-minus delta, not an ASCII hyphen", () => {
    renderView(fallingView());
    const tag = screen.getByText(/▼/);
    expect(tag.textContent).toContain("−8"); // U+2212
    expect(tag.textContent).not.toContain("-8"); // U+002D
  });

  it("steady: still prints the magnitude rather than a bare verdict word", () => {
    // `steadyDriftView` pairs deltaMs 6.4 with direction "steady" because this
    // athlete's SD (20.1) puts the engine's threshold at 7.0 ms. The card must
    // show the number anyway — this is the behaviour the SOW's whole threshold
    // discussion turns on, and it must not be "simplified" into a bare word.
    renderView(steadyDriftView());
    const tag = screen.getByText(/▬/);
    expect(tag.textContent).toContain("+6");
    expect(tag.textContent).toContain("4w");
  });

  it("the final mark is the WEEK's verdict, and carries the gauge tick's token", () => {
    const { container } = renderView(suppressedDriftView());
    // The two registers answer different questions now: the dot is last night
    // (`today.status`), the last mark is the seven-day mean the gauge tick is
    // also about. In this fixture both read suppressed — what is pinned is that
    // the MARK travels with the tick, not with the dot.
    const marks = circles(container);
    const today = marks[marks.length - 1];
    expect(
      inlineStyle(screen.getByText("Suppressed").previousElementSibling, "background-color"),
    ).toBe("var(--warning)");
    expect(today.getAttribute("fill")).toBe("var(--warning)");
    expect(today.getAttribute("fill")).toBe(inlineStyle(gaugeTick(container), "background-color"));
  });

  it("the final mark is drawn at today's larger radius, on the box's right edge", () => {
    const { container } = renderView(risingView());
    const marks = circles(container);
    const today = marks[marks.length - 1];
    expect(Number(today.getAttribute("r"))).toBeGreaterThan(Number(marks[0].getAttribute("r")));
  });

  it("suppressed: the gauge tick sits below the balanced-low boundary, in warning", () => {
    const { container } = renderView(suppressedDriftView());
    // shortAvg 77.0 against a band of 91.2 ± 12.6 → 21.8%, under the 25% mark
    // where `balancedLow` is printed. The tick's COLOR is the week's status, the
    // same value the trend view colours its delta with — the position and the
    // colour are one statement, so they cannot drift apart.
    const left = Number.parseFloat(inlineStyle(gaugeTick(container), "left") ?? "");
    expect(left).toBeGreaterThan(20);
    expect(left).toBeLessThan(25);
    expect(inlineStyle(gaugeTick(container), "background-color")).toBe("var(--warning)");
  });

  it("balanced week: the gauge tick is the same green the balanced nights carry", () => {
    const { container } = renderView(risingView());
    // shortAvg 92.8 sits inside 78.6–103.8, so the week is balanced and the tick
    // takes the success token — the one green this tile spends on "in balance",
    // on either view.
    expect(inlineStyle(gaugeTick(container), "background-color")).toBe("var(--success)");
    const balanced = circles(container).filter((c) => c.getAttribute("fill") === "var(--success)");
    expect(balanced.length).toBeGreaterThan(0);
  });

  it("no reading yet, legacy-shaped payload: the word, the figure and the tick", () => {
    // The LEGACY shape of the 7am state: `noReadingView` is built on `makeDays`,
    // whose interior days carry no band of their own, so its single banded day
    // is a run with no area and zero polygons is the honest rendering. What this
    // pins is that the three text registers survive a payload with no per-day
    // band at all. The drifting-band 7am state — the one the SOW actually
    // describes, band and all — is the test below.
    const { container } = renderView(noReadingView());
    expect(screen.getByText("No reading yet")).toBeInTheDocument();
    // shortAvg 82.3 survives the missing morning.
    expect(screen.getByText("82")).toBeInTheDocument();
    expect(gaugeTick(container)).not.toBeNull();
    expect(container.textContent).not.toContain("—");
    expect(polygons(container)).toHaveLength(0);
  });

  it("no reading yet, drifting band: the chart keeps its final mark at 7am", () => {
    // At 7am the word reads "No reading yet", the 28px figure still prints the
    // 7-day average, the gauge still has its tick — and now the chart keeps its
    // final mark too, because that mark IS the 7-day average and a mean over a
    // window that includes today does not require it. On the raw-nightly chart
    // this state cost the curve its endpoint every single morning.
    const { container } = renderView(noReadingDriftView());
    expect(screen.getByText("No reading yet")).toBeInTheDocument();
    expect(screen.getByText("93")).toBeInTheDocument(); // shortAvg 92.8, rounded
    expect(gaugeTick(container)).not.toBeNull();
    expect(container.textContent).not.toContain("—");
    expect(polygons(container)).toHaveLength(1);

    // Same view with this morning's reading present: the SAME marks.
    const withReading = renderView(risingView());
    expect(circles(container)).toHaveLength(circles(withReading.container).length);
  });

  it("partial band: one polygon that visibly starts part-way across", () => {
    // A twelve-day unbanded prefix, six of which are the lead-in the chart never
    // draws — so six unbanded days remain inside the drawn window and the
    // polygon's leftmost point is well right of the left inset rather than
    // hugging it.
    const { container } = renderView(partialBandView(undefined, 12));
    const bands = polygons(container);
    expect(bands).toHaveLength(1);
    expect(Math.min(...pointXs(bands[0]))).toBeGreaterThan(R_MAX + 30);
  });

  it("partial band: the unbanded days still render marks, at 0.45 opacity", () => {
    const { container } = renderView(partialBandView(undefined, 12));
    const faint = circles(container).filter((c) => c.getAttribute("fill-opacity") === "0.45");
    // A mean over a day with no band of its own has no verdict to carry, so it
    // is drawn in muted at reduced weight rather than coloured or dropped.
    expect(faint.length).toBeGreaterThanOrEqual(5);
    // Its baseline drift cannot be computed from a part-banded window.
    expect(screen.getByText("drift not yet known")).toBeInTheDocument();
  });

  it("band gap: an interior null baseline splits the polygon in two", () => {
    const gapped = renderView(bandGapView());
    expect(polygons(gapped.container)).toHaveLength(2);
    gapped.unmount();

    const whole = renderView(risingView());
    expect(polygons(whole.container)).toHaveLength(1);
  });

  it("one mark per drawn day, and an interior gap costs none of them", () => {
    const section = risingView();
    // 31 charted days, six of which are lead-in for the first seven-night mean.
    const drawn = section.days!.length - 6;

    const gapped = renderView(section);
    const gaplessMarks = renderView(
      risingView(DRIFT_HRV_SERIES_GAPLESS),
    ).container.querySelectorAll("circle").length;

    expect(circles(gapped.container)).toHaveLength(drawn);
    // The missing night is absorbed — it is one fewer sample in seven windows,
    // not a hole in the series — so filling it changes neither mark nor polygon.
    // On the raw-nightly chart it cost exactly one mark.
    expect(gaplessMarks).toBe(drawn);
    expect(polygons(gapped.container)).toHaveLength(1);
  });

  it("the curve is one polyline under the marks, and it breaks over a real hole", () => {
    const whole = renderView(risingView());
    const wholeMarks = circles(whole.container).length;
    expect(polylines(whole.container)).toHaveLength(1);
    // Drawn under the dots, so no mark is half-covered by its own connector.
    expect(whole.container.querySelector("polyline, circle")?.tagName).toBe("polyline");
    whole.unmount();

    // A week off the strap: seven consecutive nights missing, so the windows
    // that sit over the middle of it fall under the four-reading floor. The
    // curve must break there rather than draw a chord across a week the athlete
    // has no data for.
    const strapOff = DRIFT_HRV_SERIES.map((v, i) => (i >= 10 && i <= 16 ? null : v));
    const { container } = renderView(risingView(strapOff));
    expect(polylines(container)).toHaveLength(2);
    expect(circles(container).length).toBeLessThan(wholeMarks);
  });

  it("no circle is ever scaled: viewBox equals the rendered pixel size", () => {
    const { container } = renderView(risingView());
    const svg = container.querySelector("svg");
    const viewBox = (svg?.getAttribute("viewBox") ?? "").split(" ");
    expect(svg?.getAttribute("width")).toBe(viewBox[2]);
    expect(container.innerHTML).not.toContain("preserveAspectRatio");
  });

  it("marks are inset by EXACTLY their own radius at both ends", () => {
    const { container } = renderView(risingView());
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
      const { container } = renderView(risingView());
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

    const { container } = renderView(section);

    expect(screen.getByText("85")).toBeInTheDocument();
    expect(container.textContent).not.toContain("84.9143");
  });
});
