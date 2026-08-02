/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { DashboardData, RecoveryView, BloodPressureView } from "@/lib/dashboard";
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
    bloodPressure: { present: false },
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

  it("renders the blood-pressure empty CTA when the section is absent", () => {
    render(<TileCard id="blood_pressure" data={fixture()} />);
    expect(screen.getByRole("heading", { name: "Blood Pressure" })).toBeInTheDocument();
    expect(screen.getByText("Log your first reading")).toBeInTheDocument();
  });

  it("renders the live blood-pressure card with reading, category, and dual spark", () => {
    const bloodPressure: BloodPressureView = {
      latest: { systolic: 122, diastolic: 78, measured_at: "2026-07-30T08:15:00Z" },
      category: "elevated",
      avg30: { systolic: 119, diastolic: 76 },
      systolicSpark: [118, 120, 124, 122, 121],
      diastolicSpark: [74, 76, 79, 78, 77],
    };
    const { container } = render(
      <TileCard
        id="blood_pressure"
        data={fixture({ bloodPressure: { present: true, ...bloodPressure } })}
      />,
    );
    // headline reading
    expect(screen.getByText("122/78")).toBeInTheDocument();
    // category label from BP_CATEGORIES
    expect(screen.getByText("Elevated")).toBeInTheDocument();
    // 30-day average
    expect(screen.getByText("119/76")).toBeInTheDocument();
    // dual sparkline → both series drawn (systolic + diastolic)
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("drops the 30-day average when it is null", () => {
    const bloodPressure: BloodPressureView = {
      latest: { systolic: 130, diastolic: 82, measured_at: "2026-07-30T08:15:00Z" },
      category: "stage_1",
      avg30: null,
      systolicSpark: [128, 130],
      diastolicSpark: [80, 82],
    };
    render(
      <TileCard
        id="blood_pressure"
        data={fixture({ bloodPressure: { present: true, ...bloodPressure } })}
      />,
    );
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
    expect(screen.queryByText("30d avg")).not.toBeInTheDocument();
  });
});
