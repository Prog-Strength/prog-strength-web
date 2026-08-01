/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { WalkingView } from "@/lib/dashboard";
import { WalkingCard } from "./walking-card";

const HREF = "/activities?view=walking";

function view(overrides: Partial<WalkingView> = {}): WalkingView {
  return {
    currentWeek: { distance: "12.5", sessionCount: 4 },
    durationSeconds: 3 * 3600 + 12 * 60,
    latest: {
      name: "Morning stroll",
      distance: "3.1",
      durationSeconds: 45 * 60,
      startTime: "2026-07-30T08:00:00Z",
    },
    spark: { points: [2, 3, 2.5, 4, 3.1], unit: "mi" },
    unit: "mi",
    ...overrides,
  };
}

describe("WalkingCard", () => {
  it("renders this week's distance headline, meta, and a spark when present", () => {
    const { container } = render(
      <WalkingCard section={{ present: true, ...view() }} href={HREF} />,
    );

    expect(screen.getByText("Walking")).toBeInTheDocument();
    expect(screen.getByText("12.5")).toBeInTheDocument();
    expect(screen.getByText("mi this week")).toBeInTheDocument();
    // meta labels/values
    expect(screen.getByText("walks")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("3:12:00")).toBeInTheDocument();
    expect(screen.getByText("last")).toBeInTheDocument();
    expect(screen.getByText("3.1 mi")).toBeInTheDocument();
    // deep-links into the walking view
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
    // a spark line is drawn
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("uses a non-accent (--muted) stroke for the walking spark", () => {
    const { container } = render(
      <WalkingCard section={{ present: true, ...view() }} href={HREF} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("text-[var(--muted)]");
    expect(svg?.getAttribute("class")).not.toContain("--accent");
  });

  it("shows the empty CTA when the section is absent", () => {
    const { container } = render(<WalkingCard section={{ present: false }} href={HREF} />);
    expect(screen.getByText("Log a walk to start tracking")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });
});
