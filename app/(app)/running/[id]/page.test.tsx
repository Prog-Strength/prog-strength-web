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

import { intervalTrackpoints, synthesize } from "@/lib/test-fixtures/running-trackpoints";

// --- trackpoint synthesis ---------------------------------------------------

/** ~2.2 mi steady run — produces 3 mile splits, no interval structure. */
function steadyTrackpoints(): RunningTrackpoint[] {
  return synthesize([
    { meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150, sampleMeters: 10 },
  ]);
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
    heart_rate_zones: {
      model: "percent_max_hr",
      max_hr_reference_bpm: 191,
      reference_source: "p99_recent_runs",
      reference_confidence: "calibrated",
      calibrating: false,
      total_hr_seconds: 1500,
      zones: [
        {
          zone: 1,
          name: "Recovery",
          lower_pct: 0.0,
          upper_pct: 0.6,
          min_bpm: 0,
          max_bpm: 114,
          time_seconds: 120,
          time_pct: 0.08,
        },
        {
          zone: 2,
          name: "Aerobic",
          lower_pct: 0.6,
          upper_pct: 0.7,
          min_bpm: 115,
          max_bpm: 133,
          time_seconds: 480,
          time_pct: 0.32,
        },
        {
          zone: 3,
          name: "Tempo",
          lower_pct: 0.7,
          upper_pct: 0.8,
          min_bpm: 134,
          max_bpm: 152,
          time_seconds: 360,
          time_pct: 0.24,
        },
        {
          zone: 4,
          name: "Threshold",
          lower_pct: 0.8,
          upper_pct: 0.9,
          min_bpm: 153,
          max_bpm: 171,
          time_seconds: 330,
          time_pct: 0.22,
        },
        {
          zone: 5,
          name: "VO2max",
          lower_pct: 0.9,
          upper_pct: 1.0,
          min_bpm: 172,
          max_bpm: 191,
          time_seconds: 210,
          time_pct: 0.14,
        },
      ],
    },
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

describe("RunningDetailPage — heart-rate zones", () => {
  it("renders the zones widget from the session's heart_rate_zones block", async () => {
    render(<RunningDetailPage />);

    expect(await screen.findByText("Heart rate zones")).toBeInTheDocument();
    // A legend row per zone, with bpm ranges.
    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("VO2max")).toBeInTheDocument();
    expect(screen.getByText(/172[–-]191 bpm/)).toBeInTheDocument();
  });

  it("omits the widget when the run has no heart_rate_zones block", async () => {
    const noZones = runningSession(steadyTrackpoints());
    delete noZones.heart_rate_zones;
    getRunningSessionMock.mockResolvedValue(noZones);
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(screen.queryByText("Heart rate zones")).not.toBeInTheDocument();
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
