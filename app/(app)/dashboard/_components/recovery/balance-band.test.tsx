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
const R_MAX = 4.6; // DOT_R (3.4) + 1.2 — today's mark is the largest drawn.
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

/**
 * The plotted means. Each is a `<g>` carrying its status and holding whichever
 * SHAPE that status draws, so a count survives a mark changing from a circle to
 * a triangle — which is exactly what a status change now does.
 */
function marks(container: HTMLElement): SVGGElement[] {
  return Array.from(container.querySelectorAll('[data-testid="hrv-mark"]'));
}

/** A mark's centre, read off the transform every shape is positioned by. */
function markAt(mark: Element): { x: number; y: number } {
  const [x, y] = (mark.getAttribute("transform") ?? "")
    .replace(/translate\(|\)/g, "")
    .split(/[\s,]+/)
    .map(Number);
  return { x, y };
}

/** The tag name of the shape inside a mark — circle / polygon. */
function markShape(mark: Element): string {
  return mark.firstElementChild?.tagName ?? "";
}

/** The gauge tick, by the handle the component publishes for it. */
function gaugeTick(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-testid="gauge-tick"]');
}

/**
 * The band ribbons. Scoped to DIRECT children of the svg on purpose: an
 * out-of-band mark is a polygon too, but it lives inside its mark `<g>`, so
 * without the child combinator a bad week would silently inflate the band count.
 */
