/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import type { Activity, RunningSession, StepsEntry } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());

const listActivitiesMock = vi.hoisted(() => vi.fn());
const listStepsMock = vi.hoisted(() => vi.fn());
const getStepsGoalMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

// The view partitions ONE unified page and adapts strength items through
// the real activityToWorkout, so the adapter stays under test here.
vi.mock("@/lib/api", async (importOriginal) => ({
  activityToWorkout: (await importOriginal<typeof import("@/lib/api")>()).activityToWorkout,
  listActivities: listActivitiesMock,
  listSteps: listStepsMock,
  getStepsGoal: getStepsGoalMock,
}));

// The combined chart owns its own recharts plumbing; stub it so this test
// focuses on the KPI row + instrument frames.
vi.mock("@/components/activities/activities-combined-chart", () => ({
  ActivitiesCombinedChart: () => <div data-testid="combined-chart" />,
}));

import { ActivitiesOverviewView } from "./activities-overview-view";

// --- builders (dates relative to a real "today", since the view uses
//     new Date() for the window) ---------------------------------------------

let seq = 0;
const id = () => `id-${seq++}`;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// One unified strength activity as GET /activities returns it — the view
// adapts it to the legacy Workout shape (performed_at/ended_at from
// start_time + duration) before deriving stats.
function lift(daysBack: number, minutes: number): Activity {
  const start = daysAgo(daysBack);
  start.setHours(8, 0, 0, 0);
  return {
    id: id(),
    activity_type: "strength_training",
    ingest_source: "manual",
    source_activity_id: "",
    name: null,
    start_time: start.toISOString(),
    distance_meters: 0,
    raw_distance_meters: 0,
    environment: "outdoor",
    duration_seconds: minutes * 60,
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: null,
    max_heart_rate_bpm: null,
    total_calories: null,
    elevation_gain_meters: null,
    created_at: start.toISOString(),
    details: { exercises: [], personal_records_set: [] },
  };
}

function run(daysBack: number, opts: Partial<RunningSession>): RunningSession {
  const start = daysAgo(daysBack);
  start.setHours(7, 0, 0, 0);
  return {
    id: id(),
    activity_type: "running",
    ingest_source: "garmin_api",
    source_activity_id: id(),
    name: null,
    start_time: start.toISOString(),
    distance_meters: 5000,
    raw_distance_meters: 5000,
    environment: "outdoor",
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 290,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 170,
    total_calories: null,
    elevation_gain_meters: 100,
    created_at: start.toISOString(),
    ...opts,
  };
}

function step(daysBack: number, steps: number): StepsEntry {
  const date = ymd(daysAgo(daysBack));
  return { id: id(), date, steps, created_at: date, updated_at: date };
}

function setup({
  lifts = [],
  sessions = [],
  steps = [],
}: {
  lifts?: Activity[];
  sessions?: RunningSession[];
  steps?: StepsEntry[];
}) {
  // One unified page carries every type; the view partitions it.
  listActivitiesMock.mockResolvedValue({
    activities: [...lifts, ...sessions],
    next_before: null,
  });
  listStepsMock.mockResolvedValue({ steps, next_before: null });
  getStepsGoalMock.mockResolvedValue({
    goal: 10000,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  getTokenMock.mockReturnValue("tok");
});

// --- representative fixture ------------------------------------------------

describe("ActivitiesOverviewView — instrument panel", () => {
  it("shows the KPI row and every instrument for a mixed window", async () => {
    setup({
      lifts: [lift(2, 60), lift(5, 45)],
      sessions: [run(1, {}), run(3, { avg_pace_sec_per_km: 320 })],
      steps: [step(0, 9000), step(1, 8500), step(2, 9500)],
    });
    render(<ActivitiesOverviewView days={30} distanceUnit="mi" />);

    await waitFor(() => expect(screen.getByText("Total time")).toBeInTheDocument());

    // KPI row — the decided content: avg pace + days active present.
    expect(screen.getByText("Avg run pace")).toBeInTheDocument();
    expect(screen.getByText("Days active")).toBeInTheDocument();
    expect(screen.getByText(/\d+ \/ 30/)).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();

    // Instruments all framed and present.
    expect(screen.getByText("Weekly activity")).toBeInTheDocument();
    expect(screen.getByText("Time split")).toBeInTheDocument();
    expect(screen.getByText("Avg pace")).toBeInTheDocument();
    expect(screen.getByText("Mileage")).toBeInTheDocument();
    expect(screen.getByText("Effort")).toBeInTheDocument();
    expect(screen.getByText("Daily steps")).toBeInTheDocument();

    // The dropped metrics are gone.
    expect(screen.queryByText("Total volume")).not.toBeInTheDocument();
    expect(screen.queryByText("PRs")).not.toBeInTheDocument();
    expect(screen.queryByText("Steps goal")).not.toBeInTheDocument();
  });

  it("hides the steps instrument when there is no step history", async () => {
    setup({ sessions: [run(1, {})], steps: [] });
    render(<ActivitiesOverviewView days={30} distanceUnit="mi" />);
    await waitFor(() => expect(screen.getByTestId("combined-chart")).toBeInTheDocument());
    expect(screen.queryByText("Daily steps")).not.toBeInTheDocument();
  });

  it("renders avg pace as '—' and a pace gap when every run is manual", async () => {
    setup({
      sessions: [
        run(1, { avg_pace_sec_per_km: null, best_pace_sec_per_km: null }),
        run(3, { avg_pace_sec_per_km: null, best_pace_sec_per_km: null }),
      ],
    });
    render(<ActivitiesOverviewView days={30} distanceUnit="mi" />);
    await waitFor(() => expect(screen.getByText("Avg run pace")).toBeInTheDocument());
    // KPI dash + the sparkline's no-pace empty line.
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.getByText(/no pace data/)).toBeInTheDocument();
    // Mileage still renders (mileage counts even for manual runs).
    expect(screen.getByText("Mileage")).toBeInTheDocument();
  });

  it("degrades a lifting-only window to a 100/0 donut with no run instruments", async () => {
    setup({ lifts: [lift(2, 60), lift(5, 45)] });
    render(<ActivitiesOverviewView days={30} distanceUnit="mi" />);
    await waitFor(() => expect(screen.getByText("Time split")).toBeInTheDocument());

    // Donut reads 100% LIFT.
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(screen.getByText("LIFT")).toBeInTheDocument();

    // No runs → no pace / mileage / effort instruments (no empty holes).
    expect(screen.queryByText("Avg pace")).not.toBeInTheDocument();
    expect(screen.queryByText("Mileage")).not.toBeInTheDocument();
    expect(screen.queryByText("Effort")).not.toBeInTheDocument();
  });

  it("shows an empty effort line when runs carry no HR or elevation", async () => {
    setup({
      sessions: [
        run(1, { avg_heart_rate_bpm: null, max_heart_rate_bpm: null, elevation_gain_meters: null }),
      ],
    });
    render(<ActivitiesOverviewView days={30} distanceUnit="mi" />);
    await waitFor(() => expect(screen.getByText("Effort")).toBeInTheDocument());
    expect(screen.getByText(/No HR or elevation data/)).toBeInTheDocument();
  });
});
