/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { RunningSession } from "@/lib/api";
import { RunDigest } from "./run-digest";

function makeRun(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "run-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Morning Run",
    start_time: "2026-06-09T06:42:00Z",
    distance_meters: 8046.72,
    raw_distance_meters: 8046.72,
    environment: "outdoor",
    duration_seconds: 2520,
    avg_pace_sec_per_km: 313,
    best_pace_sec_per_km: 290,
    avg_heart_rate_bpm: 152,
    max_heart_rate_bpm: 171,
    total_calories: 480,
    elevation_gain_meters: 64,
    created_at: "2026-06-09T07:30:00Z",
    ...overrides,
  };
}

function renderDigest(run: RunningSession) {
  return render(
    <DistanceUnitProvider>
      <RunDigest run={run} />
    </DistanceUnitProvider>,
  );
}

describe("RunDigest", () => {
  it("renders distance and duration values for a complete run", () => {
    renderDigest(makeRun());
    // Default unit is "mi": 8046.72 m → 5.0 mi.
    expect(screen.getByText("Distance")).toBeInTheDocument();
    expect(screen.getByText("5.0 mi")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("42:00")).toBeInTheDocument();
  });

  it("omits Avg HR and Elevation rows when those fields are null", () => {
    renderDigest(makeRun({ avg_heart_rate_bpm: null, elevation_gain_meters: null }));
    expect(screen.queryByText("Avg HR")).not.toBeInTheDocument();
    expect(screen.queryByText("Elevation gain")).not.toBeInTheDocument();
  });

  it("links to the full run detail page", () => {
    renderDigest(makeRun({ id: "abc-123" }));
    const link = screen.getByRole("link", { name: /view full run details/i });
    expect(link).toHaveAttribute("href", "/running/abc-123");
  });
});
