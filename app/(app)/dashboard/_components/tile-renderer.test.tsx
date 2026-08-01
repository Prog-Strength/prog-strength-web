/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { DashboardData, RecoveryView } from "@/lib/dashboard";
import { TileCard } from "./tile-renderer";

function fixture(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    layout: [],
    running: { present: false },
    walking: { present: false },
    cycling: { present: false },
    hiking: { present: false },
    lifting: { present: false },
    steps: { present: false },
    nutrition: { present: false },
    bodyweight: { present: false },
    recovery: { present: false },
    streak: { weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true },
    ...overrides,
  };
}

describe("TileCard", () => {
  it("renders the running card for id 'running'", () => {
    render(<TileCard id="running" data={fixture()} />);
    expect(screen.getByRole("heading", { name: "Running" })).toBeInTheDocument();
    // Empty section → its inviting CTA.
    expect(screen.getByText("Import a run to start tracking")).toBeInTheDocument();
  });

  it("renders the streak card for id 'streak'", () => {
    render(<TileCard id="streak" data={fixture()} />);
    expect(screen.getByRole("heading", { name: "Streak" })).toBeInTheDocument();
  });

  it("renders the Connect Whoop CTA when recovery is enabled but not present", () => {
    render(<TileCard id="recovery" data={fixture({ recovery: { present: false } })} />);
    expect(screen.getByRole("heading", { name: "Recovery" })).toBeInTheDocument();
    expect(screen.getByText("Connect Whoop to see recovery")).toBeInTheDocument();
  });

  it("renders the live recovery card when present", () => {
    const recovery: RecoveryView = {
      restingToday: 52,
      recoveryScore: 74,
      spark: [50, 51, 52, 53, 52],
    };
    render(<TileCard id="recovery" data={fixture({ recovery: { present: true, ...recovery } })} />);
    expect(screen.getByText("52")).toBeInTheDocument();
    expect(screen.getByText("bpm resting")).toBeInTheDocument();
  });
});
