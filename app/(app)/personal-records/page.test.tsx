/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type {
  PersonalRecord,
  RunningBestEffort,
  ExerciseOneRMHistory,
  RunningMaxEffortDetail,
} from "@/lib/api";

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

// recharts' ResponsiveContainer measures its parent via ResizeObserver, which
// jsdom doesn't lay out — stub it to a fixed box so the detail chart mounts.
vi.mock("recharts", async (orig) => {
  const mod = await orig<typeof import("recharts")>();
  return {
    ...mod,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 240 }}>{children}</div>
    ),
  };
});

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
  getRunningMaxEffort: vi.fn(async () => RUN_DETAIL),
}));

import {
  listPersonalRecords,
  listRunningBestEfforts,
  getExerciseOneRMHistory,
  getRunningMaxEffort,
} from "@/lib/api";
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

const RUN_DETAIL: RunningMaxEffortDetail = {
  estimator_version: "v1",
  distance_key: "5k",
  distance_label: "5K",
  distance_meters: 5000,
  estimate: {
    seconds: 1170,
    lower_seconds: 1150,
    upper_seconds: 1190,
    basis: "fitted",
    confidence: "medium",
    n_points: 4,
    n_distances: 3,
  },
  actual_best: {
    seconds: 1184.7,
    activity_id: "act_5k",
    achieved_at: "2026-04-18T06:45:00Z",
  },
  estimate_history: [
    { as_of: "2026-02-01T00:00:00Z", seconds: 1200, lower_seconds: 1180, upper_seconds: 1220 },
    { as_of: "2026-04-01T00:00:00Z", seconds: 1170, lower_seconds: 1150, upper_seconds: 1190 },
  ],
  attempts: [
    {
      activity_id: "act_5k",
      achieved_at: "2026-04-18T06:45:00Z",
      duration_seconds: 1184.7,
      pace_sec_per_km: 236.9,
      source: "race_like",
    },
  ],
  stats: {
    estimated_max_effort_seconds: 1170,
    current_best_seconds: 1184.7,
    gap_seconds: 14.7,
    confidence: "medium",
    data_summary: "ok",
  },
};

function renderPage() {
  // Fresh client per render so cache doesn't leak across tests; retry off so
  // a rejected query settles immediately; staleTime Infinity mirrors the
  // page's intent (cached series reused on re-expand, no refetch on remount).
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  // A fresh element each call (React bails out on a referentially-identical
  // element), but always the SAME QueryClient + same component identity, so
  // component state (per-tab selection) survives a viewParam flip.
  const tree = () => (
    <QueryClientProvider client={client}>
      <DistanceUnitProvider>
        <PersonalRecordsPage />
      </DistanceUnitProvider>
    </QueryClientProvider>
  );
  const utils = render(tree());
  return { ...utils, rerenderSame: () => utils.rerender(tree()) };
}

// The ledger list and the detail pane can both render the same label (e.g.
// the auto-selected lift's name, or the running distance label). Scope row
// assertions to the ledger's labelled <ul> to disambiguate.
async function findLedger() {
  return within(await screen.findByRole("list", { name: "Personal records" }));
}

// Sync variant for use inside waitFor, where the labelled <ul> may not exist
// yet (lazy query still pending). queryByRole returns null instead of throwing.
function findLedgerSync() {
  const ul = screen.queryByRole("list", { name: "Personal records" });
  return { queryByText: (t: string) => (ul ? within(ul).queryByText(t) : null) };
}

beforeEach(() => {
  viewParam.value = "lifts";
  replaceMock.mockClear();
  vi.mocked(listPersonalRecords).mockClear();
  vi.mocked(listRunningBestEfforts).mockClear();
  vi.mocked(getExerciseOneRMHistory).mockClear();
  vi.mocked(getRunningMaxEffort).mockClear();
});

describe("PersonalRecordsPage", () => {
  it("renders the lift ledger on the default view and does not fetch running", async () => {
    renderPage();
    const ledger = await findLedger();
    expect(await ledger.findByText("Barbell Bench Press")).toBeInTheDocument();
    expect(ledger.getByText("Back Squat")).toBeInTheDocument();
    expect(listPersonalRecords).toHaveBeenCalledTimes(1);
    expect(listRunningBestEfforts).not.toHaveBeenCalled();
  });

  it("auto-selects the most-due lift and fires its detail query once", async () => {
    renderPage();
    const ledger = await findLedger();
    await ledger.findByText("Barbell Bench Press");
    // Bench gap 15 > Squat gap 5 → Bench is most-due and is auto-selected,
    // firing its detail history query.
    await waitFor(() =>
      expect(getExerciseOneRMHistory).toHaveBeenCalledWith(
        expect.anything(),
        "barbell-bench-press",
      ),
    );
  });

  it("renders the running ledger on ?view=running and does not fetch lifts", async () => {
    viewParam.value = "running";
    renderPage();
    // All six standard-distance rows render in the ledger; the 5K is populated.
    const ledger = await findLedger();
    await waitFor(() => expect(ledger.getByText("Half Marathon")).toBeInTheDocument());
    expect(ledger.getByText("5K")).toBeInTheDocument();
    expect(ledger.getByText("19:45")).toBeInTheDocument(); // 1184.7s best time
    expect(listRunningBestEfforts).toHaveBeenCalledTimes(1);
    expect(listPersonalRecords).not.toHaveBeenCalled();
  });

  it("hides Customize on running, shows it on lifts", async () => {
    viewParam.value = "running";
    const { rerenderSame } = renderPage();
    await screen.findByText("5K");
    expect(screen.queryByRole("button", { name: "Customize" })).toBeNull();

    // Flip to lifts and re-render the same tree: Customize reappears.
    viewParam.value = "lifts";
    rerenderSame();
    expect(await screen.findByRole("button", { name: "Customize" })).toBeInTheDocument();
  });

  it("shows the readiness summary on lifts", async () => {
    renderPage();
    const ledger = await findLedger();
    await ledger.findByText("Barbell Bench Press");
    expect(screen.getByText(/tested/)).toBeInTheDocument();
  });

  it("preserves each tab's selection across a tab switch", async () => {
    const { rerenderSame } = renderPage();
    const ledger = await findLedger();
    await ledger.findByText("Back Squat");

    // Pick Back Squat explicitly (overrides the most-due default of Bench).
    fireEvent.click(ledger.getByRole("button", { name: /Back Squat/ }));
    await waitFor(() =>
      expect(getExerciseOneRMHistory).toHaveBeenCalledWith(expect.anything(), "back-squat"),
    );

    // Switch to running and back to lifts on the SAME tree (state survives).
    viewParam.value = "running";
    rerenderSame();
    await waitFor(() => expect(findLedgerSync().queryByText("Half Marathon")).not.toBeNull());

    viewParam.value = "lifts";
    rerenderSame();

    const liftLedger = await findLedger();
    const squatRow = await liftLedger.findByRole("button", { name: /Back Squat/ });
    expect(squatRow).toHaveAttribute("aria-current", "true");
  });
});
