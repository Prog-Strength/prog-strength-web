/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());

const listWorkoutsMock = vi.hoisted(() => vi.fn());
const listRunningSessionsMock = vi.hoisted(() => vi.fn());
const listStepsMock = vi.hoisted(() => vi.fn());
const getStepsGoalMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  listWorkouts: listWorkoutsMock,
  listRunningSessions: listRunningSessionsMock,
  listSteps: listStepsMock,
  getStepsGoal: getStepsGoalMock,
}));

// The combined chart owns its own recharts plumbing; stub it so this
// test focuses on the digest tiles.
vi.mock("@/components/activities/activities-combined-chart", () => ({
  ActivitiesCombinedChart: () => <div data-testid="combined-chart" />,
}));

import { ActivitiesOverviewView } from "./activities-overview-view";

function step(date: string, steps: number) {
  return { id: date, date, steps, created_at: date, updated_at: date };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTokenMock.mockReturnValue("tok");
  listWorkoutsMock.mockResolvedValue({ items: [] });
  listRunningSessionsMock.mockResolvedValue({ activities: [] });
  getStepsGoalMock.mockResolvedValue({
    goal: 10000,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  });
});

describe("ActivitiesOverviewView — steps tiles", () => {
  it("renders the steps tiles when step history exists", async () => {
    listStepsMock.mockResolvedValue({
      steps: [step("2026-06-10", 8000), step("2026-06-11", 12000)],
      next_before: null,
    });
    render(<ActivitiesOverviewView days={30} displayUnit="lb" distanceUnit="mi" />);
    await waitFor(() => expect(screen.getByText("Avg daily steps")).toBeInTheDocument());
    // avg 10,000 vs goal 10,000 → 100%
    expect(screen.getByText("Steps goal")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("omits the steps tiles when there is no step history", async () => {
    listStepsMock.mockResolvedValue({ steps: [], next_before: null });
    render(<ActivitiesOverviewView days={30} displayUnit="lb" distanceUnit="mi" />);
    // Wait for load to resolve (combined chart appears once loading clears).
    await waitFor(() => expect(screen.getByTestId("combined-chart")).toBeInTheDocument());
    expect(screen.queryByText("Avg daily steps")).not.toBeInTheDocument();
    expect(screen.queryByText("Steps goal")).not.toBeInTheDocument();
  });
});
