/// <reference types="vitest/globals" />
import { render } from "@testing-library/react";
import type { CalendarEvent } from "@/components/calendar/types";
import type { PlannedWorkout } from "@/lib/api";
import { DayCell } from "./day-cell";
import { PlannedBanner } from "./planned-banner";

/**
 * The cohesion guarantee the SOW exists to enforce: the SAME planned event
 * resolves to the SAME activity-type token on the month grid (its pill) and
 * in the daily timeline (its banner rail) — a planned run reads run-toned in
 * both places, a planned lift lift-toned, never violet/emerald. Both sides
 * route through `activityColors`, so this test asserts the shared token shows
 * up on each surface for the same plan.
 */

function makePlanned(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "p-1",
    name: "Long Run",
    activity_kind: "run",
    scheduled_start: "2026-06-16T07:00:00Z",
    scheduled_end: "2026-06-16T08:00:00Z",
    timezone: "America/Denver",
    status: "planned",
    notes: null,
    completed_session_id: null,
    completed_session_kind: null,
    calendar_detail: null,
    google_event_id: null,
    last_sync_error: null,
    google_sync_status: null,
    run_type: "easy",
    run_details: null,
    exercises: [],
    created_at: "2026-06-15T12:00:00Z",
    updated_at: "2026-06-15T12:00:00Z",
    ...overrides,
  };
}

function noop() {}

function renderPill(planned: PlannedWorkout): HTMLElement {
  const { getByTestId } = render(
    <DayCell
      day={new Date(2026, 5, 16)}
      inMonth
      isToday={false}
      isSelected={false}
      events={[{ kind: "planned", startMs: 1, planned } as CalendarEvent]}
      onSelectDay={noop}
      onNavigateWorkout={noop}
      onNavigateActivity={noop}
      onOpenPlanned={noop}
    />,
  );
  return getByTestId("planned-pill");
}

function renderRail(planned: PlannedWorkout): HTMLElement {
  const { container } = render(<PlannedBanner planned={planned} />);
  return container.querySelector('span[aria-hidden="true"]') as HTMLElement;
}

describe("grid pill / timeline banner color parity", () => {
  it("a planned RUN resolves to the run token on both the grid pill and the timeline rail", () => {
    const planned = makePlanned({ activity_kind: "run" });
    expect(renderPill(planned).style.borderColor).toContain("discipline-run-dot");
    expect(renderRail(planned).style.backgroundColor).toContain("discipline-run-dot");
  });

  it("a planned LIFT resolves to the lift token on both the grid pill and the timeline rail", () => {
    const planned = makePlanned({ activity_kind: "lift" });
    expect(renderPill(planned).style.borderColor).toContain("discipline-lift-dot");
    expect(renderRail(planned).style.backgroundColor).toContain("discipline-lift-dot");
  });

  it("neither surface uses the violet accent or a hardcoded emerald for the planned event", () => {
    const planned = makePlanned({ activity_kind: "run" });
    const pill = renderPill(planned);
    const rail = renderRail(planned);
    for (const el of [pill, rail]) {
      expect(el.className).not.toMatch(/emerald|accent/);
    }
    expect(pill.style.borderColor).not.toContain("accent");
    expect(rail.style.backgroundColor).not.toContain("accent");
  });
});
