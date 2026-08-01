/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { HikingView } from "@/lib/dashboard";
import { HikingCard } from "./hiking-card";

const HREF = "/activities?view=hiking";

function view(overrides: Partial<HikingView> = {}): HikingView {
  return {
    currentWeek: { distance: "9.2", sessionCount: 2 },
    durationSeconds: 4 * 3600 + 30 * 60,
    latest: {
      name: "Ridge trail",
      distance: "6.0",
      durationSeconds: 3 * 3600,
      startTime: "2026-07-28T07:00:00Z",
    },
    spark: { points: [3, 5, 4, 6], unit: "mi" },
    unit: "mi",
    elevationGainMeters: 400,
    ...overrides,
  };
}

describe("HikingCard", () => {
  it("renders headline, elevation, meta, and a spark when present", () => {
    const { container } = render(<HikingCard section={{ present: true, ...view() }} href={HREF} />);

    expect(screen.getByText("Hiking")).toBeInTheDocument();
    expect(screen.getByText("9.2")).toBeInTheDocument();
    expect(screen.getByText("mi this week")).toBeInTheDocument();
    // meta labels/values
    expect(screen.getByText("hikes")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("elevation")).toBeInTheDocument();
    // 400 m → feet under "mi": round(400 * 3.28084) = 1,312 ft
    expect(screen.getByText("1,312 ft")).toBeInTheDocument();
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("4:30:00")).toBeInTheDocument();
    expect(screen.getByText("last")).toBeInTheDocument();
    expect(screen.getByText("6.0 mi")).toBeInTheDocument();
    // deep-links into the hiking view
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
    expect(container.querySelector("polyline")).not.toBeNull();
  });

  it("renders elevation in meters under the km unit", () => {
    render(
      <HikingCard
        section={{ present: true, ...view({ unit: "km", elevationGainMeters: 376 }) }}
        href={HREF}
      />,
    );
    expect(screen.getByText("376 m")).toBeInTheDocument();
  });

  it("uses the hike discipline dot stroke for the hiking spark", () => {
    const { container } = render(<HikingCard section={{ present: true, ...view() }} href={HREF} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("text-[var(--discipline-hike-dot)]");
    expect(svg?.getAttribute("class")).not.toContain("--accent");
  });

  it("shows the empty CTA when the section is absent", () => {
    const { container } = render(<HikingCard section={{ present: false }} href={HREF} />);
    expect(screen.getByText("Log a hike to start tracking")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });
});
