/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MuscleGroupProgression, WorkoutsPage } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The active filter is driven by ?pattern & ?days; a mutable holder lets each
// test pick the values before rendering. useSearchParams returns a real
// URLSearchParams so .get() behaves like production.
const params = vi.hoisted(() => ({ value: "pattern=all&days=90" }));
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(params.value),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// Recharts is stubbed: jsdom has no layout, and these tests assert on the
// stat tiles / empty state, not the SVG.
vi.mock("recharts", () => {
  const Stub = () => <div />;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Line: Stub,
    CartesianGrid: Stub,
    XAxis: Stub,
    YAxis: Stub,
    Tooltip: Stub,
    ReferenceLine: Stub,
  };
});

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  listProgression: vi.fn(async () => PROGRESSION),
  listWorkouts: vi.fn(async () => WORKOUTS),
}));

import { listProgression, listWorkouts } from "@/lib/api";
import ProgressPage from "./page";

// --- fixtures --------------------------------------------------------------

const PROGRESSION: MuscleGroupProgression = {
  filter: { movement_pattern: "all", muscle_groups_included: ["chest", "back"] },
  since: "2026-03-12T00:00:00Z",
  until: "2026-06-10T00:00:00Z",
  baseline_model: "recency_weighted_current",
  exercise_baselines: [
    { exercise_id: "bench", exercise_name: "Barbell Bench Press", baseline: 245, unit: "lb" },
  ],
  points: [
    {
      workout_id: "wk_1",
      exercise_id: "bench",
      exercise_name: "Barbell Bench Press",
      performed_at: "2026-04-12T17:30:00Z",
      normalized_max: 0.93,
      avg_estimated_1rm: 220,
      max_estimated_1rm: 227,
      min_estimated_1rm: 215,
      set_count: 5,
      unit: "lb",
    },
  ],
  per_exercise_trends: [
    { exercise_id: "bench", session_count: 8, slope_per_month: 2.1, trendline: null },
  ],
  aggregate: {
    lifts_tracked: 5,
    lifts_progressing: 3,
    median_slope_per_month: 1.4,
    min_sessions_threshold: 3,
  },
};

const EMPTY_PROGRESSION: MuscleGroupProgression = {
  filter: { movement_pattern: "push", muscle_groups_included: ["chest", "shoulders", "triceps"] },
  since: "2026-03-12T00:00:00Z",
  until: "2026-06-10T00:00:00Z",
  baseline_model: "recency_weighted_current",
  exercise_baselines: [],
  points: [],
  per_exercise_trends: [],
  aggregate: null,
};

const WORKOUTS: WorkoutsPage = {
  items: [],
  next_before: null,
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProgressPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  params.value = "pattern=all&days=90";
  replaceMock.mockClear();
  vi.mocked(listProgression).mockClear();
  vi.mocked(listProgression).mockResolvedValue(PROGRESSION);
  vi.mocked(listWorkouts).mockClear();
  vi.mocked(listWorkouts).mockResolvedValue(WORKOUTS);
});

describe("ProgressPage", () => {
  it("default load fetches movement_pattern=all and renders the aggregate stat tiles", async () => {
    renderPage();
    expect(await screen.findByText("3 / 5")).toBeInTheDocument();
    expect(screen.getByText("+1.4%/mo")).toBeInTheDocument();

    expect(listProgression).toHaveBeenCalledTimes(1);
    const call = vi.mocked(listProgression).mock.calls[0];
    // listProgression(token, { movementPattern }, sinceISO, untilISO)
    expect(call[1]).toEqual({ movementPattern: "all" });
    expect(listWorkouts).toHaveBeenCalledTimes(1);
  });

  it("renders the empty-state hint with movement-pattern copy when no points", async () => {
    params.value = "pattern=push&days=90";
    vi.mocked(listProgression).mockResolvedValue(EMPTY_PROGRESSION);
    renderPage();
    expect(await screen.findByText("No push sessions in this window")).toBeInTheDocument();
  });

  it("flipping to 60d refires both queries with the new window", async () => {
    // First render at 90d.
    const { rerender } = renderPage();
    await screen.findByText("3 / 5");
    expect(listProgression).toHaveBeenCalledTimes(1);
    const firstUntil = vi.mocked(listProgression).mock.calls[0][3];

    // Simulate the URL flipping to 60d (router.replace would do this in
    // production; here we move the param and re-render the same client).
    params.value = "pattern=all&days=60";
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <ProgressPage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      // The 60d window keys a fresh query (and a fresh workouts query).
      expect(vi.mocked(listProgression).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
    const lastCall = vi.mocked(listProgression).mock.calls.at(-1)!;
    expect(lastCall[1]).toEqual({ movementPattern: "all" });
    // since for a 60d window is later (closer to now) than for 90d.
    const newSince = new Date(lastCall[2]!).getTime();
    const oldSince = new Date(vi.mocked(listProgression).mock.calls[0][2]!).getTime();
    expect(newSince).toBeGreaterThan(oldSince);
    expect(firstUntil).toBeTruthy();

    await waitFor(() => {
      expect(vi.mocked(listWorkouts).mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });
});
