/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { CyclingView } from "@/lib/dashboard";
import { CyclingCard } from "./cycling-card";

const HREF = "/activities?view=cycling";

function view(overrides: Partial<CyclingView> = {}): CyclingView {
  return {
    currentWeek: { distance: "48.0", sessionCount: 3 },
    durationSeconds: 2 * 3600 + 5 * 60,
    latest: {
      name: "River loop",
      distance: "22.4",
      durationSeconds: 70 * 60,
      startTime: "2026-07-29T17:00:00Z",
    },
    spark: { points: [10, 20, 15, 22.4], unit: "mi" },
    unit: "mi",
    ...overrides,
  };
}

describe("CyclingCard", () => {
  it("renders this week's distance headline, meta, and a spark when present", () => {
    const { container } = render(
      <CyclingCard section={{ present: true, ...view() }} href={HREF} />,
    );

    expect(screen.getByText("Cycling")).toBeInTheDocument();
    expect(screen.getByText("48.0")).toBeInTheDocument();
    expect(screen.getByText("mi this week")).toBeInTheDocument();
    // meta labels/values — cycling uses "rides"
    expect(screen.getByText("rides")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("2:05:00")).toBeInTheDocument();
    expect(screen.getByText("last")).toBeInTheDocument();
    expect(screen.getByText("22.4 mi")).toBeInTheDocument();
    // deep-links into the cycling view
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("uses a non-accent (--muted) stroke for the cycling spark", () => {
    const { container } = render(
      <CyclingCard section={{ present: true, ...view() }} href={HREF} />,
    );
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("text-[var(--muted)]");
    expect(svg?.getAttribute("class")).not.toContain("--accent");
  });

  it("shows the empty CTA when the section is absent", () => {
    const { container } = render(<CyclingCard section={{ present: false }} href={HREF} />);
    expect(screen.getByText("Log a ride to start tracking")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });
});
