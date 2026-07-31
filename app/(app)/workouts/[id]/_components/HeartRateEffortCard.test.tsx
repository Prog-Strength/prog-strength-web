/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { HeartRateZones, WorkoutEnrichment } from "@/lib/api";

// The card embeds WorkoutHeartRateChart, which is Recharts-backed and renders
// nothing useful in jsdom. Stub the chart itself — these tests are about the
// card's composition (tiles + zones), not the plot.
vi.mock("./WorkoutHeartRateChart", () => ({
  WorkoutHeartRateChart: () => <div data-testid="hr-chart" />,
}));

import { HeartRateEffortCard } from "./HeartRateEffortCard";

const ZONES: HeartRateZones = {
  model: "percent_max_hr",
  max_hr_reference_bpm: 191,
  reference_source: "p99_recent_runs",
  reference_confidence: "calibrated",
  calibrating: false,
  total_hr_seconds: 3600,
  zones: [
    {
      zone: 1,
      name: "Recovery",
      lower_pct: 0,
      upper_pct: 0.6,
      min_bpm: 0,
      max_bpm: 114,
      time_seconds: 1800,
      time_pct: 0.5,
    },
    {
      zone: 2,
      name: "Aerobic",
      lower_pct: 0.6,
      upper_pct: 0.7,
      min_bpm: 115,
      max_bpm: 133,
      time_seconds: 1800,
      time_pct: 0.5,
    },
  ],
};

function enrichment(overrides: Partial<WorkoutEnrichment> = {}): WorkoutEnrichment {
  return {
    source_activity_id: "garmin-123",
    start_time: "2026-07-01T10:00:00Z",
    duration_seconds: 3600,
    avg_heart_rate_bpm: 120,
    max_heart_rate_bpm: 160,
    total_calories: 400,
    trackpoints: [{ sequence: 0, elapsed_seconds: 0, heart_rate_bpm: 120 }],
    ...overrides,
  };
}

describe("HeartRateEffortCard", () => {
  it("renders the effort tiles and the HR chart", () => {
    render(<HeartRateEffortCard enrichment={enrichment()} />);

    expect(screen.getByText("Avg HR")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText("Max HR")).toBeInTheDocument();
    expect(screen.getByText("160")).toBeInTheDocument();
    expect(screen.getByText("Calories")).toBeInTheDocument();
    expect(screen.getByTestId("hr-chart")).toBeInTheDocument();
  });

  // The point of issue #131 on the strength side: a lift with HR gets the same
  // time-in-zone breakdown a run does, nested in this card.
  it("renders the zone breakdown when the enrichment carries heart_rate_zones", () => {
    render(<HeartRateEffortCard enrichment={enrichment({ heart_rate_zones: ZONES })} />);

    expect(screen.getByText("Time in zones")).toBeInTheDocument();
    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("Aerobic")).toBeInTheDocument();
    expect(screen.getAllByText("30:00")).toHaveLength(2);
    expect(screen.getAllByText("50%")).toHaveLength(2);
    // The nested widget must not restate the outer card's own heading.
    expect(screen.queryByText("Heart rate zones")).not.toBeInTheDocument();
  });

  it("omits the zone section entirely when the workout has no zones", () => {
    render(<HeartRateEffortCard enrichment={enrichment()} />);

    expect(screen.queryByText("Time in zones")).not.toBeInTheDocument();
    expect(screen.queryByText("Recovery")).not.toBeInTheDocument();
  });

  it("omits the zone section when the zones array is empty", () => {
    render(
      <HeartRateEffortCard
        enrichment={enrichment({ heart_rate_zones: { ...ZONES, zones: [] } })}
      />,
    );

    expect(screen.queryByText("Time in zones")).not.toBeInTheDocument();
  });
});