function polygons(container: HTMLElement): SVGPolygonElement[] {
  return Array.from(container.querySelectorAll("svg > polygon"));
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
    // The two registers answer different questions now: the dot beside the word
    // is last night (`today.status`), the last mark is the seven-day mean the
    // gauge tick is also about. In this fixture both read suppressed — what is
    // pinned is that the MARK travels with the tick, not with the verdict dot.
    const today = marks(container).at(-1)!;
    expect(
      inlineStyle(screen.getByText("Suppressed").previousElementSibling, "background-color"),
    ).toBe("var(--warning)");
    expect(today.getAttribute("data-status")).toBe("suppressed");
    expect(today.firstElementChild?.getAttribute("fill")).toBe(
      inlineStyle(gaugeTick(container), "background-color"),
    );
  });

  it("the final mark is drawn a size up, and is the only one flagged as today", () => {
    const { container } = renderView(risingView());
    const all = marks(container);
    const today = all.at(-1)!;
    expect(all.filter((m) => m.getAttribute("data-today") === "true")).toHaveLength(1);
    expect(today.getAttribute("data-today")).toBe("true");
    expect(Number(today.firstElementChild?.getAttribute("r"))).toBeGreaterThan(
      Number(all[0].firstElementChild?.getAttribute("r")),
    );
  });

  it("a week outside the band changes SHAPE, not only colour", () => {
    // Colour alone is the weakest way to say "this week left the band" — it is
    // invisible in greyscale and to a red-green deficiency. Every reading pushed
    // 20 ms below the baseline walk puts the whole curve under the week band.
    const low = renderView(risingView(DRIFT_HRV_SERIES.map((v) => (v === null ? null : v - 20))));
    const dipped = marks(low.container).filter(
      (m) => m.getAttribute("data-status") === "suppressed",
    );
    expect(dipped.length).toBeGreaterThan(10);
    expect(dipped.every((m) => markShape(m) === "polygon")).toBe(true);
    expect(dipped[0].firstElementChild?.getAttribute("fill")).toBe("var(--warning)");
    low.unmount();

    // And above it — a different shape again, so the two excursions never read
    // as the same event in a screenshot.
    const high = renderView(risingView(DRIFT_HRV_SERIES.map((v) => (v === null ? null : v + 20))));
    const raised = marks(high.container).filter(
      (m) => m.getAttribute("data-status") === "elevated",
    );
    expect(raised.length).toBeGreaterThan(10);
    expect(raised.every((m) => markShape(m) === "polygon")).toBe(true);
    // Distinct GEOMETRY, not merely both-polygons: a down triangle has three
    // points, a diamond four.
    const points = (m: Element) =>
      (m.firstElementChild?.getAttribute("points") ?? "").trim().split(/\s+/).length;
    expect(points(dipped[0])).toBe(3);
    expect(points(raised[0])).toBe(4);
  });

  it("an in-band week stays a circle", () => {
    const { container } = renderView(risingView());
    const all = marks(container);
    expect(all.every((m) => m.getAttribute("data-status") === "balanced")).toBe(true);
    expect(all.every((m) => markShape(m) === "circle")).toBe(true);
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
    const balanced = marks(container).filter((m) => m.getAttribute("data-status") === "balanced");
    expect(balanced.length).toBeGreaterThan(0);
    expect(balanced[0].firstElementChild?.getAttribute("fill")).toBe("var(--success)");
  });

  it("the gauge's green zone is the WEEK band, narrower than the middle half", () => {
    const { container } = renderView(risingView());
    const zones = Array.from(container.querySelectorAll('[data-testid="gauge-zone"]'));
    const width = (status: string) =>
      Number.parseFloat(
        inlineStyle(zones.find((z) => z.getAttribute("data-status") === status)!, "width") ?? "",
      );

    expect(zones.map((z) => z.getAttribute("data-status"))).toEqual([
      "suppressed",
      "balanced",
      "elevated",
    ]);
    // The nightly band filled the middle 50%. A mean's band is √7 narrower, so
    // green must be well under that — and still centred, so the two outer zones
    // stay equal. Pinned as a relationship rather than a literal percentage:
    // the divisor is meant to be dialled.
    expect(width("balanced")).toBeLessThan(30);
    expect(width("suppressed")).toBeCloseTo(width("elevated"), 6);
  });

  it("the lit zone is the week's own, at full strength — the wash is the rest", () => {
    // This is the alignment: the segment the week sits in and the final mark are
    // the same token at the same weight, rather than the same hue at a third of
    // the opacity.
    const { container } = renderView(risingView());
    const zones = Array.from(container.querySelectorAll('[data-testid="gauge-zone"]'));
    const lit = zones.filter((z) => inlineStyle(z, "opacity") === "1");

    expect(lit).toHaveLength(1);
    expect(lit[0].getAttribute("data-status")).toBe("balanced");
    expect(inlineStyle(lit[0], "background-color")).toBe(
      marks(container).at(-1)!.firstElementChild?.getAttribute("fill"),
    );
    // The other two are present but dimmed — the scale still reads as a scale.
    expect(zones.filter((z) => inlineStyle(z, "opacity") === "0.4")).toHaveLength(2);
  });

  it("the gauge prints the WEEK bounds, which are inside the nightly ones", () => {
    const { container } = renderView(risingView());
    const chart = prepareHrvChart(risingView())!;
    expect(screen.getByText(String(Math.round(chart.weekLow)))).toBeInTheDocument();
    expect(screen.getByText(String(Math.round(chart.weekHigh)))).toBeInTheDocument();
    // The nightly bounds are no longer printed — they are the SCALE, not the
    // threshold, and printing both pairs is how a reader learns to trust neither.
    expect(container.textContent).not.toContain(String(Math.round(chart.balancedLow)));
    expect(container.textContent).not.toContain(String(Math.round(chart.balancedHigh)));
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
    expect(marks(container)).toHaveLength(marks(withReading.container).length);
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
    const faint = marks(container).filter(
      (m) => m.firstElementChild?.getAttribute("fill-opacity") === "0.45",
    );
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
    const gaplessMarks = marks(renderView(risingView(DRIFT_HRV_SERIES_GAPLESS)).container).length;

    expect(marks(gapped.container)).toHaveLength(drawn);
    // The missing night is absorbed — it is one fewer sample in seven windows,
    // not a hole in the series — so filling it changes neither mark nor polygon.
    // On the raw-nightly chart it cost exactly one mark.
    expect(gaplessMarks).toBe(drawn);
    expect(polygons(gapped.container)).toHaveLength(1);
  });

  it("the curve is one polyline under the marks, and it breaks over a real hole", () => {
    const whole = renderView(risingView());
    const wholeMarks = marks(whole.container).length;
    expect(polylines(whole.container)).toHaveLength(1);
    // Drawn under the marks, so none is half-covered by its own connector.
    const curve = polylines(whole.container)[0];
    const following = curve.compareDocumentPosition(marks(whole.container)[0]);
    expect(following & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    whole.unmount();

    // A week off the strap: seven consecutive nights missing, so the windows
    // that sit over the middle of it fall under the four-reading floor. The
    // curve must break there rather than draw a chord across a week the athlete
    // has no data for.
    const strapOff = DRIFT_HRV_SERIES.map((v, i) => (i >= 10 && i <= 16 ? null : v));
    const { container } = renderView(risingView(strapOff));
    expect(polylines(container)).toHaveLength(2);
    expect(marks(container).length).toBeLessThan(wholeMarks);
  });

  it("no mark is ever scaled: viewBox equals the rendered pixel size", () => {
    const { container } = renderView(risingView());
    const svg = container.querySelector("svg");
    const viewBox = (svg?.getAttribute("viewBox") ?? "").split(" ");
    expect(svg?.getAttribute("width")).toBe(viewBox[2]);
    expect(container.innerHTML).not.toContain("preserveAspectRatio");
  });

  it("marks are inset by EXACTLY their own radius at both ends", () => {
    const { container } = renderView(risingView());
    const width = Number(container.querySelector("svg")?.getAttribute("width"));
    const all = marks(container);
    const first = markAt(all[0]).x;
    const today = markAt(all[all.length - 1]).x;

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
      const all = marks(container);

      expect(svg?.getAttribute("width")).toBe(String(WIDE));
      expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${WIDE} ${CHART_H}`);
      expect(markAt(all[0]).x).toBeCloseTo(R_MAX);
      expect(markAt(all[all.length - 1]).x).toBeCloseTo(WIDE - R_MAX);
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
