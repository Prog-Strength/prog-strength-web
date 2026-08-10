/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { HrvBalanceCard } from "./balance-band";
import { balancedView, calibratingView, noReadingView, suppressedView } from "./fixtures";

const HREF = "/recovery";

describe("HrvBalanceCard", () => {
  it("suppressed: band rect at server bounds, baseline centre line, today in warning", () => {
    const { container } = render(<HrvBalanceCard section={suppressedView()} href={HREF} />);
    expect(screen.getByText("74")).toBeInTheDocument();
    expect(screen.getByText("Suppressed")).toBeInTheDocument();
    // The band — one rect filled with the desaturated success token.
    const rect = container.querySelector("rect");
    expect(rect).not.toBeNull();
    expect(rect?.getAttribute("fill")).toBe("var(--success)");
    // Dashed baseline centre line.
    expect(container.querySelector("line")).not.toBeNull();
    // Today's point carries the status color.
    const circle = container.querySelector("circle");
    expect(circle?.getAttribute("fill")).toBe("var(--warning)");
    // Server bounds spelled out, rounded: 78.6–103.8 → 79–104.
    expect(screen.getAllByText(/79–104 ms/).length).toBeGreaterThan(0);
  });

  it("breaks the polyline around the interior gap instead of interpolating", () => {
    const { container } = render(<HrvBalanceCard section={suppressedView()} href={HREF} />);
    // One null at index 27 splits the 31-day series into exactly two segments.
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("balanced: today's point renders in success", () => {
    const { container } = render(<HrvBalanceCard section={balancedView()} href={HREF} />);
    expect(container.querySelector("circle")?.getAttribute("fill")).toBe("var(--success)");
  });

  it("calibrating: honest progress, no band and no chart frame", () => {
    const { container } = render(<HrvBalanceCard section={calibratingView()} href={HREF} />);
    expect(screen.getByText(/9 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    expect(container.querySelector("rect")).toBeNull();
  });

  it("no reading yet: prints the band bounds and still draws the chart, no today point", () => {
    const { container } = render(<HrvBalanceCard section={noReadingView()} href={HREF} />);
    expect(screen.getByText(/No reading yet/)).toBeInTheDocument();
    expect(container.querySelector("rect")).not.toBeNull();
    expect(container.querySelector("circle")).toBeNull();
  });

  it("headline: integer milliseconds, never the raw Whoop float", () => {
    const section = balancedView();
    const days = section.days!;
    // The headline reads the LAST day of the window, not the scalar — move both,
    // as the server does, so the fixture stays a payload a real morning produces.
    days[days.length - 1] = { ...days[days.length - 1], hrv: 77.39185 };
    section.hrvToday = 77.39185;

    const { container } = render(<HrvBalanceCard section={section} href={HREF} />);

    expect(screen.getByText("77")).toBeInTheDocument();
    expect(container.textContent).not.toContain("77.39185");
  });
});
