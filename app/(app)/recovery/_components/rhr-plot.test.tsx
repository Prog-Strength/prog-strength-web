import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RecoveryDayPoint } from "@/lib/dashboard";
import { MIN_BASELINE_DAYS } from "@/app/(app)/dashboard/_components/recovery/shared";
import { calibratingView, defaultView } from "../fixtures";
import { RhrCalibrating, RhrPlot } from "./rhr-plot";

/** The row height these tests draw at, so `mid` and `half` are known here. */
const HEIGHT = 100;
const MID = HEIGHT / 2;
/** Must match `CAPTION_ROOM` in the component: the bars' half-height in px. */
const HALF = MID - 10;

/**
 * One morning, carrying only the field this plot reads. The other metrics are
 * present and null on purpose — a `RecoveryDayPoint` is date-aligned with every
 * slot materialised, and a fixture that omitted them would be testing a shape
 * the endpoint never sends.
 */
function morning(date: string, restingHr: number | null): RecoveryDayPoint {
  return {
    date,
    restingHr,
    recoveryScore: null,
    hrv: null,
    baselineAvg: null,
    balancedLow: null,
    balancedHigh: null,
    zScore: null,
    status: "unknown",
  };
}

/** Every bar the plot drew, in DOM order. */
function bars(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll("rect"));
}

function attr(el: Element, name: string): number {
  return Number(el.getAttribute(name));
}

/** The plot's whole text, whitespace-normalised so JSX line breaks don't bite. */
function text(el: Element): string {
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}

describe("RhrPlot — divergence from the server's average", () => {
  // The direction is the whole message: a morning above the athlete's own
  // trailing average grows UP from the zero line and is the only one that takes
  // colour, and it takes the desaturated warning token, never --danger.
  it("draws a morning above the average upward from the zero line, in --warning", () => {
    const { container } = render(
      <RhrPlot days={[morning("2026-08-12", 60)]} avg={52} windowDays={30} height={HEIGHT} />,
    );

    const [bar] = bars(container);
    expect(attr(bar, "y") + attr(bar, "height")).toBeCloseTo(MID, 5);
    expect(bar).toHaveAttribute("fill", "var(--warning)");
  });

  it("draws a morning below the average downward from the zero line, in --muted", () => {
    const { container } = render(
      <RhrPlot days={[morning("2026-08-12", 44)]} avg={52} windowDays={30} height={HEIGHT} />,
    );

    const [bar] = bars(container);
    expect(attr(bar, "y")).toBeCloseTo(MID, 5);
    expect(bar).toHaveAttribute("fill", "var(--muted)");
    expect(container.innerHTML).not.toContain("var(--danger)");
  });

  // A gap is a gap. A zero-height bar sitting on the zero line would read as
  // "exactly average", which is the one thing an unrecorded morning is not.
  it("draws no bar for a morning with no reading", () => {
    const { container } = render(
      <RhrPlot
        days={[morning("2026-08-10", 55), morning("2026-08-11", null), morning("2026-08-12", 49)]}
        avg={52}
        windowDays={30}
        height={HEIGHT}
      />,
    );

    expect(bars(container)).toHaveLength(2);
  });

  it("keeps the zero line in --border-strong, full width", () => {
    const { container } = render(
      <RhrPlot days={[morning("2026-08-12", 60)]} avg={52} windowDays={30} height={HEIGHT} />,
    );

    const line = container.querySelector("line");
    expect(line).toHaveAttribute("stroke", "var(--border-strong)");
    expect(attr(line as Element, "y1")).toBeCloseTo(MID, 5);
  });

  // The ±4 bpm floor. Without it a month the athlete never moved more than a
  // beat in would be stretched to the full row and read as a mountain range.
  it("does not magnify a flat month past the ±4 bpm floor scale", () => {
    const flat = [51, 52, 53, 52.5, 51.5, 53.5, 52].map((bpm, i) =>
      morning(`2026-08-0${i + 1}`, bpm),
    );
    const { container } = render(<RhrPlot days={flat} avg={52} windowDays={30} height={HEIGHT} />);

    const tallest = Math.max(...bars(container).map((b) => attr(b, "height")));
    expect(tallest).toBeLessThan(HALF);
    // And the floor really is 4 bpm, not something larger that would also pass
    // the assertion above: the biggest departure here is 1.5 beats.
    expect(tallest).toBeCloseTo((1.5 / 4) * HALF, 5);
  });

  // Correction 2. This caption and the window strip's `Resting HR · window avg`
  // describe genuinely different figures, and the wording is what keeps them
  // from being read as the same one printed twice with a bug in it.
  it("captions the server's own baseline, rounded, and says it excludes today", () => {
    const baseline = defaultView().baseline;
    const avg = baseline?.restingHrAvg ?? 0;
    render(
      <RhrPlot
        days={[morning("2026-08-12", 69)]}
        avg={avg}
        windowDays={baseline?.windowDays ?? 30}
        height={HEIGHT}
      />,
    );

    expect(text(screen.getByTestId("rhr-caption"))).toBe(
      `baseline ${baseline?.windowDays}d avg ${Math.round(avg)} bpm · excl. today`,
    );
  });

  it("summarises itself for a screen reader", () => {
    render(
      <RhrPlot
        days={[morning("2026-08-11", 60), morning("2026-08-12", 49)]}
        avg={52.4}
        windowDays={30}
        height={HEIGHT}
      />,
    );

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "2 mornings of resting heart rate, drawn above and below a 30-day trailing average of 52 bpm.",
    );
  });
});

describe("RhrCalibrating", () => {
  // Nothing is drawn against a number that does not exist, so the sentence is
  // the whole row — no zero line to diverge from means no bars either.
  it("prints the honest sentence and draws nothing", () => {
    const nights = calibratingView().baseline?.restingHrDays ?? 0;
    const { container } = render(<RhrCalibrating nights={nights} />);

    expect(text(screen.getByTestId("rhr-calibrating"))).toBe(
      `No trailing average yet — ${nights} of ${MIN_BASELINE_DAYS} mornings recorded. ` +
        "The diverging baseline appears once the rest are, and nothing is drawn against a " +
        "number that does not exist.",
    );
    expect(bars(container)).toHaveLength(0);
  });

  // The floor is the API's configurable `min_baseline_days`, imported rather
  // than typed out — a hard-coded 14 here is how two surfaces start disagreeing
  // about what "calibrating" means.
  it("counts the mornings owed against the imported baseline floor", () => {
    render(<RhrCalibrating nights={9} />);

    expect(MIN_BASELINE_DAYS).toBe(14);
    expect(text(screen.getByTestId("rhr-calibrating"))).toContain("9 of 14 mornings recorded");
  });
});
