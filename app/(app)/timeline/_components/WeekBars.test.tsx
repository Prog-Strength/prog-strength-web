/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { WeekBars } from "./WeekBars";

describe("WeekBars", () => {
  it("renders seven day bars labeled Mon→Sun", () => {
    render(<WeekBars bars={[1, 0, 2, 0, 0, 0, 0]} todayIndex={2} />);
    const bars = screen.getAllByTestId("week-bar");
    expect(bars).toHaveLength(7);
  });

  it("marks the today bar", () => {
    render(<WeekBars bars={[0, 0, 0, 0, 0, 0, 0]} todayIndex={4} />);
    const bars = screen.getAllByTestId("week-bar");
    expect(bars[4]).toHaveAttribute("data-today", "true");
  });

  it("renders an accessible label summarizing the week", () => {
    render(<WeekBars bars={[1, 0, 2, 0, 0, 0, 0]} todayIndex={2} />);
    expect(screen.getByRole("img", { name: /this week/i })).toBeInTheDocument();
  });
});
