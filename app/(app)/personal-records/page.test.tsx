/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { PersonalRecord, RunningBestEffort, ExerciseOneRMHistory } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The active view is driven by ?view; a mutable holder lets each test pick
// the value before rendering. useSearchParams returns a real URLSearchParams
// so .get("view") behaves like production.
const viewParam = vi.hoisted(() => ({ value: "lifts" }));
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(`view=${viewParam.value}`),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// Spy-able api: keep the real type exports, override the data fns. getMe is
// stubbed to throw so DistanceUnitProvider never reconciles over the network.
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => {
    throw new Error("no /me in test");
  }),
  listPersonalRecords: vi.fn(async () => LIFTS),
  listRunningBestEfforts: vi.fn(async () => RUNS),
  getExerciseOneRMHistory: vi.fn(async () => HISTORY),
}));

import { listPersonalRecords, listRunningBestEfforts, getExerciseOneRMHistory } from "@/lib/api";
import PersonalRecordsPage from "./page";

// --- fixtures --------------------------------------------------------------

const LIFTS: PersonalRecord[] = [
  {
    exercise_id: "barbell-bench-press",
    exercise_name: "Barbell Bench Press",
    workout_id: "wk_1",
    weight: 305,
    reps: 3,
    unit: "lb",
    achieved_at: "2026-04-01T17:30:00Z",
    current_estimated_1rm: 320,
    estimated_1rm_unit: "lb",
    recent_estimated_1rm_points: [305, 312, 320],
  },
  {
    exercise_id: "back-squat",
    exercise_name: "Back Squat",
    workout_id: "wk_2",
    weight: 405,
    reps: 2,
    unit: "lb",
    achieved_at: "2026-03-15T17:30:00Z",
    current_estimated_1rm: 410,
    estimated_1rm_unit: "lb",
    recent_estimated_1rm_points: [405, 408, 410],
  },
];

const RUNS: RunningBestEffort[] = [
  {
    distance_key: "5k",
    distance_label: "5K",
    distance_meters: 5000,
    duration_seconds: 1184.7,
    pace_sec_per_km: 236.9,
    activity_id: "act_5k",
    activity_start_time: "2026-04-18T06:45:00Z",
  },
];

const HISTORY: ExerciseOneRMHistory = {
  exercise_id: "barbell-bench-press",
  exercise_name: "Barbell Bench Press",
  unit: "lb",
  points: [
    { workout_id: "wk_a", performed_at: "2026-01-04T17:30:00Z", estimated_1rm: 305 },
    { workout_id: "wk_b", performed_at: "2026-02-11T17:25:00Z", estimated_1rm: 312 },
    { workout_id: "wk_c", performed_at: "2026-04-01T17:30:00Z", estimated_1rm: 320 },
  ],
};

function renderPage() {
  // Fresh client per render so cache doesn't leak across tests; retry off so
  // a rejected query settles immediately; staleTime Infinity mirrors the
  // page's intent (cached series reused on re-expand, no refetch on remount).
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <DistanceUnitProvider>
        <PersonalRecordsPage />
      </DistanceUnitProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  viewParam.value = "lifts";
  replaceMock.mockClear();
  vi.mocked(listPersonalRecords).mockClear();
  vi.mocked(listRunningBestEfforts).mockClear();
  vi.mocked(getExerciseOneRMHistory).mockClear();
});

describe("PersonalRecordsPage", () => {
  it("renders lift cards on the default view and does not fetch running", async () => {
    renderPage();
    expect(await screen.findByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Back Squat")).toBeInTheDocument();
    expect(listPersonalRecords).toHaveBeenCalledTimes(1);
    expect(listRunningBestEfforts).not.toHaveBeenCalled();
  });

  it("renders running cards on ?view=running and does not fetch lifts", async () => {
    viewParam.value = "running";
    renderPage();
    // All six standard-distance cards render; the 5K is populated.
    expect(await screen.findByText("5K")).toBeInTheDocument();
    expect(screen.getByText("Half Marathon")).toBeInTheDocument();
    expect(screen.getByText(/19:45/)).toBeInTheDocument(); // 1184.7s best time
    expect(listRunningBestEfforts).toHaveBeenCalledTimes(1);
    expect(listPersonalRecords).not.toHaveBeenCalled();
  });

  it("hides Customize on running, shows it on lifts", async () => {
    viewParam.value = "running";
    const { rerender } = renderPage();
    await screen.findByText("5K");
    expect(screen.queryByRole("button", { name: "Customize" })).toBeNull();

    // Flip to lifts and re-render the same tree: Customize reappears.
    viewParam.value = "lifts";
    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <DistanceUnitProvider>
          <PersonalRecordsPage />
        </DistanceUnitProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("button", { name: "Customize" })).toBeInTheDocument();
  });

  it("fires exactly one history query on expand and reuses the cache on re-expand", async () => {
    renderPage();
    await screen.findByText("Barbell Bench Press");
    fireEvent.click(screen.getByRole("button", { name: /Barbell Bench Press/ }));
    await waitFor(() => expect(getExerciseOneRMHistory).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /Barbell Bench Press/ }));
    fireEvent.click(screen.getByRole("button", { name: /Barbell Bench Press/ }));
    await waitFor(() => expect(getExerciseOneRMHistory).toHaveBeenCalledTimes(1));
  });

  it("shows the readiness summary on lifts", async () => {
    renderPage();
    await screen.findByText("Barbell Bench Press");
    expect(screen.getByText(/tested/)).toBeInTheDocument();
  });
});
