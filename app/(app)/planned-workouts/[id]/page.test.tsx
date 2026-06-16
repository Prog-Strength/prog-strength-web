/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import type { PlannedWorkout } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The route param drives which plan the page fetches; a mutable holder lets
// each test pick the id before rendering.
const params = vi.hoisted(() => ({ value: { id: "191ebc9824b002b3f9566c9edabecc53" } }));
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useParams: () => params.value,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getPlannedWorkout: vi.fn(async () => PLAN),
  listExercises: vi.fn(async () => [
    { id: "bench-press", name: "Bench Press", muscle_groups: ["chest"], equipment: ["barbell"] },
  ]),
  getCalendarConnection: vi.fn(async () => ({ status: "disconnected" })),
}));

import { getPlannedWorkout } from "@/lib/api";
import PlannedWorkoutDetailPage from "./page";

// --- fixture ---------------------------------------------------------------

const PLAN: PlannedWorkout = {
  id: "191ebc9824b002b3f9566c9edabecc53",
  name: "Upper 1",
  activity_kind: "lift",
  scheduled_start: "2026-06-20T18:00:00Z",
  scheduled_end: "2026-06-20T19:00:00Z",
  timezone: "America/New_York",
  status: "planned",
  notes: null,
  completed_session_id: null,
  completed_session_kind: null,
  calendar_detail: null,
  google_event_id: "evt-1",
  google_sync_status: "synced",
  last_sync_error: null,
  run_type: null,
  run_details: null,
  exercises: [
    {
      id: "pe-1",
      exercise_id: "bench-press",
      order_index: 0,
      notes: null,
      sets: [
        {
          id: "ps-1",
          order_index: 0,
          target_reps: 5,
          target_weight: 135,
          unit: "lb",
          target_rpe: 8,
        },
      ],
    },
  ],
  created_at: "2026-06-15T00:00:00Z",
  updated_at: "2026-06-15T00:00:00Z",
};

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("PlannedWorkoutDetailPage", () => {
  it("fetches the plan by the route id and renders its detail", async () => {
    render(<PlannedWorkoutDetailPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Upper 1" })).toBeInTheDocument();
    });
    // The agenda renders below the banner (exercise name resolved from the
    // catalog, numbered timeline-style) — proves the deep-link landing
    // actually shows the plan.
    expect(screen.getByText(/Bench Press/)).toBeInTheDocument();
    expect(getPlannedWorkout).toHaveBeenCalledWith(
      "test-token",
      "191ebc9824b002b3f9566c9edabecc53",
    );
  });

  it("surfaces a not-found error instead of silently blanking", async () => {
    (getPlannedWorkout as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("planned workout not found"),
    );
    render(<PlannedWorkoutDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("planned workout not found")).toBeInTheDocument();
    });
  });
});
