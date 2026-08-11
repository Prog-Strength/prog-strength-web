/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { prepareHrvChart } from "./hrv-chart";
import {
  driftingDays,
  noReadingDriftView,
  risingView,
  suppressedDriftView,
  DRIFT_HRV_SERIES,
} from "./fixtures";
import { RecoveryTrendView } from "./trend-rail";

function renderView(section: RecoveryView) {
  const chart = prepareHrvChart(section);
  if (!chart) throw new Error("fixture does not clear the tile's guard");
  return render(<RecoveryTrendView chart={chart} />);
}

function railMarks(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="img"] > span')) as HTMLElement[];
}

/** Marks whose inline background is this token, at any opacity. */
function marksColored(container: HTMLElement, token: string): HTMLElement[] {
  return railMarks(container).filter((m) => m.style.backgroundColor === token);
}

/** How many days the PAYLOAD itself calls this status — the rail must match. */
function daysWithStatus(days: RecoveryDayPoint[], status: string): number {
  return days.filter((d) => d.hrv !== null && d.status === status).length;
}

describe("RecoveryTrendView", () => {
  it("heroes the week-vs-baseline delta, derived from server figures only", () => {
    renderView(suppressedDriftView());
    // shortAvg 77.0 vs hrvAvg 91.2 → −14.2 ms → −16% (rounded).
    expect(screen.getByText(/16%/)).toBeInTheDocument();
    expect(screen.getByText("−14.2 ms")).toBeInTheDocument();
    expect(screen.getByText(/falling this week/)).toBeInTheDocument();
  });

  it("the delta figure carries the WEEK's status, not last night's", () => {
    // shortAvg 77.0 is below balancedLow 78.6, so the week reads suppressed —
    // and this is the same value that colours the balance view's gauge tick.
    renderView(suppressedDriftView());
    expect(screen.getByText(/16%/)).toHaveStyle({ color: "var(--warning)" });
  });

  it("a balanced week is the tile's one green, on the same token as the chart", () => {
    // risingView: shortAvg 92.8 inside 78.6–103.8.
    renderView(risingView());
    expect(screen.getByText(/2%/)).toHaveStyle({ color: "var(--success)" });
  });

  it("renders one mark per night with the missing night left blank", () => {
    const { container } = renderView(risingView());
    expect(railMarks(container)).toHaveLength(31);
    expect(marksColored(container, "var(--surface-2)")).toHaveLength(1); // the interior gap
  });

  it("marks mirror the payload's own per-day statuses, never a re-test against today's band", () => {
    const view = risingView();
    const { container } = renderView(view);
    const days = view.days!;

    // The rail reports exactly what the server said about each morning — which
    // is what keeps it agreeing with the chart one swipe away, where each mark
    // is coloured from the same field.
    expect(marksColored(container, "var(--success)")).toHaveLength(
      daysWithStatus(days, "balanced"),
    );
    expect(marksColored(container, "var(--warning)")).toHaveLength(
      daysWithStatus(days, "suppressed"),
    );
    expect(marksColored(container, "var(--accent)")).toHaveLength(daysWithStatus(days, "elevated"));
  });

  it("an isolated suppressed night is drawn lighter than a sustained dip", () => {
    // suppressedDriftView's only suppressed night is today's 74 ms — alone, so
    // it must not read as solid as a three-night run.
    const { container } = renderView(suppressedDriftView());
    const dips = marksColored(container, "var(--warning)");
    expect(dips).toHaveLength(1);
    expect(dips[0].style.opacity).toBe("0.55");
    expect(screen.queryByText(/nights suppressed/)).not.toBeInTheDocument();
  });

  it("promotes a ≥3-night suppressed run to solid, and says so", () => {
    // A window whose last three mornings sit well under a flat band.
    const hrv = DRIFT_HRV_SERIES.map((v, i) => (i >= DRIFT_HRV_SERIES.length - 3 ? 60 : v));
    const days = driftingDays({ hrv, fromAvg: 91.2, toAvg: 91.2, halfWidth: 12.6 });
    const view: RecoveryView = { ...risingView(), days };

    const { container } = renderView(view);
    const solid = marksColored(container, "var(--warning)").filter((m) => m.style.opacity === "1");
    expect(solid).toHaveLength(3);
    expect(screen.getByText(/3\+ nights suppressed/)).toBeInTheDocument();
  });

  it("no reading today: the headline is unaffected by definition", () => {
    renderView(noReadingDriftView());
    expect(screen.getByText(/2%/)).toBeInTheDocument();
    expect(screen.getByText("+1.6 ms")).toBeInTheDocument();
  });

  it("no 7-day mean yet: a plain line instead of an invented percentage", () => {
    const view = risingView();
    view.hrv = { ...view.hrv!, shortAvg: null };
    const { container } = renderView(view);
    expect(screen.getByText("Not enough nights for a weekly read yet")).toBeInTheDocument();
    expect(container.textContent).not.toContain("%");
    // The rail is about the nights, not the mean, so it still draws.
    expect(railMarks(container)).toHaveLength(31);
  });
});
