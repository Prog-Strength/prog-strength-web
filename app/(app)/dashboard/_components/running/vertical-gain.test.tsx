/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { VerticalGainCard } from "./vertical-gain";
import { firstRunEver, indoorOnly, ordinaryWeek, zeroRuns } from "./fixtures";

const UNITS = ["mi", "km"] as const;

describe("VerticalGainCard", () => {
  it.each(UNITS)("heroes the week's climb with the biggest climb called out (%s)", (unit) => {
    render(<VerticalGainCard section={ordinaryWeek(unit)} href="/x" />);
    // The hero figure and its unit suffix render as separate spans.
    expect(screen.getByText(unit === "mi" ? "899" : "274")).toBeInTheDocument();
    const most = unit === "mi" ? "702 ft" : "214 m";
    expect(screen.getByText(new RegExp(`most: ${most} · Sat`))).toBeInTheDocument();
  });

  it("renders a gap outline — not a zero column — for the treadmill run", () => {
    render(<VerticalGainCard section={ordinaryWeek("mi")} href="/x" />);
    expect(screen.getAllByTestId("gain-column")).toHaveLength(3);
    expect(screen.getAllByTestId("gain-gap")).toHaveLength(1);
    // Coverage is stated.
    expect(screen.getByText(/3 of 4 runs/)).toBeInTheDocument();
  });

  it("fills columns with sage, never hike clay", () => {
    render(<VerticalGainCard section={ordinaryWeek("mi")} href="/x" />);
    for (const col of screen.getAllByTestId("gain-column")) {
      expect(col).toHaveStyle({ backgroundColor: "var(--discipline-run-dot)" });
    }
  });

  it.each(UNITS)("states the indoor-only week in words, not an empty chart (%s)", (unit) => {
    const { container } = render(<VerticalGainCard section={indoorOnly(unit)} href="/x" />);
    expect(screen.getByText(/no outdoor runs this week/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/0 ft|0 m/);
    expect(screen.queryAllByTestId("gain-column")).toHaveLength(0);
  });

  it.each(UNITS)("says something true on a zero-run week (%s)", (unit) => {
    const { container } = render(<VerticalGainCard section={zeroRuns(unit)} href="/x" />);
    expect(screen.getByText(/no runs this week/)).toBeInTheDocument();
    expect(container.textContent).not.toBe("—");
  });

  it("keeps a lone small climb a visible step (floor, not a sliver)", () => {
    render(<VerticalGainCard section={firstRunEver("mi")} href="/x" />);
    const cols = screen.getAllByTestId("gain-column");
    expect(cols).toHaveLength(1);
  });
});
