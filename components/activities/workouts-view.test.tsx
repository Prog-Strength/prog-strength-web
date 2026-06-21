/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { Workout } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());

const listWorkoutsMock = vi.hoisted(() => vi.fn());
const listExercisesMock = vi.hoisted(() => vi.fn());
const deleteWorkoutMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  listWorkouts: listWorkoutsMock,
  listExercises: listExercisesMock,
  deleteWorkout: deleteWorkoutMock,
}));

vi.mock("@/components/workout-modal", () => ({
  WorkoutModal: () => <div data-testid="workout-modal" />,
}));

// The view imports hasMeaningfulName from this module, so the mock
// must provide a working implementation.
vi.mock("@/components/workout-details", () => ({
  hasMeaningfulName: (name?: string) => !!name && name.trim().length > 0,
}));

vi.mock("@/components/workouts-analytics", () => ({
  WorkoutsAnalytics: () => <div data-testid="workouts-analytics" />,
}));

vi.mock("@/lib/workout-volume", () => ({
  workoutVolume: () => 1000,
}));

import { WorkoutsView } from "./workouts-view";

// --- helpers ---------------------------------------------------------------

function workoutFixture(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w1",
    user_id: "u1",
    name: "Push day",
    performed_at: "2026-06-10T10:00:00Z",
    ended_at: "2026-06-10T11:00:00Z",
    notes: undefined,
    exercises: [],
    created_at: "2026-06-10T10:00:00Z",
    updated_at: "2026-06-10T11:00:00Z",
    personal_records_set: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTokenMock.mockReturnValue("tok");
  listExercisesMock.mockResolvedValue([]);
});

describe("WorkoutsView — PR trophy badge", () => {
  it("renders the trophy badge when the workout set a personal record", async () => {
    listWorkoutsMock.mockResolvedValue({
      items: [
        workoutFixture({
          personal_records_set: ["x"] as unknown as Workout["personal_records_set"],
        }),
      ],
    });
    render(<WorkoutsView days={30} displayUnit="lb" />);

    const badge = await screen.findByTitle("This workout set a new personal record");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("aria-label", "This workout set a new personal record");
  });
});

describe("WorkoutsView — row navigation", () => {
  it("links each row to its workout detail page", async () => {
    listWorkoutsMock.mockResolvedValue({
      items: [workoutFixture({ id: "828782f8", name: "Leg day" })],
    });
    render(<WorkoutsView days={30} displayUnit="lb" />);

    const link = await screen.findByRole("link", { name: /Leg day/ });
    expect(link).toHaveAttribute("href", "/workouts/828782f8");
  });
});

describe("WorkoutsView — long-note truncation", () => {
  it("clips a long note with the truncate class", async () => {
    const longNote =
      "This is an extremely long note that should be clipped by the truncate class because it would otherwise overflow the row width and disrupt the calm layout of the activities page.";
    listWorkoutsMock.mockResolvedValue({ items: [workoutFixture({ notes: longNote })] });
    render(<WorkoutsView days={30} displayUnit="lb" />);

    const noteEl = await screen.findByText(longNote);
    expect(noteEl.className).toContain("truncate");
  });
});
