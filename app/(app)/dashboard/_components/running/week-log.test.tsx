/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RunningView } from "@/lib/dashboard";
import { WeekLogCard } from "./week-log";
import { firstRunEver, ordinaryWeek, zeroRuns } from "./fixtures";

const UNITS = ["mi", "km"] as const;

describe("WeekLogCard", () => {
  it.each(UNITS)("renders each run as a dated row under a quiet header (%s)", (unit) => {
    render(<WeekLogCard section={ordinaryWeek(unit)} href="/x" />);
    // Header caption: total · runs · time.
    const total = unit === "mi" ? "21.3" : "34.3";
    expect(screen.getByText(new RegExp(`${total} ${unit} · 4 runs · 3:36:17`))).toBeInTheDocument();
    // Rows are dated by weekday.
    expect(screen.getByText("Sat")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    // The long run's figures are on its row.
    expect(screen.getByText(new RegExp(unit === "mi" ? "12.7" : "20.4"))).toBeInTheDocument();
  });

  it("shows an em-dash only in the HR column of a no-HR run", () => {
    render(<WeekLogCard section={ordinaryWeek("mi")} href="/x" />);
    // Exactly one of the four runs (Lunch run) lacks HR.
    expect(screen.getAllByText("—")).toHaveLength(1);
    // Its other columns still speak: the pace is present.
    expect(screen.getByText("10:30")).toBeInTheDocument();
  });

  it("marks the indoor run with a glyph instead of a blank column", () => {
    render(<WeekLogCard section={ordinaryWeek("mi")} href="/x" />);
    expect(screen.getByLabelText("indoor run")).toBeInTheDocument();
  });

  it("collapses a five-run week to four rows plus an earlier line", () => {
    const five: RunningView = ordinaryWeek("mi");
    five.weekRuns = [
      { ...five.weekRuns[0], activityId: "a0", localDate: "2026-07-26" },
      ...five.weekRuns,
    ];
    render(<WeekLogCard section={five} href="/x" />);
    expect(screen.getByText("+1 earlier")).toBeInTheDocument();
  });

  it("brightens the pace of runs that beat the baseline", () => {
    render(<WeekLogCard section={ordinaryWeek("mi")} href="/x" />);
    // Treadmill run 356.1 beat the 381.2 baseline → bright sage.
    expect(screen.getByText("9:33")).toHaveStyle({ color: "var(--discipline-run-fg)" });
    // The 391.5 lunch run did not → dim sage.
    expect(screen.getByText("10:30")).toHaveStyle({ color: "var(--discipline-run-dot)" });
  });

  it.each(UNITS)("dates the last run clearly on a zero-run week (%s)", (unit) => {
    render(<WeekLogCard section={zeroRuns(unit)} href="/x" />);
    expect(screen.getByText(/no runs this week/)).toBeInTheDocument();
    // The last run is dated (short date, not a bare weekday), so last week
    // is never mistaken for this one.
    expect(screen.getByText(/Aug 1/)).toBeInTheDocument();
  });

  it("renders a single-row week without implying more", () => {
    const { container } = render(<WeekLogCard section={firstRunEver("mi")} href="/x" />);
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/earlier/);
  });
});
