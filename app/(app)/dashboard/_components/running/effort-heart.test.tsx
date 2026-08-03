/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RunningView } from "@/lib/dashboard";
import { EffortHeartCard } from "./effort-heart";
import { firstRunEver, ordinaryWeek, zeroRuns } from "./fixtures";

const UNITS = ["mi", "km"] as const;

describe("EffortHeartCard", () => {
  it.each(UNITS)("heroes the duration-weighted bpm with the baseline delta (%s)", (unit) => {
    render(<EffortHeartCard section={ordinaryWeek(unit)} href="/x" />);
    expect(screen.getByText("153")).toBeInTheDocument();
    // 153 vs baseline 150 — a signed delta of two server figures.
    expect(screen.getByText(/\+3 vs 4-wk/)).toBeInTheDocument();
  });

  it("states coverage when not every run carried HR", () => {
    render(<EffortHeartCard section={ordinaryWeek("mi")} href="/x" />);
    expect(screen.getByText(/3 of 4 runs/)).toBeInTheDocument();
  });

  it("renders one dot per HR-bearing run, colored by zone", () => {
    render(<EffortHeartCard section={ordinaryWeek("mi")} href="/x" />);
    const dots = screen.getAllByTestId("effort-dot");
    expect(dots).toHaveLength(3);
    expect(dots[0]).toHaveStyle({ backgroundColor: "var(--zone-2)" });
    expect(dots[1]).toHaveStyle({ backgroundColor: "var(--zone-3)" });
  });

  it("says which zone the week mostly was — never minutes-in-zone", () => {
    const { container } = render(<EffortHeartCard section={ordinaryWeek("mi")} href="/x" />);
    expect(screen.getByText(/mostly zone 3 runs/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/min(ute)?s? in zone/i);
  });

  it("renders neutral dots when zones are nil (engine unwired)", () => {
    const section: RunningView = ordinaryWeek("mi");
    section.weekRuns = section.weekRuns.map((r) => ({ ...r, heartRateZone: null }));
    render(<EffortHeartCard section={section} href="/x" />);
    for (const dot of screen.getAllByTestId("effort-dot")) {
      expect(dot).toHaveStyle({ backgroundColor: "var(--muted)" });
    }
    // Without zones the card must not claim a zone in words either.
    expect(screen.queryByText(/mostly zone/)).not.toBeInTheDocument();
  });

  it("handles a week with no HR-bearing runs honestly", () => {
    const section: RunningView = ordinaryWeek("mi");
    section.weekRuns = section.weekRuns.map((r) => ({
      ...r,
      avgHeartRate: null,
      heartRateZone: null,
    }));
    section.currentWeek = { ...section.currentWeek, avgHeartRate: null, heartRateRuns: 0 };
    render(<EffortHeartCard section={section} href="/x" />);
    expect(screen.getByText(/4 runs/)).toBeInTheDocument();
    expect(screen.getByText(/no heart-rate data this week/)).toBeInTheDocument();
    expect(screen.queryAllByTestId("effort-dot")).toHaveLength(0);
  });

  it.each(UNITS)("says something true on a zero-run week (%s)", (unit) => {
    const { container } = render(<EffortHeartCard section={zeroRuns(unit)} href="/x" />);
    expect(screen.getByText(/no runs this week/)).toBeInTheDocument();
    expect(container.textContent).not.toBe("—");
  });

  it("survives n = 1 without implying a distribution", () => {
    render(<EffortHeartCard section={firstRunEver("mi")} href="/x" />);
    expect(screen.getByText("148")).toBeInTheDocument();
    expect(screen.getAllByTestId("effort-dot")).toHaveLength(1);
    // No baseline → no delta claim; one run → no "mostly zone" claim either.
    expect(screen.queryByText(/vs 4-wk/)).not.toBeInTheDocument();
    expect(screen.queryByText(/mostly zone/)).not.toBeInTheDocument();
  });
});
