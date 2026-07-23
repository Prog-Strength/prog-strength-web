/// <reference types="vitest/globals" />
import { render, screen, within } from "@testing-library/react";
import { RecoveryLog } from "./recovery-log";
import type { WhoopRecoveryDay } from "@/lib/api";

const rows: WhoopRecoveryDay[] = [
  { date: "2026-07-01", recovery_score: 40, resting_heart_rate: 60, hrv_rmssd_milli: 70 },
  { date: "2026-07-03", recovery_score: 80, resting_heart_rate: 50, hrv_rmssd_milli: 90.2 },
  { date: "2026-07-02", recovery_score: null, resting_heart_rate: null, hrv_rmssd_milli: null },
];

describe("RecoveryLog", () => {
  it("lists rows newest-first", () => {
    render(<RecoveryLog rows={rows} />);
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText(/Jul 3/)).toBeInTheDocument();
    expect(within(items[1]).getByText(/Jul 2/)).toBeInTheDocument();
    expect(within(items[2]).getByText(/Jul 1/)).toBeInTheDocument();
  });

  it("renders the score as a band-colored chip and rounds metrics", () => {
    render(<RecoveryLog rows={rows} />);
    const top = screen.getAllByRole("listitem")[0];
    const chip = within(top).getByTestId("recovery-log-chip");
    expect(chip).toHaveTextContent("80");
    expect(chip).toHaveStyle({ color: "var(--success)" });
    expect(within(top).getByText(/50/)).toBeInTheDocument();
    expect(within(top).getByText(/90/)).toBeInTheDocument();
  });

  it("shows em-dashes for a fully-null day", () => {
    render(<RecoveryLog rows={rows} />);
    const middle = screen.getAllByRole("listitem")[1]; // 2026-07-02
    expect(within(middle).getAllByText("—").length).toBeGreaterThanOrEqual(3);
  });
});
