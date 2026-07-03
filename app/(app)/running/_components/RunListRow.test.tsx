/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { RunningSession } from "@/lib/api";
import { RunListRow } from "./RunListRow";

// The row only needs the unit formatters; mock the context so render is
// provider-free (mirrors the running feature's other component tests).
vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({
    formatDistance: (m: number) => (m / 1609.344).toFixed(1),
    formatPace: (s: number | null) => (s == null ? "—" : String(s)),
    unitLabel: "mi",
  }),
}));

function makeRun(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "run-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Morning Run",
    start_time: "2026-06-18T13:00:00Z",
    distance_meters: 5000,
    raw_distance_meters: 5000,
    environment: "outdoor",
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 240,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 178,
    total_calories: 420,
    elevation_gain_meters: 30,
    created_at: "2026-06-18T13:30:00Z",
    ...overrides,
  };
}

describe("RunListRow — treadmill glyph", () => {
  it("shows the treadmill glyph for an indoor running row", () => {
    render(
      <ul>
        <RunListRow session={makeRun({ environment: "indoor" })} />
      </ul>,
    );
    expect(screen.getByLabelText("Treadmill")).toBeInTheDocument();
  });

  it("does not show the glyph for an outdoor run", () => {
    render(
      <ul>
        <RunListRow session={makeRun({ environment: "outdoor" })} />
      </ul>,
    );
    expect(screen.queryByLabelText("Treadmill")).not.toBeInTheDocument();
  });
});
