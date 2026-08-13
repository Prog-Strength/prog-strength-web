/// <reference types="vitest/globals" />

import { render } from "@testing-library/react";
import type { RecoveryDayPoint } from "@/lib/dashboard";
import { addDays } from "./shared";
import { defaultView, FIXTURE_TODAY } from "../fixtures";
import { ScorePlot } from "./score-plot";

/** The plot's own contract, mirrored rather than imported — the tests are here
 *  to catch a change to it, so they must not move with it. */
const HEIGHT = 44;
/** jsdom's global stub (`vitest.setup.ts`), so the component really measures. */
const STUB_WIDTH = 260;
/** `PLOT_INSET`, mirrored — the deck's shared inset, and the reason a first or
 *  last column hangs half outside the box. */
const INSET = 4.6;

/** A day point with only the fields this plot reads set meaningfully. */
function day(date: string, recoveryScore: number | null): RecoveryDayPoint {
  return {
    date,
    restingHr: 50,
    recoveryScore,
    hrv: 90,
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
  };
}

/** `n` consecutive mornings ending on the fixture's today, scored by `score`. */
function series(n: number, score: (i: number) => number | null): RecoveryDayPoint[] {
  return Array.from({ length: n }, (_, i) => day(addDays(FIXTURE_TODAY, i - (n - 1)), score(i)));
}

function plot(days: RecoveryDayPoint[], height = HEIGHT) {
  return render(<ScorePlot days={days} height={height} />);
}

function columns(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll("rect"));
}
function hairlines(container: HTMLElement): SVGLineElement[] {
  return Array.from(container.querySelectorAll("line"));
}
function num(el: Element, attr: string): number {
  return Number.parseFloat(el.getAttribute(attr) ?? "");
}
/** A column's centre — the point the crosshair and the other two rows share. */
function centre(column: SVGRectElement): number {
  return num(column, "x") + num(column, "width") / 2;
}

