/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RecoveryDayPoint } from "@/lib/dashboard";
import { MIN_BASELINE_DAYS } from "@/app/(app)/dashboard/_components/recovery/shared";
import { defaultView } from "../fixtures";
import { RhrPlot } from "./rhr-plot";
import { prepareDeck } from "./shared";
import { WindowStrip } from "./window-strip";

/** A morning with everything present; override only what a test is about. */
function day(over: Partial<RecoveryDayPoint> = {}): RecoveryDayPoint {
  return {
    date: "2026-08-12",
    restingHr: 52,
    recoveryScore: 71,
    hrv: 88,
    baselineAvg: 88,
    balancedLow: 76,
    balancedHigh: 100,
    zScore: 0,
    status: "balanced",
    ...over,
  };
}

/** `n` mornings, each built by `over(i)` — enough history to clear the gate. */
function days(n: number, over: (i: number) => Partial<RecoveryDayPoint> = () => ({})) {
  return Array.from({ length: n }, (_, i) => day(over(i)));
}

/** The window the deck would actually draw at 30d, from the page fixture. */
function window30() {
  return prepareDeck(defaultView(), 30).days;
}

/** Collapsed text of a node — the plot's caption is an SVG `<text>` in parts. */
function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("WindowStrip — the figures say which window they describe", () => {
  test("all three metric cells are labelled `window avg`", () => {
    render(<WindowStrip caption="Last 30 days" days={window30()} />);

    expect(screen.getByText("Score · window avg")).toBeInTheDocument();
    expect(screen.getByText("Resting HR · window avg")).toBeInTheDocument();
    expect(screen.getByText("HRV · window avg")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days · window orientation")).toBeInTheDocument();
  });

  test("the caption is the window's own prose, so `window avg` names a stretch", () => {
    render(<WindowStrip caption="Last 12 months" days={window30()} />);
    expect(screen.getByText("Last 12 months · window orientation")).toBeInTheDocument();
  });

  test("each cell prints its window mean over the readings actually present", () => {
    // 29 of the 30 slots carry a resting HR — Fri 7 Aug is a strap-off morning
    // and contributes nothing, so the sub-line counts readings, never slots.
    render(<WindowStrip caption="Last 30 days" days={window30()} />);

    const nights = screen.getAllByText(/^\d+ nights$/).map((el) => el.textContent);
    expect(nights).toEqual(["28 nights", "29 nights", "29 nights"]);

    // The window's own means, rounded for display and never re-derived from a
    // server figure — 58 % · 53 bpm · 89 ms over the fixture's last 30 slots.
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText("53")).toBeInTheDocument();
    expect(screen.getByText("89")).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});

describe("WindowStrip — the calibration gate is per metric", () => {
  test("a metric below MIN_BASELINE_DAYS readings prints its count, not a mean", () => {
    // Twenty mornings, but resting HR was only recorded on five of them.
    const window = days(20, (i) => ({ restingHr: i < 5 ? 52 : null }));
    render(<WindowStrip caption="Last 30 days" days={window} />);

    expect(screen.getByText(`5 of ${MIN_BASELINE_DAYS} nights`)).toBeInTheDocument();
    // Exactly one em-dash: the resting-HR figure, and no other cell's.
    expect(screen.getAllByText("—")).toHaveLength(1);
    expect(screen.queryByText("52")).not.toBeInTheDocument();
    expect(screen.getByText("not yet")).toBeInTheDocument();
  });

  test("the other cells are unaffected when they do have enough", () => {
    const window = days(20, (i) => ({ restingHr: i < 5 ? 52 : null }));
    render(<WindowStrip caption="Last 30 days" days={window} />);

    // Score and HRV have all twenty readings and still print their means.
    expect(screen.getAllByText("20 nights")).toHaveLength(2);
    expect(screen.getByText("71")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
    expect(screen.getByText("ms")).toBeInTheDocument();
    expect(screen.queryByText("bpm")).not.toBeInTheDocument();
  });

  test("exactly at the floor the cell commits to a figure", () => {
    const window = days(20, (i) => ({ restingHr: i < MIN_BASELINE_DAYS ? 52 : null }));
    render(<WindowStrip caption="Last 30 days" days={window} />);

    expect(screen.queryByText("—")).not.toBeInTheDocument();
    expect(screen.getByText(`${MIN_BASELINE_DAYS} nights`)).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
  });
});

describe("WindowStrip — the band mix", () => {
  test("the counts match the hand-counted fixture window, each in its band colour", () => {
    render(<WindowStrip caption="Last 30 days" days={window30()} />);

    // The same 13 · 10 · 5 that `shared.test.ts` pins for the 30-day window.
    const row = screen.getByText("Band mix").previousElementSibling as HTMLElement;
    expect(row.textContent).toBe("13·10·5");

    const [green, yellow, red] = Array.from(row.children) as HTMLElement[];
    expect(green.style.color).toBe("var(--success)");
    expect(yellow.style.color).toBe("var(--warning)");
    expect(red.style.color).toBe("var(--danger)");
  });

  test("the segments are proportional to the counts, over the surface track", () => {
    const window = [
      ...days(2, () => ({ recoveryScore: 80 })),
      ...days(1, () => ({ recoveryScore: 50 })),
      ...days(1, () => ({ recoveryScore: 20 })),
      // A scoreless morning is in no band and widens nothing.
      day({ recoveryScore: null }),
    ];
    render(<WindowStrip caption="Last 30 days" days={window} />);

    const row = screen.getByText("Band mix").previousElementSibling as HTMLElement;
    expect(row.textContent).toBe("2·1·1");

    const track = row.previousElementSibling?.firstElementChild as HTMLElement;
    const widths = Array.from(track.children).map((s) => (s as HTMLElement).style.width);
    expect(widths).toEqual(["50%", "25%", "25%"]);
    expect(track.className).toContain("bg-[var(--surface-2)]");
  });

  test("a window with no scored morning says so rather than drawing an empty bar", () => {
    render(<WindowStrip caption="Last 30 days" days={days(20, () => ({ recoveryScore: null }))} />);

    expect(screen.getByText("no scored mornings")).toBeInTheDocument();
    const track = screen.getByText("Band mix").parentElement?.firstElementChild as HTMLElement;
    expect(track.firstElementChild?.children).toHaveLength(0);
  });
});

describe("WindowStrip — correction 2", () => {
  /**
   * THE REGRESSION TEST FOR CORRECTION 2, and the reason it asserts two strings
   * that live in two files.
   *
   * This strip's resting-HR figure is a client mean over the RENDERED window,
   * today included. `rhr-plot.tsx`'s caption prints `baseline {win}d avg {v} bpm
   * · excl. today` — `baseline.restingHrAvg`, the server's trailing mean, which
   * EXCLUDES today and is the plot's zero line. Two different figures, one
   * screen, and at the 30d window they will print different numbers. The only
   * thing stopping that reading as a bug is that each caption says which figure
   * it is.
   *
   * So: the strip must say `window avg` and must never say `excl. today`, and
   * the plot's caption is asserted alongside it in `rhr-plot.test.tsx`. If a
   * future edit shortens either label toward the other — `Resting HR avg` here,
   * or a bare `30d avg 54 bpm` there — this fails, which is the point. The two
   * registers must never converge again.
   */
  test("the strip's window mean and the plot's baseline caption are distinguishable", () => {
    // Both registers, in ONE test and one document, because the defect
    // correction 2 fixes is not in either string alone — it is in the pair.
    const view = defaultView();
    const days = window30();
    const avg = view.baseline?.restingHrAvg ?? 0;
    const windowDays = view.baseline?.windowDays ?? 30;

    const { container } = render(
      <>
        <WindowStrip caption="Last 30 days" days={days} />
        <RhrPlot days={days} avg={avg} windowDays={windowDays} height={100} />
      </>,
    );

    const stripLabel = "Resting HR · window avg";
    const plotCaption = `baseline ${windowDays}d avg ${Math.round(avg)} bpm · excl. today`;
    expect(screen.getByText(stripLabel)).toBeInTheDocument();
    expect(text(screen.getByTestId("rhr-caption"))).toBe(plotCaption);

    // Neither wording is the other's, and the mockup's `Resting HR avg` — the
    // label that made the two read as one figure printed twice — is on neither.
    expect(stripLabel).not.toEqual(plotCaption);
    expect(screen.queryByText("Resting HR avg")).not.toBeInTheDocument();
    // Each register says which figure it is, in the words that carry it: the
    // strip is a window mean, the caption is a server baseline excluding today.
    expect(plotCaption).toContain("baseline");
    expect(plotCaption).toContain("excl. today");
    expect(stripLabel).toContain("window avg");
    expect(container.textContent).toContain(stripLabel);
    expect(container.textContent).toContain(plotCaption);
  });

  test("the strip alone never claims to exclude today, or to be a baseline", () => {
    const { container } = render(<WindowStrip caption="Last 30 days" days={window30()} />);

    expect(container.textContent).toContain("Resting HR · window avg");
    expect(container.textContent).not.toContain("excl. today");
    expect(container.textContent).not.toContain("baseline");
  });

  test("the component has no baseline to compare against, by signature", () => {
    // Nothing on the strip is ranked against `baseline.restingHrAvg`,
    // `baseline.hrvAvg` or `baseline.recoveryScoreAvg`: the props are the window
    // and its caption, so the comparison cannot be written without widening the
    // signature first — which makes it a decision rather than a slip.
    const { container } = render(<WindowStrip caption="Last 30 days" days={window30()} />);

    expect(container.textContent).not.toContain("vs 30d");
    expect(container.textContent).not.toContain("30d avg");
  });
});
