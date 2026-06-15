/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import type { Exercise, PlannedWorkout } from "@/lib/api";
import { PlannedBanner } from "./planned-banner";

function makePlanned(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "p-1",
    name: null,
    activity_kind: "lift",
    scheduled_start: "2026-06-20T18:00:00Z",
    scheduled_end: "2026-06-20T19:00:00Z",
    timezone: "America/Denver",
    status: "planned",
    notes: null,
    completed_session_id: null,
    completed_session_kind: null,
    calendar_detail: null,
    google_event_id: null,
    google_sync_status: null,
    last_sync_error: null,
    run_type: null,
    run_details: null,
    exercises: [],
    ...overrides,
    created_at: "2026-06-19T12:00:00Z",
    updated_at: "2026-06-19T12:00:00Z",
  };
}

const EMPTY_MAP = new Map<string, Exercise>();

describe("PlannedBanner — run", () => {
  it("labels an unnamed run with the kind and run type, and expands to details", () => {
    render(
      <PlannedBanner
        planned={makePlanned({
          activity_kind: "run",
          run_type: "intervals",
          run_details: "4x800m @ 5k pace, 90s jog recovery",
        })}
        exerciseMap={EMPTY_MAP}
      />,
    );

    // Unnamed run leads with "Run · <time>".
    expect(screen.getByText(/Run · /)).toBeInTheDocument();
    // The stats line surfaces the run type.
    expect(screen.getByText(/Interval run/)).toBeInTheDocument();

    // Expanding reveals the free-text details.
    fireEvent.click(screen.getByRole("button", { name: /Expand details/i }));
    expect(screen.getByText("4x800m @ 5k pace, 90s jog recovery")).toBeInTheDocument();
  });

  it("is not expandable when a run has no details", () => {
    render(
      <PlannedBanner
        planned={makePlanned({ activity_kind: "run", run_type: "easy", run_details: null })}
        exerciseMap={EMPTY_MAP}
      />,
    );
    expect(screen.getByText(/Easy run/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Expand details/i })).not.toBeInTheDocument();
  });
});
