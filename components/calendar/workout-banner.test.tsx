/// <reference types="vitest/globals" />
import { fireEvent, render, screen } from "@testing-library/react";
import type { Exercise, Workout } from "@/lib/api";
import { WorkoutBanner } from "./workout-banner";

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "wk-1",
    user_id: "user-1",
    name: "Upper 1",
    performed_at: "2026-06-09T13:30:00Z",
    exercises: [
      {
        exercise_id: "bench-press",
        order: 0,
        sets: [{ reps: 5, weight: 100, unit: "lb" }],
      },
    ],
    created_at: "2026-06-09T14:00:00Z",
    updated_at: "2026-06-09T14:00:00Z",
    personal_records_set: [],
    ...overrides,
  };
}

function makeExerciseMap(): Map<string, Exercise> {
  return new Map<string, Exercise>([
    ["bench-press", { id: "bench-press", name: "Bench Press", muscle_groups: [], equipment: [] }],
  ]);
}

describe("WorkoutBanner", () => {
  it("calls onNavigate on body click without opening the dropdown", () => {
    const onNavigate = vi.fn();
    render(
      <WorkoutBanner
        workout={makeWorkout()}
        exerciseMap={makeExerciseMap()}
        onNavigate={onNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Upper 1/ }));

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /Expand details/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(/Total volume/i)).not.toBeInTheDocument();
  });

  it("toggles the digest dropdown when the chevron is clicked", () => {
    const onNavigate = vi.fn();
    render(
      <WorkoutBanner
        workout={makeWorkout()}
        exerciseMap={makeExerciseMap()}
        onNavigate={onNavigate}
      />,
    );

    const chevron = screen.getByRole("button", { name: /Expand details/i });
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Total volume/i)).not.toBeInTheDocument();

    fireEvent.click(chevron);
    expect(onNavigate).not.toHaveBeenCalled();
    const expanded = screen.getByRole("button", { name: /Collapse details/i });
    expect(expanded).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Total volume/i)).toBeInTheDocument();

    fireEvent.click(expanded);
    expect(screen.getByRole("button", { name: /Expand details/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByText(/Total volume/i)).not.toBeInTheDocument();
  });
});
