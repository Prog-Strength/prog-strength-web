/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import {
  prepareHrvChart,
  scaler,
  type HrvChart,
} from "@/app/(app)/dashboard/_components/recovery/hrv-chart";
import {
  driftColor,
  driftTag,
  statusWord,
  MIN_BASELINE_DAYS,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { calibratingView, defaultView } from "../fixtures";
import { HrvCalibrating, HrvPanel } from "./hrv-panel";
import { monthLabel, PLOT_INSET, shortDate } from "./shared";

/** The deck's desktop height for this row, and the panel's own largest radius —
 *  restated here so the assertions can check the geometry the panel draws with. */
const HEIGHT = 170;
const R_MAX = 4.6; // DOT_R (3.4) + 1.2 — today's mark is the largest drawn.

/**
 * The real object the deck passes: one `prepareHrvChart` call over the fixture's
 * own history. The panel takes a PREPARED chart, so a fixture that cannot clear
 * the guard is a broken fixture rather than a calibrating state — the deck owns
 * that branch, and `HrvCalibrating` is tested directly at the bottom of the file.
 */
function preparedChart(): HrvChart {
  const chart = prepareHrvChart(defaultView());
  expect(chart).not.toBeNull();
  if (!chart) throw new Error("the default fixture must clear prepareHrvChart's guard");
  return chart;
}

/** The plotted means. Each is a `<g>` carrying its status and holding whichever
 *  SHAPE that status draws, so a count survives a circle becoming a triangle. */
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

/** How many points a mark's shape has: a down triangle three, a diamond four. */
function markPoints(mark: Element): number {
  return (mark.firstElementChild?.getAttribute("points") ?? "").trim().split(/\s+/).length;
}

/** The rolling-average curve — one polyline per unbroken run of the series. */
function polylines(container: HTMLElement): SVGPolylineElement[] {
  return Array.from(container.querySelectorAll("polyline"));
}

/** Read one declaration off an element's inline style attribute. React writes
 *  `var(--token)` through verbatim, so this compares TOKENS, not resolved hex. */
function inlineStyle(el: Element | null, prop: string): string | null {
  const match = new RegExp(`${prop}:\\s*([^;]+)`).exec(el?.getAttribute("style") ?? "");
  return match ? match[1].trim() : null;
}

describe("HrvPanel", () => {
  it("nothing is recomputed: the curve ends on the server's own 7-day mean", () => {
    // The single most important property of this panel. `prepareHrvChart`
    // overwrites `rolling`'s last entry with `hrv.shortAvg`, so the final mark
    // must be that figure at the scale's own pixel — not a client re-derivation
    // that merely ought to equal it — and it must carry `week`, the verdict the
    // tile's gauge tick carries one surface away.
    const chart = preparedChart();
    const { container } = render(<HrvPanel chart={chart} height={HEIGHT} />);

    const y = scaler(chart.domain, R_MAX, HEIGHT - R_MAX * 2);
    expect(chart.shortAvg).not.toBeNull();
    const expectedY = y(chart.shortAvg as number);

    const today = marks(container).at(-1)!;
    expect(markAt(today).y).toBeCloseTo(expectedY);
    expect(today.getAttribute("data-status")).toBe(chart.week);
    expect(today.getAttribute("data-today")).toBe("true");

    // And the curve terminates on the same point, so the line and the mark are
    // one figure rather than two that agree by arithmetic coincidence.
    const tail = polylines(container).at(-1)!;
    const last = (tail.getAttribute("points") ?? "").trim().split(/\s+/).at(-1)!;
    expect(Number(last.split(",")[1])).toBeCloseTo(expectedY);
  });

  it("one mark per plotted mean, carrying that mean's own status", () => {
    const chart = preparedChart();
    const { container } = render(<HrvPanel chart={chart} height={HEIGHT} />);

    // Read straight off `rolling`: a null entry is a window too sparse to
    // average and draws nothing at all, and every other entry's status is the
    // one the chart object already decided.
    const expected = chart.rolling.flatMap((p) => (p === null ? [] : [p.status]));
    expect(expected.length).toBeGreaterThan(300);
    expect(marks(container).map((m) => m.getAttribute("data-status"))).toEqual(expected);
  });

  it("the shape grammar survives at page scale: triangle below, circle in band", () => {
    // Colour alone is the weakest way to say "this week left the band", and a
    // 170px plot of fourteen months is exactly where a hue change disappears.
    // The fixture's five below-band nights from 21 Jul are what make this true.
    const chart = preparedChart();
    const { container } = render(<HrvPanel chart={chart} height={HEIGHT} />);
    const all = marks(container);

    const suppressed = all.filter((m) => m.getAttribute("data-status") === "suppressed");
    expect(suppressed.length).toBeGreaterThan(0);
    expect(suppressed.every((m) => markShape(m) === "polygon")).toBe(true);
    expect(markPoints(suppressed[0])).toBe(3);
    expect(suppressed[0].firstElementChild?.getAttribute("fill")).toBe("var(--warning)");

    const balanced = all.filter((m) => m.getAttribute("data-status") === "balanced");
    expect(balanced.length).toBeGreaterThan(0);
    expect(balanced.every((m) => markShape(m) === "circle")).toBe(true);
    expect(balanced[0].firstElementChild?.getAttribute("fill")).toBe("var(--success)");
  });

  it("the drift tag is `driftTag` verbatim, in `driftColor`", () => {
    const chart = preparedChart();
    render(<HrvPanel chart={chart} height={HEIGHT} />);

    // Verbatim: the tag is single-sourced in the tiles' `shared.ts`, so the page
    // and the dashboard print the same glyph, magnitude and window.
    const tag = screen.getByText(driftTag(chart.drift));
    expect(inlineStyle(tag, "color")).toBe(driftColor(chart.drift.direction));
  });

  it("the verdict register is labelled `last night`, not the window", () => {
    // Invariant 2. `today.status` describes one morning; the plot beside it
    // describes fourteen months. Without the label a year-wide chart appears to
    // be summarised by a one-night verdict.
    const chart = preparedChart();
    render(<HrvPanel chart={chart} height={HEIGHT} />);

    const label = screen.getByText("last night");
    expect(label).toBeInTheDocument();
    const word = screen.getByText(statusWord(chart.today.status, chart.today.hrv !== null));
    expect(word).toBeInTheDocument();
    // The label belongs to the verdict, not to the axis or the drift tag.
    expect(word.parentElement).toBe(label.parentElement);
  });

  it("the axis prints the window's two ends and a tick per month boundary", () => {
    const chart = preparedChart();
    const { container } = render(<HrvPanel chart={chart} height={HEIGHT} />);
    const { series } = chart;

    expect(screen.getByText(shortDate(series[0].date))).toBeInTheDocument();
    expect(screen.getByText(shortDate(series[series.length - 1].date))).toBeInTheDocument();

    // Ticks are read off the DRAWN series — a day whose date ends in `-01` — so
    // there is exactly one per month boundary the curve actually spans.
    const expected = series.flatMap((d, i) =>
      i > 0 && d.date.slice(8) === "01" ? [monthLabel(d.date)] : [],
    );
    const ticks = Array.from(container.querySelectorAll('[data-testid="hrv-month-tick"]'));
    expect(ticks.map((t) => t.textContent)).toEqual(expected);

    // A month boundary genuinely inside this window, named: 1 Aug 2026.
    expect(series.some((d) => d.date === "2026-08-01")).toBe(true);
    expect(expected).toContain("Aug");
  });

  it("marks are inset by their own radius, and the SVG is never scaled", () => {
    const chart = preparedChart();
    const { container } = render(<HrvPanel chart={chart} height={HEIGHT} />);
    const svg = container.querySelector("svg");
    const width = Number(svg?.getAttribute("width"));
    const all = marks(container);

    expect(width).toBeGreaterThan(0);
    expect(svg?.getAttribute("viewBox")).toBe(`0 0 ${width} ${HEIGHT}`);
    expect(markAt(all[0]).x).toBeCloseTo(R_MAX);
    expect(markAt(all[all.length - 1]).x).toBeCloseTo(width - R_MAX);
    // …and the deck's shared inset IS that radius. The score columns and the
    // resting-HR bars are centred on `PLOT_INSET`, so the day the crosshair
    // names in this row is the day it names in the other two only while these
    // two numbers are the same one. Pinned here because they live in two files.
    expect(PLOT_INSET).toBeCloseTo(R_MAX);
    // The whole read is available without a pointer.
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toContain(shortDate(chart.series[0].date));
  });
});

describe("HrvCalibrating", () => {
  it("prints honest progress toward the baseline floor", () => {
    // The state the deck renders when `prepareHrvChart` returns null — which is
    // exactly what the calibrating fixture does.
    const view = calibratingView();
    expect(prepareHrvChart(view)).toBeNull();

    const nights = view.baseline?.hrvDays ?? 0;
    render(<HrvCalibrating nights={nights} />);

    expect(screen.getByText("Calibrating your band")).toBeInTheDocument();
    expect(screen.getByText(`${nights} of ${MIN_BASELINE_DAYS}`)).toBeInTheDocument();
    // The floor is the API's `min_baseline_days`, imported rather than typed —
    // pinned here so the copy above cannot quietly drift from the constant.
    expect(MIN_BASELINE_DAYS).toBe(14);
    expect(
      screen.getByText(/your normal range appears once Whoop knows your spread/),
    ).toBeVisible();
  });
});
