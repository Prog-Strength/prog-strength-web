/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { PlannedWorkout, RunningSession, RunningTrackpoint } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The route param drives which run the page loads; a mutable holder keeps it
// stable across tests (all tests use the same id).
const params = vi.hoisted(() => ({ value: { id: "run-1" } }));
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
// A STABLE router object: next/navigation returns a stable router, and the
// page's load effect depends (transitively) on its identity — a fresh object
// per render would re-run the effect every render and clobber optimistic state.
const routerMock = vi.hoisted(() => ({ replace: replaceMock, push: pushMock }));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useParams: () => params.value,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// API mock: spread the real module so types/helpers stay intact, then
// override only the network calls this page makes.
const getRunningSessionMock = vi.hoisted(() => vi.fn());
const getPlannedWorkoutBySessionMock = vi.hoisted(() => vi.fn());
const renameRunningSessionMock = vi.hoisted(() => vi.fn());
const deleteRunningSessionMock = vi.hoisted(() => vi.fn());
const unlinkPlannedWorkoutMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getRunningSession: getRunningSessionMock,
  getPlannedWorkoutBySession: getPlannedWorkoutBySessionMock,
  renameRunningSession: renameRunningSessionMock,
  deleteRunningSession: deleteRunningSessionMock,
  unlinkPlannedWorkout: unlinkPlannedWorkoutMock,
}));

// Distance-unit + toast contexts are mocked directly (matching the running
// feature's existing tests) so render is provider-free and non-flaky. The
// distance-unit mock mirrors the REAL "mi" formatters so the derivation that
// the page feeds these into produces realistic, mile-bucketed splits.
const METERS_PER_MILE = 1609.344;
const KM_PER_MILE = 1.609344;

function formatDistanceMi(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  return (meters / METERS_PER_MILE).toFixed(1);
}
function formatPaceMi(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm * KM_PER_MILE);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({
    unit: "mi",
    unitLabel: "mi",
    setUnit: vi.fn(),
    formatDistance: formatDistanceMi,
    formatPace: formatPaceMi,
  }),
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

import RunningDetailPage from "./page";

// --- trackpoint synthesis ---------------------------------------------------

type SegmentSpec = {
  meters: number;
  paceSecPerKm: number;
  hr?: number | null;
  elevation?: number | null;
  sampleMeters?: number;
};

/**
 * Synthesize a dense RunningTrackpoint stream from constant-pace segment
 * specs (mirrors the proven approach in lib/running-splits.test.ts) so the
 * page's derivation produces real splits and, for the interval fixture,
 * detects intervals.
 */
function synthesize(specs: SegmentSpec[]): RunningTrackpoint[] {
  const points: RunningTrackpoint[] = [];
  let sequence = 0;
  let distance = 0;
  let elapsed = 0;

  const push = (pace: number, hr: number | null, elevation: number | null) => {
    points.push({
      sequence,
      elapsed_seconds: Math.round(elapsed),
      distance_meters: Math.round(distance * 100) / 100,
      heart_rate_bpm: hr,
      pace_sec_per_km: pace,
      elevation_meters: elevation,
    });
    sequence += 1;
  };

  const first = specs[0];
  push(first.paceSecPerKm, first.hr ?? null, first.elevation ?? null);

  for (const spec of specs) {
    const step = spec.sampleMeters ?? 25;
    const hr = spec.hr ?? null;
    let covered = 0;
    while (covered < spec.meters - 1e-6) {
      const next = Math.min(step, spec.meters - covered);
      covered += next;
      distance += next;
      elapsed += (next / 1000) * spec.paceSecPerKm;
      push(spec.paceSecPerKm, hr, spec.elevation ?? null);
    }
  }

  return points;
}

/** ~2.2 mi steady run — produces 3 mile splits, no interval structure. */
function steadyTrackpoints(): RunningTrackpoint[] {
  return synthesize([
    { meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150, sampleMeters: 10 },
  ]);
}

/** 1 mi warm-up + 6×(400m fast / 200m recovery) + cool-down → detectable intervals. */
function intervalTrackpoints(): RunningTrackpoint[] {
  const specs: SegmentSpec[] = [{ meters: METERS_PER_MILE, paceSecPerKm: 360, hr: 130 }];
  for (let i = 0; i < 6; i++) {
    specs.push({ meters: 400, paceSecPerKm: 240, hr: 175 });
    specs.push({ meters: 200, paceSecPerKm: 390, hr: 150 });
  }
  specs.push({ meters: 0.5 * METERS_PER_MILE, paceSecPerKm: 360, hr: 130 });
  return synthesize(specs);
}

// --- fixtures ---------------------------------------------------------------

function runningSession(trackpoints: RunningTrackpoint[]): RunningSession {
  return {
    id: "run-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Morning Run",
    start_time: "2026-06-18T13:00:00Z",
    distance_meters: 5000,
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 240,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 178,
    total_calories: 420,
    elevation_gain_meters: 30,
    created_at: "2026-06-18T13:30:00Z",
    trackpoints,
  };
}