describe("ScorePlot — a gap is a gap", () => {
  it("draws nothing at all for a morning with no score", () => {
    const days = [day("2026-08-10", 52), day("2026-08-11", null), day("2026-08-12", 13)];
    const { container } = plot(days);
    // Two columns for three slots. A zero-height stub or a baseline tick would
    // make this three, and would put a mark a pixel away from a real score of 3.
    expect(columns(container)).toHaveLength(days.filter((d) => d.recoveryScore !== null).length);
    expect(columns(container)).toHaveLength(2);
  });

  it("keeps the unscored morning's SLOT on the axis, so the columns stay date-aligned", () => {
    // The gap is TODAY, the rightmost slot. The last drawn column is therefore
    // the middle morning and belongs at the middle of the box — if the missing
    // morning were dropped rather than merely undrawn, it would slide to the
    // right edge and the whole row would come out from under the crosshair.
    const days = [day("2026-08-10", 52), day("2026-08-11", 60), day("2026-08-12", null)];
    const { container } = plot(days);
    expect(columns(container)).toHaveLength(2);
    expect(centre(columns(container).at(-1)!)).toBeCloseTo(INSET + (STUB_WIDTH - INSET * 2) / 2, 5);

    const dropped = plot(days.slice(0, 2));
    expect(centre(columns(dropped.container).at(-1)!)).toBeCloseTo(STUB_WIDTH - INSET, 5);
  });

  it("counts the fixture's real gaps — the 9 Aug morning that was never scored", () => {
    // Fri 7 Aug has no row at all and Sun 9 Aug has readings but no score; both
    // are date-aligned slots on the wire, and neither gets a column.
    const window = defaultView().days!.slice(-30);
    const { container } = plot(window);
    const scored = window.filter((d) => d.recoveryScore !== null).length;
    expect(columns(container)).toHaveLength(scored);
    expect(scored).toBeLessThan(window.length);
  });

  it("renders no svg for an empty window rather than an empty box of rules", () => {
    const { container } = plot([]);
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("ScorePlot — the bands", () => {
  it("paints today's 13 danger and yesterday's 78 success", () => {
    // The fixture's own headline mornings: Wed 12 Aug is a 13, Tue 11 Aug a 78.
    const window = defaultView().days!.slice(-2);
    expect(window.map((d) => d.recoveryScore)).toEqual([78, 13]);
    const { container } = plot(window);
    expect(columns(container).map((c) => c.getAttribute("fill"))).toEqual([
      "var(--success)",
      "var(--danger)",
    ]);
  });

  it("takes the middle third as warning, and every column at one weight", () => {
    const { container } = plot([day("2026-08-11", 52), day("2026-08-12", 13)]);
    expect(columns(container)[0].getAttribute("fill")).toBe("var(--warning)");
    for (const column of columns(container)) {
      expect(column.getAttribute("opacity")).toBe("0.85");
    }
  });

  it("restates no threshold of its own — the fill is recoveryBand's verdict", () => {
    // A 67 is green and a 66 is yellow because `recoveryBand` says so. A second
    // copy of the cut points in this file is what these two assertions exist to
    // catch drifting.
    const { container } = plot([day("2026-08-11", 66), day("2026-08-12", 67)]);
    expect(columns(container).map((c) => c.getAttribute("fill"))).toEqual([
      "var(--warning)",
      "var(--success)",
    ]);
  });
});

describe("ScorePlot — the fixed 0–100 domain", () => {
  const expected = (score: number, height = HEIGHT) => height * (1 - score / 100);

  it("puts the hairlines at 33 and 67 of the box", () => {
    const { container } = plot(series(30, (i) => 40 + i));
    const lines = hairlines(container);
    expect(lines).toHaveLength(2);
    expect(num(lines[0], "y1")).toBeCloseTo(expected(33), 5);
    expect(num(lines[1], "y1")).toBeCloseTo(expected(67), 5);
    // Horizontal, and spanning the whole box rather than the plotted stretch.
    for (const line of lines) {
      expect(num(line, "y2")).toBeCloseTo(num(line, "y1"), 5);
      expect(num(line, "x1")).toBe(0);
      expect(num(line, "x2")).toBe(STUB_WIDTH);
    }
  });

  it("leaves them there when the data's own range is narrow", () => {
    // Every score between 50 and 60 — the case a rescaled chart would stretch to
    // fill the box, dragging both hairlines off the scores they are named after.
    const { container } = plot(series(30, (i) => 50 + (i % 11)));
    expect(num(hairlines(container)[0], "y1")).toBeCloseTo(expected(33), 5);
    expect(num(hairlines(container)[1], "y1")).toBeCloseTo(expected(67), 5);
    // And the columns are drawn on that same fixed scale: a 50 is half the box,
    // not the foot of a stretched one.
    const fifty = columns(container).find((_, i) => i % 11 === 0)!;
    expect(num(fifty, "y")).toBeCloseTo(expected(50), 5);
  });

  it("labels them at the right edge in 9px tabular numerals", () => {
    const { container } = plot(series(30, () => 55));
    const labels = Array.from(container.querySelectorAll("text"));
    expect(labels.map((t) => t.textContent)).toEqual(["33", "67"]);
    for (const label of labels) {
      expect(label.getAttribute("text-anchor")).toBe("end");
      expect(num(label, "x")).toBeLessThanOrEqual(STUB_WIDTH);
      expect(label.getAttribute("class")).toContain("text-[9px]");
      expect(label.getAttribute("class")).toContain("tabular-nums");
      expect(label.getAttribute("class")).toContain("fill-[var(--faint)]");
    }
  });

  it("scales a column's height by its score, not by the window's range", () => {
    const { container } = plot([day("2026-08-11", 100), day("2026-08-12", 25)]);
    const [full, quarter] = columns(container);
    expect(num(full, "height")).toBeCloseTo(HEIGHT, 5);
    expect(num(quarter, "height")).toBeCloseTo(HEIGHT * 0.25, 5);
    // A near-zero morning still leaves a mark — and cannot be read as an absent
    // one, because an absent one is not drawn. The mark has to be INSIDE the
    // box to be a mark at all: a 1px column hung off the foot of the plot is
    // clipped by the viewBox and draws exactly what a missing morning draws.
    const floor = plot([day("2026-08-12", 0)]);
    const zero = columns(floor.container)[0];
    expect(num(zero, "height")).toBeGreaterThanOrEqual(1);
    expect(num(zero, "y") + num(zero, "height")).toBeLessThanOrEqual(HEIGHT);
  });
});

describe("ScorePlot — the three densities", () => {
  it("renders a column at least a pixel wide for every scored morning of a year", () => {
    const days = series(365, (i) => (i % 17 === 0 ? null : 30 + (i % 60)));
    const { container } = plot(days);
    const scored = days.filter((d) => d.recoveryScore !== null).length;
    expect(columns(container)).toHaveLength(scored);
    for (const column of columns(container)) {
      expect(num(column, "width")).toBeGreaterThanOrEqual(1);
    }
    // 365 mornings across 260px is under a pixel of step, so the floor is what
    // is holding the columns open — the same plot, no branch.
    expect(num(columns(container)[0], "width")).toBe(1);
  });

  it("renders fat columns at 30 days and thin ones at 365, from one expression", () => {
    const month = plot(series(30, () => 60));
    const year = plot(series(365, () => 60));
    const w = (c: HTMLElement) => num(columns(c)[0], "width");
    expect(w(month.container)).toBeGreaterThan(4);
    expect(w(month.container)).toBeGreaterThan(w(year.container));
  });

  it("centres each column on the shared x-mapping, so the deck's rows line up", () => {
    const days = series(30, () => 60);
    const { container } = plot(days);
    // Centres at the shared inset and at width − inset: the columns hang half
    // outside the box at the ends by design, because they are centred on the
    // HRV chart's mark positions rather than on their own slots.
    expect(centre(columns(container)[0])).toBeCloseTo(INSET, 5);
    expect(centre(columns(container).at(-1)!)).toBeCloseTo(STUB_WIDTH - INSET, 5);
  });
});

describe("ScorePlot — the box and the label", () => {
  it("reserves its height on the wrapper so hydration does not shift the deck", () => {
    const { container } = plot(
      series(30, () => 60),
      52,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.height).toBe("52px");
    expect(container.querySelector("svg")!.getAttribute("height")).toBe("52");
  });

  it("stands in for the columns in the accessibility tree", () => {
    const days = [day("2026-08-10", 52), day("2026-08-11", null), day("2026-08-12", 13)];
    const { container } = plot(days);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toContain("3 mornings");
    expect(svg.getAttribute("aria-label")).toContain("2 with a reading");
    expect(svg.getAttribute("aria-label")).toMatch(/Whoop's canonical bands/);
  });
});
