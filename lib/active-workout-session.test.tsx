/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import type { Workout } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const createWorkoutMock = vi.hoisted(() => vi.fn());
const listWorkoutsMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  createWorkout: createWorkoutMock,
  listWorkouts: listWorkoutsMock,
}));

// The provider reads the weight unit from useProfile(); stub it so this
// test doesn't depend on the real ProfileProvider / GET /me.
vi.mock("@/lib/profile-context", () => ({
  useProfile: () => ({ profile: { weight_unit: "lb" } }),
}));

import { ActiveWorkoutSessionProvider, useActiveWorkoutSession } from "./active-workout-session";

const STORAGE_KEY = "ps_active_workout_session";

// --- helpers ---------------------------------------------------------------

function workout(over: Partial<Workout> = {}): Workout {
  return {
    id: "w1",
    performed_at: "2026-06-14T10:00:00.000Z",
    exercises: [],
    personal_records_set: [],
    ...over,
  } as Workout;
}

// Consumer surfacing the session for assertions, with buttons that drive
// the action surface.
function Harness() {
  const s = useActiveWorkoutSession();
  return (
    <div>
      <span data-testid="has-session">{String(s.session !== null)}</span>
      <span data-testid="ex-count">{s.session?.exercises.length ?? -1}</span>
      <button onClick={() => s.start()}>start</button>
      <button onClick={() => s.addExercise("bench-press")}>add-ex</button>
      <button onClick={() => s.discard()}>discard</button>
      <button
        onClick={() => {
          // Swallow rejection here so a failed save in the test doesn't
          // surface as an unhandled rejection; assertions check state.
          s.save("2026-06-14T11:00:00.000Z").catch(() => {});
        }}
      >
        save
      </button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ActiveWorkoutSessionProvider>
      <Harness />
    </ActiveWorkoutSessionProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  listWorkoutsMock.mockResolvedValue({
    items: [],
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false,
  });
});

describe("ActiveWorkoutSessionProvider", () => {
  it("starts with no session and writes nothing to localStorage", () => {
    renderHarness();
    expect(screen.getByTestId("has-session")).toHaveTextContent("false");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("persists the session to localStorage on start and on mutation", async () => {
    renderHarness();

    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(screen.getByTestId("has-session")).toHaveTextContent("true"));

    const afterStart = window.localStorage.getItem(STORAGE_KEY);
    expect(afterStart).not.toBeNull();
    expect(JSON.parse(afterStart as string).exercises).toEqual([]);

    fireEvent.click(screen.getByText("add-ex"));
    await waitFor(() => expect(screen.getByTestId("ex-count")).toHaveTextContent("1"));

    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) as string);
    expect(stored.exercises).toHaveLength(1);
    expect(stored.exercises[0].exercise_id).toBe("bench-press");
    // First set seeded with the profile-unit default.
    expect(stored.exercises[0].sets).toEqual([{ reps: 0, weight: 0, unit: "lb" }]);
  });

  it("hydrates a fresh provider from localStorage", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: "Prior session",
        performed_at: "2026-06-14T09:00:00.000Z",
        exercises: [{ exercise_id: "squat", superset_group: null, sets: [] }],
        restTimer: null,
        restDefaultSec: 90,
      }),
    );

    renderHarness();
    expect(screen.getByTestId("has-session")).toHaveTextContent("true");
    expect(screen.getByTestId("ex-count")).toHaveTextContent("1");
  });

  it("removes the storage key on discard", async () => {
    renderHarness();
    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull());

    fireEvent.click(screen.getByText("discard"));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull());
    expect(screen.getByTestId("has-session")).toHaveTextContent("false");
  });

  it("saves via createWorkout, clears the draft, and removes the key on success", async () => {
    createWorkoutMock.mockResolvedValue(workout());
    renderHarness();

    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(screen.getByTestId("has-session")).toHaveTextContent("true"));
    fireEvent.click(screen.getByText("add-ex"));
    await waitFor(() => expect(screen.getByTestId("ex-count")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByText("save"));
    });

    await waitFor(() => expect(screen.getByTestId("has-session")).toHaveTextContent("false"));
    expect(createWorkoutMock).toHaveBeenCalledTimes(1);
    expect(createWorkoutMock.mock.calls[0][0]).toBe("test-token");
    const payload = createWorkoutMock.mock.calls[0][1];
    expect(payload.ended_at).toBe("2026-06-14T11:00:00.000Z");
    expect(payload.exercises).toHaveLength(1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("preserves the draft when save() fails", async () => {
    createWorkoutMock.mockRejectedValue(new Error("HTTP 500"));
    renderHarness();

    fireEvent.click(screen.getByText("start"));
    await waitFor(() => expect(screen.getByTestId("has-session")).toHaveTextContent("true"));
    fireEvent.click(screen.getByText("add-ex"));
    await waitFor(() => expect(screen.getByTestId("ex-count")).toHaveTextContent("1"));

    await act(async () => {
      fireEvent.click(screen.getByText("save"));
    });

    // Draft is still present; storage key intact.
    expect(screen.getByTestId("has-session")).toHaveTextContent("true");
    expect(window.localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it("throws when used outside the provider", () => {
    function Bare() {
      useActiveWorkoutSession();
      return null;
    }
    // Silence the expected React error boundary logging.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/ActiveWorkoutSessionProvider/);
    spy.mockRestore();
  });
});
