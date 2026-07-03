/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Exercise, PlannedWorkout } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const createMock = vi.hoisted(() => vi.fn());
const updateMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  createPlannedWorkout: createMock,
  updatePlannedWorkout: updateMock,
  deletePlannedWorkout: deleteMock,
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
    run_type: null,
    run_details: null,
    exercises: [],
    created_at: "2026-06-19T12:00:00Z",
    updated_at: "2026-06-19T12:00:00Z",
  };
}

function plannedWithAgenda(): PlannedWorkout {
  return {
    ...plannedFixture(),
    name: "Leg Day",
    exercises: [
      {
        id: "pe-1",
        exercise_id: "back-squat",
        order_index: 0,
        notes: null,
        superset_group: null,
        sets: [0, 1, 2].map((i) => ({
          id: `s${i}`,
          order_index: i,
          target_reps: 5,
          target_weight: 225,
          unit: "lb" as const,
          target_rpe: null,
          amrap: false,
        })),
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  createMock.mockResolvedValue(plannedFixture());
  updateMock.mockResolvedValue(plannedFixture());
  deleteMock.mockResolvedValue(undefined);
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
    // The schedule defaults (date/start/duration from the picker) are fine; the
    // payload derives scheduled_start/end from them — asserted below.

    // Google sync is on by default when a calendar is connected — syncing is
    // the intended behavior, so the checkbox starts checked (no click).
    expect(screen.getByLabelText("Sync to Google Calendar")).toBeChecked();

    // Add an exercise and pick it via the searchable picker, then a target set.
    fireEvent.click(screen.getByRole("button", { name: /Add exercise/i }));
    const picker = screen.getByLabelText("Exercise");
    fireEvent.focus(picker);
    fireEvent.change(picker, { target: { value: "Bench" } });
    fireEvent.click(screen.getByRole("button", { name: /Bench Press/i }));
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

  it("submits a run plan with run_type + run_details and no exercises", async () => {
    const onSaved = vi.fn();
    render(
      <PlannedWorkoutModal
        plan={null}
        catalog={CATALOG}
        calendarConnected={false}
        defaultDate={new Date(2026, 5, 20)}
        onClose={() => {}}
        onSaved={onSaved}
      />,
    );

    // Switch to a run; the exercise agenda is replaced by the run form.
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.queryByRole("button", { name: "+ Add exercise" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Threshold" }));
    fireEvent.change(screen.getByPlaceholderText(/4x800m/), {
      target: { value: "20 min @ tempo pace" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Plan workout" }));

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const [, body] = createMock.mock.calls[0];
    expect(body.activity_kind).toBe("run");
    expect(body.run_type).toBe("threshold");
    expect(body.run_details).toBe("20 min @ tempo pace");
    expect(body.exercises).toBeUndefined();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("lets a run be a bare time block (no details required)", async () => {
    render(
      <PlannedWorkoutModal
        plan={null}
        catalog={CATALOG}
        calendarConnected={false}
        defaultDate={new Date(2026, 5, 20)}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    // Save is enabled with just the seeded time window — no details entered.
    const save = screen.getByRole("button", { name: "Plan workout" });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);
    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const [, body] = createMock.mock.calls[0];
    expect(body.activity_kind).toBe("run");
    expect(body.run_type).toBe("easy");
    expect(body.run_details).toBe("");
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

  it("opens an existing plan read-only and formats the lift agenda", () => {
    render(
      <PlannedWorkoutModal
        plan={plannedWithAgenda()}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    // Read-only: no form inputs, the plan name is the title, the type and
    // schedule show, and the agenda reads like a logged workout.
    expect(screen.getByRole("heading", { name: "Leg Day" })).toBeInTheDocument();
    expect(screen.getByText("Lift")).toBeInTheDocument();
    // Numbered like the timeline ("1. Back Squat").
    expect(screen.getByText(/Back Squat/)).toBeInTheDocument();
    expect(screen.getByText("5 reps × 3 sets @ 225 lbs")).toBeInTheDocument();
    // The edit form's name input is not present until the pencil is clicked.
    expect(screen.queryByPlaceholderText("e.g. Upper 1")).not.toBeInTheDocument();
  });

  it("offers Start workout on a lift plan and hands the plan to the parent", () => {
    const onStartWorkout = vi.fn();
    render(
      <PlannedWorkoutModal
        plan={plannedWithAgenda()}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onStartWorkout={onStartWorkout}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start workout" }));
    expect(onStartWorkout).toHaveBeenCalledWith(expect.objectContaining({ id: "p-1" }));
  });

  it("edits an existing plan via the pencil, then updatePlannedWorkout", async () => {
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
    // Read-only first; the pencil switches to the edit form.
    fireEvent.click(screen.getByRole("button", { name: "Edit planned workout" }));
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

  it("marks a set AMRAP — sends amrap with no reps, and stays saveable", async () => {
    render(
      <PlannedWorkoutModal
        plan={null}
        catalog={CATALOG}
        calendarConnected={false}
        defaultDate={new Date(2026, 5, 20)}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add exercise/i }));
    // Toggle the set to AMRAP — reps are no longer required.
    fireEvent.click(screen.getByRole("button", { name: "Toggle AMRAP" }));
    const save = screen.getByRole("button", { name: "Plan workout" });
    expect(save).not.toBeDisabled();
    fireEvent.click(save);

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1));
    const [, body] = createMock.mock.calls[0];
    expect(body.exercises[0].sets[0].amrap).toBe(true);
    expect(body.exercises[0].sets[0].target_reps).toBeUndefined();
  });

  it("deletes a planned workout after inline confirmation and notifies the parent", async () => {
    const onDeleted = vi.fn();
    render(
      <PlannedWorkoutModal
        plan={plannedFixture()}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={onDeleted}
      />,
    );

    // The footer Delete opens the inline confirm panel — nothing is deleted yet.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(deleteMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Delete this planned activity\?/)).toBeInTheDocument();
    // This plan was never synced (google_event_id null) — no calendar warning.
    expect(screen.queryByText(/Google Calendar/)).not.toBeInTheDocument();

    // Confirming performs the delete and hands control back to the parent.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("test-token", "p-1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("lets the confirm panel be cancelled without deleting", () => {
    render(
      <PlannedWorkoutModal
        plan={plannedFixture()}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText(/Delete this planned activity\?/)).not.toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
    // Back to the normal view footer (the Delete entry point is back).
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("warns that the Google Calendar event is removed when the plan is synced", () => {
    render(
      <PlannedWorkoutModal
        plan={{ ...plannedFixture(), google_event_id: "evt-1", google_sync_status: "synced" }}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Google Calendar event/)).toBeInTheDocument();
  });

  it("hides Delete on completed and skipped plans", () => {
    const { unmount } = render(
      <PlannedWorkoutModal
        plan={{ ...plannedFixture(), status: "completed" }}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    unmount();
    render(
      <PlannedWorkoutModal
        plan={{ ...plannedFixture(), status: "skipped" }}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("surfaces a delete failure and keeps the modal open", async () => {
    deleteMock.mockRejectedValue(new Error("nope"));
    const onDeleted = vi.fn();
    render(
      <PlannedWorkoutModal
        plan={plannedFixture()}
        catalog={CATALOG}
        calendarConnected
        onClose={() => {}}
        onSaved={() => {}}
        onDeleted={onDeleted}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("nope")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    // Still on the confirm panel — the user can retry or cancel.
    expect(screen.getByText(/Delete this planned activity\?/)).toBeInTheDocument();
  });

  it("requires reps on every set (weight stays optional)", () => {
    render(
      <PlannedWorkoutModal
        plan={null}
        catalog={CATALOG}
        calendarConnected={false}
        defaultDate={new Date(2026, 5, 20)}
        onClose={() => {}}
        onSaved={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Add exercise/i }));
    // The seeded set has reps "5" → saveable. Clearing reps disables save;
    // an empty weight does not.
    const save = screen.getByRole("button", { name: "Plan workout" });
    expect(save).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Target reps"), { target: { value: "" } });
    expect(save).toBeDisabled();
  });
});
