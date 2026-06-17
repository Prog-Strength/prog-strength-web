/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { MacroRingsMock, PrStatMock, CalendarStreakMock } from "./supporting-mocks";
import { macroRings, prStat, calendarStreak } from "../_fixtures";

describe("supporting mocks", () => {
  it("renders one labeled ring per macro with the intake-vs-goal percentage", () => {
    render(<MacroRingsMock />);
    macroRings.forEach((ring) => {
      const pct = Math.round((ring.intake / ring.goal) * 100);
      // The aria-label locks the ring math (e.g. Protein 128/180 → 71%).
      expect(screen.getByLabelText(`${ring.label}: ${pct}% of goal`)).toBeInTheDocument();
    });
  });

  it("renders the PR stat with its estimated 1RM and climbing delta", () => {
    render(<PrStatMock />);
    expect(screen.getByText(prStat.lift)).toBeInTheDocument();
    expect(screen.getByText(String(prStat.estimatedOneRm))).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`▲\\s*${prStat.deltaLb}\\s*${prStat.unit}`)),
    ).toBeInTheDocument();
  });

  it("renders the calendar streak figure", () => {
    render(<CalendarStreakMock />);
    expect(
      screen.getByText(new RegExp(`${calendarStreak.streakWeeks}\\s*weeks`)),
    ).toBeInTheDocument();
  });
});