function intervalsPlan(): PlannedWorkout {
  return {
    id: "plan-1",
    name: "Track Intervals",
    activity_kind: "run",
    scheduled_start: "2026-06-18T12:00:00Z",
    scheduled_end: "2026-06-18T13:00:00Z",
    timezone: "America/New_York",
    status: "completed",
    notes: null,
    completed_session_id: "run-1",
    completed_session_kind: "activity",
    calendar_detail: null,
    google_event_id: null,
    google_sync_status: null,
    last_sync_error: null,
    run_type: "intervals",
    run_details: "8 × 400m @ 5K effort (~6:30/mi) with 200m jog recovery.",
    exercises: [],
    created_at: "2026-06-15T00:00:00Z",
    updated_at: "2026-06-15T00:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  params.value = { id: "run-1" };
  // Sensible defaults; individual tests override.
  getRunningSessionMock.mockResolvedValue(runningSession(intervalTrackpoints()));
  getPlannedWorkoutBySessionMock.mockResolvedValue(intervalsPlan());
  renameRunningSessionMock.mockImplementation(async (_t, _id, name) => ({
    ...runningSession([]),
    name,
  }));
  deleteRunningSessionMock.mockResolvedValue(undefined);
  unlinkPlannedWorkoutMock.mockResolvedValue({ ...intervalsPlan(), status: "planned" });
});

afterEach(() => {
  window.localStorage.clear();
});

describe("RunningDetailPage — splits ledger", () => {
  it("Step 1: renders splits from a known interval fixture", async () => {
    render(<RunningDetailPage />);

    // Splits table renders a per-mile row.
    expect(await screen.findByText("Mi 1")).toBeInTheDocument();
    expect(screen.getByText("Mi 2")).toBeInTheDocument();

    // Header band shows the session distance: 5000 m / 1609.344 ≈ "3.1 mi".
    const distanceLabel = screen.getByText("Distance");
    const distanceCell = distanceLabel.closest("div");
    expect(distanceCell).not.toBeNull();
    expect(within(distanceCell!).getByText(/3\.1\s*mi/)).toBeInTheDocument();
  });

  it("Step 2a: shows the intervals toggle when intervals are detected", async () => {
    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    // The segmented toggle exposes an "intervals" button only when detected.
    expect(screen.getByRole("button", { name: "intervals" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "miles" })).toBeInTheDocument();
  });

  it("Step 2b: hides the toggle for an easy/steady run (miles-only)", async () => {
    getRunningSessionMock.mockResolvedValue(runningSession(steadyTrackpoints()));
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(screen.queryByRole("button", { name: "intervals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "miles" })).not.toBeInTheDocument();
  });

  it("Step 2c: flips to the intervals table when the toggle is clicked", async () => {
    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    fireEvent.click(screen.getByRole("button", { name: "intervals" }));

    // The intervals table surfaces warm-up + numbered reps.
    expect(await screen.findByText("Warm-up")).toBeInTheDocument();
    expect(screen.getByText("Rep 1")).toBeInTheDocument();
  });
});

describe("RunningDetailPage — preserved behaviors", () => {
  it("Step 3: rename still fires with the new name", async () => {
    render(<RunningDetailPage />);

    const nameButton = await screen.findByRole("button", { name: /Morning Run/ });
    fireEvent.click(nameButton);

    const input = screen.getByDisplayValue("Morning Run");
    fireEvent.change(input, { target: { value: "Tempo Tuesday" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(renameRunningSessionMock).toHaveBeenCalledWith("test-token", "run-1", "Tempo Tuesday");
    });
    // The renamed value is reflected in the header.
    expect(await screen.findByRole("button", { name: /Tempo Tuesday/ })).toBeInTheDocument();
  });

  it("Step 4: delete confirms then pushes back to the runs view", async () => {
    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    // Confirm in the modal (the modal's confirm button is also labelled Delete).
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(deleteRunningSessionMock).toHaveBeenCalledWith("test-token", "run-1");
    });
    expect(pushMock).toHaveBeenCalledWith("/activities?view=running");
  });

  it("Step 5: unlink fires and removes the ✓ pill", async () => {
    render(<RunningDetailPage />);

    // The linked plan shows a ✓ pill with the plan name.
    const pill = await screen.findByText(/Track Intervals/);
    expect(pill).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Unlink/i }));

    await waitFor(() => {
      expect(unlinkPlannedWorkoutMock).toHaveBeenCalledWith("test-token", "plan-1");
    });
    // The pill (and Unlink button) disappear once the plan is detached.
    await waitFor(() => {
      expect(screen.queryByText(/Track Intervals/)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Unlink/i })).not.toBeInTheDocument();
  });
});
