/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import type { PlannedWorkout } from "@/lib/api";
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
    last_sync_error: null,
    google_sync_status: null,
    run_type: null,
    run_details: null,
    exercises: [],
    ...overrides,
    created_at: "2026-06-19T12:00:00Z",
    updated_at: "2026-06-19T12:00:00Z",
  };
}

describe("PlannedBanner", () => {
  it("labels an unnamed run with the kind and run type", () => {
    render(
      <PlannedBanner planned={makePlanned({ activity_kind: "run", run_type: "intervals" })} />,
    );
    // Unnamed run leads with "Run · <time>".
    expect(screen.getByText(/Run · /)).toBeInTheDocument();
    // The stats line surfaces the run type.
    expect(screen.getByText(/Interval run/)).toBeInTheDocument();
  });

  it("opens the modal when the row is clicked (the detail surface lives there)", () => {
    const onOpen = vi.fn();
    render(<PlannedBanner planned={makePlanned({ name: "Upper 1" })} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /Open planned workout/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("does not render an inline agenda/expand control (that moved to the modal)", () => {
    render(
      <PlannedBanner
        planned={makePlanned({
          activity_kind: "run",
          run_type: "intervals",
          run_details: "4x800m @ 5k pace",
        })}
      />,
    );
    expect(screen.queryByRole("button", { name: /Expand details/i })).not.toBeInTheDocument();
    expect(screen.queryByText("4x800m @ 5k pace")).not.toBeInTheDocument();
  });
});

describe("PlannedBanner — completed (cross-day fallback)", () => {
  const COMPLETED = makePlanned({
    name: "Easy Run",
    activity_kind: "run",
    status: "completed",
    completed_session_id: "act1",
    completed_session_kind: "activity",
    run_type: "easy",
  });

  it("links to the logged session and shows Unlink when wired", () => {
    const onUnlink = vi.fn();
    const onNavigateSession = vi.fn();
    render(
      <PlannedBanner
        planned={COMPLETED}
        onUnlink={onUnlink}
        onNavigateSession={onNavigateSession}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /View logged run/i }));
    expect(onNavigateSession).toHaveBeenCalledWith("activity", "act1");
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    expect(onUnlink).toHaveBeenCalled();
  });

  it("hides Unlink when onUnlink absent", () => {
    render(<PlannedBanner planned={COMPLETED} />);
    expect(screen.queryByRole("button", { name: "Unlink" })).not.toBeInTheDocument();
  });
});

describe("PlannedBanner — activity-type color (not status)", () => {
  it("colors a planned run's rail with the run token, not the violet accent", () => {
    const { container } = render(<PlannedBanner planned={makePlanned({ activity_kind: "run" })} />);
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("discipline-run-dot");
    expect(rail.style.backgroundColor).not.toContain("accent");
  });

  it("colors a planned lift's rail with the lift token", () => {
    const { container } = render(
      <PlannedBanner planned={makePlanned({ activity_kind: "lift" })} />,
    );
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("discipline-lift-dot");
  });

  it("keeps a completed plan's rail in its activity type, not emerald", () => {
    const { container } = render(
      <PlannedBanner planned={makePlanned({ activity_kind: "lift", status: "completed" })} />,
    );
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("discipline-lift-dot");
    expect(rail.style.backgroundColor).not.toContain("emerald");
    expect(rail.className).not.toMatch(/emerald/);
  });

  it("mutes a skipped plan's rail", () => {
    const { container } = render(
      <PlannedBanner planned={makePlanned({ activity_kind: "run", status: "skipped" })} />,
    );
    const rail = container.querySelector('span[aria-hidden="true"]') as HTMLElement;
    expect(rail.style.backgroundColor).toContain("muted");
  });
});
