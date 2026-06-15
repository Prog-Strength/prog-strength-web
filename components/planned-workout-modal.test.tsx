/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Exercise, PlannedWorkout } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  createPlannedWorkout: createMock,
  updatePlannedWorkout: updateMock,
}));

import { PlannedWorkoutModal } from "./planned-workout-modal";

// --- fixtures --------------------------------------------------------------

const CATALOG: Exercise[] = [
  { id: "back-squat", name: "Back Squat", muscle_groups: ["quads"], equipment: ["barbell"] },
  { id: "bench-press", name: "Bench Press", muscle_groups: ["chest"], equipment: ["barbell"] },
];

function plannedFixture(): PlannedWorkout {
  return {
    id: "p-1",
    name: "Created Plan",
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
    exercises: [],
    created_at: "2026-06-19T12:00:00Z",
    updated_at: "2026-06-19T12:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue(plannedFixture());
  updateMock.mockResolvedValue(plannedFixture());
});

describe("PlannedWorkoutModal", () => {
  it("submits a new plan with name, times, agenda, and calendar_sync when checked", async () => {
    const onSaved = vi.fn();
    render(
      <PlannedWorkoutModal
        plan={null}
        catalog={CATALOG}
        calendarConnected
        defaultDate={new Date(2026, 5, 20)}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("e.g. Upper 1"), {
      target: { value: "Leg Day" },
    });
    fireEvent.change(screen.getByLabelText("Starts at"), {
      target: { value: "2026-06-20T18:00" },
    });
    fireEvent.change(screen.getByLabelText("Ends at"), {
      target: { value: "2026-06-20T19:30" },
    });

    // Tick the Google sync checkbox (visible because calendarConnected).
    fireEvent.click(screen.getByLabelText("Sync to Google Calendar"));

    // Add an exercise with a target set.
    fireEvent.click(screen.getByRole("button", { name: "+ Add exercise" }));
    fireEvent.change(screen.getByLabelText("Exercise"), { target: { value: "bench-press" } });
    fireEvent.change(screen.getByLabelText("Target reps"), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText("Target weight"), { target: { value: "60" } });

    fireEvent.click(screen.getByRole("button", { name: "Plan workout" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const [, body] = createMock.mock.calls[0];
    expect(body.name).toBe("Leg Day");
    expect(body.calendar_sync).toBe(true);
    expect(typeof body.scheduled_start).toBe("string");
    expect(typeof body.scheduled_end).toBe("string");
    expect(body.exercises).toHaveLength(1);
    expect(body.exercises[0].exercise_id).toBe("bench-press");
    expect(body.exercises[0].sets[0]).toEqual(
      expect.objectContaining({ target_reps: 8, target_weight: 60, unit: "lb" }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("hides the Google sync checkbox when the calendar is not connected", () => {
    render(
      <PlannedWorkoutModal
        plan={null}
        catalog={CATALOG}
        calendarConnected={false}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(screen.queryByLabelText("Sync to Google Calendar")).not.toBeInTheDocument();
  });

  it("edits an existing plan via updatePlannedWorkout", async () => {
    const onSaved = vi.fn();
    render(
      <PlannedWorkoutModal
        plan={plannedFixture()}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );
    // The name field is seeded from the plan.
    expect(screen.getByPlaceholderText("e.g. Upper 1")).toHaveValue("Created Plan");
    fireEvent.change(screen.getByPlaceholderText("e.g. Upper 1"), {
      target: { value: "Renamed Plan" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(1));
    const [, id, body] = updateMock.mock.calls[0];
    expect(id).toBe("p-1");
    expect(body.name).toBe("Renamed Plan");
    expect(onSaved).toHaveBeenCalled();
  });
});
