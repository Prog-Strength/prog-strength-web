/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { Exercise, PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import { CompletedPlannedBanner } from "./completed-planned-banner";

function makePlanned(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "p-1",
    name: "W7 D1 - Easy Run",
    activity_kind: "run",
    scheduled_start: "2026-06-20T12:00:00Z",
    scheduled_end: "2026-06-20T13:00:00Z",
    timezone: "America/Denver",
    status: "completed",
    notes: null,
    completed_session_id: "act1",
    completed_session_kind: "activity",
    calendar_detail: null,
    google_event_id: null,
    last_sync_error: null,
    google_sync_status: null,
    run_type: "easy",
    run_details: null,
    exercises: [],
    created_at: "2026-06-19T12:00:00Z",
    updated_at: "2026-06-19T12:00:00Z",
    ...overrides,
  };
}
function makeRun(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "run-1",
    name: "Tempo Run",
    start_time: "2026-06-20T12:00:00Z",
    distance_meters: 8046.72,
    duration_seconds: 2520,
    avg_pace_sec_per_km: 313,
    ...overrides,
  } as unknown as RunningSession;
}
function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w-1",
    name: "Upper 1",
    performed_at: "2026-06-20T17:00:00Z",
    exercises: [],
    ...overrides,
  } as unknown as Workout;
}

function renderBanner(
  logged: { kind: "workout"; workout: Workout } | { kind: "run"; run: RunningSession },
  planned = makePlanned(),
) {
  return render(
    <DistanceUnitProvider>
      <CompletedPlannedBanner
        planned={planned}
        logged={logged}
        exerciseMap={new Map<string, Exercise>()}
        onNavigate={() => {}}
      />
    </DistanceUnitProvider>,
  );
}

describe("CompletedPlannedBanner", () => {
  it("colors the rail with the logged run's type color, not emerald", () => {
    const { container } = renderBanner({ kind: "run", run: makeRun() });
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("discipline-run-dot");
    expect(rail.style.backgroundColor).not.toContain("emerald");
    expect(rail.className).not.toMatch(/emerald/);
  });

  it("colors the rail with the logged workout's lift color when a plan was fulfilled by a lift", () => {
    const { container } = renderBanner({ kind: "workout", workout: makeWorkout() });
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("discipline-lift-dot");
  });

  it("uses no emerald anywhere (completion is the check + badge, not green)", () => {
    const { container } = renderBanner({ kind: "run", run: makeRun() });
    expect(container.innerHTML).not.toMatch(/emerald/);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});
