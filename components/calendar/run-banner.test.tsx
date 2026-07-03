/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { RunningSession } from "@/lib/api";
import { RunBanner } from "./run-banner";

function makeRun(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "run-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Tempo Run",
    start_time: "2026-06-09T12:00:00Z",
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
    created_at: "2026-06-09T13:00:00Z",
    ...overrides,
  };
}

function renderBanner(run: RunningSession, onNavigate: () => void) {
  return render(
    <DistanceUnitProvider>
      <RunBanner run={run} onNavigate={onNavigate} />
    </DistanceUnitProvider>,
  );
}

describe("RunBanner", () => {
  it("calls onNavigate on body click without opening the dropdown", () => {
    const onNavigate = vi.fn();
    renderBanner(makeRun(), onNavigate);

    fireEvent.click(screen.getByRole("button", { name: /Tempo Run/ }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Expand details/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: /view full run details/i })).not.toBeInTheDocument();
  });

  it("toggles the digest dropdown when the chevron is clicked", () => {
    const onNavigate = vi.fn();
    renderBanner(makeRun(), onNavigate);

    const chevron = screen.getByRole("button", { name: /Expand details/i });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /view full run details/i })).not.toBeInTheDocument();

    fireEvent.click(chevron);
    expect(onNavigate).not.toHaveBeenCalled();
    const expanded = screen.getByRole("button", { name: /Collapse details/i });
    expect(expanded).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /view full run details/i })).toBeInTheDocument();

    fireEvent.click(expanded);
    expect(screen.getByRole("button", { name: /Expand details/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("link", { name: /view full run details/i })).not.toBeInTheDocument();
  });
});
