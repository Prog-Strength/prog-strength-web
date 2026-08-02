/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { calibratingView, noReadingView, suppressedView } from "./fixtures";
import { MorningLedgerCard } from "./morning-ledger";

const HREF = "/recovery";

describe("MorningLedgerCard", () => {
  it("header prints the server baselines as the yardstick", () => {
    render(<MorningLedgerCard section={suppressedView()} href={HREF} />);
    // 91.2 ms · 52.4 bpm · 68.1 → rounded.
    expect(screen.getByText(/91 ms · 52 bpm · 68/)).toBeInTheDocument();
  });

  it("rows are newest-first with Today leading", () => {
    render(<MorningLedgerCard section={suppressedView()} href={HREF} />);
    const labels = screen.getAllByText(/^(Today|Fri|Thu|Wed)$/).map((el) => el.textContent);
    expect(labels).toEqual(["Today", "Fri", "Thu", "Wed"]);
  });

  it("a fully-null morning renders a 'no reading' row, not a vanished one", () => {
    // The fixture's interior gap (2026-07-29, Wed) falls inside the last four days.
    render(<MorningLedgerCard section={suppressedView()} href={HREF} />);
    expect(screen.getByText("no reading")).toBeInTheDocument();
  });

  it("today's row carries the HRV delta glyph as its only color", () => {
    const { container } = render(<MorningLedgerCard section={suppressedView()} href={HREF} />);
    // 74 vs 91.2 → below by more than 3 → ▼ in warning.
    const glyphs = Array.from(container.querySelectorAll("span")).filter(
      (s) => s.textContent === "▼",
    ) as HTMLElement[];
    expect(glyphs.length).toBeGreaterThan(0);
    expect(glyphs[0].style.color).toBe("var(--warning)");
  });

  it("no reading yet today: today appears as a no-reading row", () => {
    render(<MorningLedgerCard section={noReadingView()} href={HREF} />);
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getAllByText("no reading").length).toBeGreaterThan(0);
  });

  it("calibrating: the header shows honest n-of-14 progress", () => {
    render(<MorningLedgerCard section={calibratingView()} href={HREF} />);
    expect(screen.getByText(/9 of 14 nights/)).toBeInTheDocument();
  });
});
