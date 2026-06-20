/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { PersonalRecord, ExerciseOneRMHistory, RunningMaxEffortDetail } from "@/lib/api";

vi.mock("recharts", async (orig) => {
  const mod = await orig<typeof import("recharts")>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 240 }}>{children}</div>
    ),
  };
});
vi.mock("@/lib/auth", () => ({ getToken: () => "t", clearToken: vi.fn() }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => {
    throw new Error("no /me");
  }),
  getExerciseOneRMHistory: vi.fn(async () => HISTORY),
  getRunningMaxEffort: vi.fn(async () => RUN_DETAIL),
}));

import { PRDetail } from "./PRDetail";

const HISTORY: ExerciseOneRMHistory = {
  exercise_id: "Bench",
  exercise_name: "Bench",
  unit: "lb",
  points: [
    { workout_id: "a", performed_at: "2026-01-04T00:00:00Z", estimated_1rm: 305 },
    { workout_id: "b", performed_at: "2026-03-01T00:00:00Z", estimated_1rm: 330 },
  ],
};
const RUN_DETAIL: RunningMaxEffortDetail = {
  estimator_version: "v1",
  distance_key: "5k",
  distance_label: "5K",
  distance_meters: 5000,
  estimate: {
    seconds: 1170,
    lower_seconds: 1150,
    upper_seconds: 1200,
    basis: "fit",
    confidence: "high",
    n_points: 5,
    n_distances: 3,
  },
  actual_best: { seconds: 1184, activity_id: "a", achieved_at: "2026-04-18T00:00:00Z" },
  estimate_history: [
    { as_of: "2026-02-01T00:00:00Z", seconds: 1200, lower_seconds: 1180, upper_seconds: 1230 },
    { as_of: "2026-04-01T00:00:00Z", seconds: 1170, lower_seconds: 1150, upper_seconds: 1200 },
  ],
  attempts: [
    {
      activity_id: "a",
      achieved_at: "2026-04-18T00:00:00Z",
      duration_seconds: 1184,
      pace_sec_per_km: 236,
      source: "race_like",
    },
  ],
  stats: {
    estimated_max_effort_seconds: 1170,
    current_best_seconds: 1184,
    gap_seconds: -14,
    confidence: "high",
    data_summary: "5 efforts",
  },
};

const due: PersonalRecord = {
  exercise_id: "Bench",
  exercise_name: "Bench",
  workout_id: "wk",
  weight: 300,
  reps: 3,
  unit: "lb",
  achieved_at: "2026-03-01T00:00:00Z",
  current_estimated_1rm: 330,
  estimated_1rm_unit: "lb",
  recent_estimated_1rm_points: null,
};
const untested: PersonalRecord = {
  ...due,
  exercise_id: "Deadlift",
  exercise_name: "Deadlift",
  workout_id: null,
  weight: null,
  current_estimated_1rm: null,
};

const wrap = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DistanceUnitProvider>{ui}</DistanceUnitProvider>
    </QueryClientProvider>,
  );
};

describe("PRDetail lift", () => {
  it("shows the est-1RM figure and the +N over PR cue when due", async () => {
    wrap(<PRDetail view="lifts" liftRecord={due} distanceKey={null} distanceLabel={null} />);
    expect(await screen.findByText(/330/)).toBeInTheDocument();
    expect(screen.getByText(/over PR — go for a max/)).toBeInTheDocument();
  });
  it("shows the empty state for an untested lift", () => {
    wrap(<PRDetail view="lifts" liftRecord={untested} distanceKey={null} distanceLabel={null} />);
    expect(screen.getByText(/Log a heavy set/)).toBeInTheDocument();
  });
});

describe("PRDetail run", () => {
  it("shows the estimate, attempt chips, and in-reach cue for a projected distance", async () => {
    wrap(<PRDetail view="running" liftRecord={null} distanceKey="5k" distanceLabel="5K" />);
    expect(await screen.findByText(/Race-like/)).toBeInTheDocument(); // attempt chip
    expect(screen.getByText(/in reach/)).toBeInTheDocument(); // 1170 < 1184
  });
  it("shows the insufficient state when there is no estimate", async () => {
    vi.mocked((await import("@/lib/api")).getRunningMaxEffort).mockResolvedValueOnce({
      ...RUN_DETAIL,
      estimate: null,
    });
    wrap(
      <PRDetail view="running" liftRecord={null} distanceKey="marathon" distanceLabel="Marathon" />,
    );
    expect(await screen.findByText(/Not enough data yet/)).toBeInTheDocument();
  });
});
