/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { DashboardData, BloodPressureView } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";
import { TileCard } from "./tile-renderer";
import { suppressedView } from "./recovery/fixtures";
import { ordinaryWeek } from "./running/fixtures";

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
    expect(screen.getByRole("heading", { name: "Training Load" })).toBeInTheDocument();
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

  const FAMILY: [TileId, string][] = [
    ["recovery", "Recovery"],
    ["hrv_balance", "HRV Balance"],
    ["morning_vitals", "Morning Vitals"],
    ["recovery_trend", "Recovery Trend"],
    ["recovery_log", "Recovery Log"],
  ];

  it.each(FAMILY)("renders the %s card from the shared recovery section", (id, title) => {
    render(
      <TileCard id={id} data={fixture({ recovery: { present: true, ...suppressedView() } })} />,
    );
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Connect Whoop to see recovery")).not.toBeInTheDocument();
  });

  it.each(FAMILY)("renders the titled connect CTA for %s when recovery is absent", (id, title) => {
    render(<TileCard id={id} data={fixture({ recovery: { present: false } })} />);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("Connect Whoop to see recovery")).toBeInTheDocument();
  });

  const RUNNING_FAMILY: [TileId, string][] = [
    ["running", "Training Load"],
    ["running_log", "Runs This Week"],
    ["running_effort", "Run Effort"],
    ["running_vertical", "Vertical Gain"],
  ];

  it.each(RUNNING_FAMILY)("renders the %s card from the shared running section", (id, title) => {
    render(
      <TileCard id={id} data={fixture({ running: { present: true, ...ordinaryWeek("mi") } })} />,
    );
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Import a run to start tracking")).not.toBeInTheDocument();
  });

  it.each(RUNNING_FAMILY)(
    "renders the titled empty CTA for %s when running is absent",
    (id, title) => {
      render(<TileCard id={id} data={fixture()} />);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText("Import a run to start tracking")).toBeInTheDocument();
    },
  );

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
