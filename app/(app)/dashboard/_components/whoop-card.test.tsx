/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RecoveryView } from "@/lib/dashboard";
import { RecoveryCard } from "./whoop-card";

const HREF = "/settings?tab=integrations";

function view(overrides: Partial<RecoveryView> = {}): RecoveryView {
  return {
    restingToday: 52,
    recoveryScore: 78,
    spark: [55, 54, 53, 52, 52, 51, 52],
    ...overrides,
  };
}

describe("RecoveryCard", () => {
  it("renders today's resting HR, the recovery score, and a spark when present", () => {
    const { container } = render(<RecoveryCard section={view()} href={HREF} />);

    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText("bpm resting")).toBeInTheDocument();
    // recovery score secondary line
    expect(screen.getByText("recovery")).toBeInTheDocument();
    expect(screen.getByText("78")).toBeInTheDocument();
    // deep-links into the integrations settings tab
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
    // a spark line is drawn (7 points → one polyline)
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("uses a non-accent (--muted) stroke for the resting-HR spark", () => {
    const { container } = render(<RecoveryCard section={view()} href={HREF} />);
    const svg = container.querySelector("svg");
    // Spark inherits currentColor via the text-* class; assert it's --muted,
    // never --accent (app chrome / selection only).
    expect(svg?.getAttribute("class")).toContain("text-[var(--muted)]");
    expect(svg?.getAttribute("class")).not.toContain("--accent");
  });

  it("shows a 'no data yet today' state when resting HR is null but still present", () => {
    render(<RecoveryCard section={view({ restingToday: null })} href={HREF} />);
    expect(screen.getByText("no data yet today")).toBeInTheDocument();
    // headline degrades to an em-dash rather than 0/NaN
    expect(screen.getByText("—")).toBeInTheDocument();
    // the card is still present (title rendered)
    expect(screen.getByText("Recovery")).toBeInTheDocument();
  });

  it("shows a '—' recovery score when the score is null", () => {
    render(<RecoveryCard section={view({ recoveryScore: null })} href={HREF} />);
    expect(screen.getByText("recovery")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
