/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { RecoveryHero } from "./recovery-hero";

describe("RecoveryHero", () => {
  it("renders today's score, resting HR, and HRV with a band-colored ring", () => {
    render(
      <RecoveryHero
        today={{
          date: "2026-07-02",
          recovery_score: 72,
          resting_heart_rate: 54,
          hrv_rmssd_milli: 88.4,
        }}
      />,
    );
    expect(screen.getByTestId("recovery-score")).toHaveTextContent("72");
    expect(screen.getByTestId("recovery-ring-fill")).toHaveAttribute("stroke", "var(--success)");
    expect(screen.getByText(/54\s*bpm/)).toBeInTheDocument();
    expect(screen.getByText(/88\s*ms/)).toBeInTheDocument();
  });

  it("uses the warning band at 66 and success at 67", () => {
    const { rerender } = render(
      <RecoveryHero
        today={{ date: "d", recovery_score: 66, resting_heart_rate: 50, hrv_rmssd_milli: 60 }}
      />,
    );
    expect(screen.getByTestId("recovery-ring-fill")).toHaveAttribute("stroke", "var(--warning)");
    rerender(
      <RecoveryHero
        today={{ date: "d", recovery_score: 67, resting_heart_rate: 50, hrv_rmssd_milli: 60 }}
      />,
    );
    expect(screen.getByTestId("recovery-ring-fill")).toHaveAttribute("stroke", "var(--success)");
  });

  it("renders a no-data state with em-dashes when today is null (no promotion)", () => {
    render(<RecoveryHero today={null} />);
    expect(screen.getByText(/no data yet today/i)).toBeInTheDocument();
    expect(screen.queryByTestId("recovery-ring-fill")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("shows em-dash for an individually-null metric even when the score exists", () => {
    render(
      <RecoveryHero
        today={{ date: "d", recovery_score: 40, resting_heart_rate: null, hrv_rmssd_milli: null }}
      />,
    );
    expect(screen.getByTestId("recovery-score")).toHaveTextContent("40");
    expect(screen.getByTestId("recovery-ring-fill")).toHaveAttribute("stroke", "var(--warning)");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});
