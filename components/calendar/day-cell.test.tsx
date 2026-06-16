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
function plan(id: string, name: string): PlannedWorkout {
  return {
    id,
    name,
    activity_kind: "lift",
    scheduled_start: "2026-06-16T17:00:00Z",
    status: "planned",
    google_sync_status: null,
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
      onSelectWorkout={noop}
      onSelectRun={noop}
      onSelectPlanned={noop}
      {...overrides}
    />,
  );
}

describe("DayCell", () => {
  it("renders the date number", () => {
    renderCell([]);
    expect(screen.getByText("16")).toBeInTheDocument();
  });

  it("renders a done lift chip and fires onSelectWorkout", () => {
    const onSelectWorkout = vi.fn();
    renderCell([{ kind: "workout", startMs: 1, workout: workout("w1", "Upper 1") }], {
      onSelectWorkout,
    });
    fireEvent.click(screen.getByRole("button", { name: "Upper 1" }));
    expect(onSelectWorkout).toHaveBeenCalledWith("w1");
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

  it("tones run and lift chips differently", () => {
    renderCell([
      { kind: "workout", startMs: 1, workout: workout("w1", "Lift") },
      { kind: "run", startMs: 2, run: run("r1", "Run") },
    ]);
    expect(screen.getByRole("button", { name: "Lift" }).className).toMatch(/discipline-lift/);
    expect(screen.getByRole("button", { name: "Run" }).className).toMatch(/discipline-run/);
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
