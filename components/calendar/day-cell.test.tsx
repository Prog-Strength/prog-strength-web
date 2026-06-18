import { render, screen, fireEvent } from "@testing-library/react";
import type { CalendarEvent } from "@/components/calendar/types";
import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import { DayCell } from "./day-cell";

const DAY = new Date(2026, 5, 16);

function workout(id: string, name: string): Workout {
  return { id, name, performed_at: "2026-06-16T08:00:00Z", exercises: [] } as unknown as Workout;
}
function run(id: string, name: string): RunningSession {
  return { id, name, start_time: "2026-06-16T07:00:00Z" } as unknown as RunningSession;
}
function plan(id: string, name: string, overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id,
    name,
    activity_kind: "lift",
    scheduled_start: "2026-06-16T17:00:00Z",
    status: "planned",
    google_sync_status: null,
    ...overrides,
  } as unknown as PlannedWorkout;
}

function noop() {}

function renderCell(
  events: CalendarEvent[],
  overrides: Partial<React.ComponentProps<typeof DayCell>> = {},
) {
  return render(
    <DayCell
      day={DAY}
      inMonth
      isToday={false}
      isSelected={false}
      events={events}
      onSelectDay={noop}
      onNavigateWorkout={noop}
      onNavigateRun={noop}
      onOpenPlanned={noop}
      {...overrides}
    />,
  );
}

describe("DayCell", () => {
  it("renders the date number", () => {
    renderCell([]);
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("renders a done lift chip and navigates on click", () => {
    const onNavigateWorkout = vi.fn();
    renderCell([{ kind: "workout", startMs: 1, workout: workout("w1", "Upper 1") }], {
      onNavigateWorkout,
    });
    fireEvent.click(screen.getByRole("button", { name: "Upper 1" }));
    expect(onNavigateWorkout).toHaveBeenCalledWith("w1");
  });

  it("renders a run chip and navigates on click", () => {
    const onNavigateRun = vi.fn();
    renderCell([{ kind: "run", startMs: 1, run: run("r1", "Morning Run") }], { onNavigateRun });
    fireEvent.click(screen.getByRole("button", { name: "Morning Run" }));
    expect(onNavigateRun).toHaveBeenCalledWith("r1");
  });

  it("opens the planned modal (not navigate) when a planned pill is clicked", () => {
    const onOpenPlanned = vi.fn();
    const p = plan("p1", "Planned Lift");
    renderCell([{ kind: "planned", startMs: 1, planned: p }], { onOpenPlanned });
    fireEvent.click(screen.getByTestId("planned-pill"));
    expect(onOpenPlanned).toHaveBeenCalledWith(p);
  });

  it("renders a planned chip with a dashed outline, distinct from a done chip", () => {
    renderCell([
      { kind: "workout", startMs: 1, workout: workout("w1", "Logged Lift") },
      { kind: "planned", startMs: 2, planned: plan("p1", "Planned Lift") },
    ]);
    const done = screen.getByRole("button", { name: "Logged Lift" });
    const planned = screen.getByTestId("planned-pill");
    expect(planned).toHaveTextContent("Planned Lift");
    expect(planned.className).toMatch(/border-dashed/);
    expect(done.className).not.toMatch(/border-dashed/);
  });

  it("tones run and lift chips with their activity-type tokens (via style)", () => {
    renderCell([
      { kind: "workout", startMs: 1, workout: workout("w1", "Lift") },
      { kind: "run", startMs: 2, run: run("r1", "Run") },
    ]);
    expect(screen.getByRole("button", { name: "Lift" }).style.backgroundColor).toContain(
      "discipline-lift-bg",
    );
    expect(screen.getByRole("button", { name: "Run" }).style.backgroundColor).toContain(
      "discipline-run-bg",
    );
  });

  it("colors a completed planned pill in its activity type, not emerald", () => {
    const p = plan("p1", "Done Lift", { status: "completed" });
    renderCell([{ kind: "planned", startMs: 1, planned: p }]);
    const pill = screen.getByTestId("planned-pill");
    expect(pill.style.color).toContain("discipline-lift-fg");
    expect(pill.style.borderColor).toContain("discipline-lift-dot");
    expect(pill.className).not.toMatch(/emerald/);
    expect(pill.style.color).not.toContain("emerald");
  });

  it("mutes and strikes a skipped planned pill", () => {
    const p = plan("p1", "Missed Lift", { status: "skipped" });
    renderCell([{ kind: "planned", startMs: 1, planned: p }]);
    const pill = screen.getByTestId("planned-pill");
    expect(pill.className).toMatch(/line-through/);
  });

  it("rolls events beyond the visible max into a +N more control", () => {
    const onSelectDay = vi.fn();
    renderCell(
      [
        { kind: "workout", startMs: 1, workout: workout("w1", "A") },
        { kind: "workout", startMs: 2, workout: workout("w2", "B") },
        { kind: "workout", startMs: 3, workout: workout("w3", "C") },
        { kind: "workout", startMs: 4, workout: workout("w4", "D") },
      ],
      { onSelectDay },
    );
    fireEvent.click(screen.getByRole("button", { name: /\+1 more/ }));
    expect(onSelectDay).toHaveBeenCalled();
  });

  it("exposes an accessible date+activity label", () => {
    renderCell([{ kind: "run", startMs: 1, run: run("r1", "Run") }]);
    expect(screen.getByLabelText(/Tuesday, June 16, 2026, 1 run/)).toBeInTheDocument();
  });
});
