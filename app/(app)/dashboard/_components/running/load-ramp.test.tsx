/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { LoadRampCard } from "./load-ramp";
import { firstRunEver, indoorOnly, ordinaryWeek, zeroRuns } from "./fixtures";

const UNITS = ["mi", "km"] as const;

describe("LoadRampCard", () => {
  it.each(UNITS)("heroes the signed duration delta on an ordinary week (%s)", (unit) => {
    render(<LoadRampCard section={ordinaryWeek(unit)} href="/x" />);
    // (12977 − 10440) / 10440 = +24.3% → +24%, a ramp → warning word.
    expect(screen.getByText("+24%")).toBeInTheDocument();
    expect(screen.getByText(/ramping/)).toBeInTheDocument();
    // Plain-language read: this week vs the 4-week average, as durations.
    expect(screen.getByText(/3:36:17/)).toBeInTheDocument();
    expect(screen.getByText(/2:54:00/)).toBeInTheDocument();
  });

  it("colors the ramp with the warning token, never danger", () => {
    render(<LoadRampCard section={ordinaryWeek("mi")} href="/x" />);
    const hero = screen.getByText("+24%");
    expect(hero).toHaveStyle({ color: "var(--warning)" });
  });

  it.each(UNITS)("says something true on a zero-run week (%s)", (unit) => {
    render(<LoadRampCard section={zeroRuns(unit)} href="/x" />);
    expect(screen.getByText("−100%")).toBeInTheDocument();
    expect(screen.getByText(/resting/)).toBeInTheDocument();
    // The last run is stated and dated — not promoted into this week's slot.
    expect(screen.getByText(/last run/i)).toBeInTheDocument();
    expect(screen.queryByText("NaN")).not.toBeInTheDocument();
  });

  it.each(UNITS)("renders a first week with no percentage and no NaN (%s)", (unit) => {
    const { container } = render(<LoadRampCard section={firstRunEver(unit)} href="/x" />);
    expect(screen.getByText(/first week/)).toBeInTheDocument();
    // The hero is the week's own time on feet.
    expect(screen.getByText("35:28")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/%/);
    expect(container.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("still renders a full body for an indoor-only week", () => {
    const { container } = render(<LoadRampCard section={indoorOnly("mi")} href="/x" />);
    expect(container.textContent).not.toBe("—");
    expect(screen.getByText(/vs/)).toBeInTheDocument();
  });

  it("renders the 8-bucket rail with the baseline ghost line", () => {
    render(<LoadRampCard section={ordinaryWeek("mi")} href="/x" />);
    expect(screen.getByRole("img", { name: /eight weeks/i })).toBeInTheDocument();
  });
});
