/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RecoveryView } from "@/lib/dashboard";
import { calibratingView, FIXTURE_TODAY, noReadingView, suppressedView } from "./fixtures";
import { TrendRailCard } from "./trend-rail";

const HREF = "/recovery";

function railMarks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="img"] > span')) as HTMLElement[];
}

describe("TrendRailCard", () => {
  it("heroes the week-vs-baseline delta, derived from server figures only", () => {
    render(<TrendRailCard section={suppressedView()} href={HREF} />);
    // shortAvg 82.3 vs hrvAvg 91.2 → −8.9 ms → −10% (rounded).
    expect(screen.getByText(/10%/)).toBeInTheDocument();
    expect(screen.getByText("−8.9 ms")).toBeInTheDocument();
    expect(screen.getByText(/falling this week/)).toBeInTheDocument();
  });

  it("delta figure carries the status color", () => {
    render(<TrendRailCard section={suppressedView()} href={HREF} />);
    expect(screen.getByText(/10%/)).toHaveStyle({ color: "var(--warning)" });
  });

  it("renders one mark per day with the gap left blank", () => {
    const { container } = render(<TrendRailCard section={suppressedView()} href={HREF} />);
    const marks = railMarks(container);
    expect(marks).toHaveLength(31);
    const blanks = marks.filter((m) => m.style.backgroundColor === "var(--surface-2)");
    expect(blanks).toHaveLength(1); // the interior all-null day
  });

  it("classifies marks in and out of the band", () => {
    const { container } = render(<TrendRailCard section={suppressedView()} href={HREF} />);
    const marks = railMarks(container);
    const inBand = marks.filter((m) => m.style.backgroundColor === "var(--success)");
    const outBand = marks.filter((m) => m.style.backgroundColor === "var(--faint)");
    // Fixture: 28 in-band days; 105 (above) and today's 74 (below, single) out.
    expect(inBand).toHaveLength(28);
    expect(outBand).toHaveLength(2);
  });

  it("promotes a ≥3-day below-band run to warning", () => {
    const view = suppressedView();
    const days = view.days ?? [];
    // Force the last three days below balancedLow (78.6) with no gap.
    days[days.length - 3] = {
      date: days[days.length - 3].date,
      hrv: 74,
      restingHr: 51,
      recoveryScore: 55,
    };
    days[days.length - 2] = {
      date: days[days.length - 2].date,
      hrv: 72,
      restingHr: 51,
      recoveryScore: 54,
    };
    days[days.length - 1] = { date: FIXTURE_TODAY, hrv: 70, restingHr: 52, recoveryScore: 50 };
    const { container } = render(<TrendRailCard section={view} href={HREF} />);
    const warning = railMarks(container).filter(
      (m) => m.style.backgroundColor === "var(--warning)",
    );
    expect(warning).toHaveLength(3);
  });

  it("no reading today: the headline is unaffected by definition", () => {
    render(<TrendRailCard section={noReadingView()} href={HREF} />);
    expect(screen.getByText(/10%/)).toBeInTheDocument();
    expect(screen.getByText("−8.9 ms")).toBeInTheDocument();
  });

  it("calibrating: honest n-of-14 progress instead of a rail", () => {
    render(<TrendRailCard section={calibratingView()} href={HREF} />);
    expect(screen.getByText("Trend calibrating")).toBeInTheDocument();
    expect(screen.getByText(/9 of 14/)).toBeInTheDocument();
  });

  it("guards a missing days array", () => {
    const view: RecoveryView = { restingToday: 51, recoveryScore: 58, spark: [] };
    render(<TrendRailCard section={view} href={HREF} />);
    expect(screen.getByText("Trend calibrating")).toBeInTheDocument();
  });
});
