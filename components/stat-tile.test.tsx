/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";

import { StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("renders the value and label text", () => {
    render(<StatTile value="10,000" label="Avg daily steps" />);
    expect(screen.getByText("10,000")).toBeInTheDocument();
    expect(screen.getByText("Avg daily steps")).toBeInTheDocument();
  });

  it("colors the value with the success token when tone is positive", () => {
    render(<StatTile value="+12%" label="Trend" tone="positive" />);
    expect(screen.getByText("+12%").className).toContain("text-[var(--success)]");
  });

  it("colors the value with the danger token when tone is negative", () => {
    render(<StatTile value="-12%" label="Trend" tone="negative" />);
    expect(screen.getByText("-12%").className).toContain("text-[var(--danger)]");
  });

  it("colors the value with the foreground token by default (neutral)", () => {
    render(<StatTile value="42" label="Runs" />);
    expect(screen.getByText("42").className).toContain("text-[var(--foreground)]");
  });

  it("renders the sub line when provided and omits it otherwise", () => {
    const { rerender } = render(<StatTile value="42" label="Runs" sub="this month" />);
    expect(screen.getByText("this month")).toBeInTheDocument();

    rerender(<StatTile value="42" label="Runs" />);
    expect(screen.queryByText("this month")).not.toBeInTheDocument();
  });
});
