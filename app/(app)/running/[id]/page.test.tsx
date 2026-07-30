/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type {
  PlannedWorkout,
  RunningIntervalSegment,
  RunningSession,
  RunningSplit,
  RunningTrackpoint,
} from "@/lib/api";

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
const calibrateRunningSessionMock = vi.hoisted(() => vi.fn());
const setRunningSessionEnvironmentMock = vi.hoisted(() => vi.fn());
const updateRunningSessionNotesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getRunningSession: getRunningSessionMock,
  getPlannedWorkoutBySession: getPlannedWorkoutBySessionMock,
  renameRunningSession: renameRunningSessionMock,
  deleteRunningSession: deleteRunningSessionMock,
  unlinkPlannedWorkout: unlinkPlannedWorkoutMock,
  calibrateRunningSession: calibrateRunningSessionMock,
  setRunningSessionEnvironment: setRunningSessionEnvironmentMock,
  updateRunningSessionNotes: updateRunningSessionNotesMock,
}));

// Distance-unit + toast contexts are mocked directly (matching the running
// feature's existing tests) so render is provider-free and non-flaky. The
// active unit lives in a mutable holder so the unit-refetch test can flip it
// and re-render; the formatters mirror the REAL "mi" formatters.
const METERS_PER_MILE = 1609.344;
const KM_PER_MILE = 1.609344;

const unitState = vi.hoisted(() => ({ value: "mi" as "mi" | "km" }));

function formatDistanceMi(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  return (meters / METERS_PER_MILE).toFixed(1);
}
function formatPaceMi(secPerKm: number | null): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  const total = Math.round(secPerKm * KM_PER_MILE);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
const FEET_PER_METER = 3.28084;
function formatElevationMi(meters: number | null): string {
  if (meters == null || !Number.isFinite(meters)) return "—";
  return `${Math.round(meters * FEET_PER_METER).toLocaleString("en-US")} ft`;
}

vi.mock("@/lib/distance-unit-context", () => ({
  // The calibrate modal (rendered by the page) also imports the pure helpers
  // and the conversion constants, so expose them from the same mock. Literals
  // (not the top-level const) because the factory is hoisted above it.
  METERS_PER_MILE: 1609.344,
  METERS_PER_KM: 1000,
  formatDistanceValue: (m: number) => formatDistanceMi(m),
  formatPaceValue: (s: number | null) => formatPaceMi(s),
  useDistanceUnit: () => ({
    unit: unitState.value,
    unitLabel: unitState.value,
    setUnit: vi.fn(),
    formatDistance: formatDistanceMi,
    formatPace: formatPaceMi,
    formatElevation: formatElevationMi,
  }),
}));

const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}));

// The page mounts MapView, which imports maplibre-gl. The real module touches
// browser APIs (window.URL.createObjectURL) at import time that jsdom lacks, so
// stub it out via the shared stub. This page suite doesn't assert on the map;
// MapView has its own dedicated test.
const mapCtor = vi.hoisted(() => vi.fn());
vi.mock("maplibre-gl", () => ({
  default: { Map: mapCtor },
  Map: mapCtor,
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import RunningDetailPage from "./page";

import { intervalTrackpoints, synthesize } from "@/lib/test-fixtures/running-trackpoints";
import { createMapStub } from "@/lib/test-fixtures/maplibre-stub";

// --- trackpoint synthesis ---------------------------------------------------

/** ~2.2 mi steady run — feeds the pace chart only (splits arrive server-side). */
function steadyTrackpoints(): RunningTrackpoint[] {
  return synthesize([
    { meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150, sampleMeters: 10 },
  ]);
}

// --- fixtures ---------------------------------------------------------------

/**
 * Server-derived splits (mirroring the ?unit=mi detail response): two full
 * miles + a 0.2 mi trailing partial. Every pace_sec_per_unit equals
 * duration_seconds / distance_meters * METERS_PER_MILE — the server's
 * invariant. The page renders these verbatim.
 */
function serverSplits(): RunningSplit[] {
  return [
    {
      index: 0,
      partial: false,
      distance_meters: METERS_PER_MILE,
      duration_seconds: 483, // → 8:03 /mi
      pace_sec_per_unit: 483,
      avg_hr_bpm: 150,
      elevation_delta_meters: 5,
      fastest: false,
      slowest: true,
    },
    {
      index: 1,
      partial: false,
      distance_meters: METERS_PER_MILE,
      duration_seconds: 466, // → 7:46 /mi
      pace_sec_per_unit: 466,
      avg_hr_bpm: 154,
      elevation_delta_meters: -3,
      fastest: true,
      slowest: false,
    },
    {
      index: 2,
      partial: true,
      distance_meters: 0.2 * METERS_PER_MILE,
      duration_seconds: 96, // 96 / (0.2 mi) → 8:00 /mi
      pace_sec_per_unit: 480,
      avg_hr_bpm: 156,
      elevation_delta_meters: null,
      fastest: false,
      slowest: false,
    },
  ];
}

/** Server-detected interval candidates (always computed; client gates display). */
function serverIntervals(): RunningIntervalSegment[] {
  return [
    {
      kind: "warmup",
      rep: null,
      label: "Warm-up",
      distance_meters: METERS_PER_MILE,
      duration_seconds: 579,
      pace_sec_per_unit: 579,
      avg_hr_bpm: 130,
    },
    {
      kind: "work",
      rep: 1,
      label: "Rep 1",
      distance_meters: 400,
      duration_seconds: 96,
      pace_sec_per_unit: 386,
      avg_hr_bpm: 175,
    },
    {
      kind: "recovery",
      rep: 1,
      label: "Recovery 1",
      distance_meters: 200,
      duration_seconds: 78,
      pace_sec_per_unit: 628,
      avg_hr_bpm: 150,
    },
    {
      kind: "work",
      rep: 2,
      label: "Rep 2",
      distance_meters: 400,
      duration_seconds: 97,
      pace_sec_per_unit: 390,
      avg_hr_bpm: 176,
    },
    {
      kind: "cooldown",
      rep: null,
      label: "Cool-down",
      distance_meters: 0.5 * METERS_PER_MILE,
      duration_seconds: 290,
      pace_sec_per_unit: 580,
      avg_hr_bpm: 135,
    },
  ];
}

function runningSession(trackpoints: RunningTrackpoint[]): RunningSession {
  return {
    id: "run-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Morning Run",
    start_time: "2026-06-18T13:00:00Z",
    distance_meters: 5000,
    raw_distance_meters: 5000,
    environment: "outdoor",
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 240,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 178,
    total_calories: 420,
    elevation_gain_meters: 30,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: "2026-06-18T13:30:00Z",
    trackpoints,
    // Server-derived detail blocks (?unit=mi). Intervals are ALWAYS present
    // here — the server computes candidates unconditionally; the page must
    // gate their display on the linked plan's run_type.
    unit: "mi",
    splits: serverSplits(),
    strip_summary: { fastest_sec_per_unit: 386, slowest_sec_per_unit: 628, dropout_count: 0 },
    best_pace_sec_per_unit: 386, // → 6:26 /mi
    intervals: serverIntervals(),
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
  // Re-armed after clearAllMocks so each test gets a fresh map with its own
  // recorded sources/layers rather than state carried over from the last one.
  mapCtor.mockImplementation(() => createMapStub());
  params.value = { id: "run-1" };
  unitState.value = "mi";
  // Sensible defaults; individual tests override.
  getRunningSessionMock.mockResolvedValue(runningSession(intervalTrackpoints()));
  getPlannedWorkoutBySessionMock.mockResolvedValue(intervalsPlan());
  renameRunningSessionMock.mockImplementation(async (_t, _id, name) => ({
    ...runningSession([]),
    name,
  }));
  deleteRunningSessionMock.mockResolvedValue(undefined);
  unlinkPlannedWorkoutMock.mockResolvedValue({ ...intervalsPlan(), status: "planned" });
  calibrateRunningSessionMock.mockReset();
  setRunningSessionEnvironmentMock.mockReset();
  updateRunningSessionNotesMock.mockImplementation(async (_t, _id, notes) => ({
    ...runningSession([]),
    notes,
  }));
});

afterEach(() => {
  window.localStorage.clear();
});

describe("RunningDetailPage — splits ledger", () => {
  it("Step 1: renders the server-provided splits verbatim", async () => {
    render(<RunningDetailPage />);

    // Splits table renders a per-mile row.
    expect(await screen.findByText("Mi 1")).toBeInTheDocument();
    expect(screen.getByText("Mi 2")).toBeInTheDocument();

    // The pace column shows the server's pace_sec_per_unit values verbatim
    // (483 → 8:03 tagged slowest, 466 → 7:46 tagged fastest, partial 480 → 8:00).
    const mi1Row = screen.getByText("Mi 1").closest("tr")!;
    expect(within(mi1Row).getAllByText("8:03").length).toBeGreaterThan(0);
    expect(within(mi1Row).getByText("slowest")).toBeInTheDocument();
    const mi2Row = screen.getByText("Mi 2").closest("tr")!;
    expect(within(mi2Row).getAllByText("7:46").length).toBeGreaterThan(0);
    expect(within(mi2Row).getByText("fastest")).toBeInTheDocument();
    const partialRow = screen.getByText("0.2 mi").closest("tr")!;
    expect(within(partialRow).getAllByText("8:00").length).toBeGreaterThan(0); // partial split pace

    // The quiet strip shows the session distance: 5000 m / 1609.344 ≈ "3.1 mi".
    const distanceLabel = screen.getByText("Distance");
    const distanceCell = distanceLabel.closest("div");
    expect(distanceCell).not.toBeNull();
    expect(within(distanceCell!).getByText(/3\.1\s*mi/)).toBeInTheDocument();

    // Best pace is NOT in the strip anymore — it moved to the Pace recap's
    // subtitle (386 → 6:26 /mi as "Fastest").
    expect(screen.queryByText("Best")).not.toBeInTheDocument();
    expect(screen.getAllByText(/Fastest 6:26/).length).toBeGreaterThan(0);
  });

  it("Step 2a: shows the intervals toggle when the linked plan is an intervals run", async () => {
    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    // The segmented toggle exposes an "intervals" button only when the plan
    // gates it open (server intervals are present on the fixture).
    expect(screen.getByRole("button", { name: "intervals" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "miles" })).toBeInTheDocument();
  });

  it("Step 2b: hides the toggle when no linked plan says intervals (miles-only)", async () => {
    // The session STILL carries server-computed interval candidates — the
    // client gate (completesPlan?.run_type === "intervals") must hide them.
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

    // The intervals table surfaces the server's warm-up + numbered reps.
    expect(await screen.findByText("Warm-up")).toBeInTheDocument();
    expect(screen.getByText("Rep 1")).toBeInTheDocument();
  });
});

describe("RunningDetailPage — unit refetch", () => {
  it("refetches the detail when the unit toggles", async () => {
    const { rerender } = render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(getRunningSessionMock).toHaveBeenCalledTimes(1);
    expect(getRunningSessionMock).toHaveBeenLastCalledWith("test-token", "run-1", "mi");

    // Flip the (mocked) unit context to km and re-render: the detail effect
    // depends on the unit, so it must refetch the km-shaped response rather
    // than convert anything client-side.
    unitState.value = "km";
    rerender(<RunningDetailPage />);

    await waitFor(() => {
      expect(getRunningSessionMock).toHaveBeenCalledTimes(2);
    });
    expect(getRunningSessionMock).toHaveBeenLastCalledWith("test-token", "run-1", "km");
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

describe("RunningDetailPage — treadmill badge + environment", () => {
  it("shows the Treadmill badge and calibrate action for an indoor run", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      environment: "indoor",
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(screen.getAllByTitle(/Recorded indoors/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Calibrate distance" })).toBeInTheDocument();
  });

  it("hides the badge and calibrate action for an outdoor run", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      environment: "outdoor",
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(screen.queryByTitle(/Recorded indoors/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Calibrate distance" })).not.toBeInTheDocument();
  });

  it("toggling to Indoor calls setRunningSessionEnvironment after confirm", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      environment: "outdoor",
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);
    setRunningSessionEnvironmentMock.mockResolvedValue({
      ...runningSession([]),
      environment: "indoor",
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    fireEvent.click(screen.getByRole("button", { name: "Indoor" }));

    await waitFor(() => {
      expect(setRunningSessionEnvironmentMock).toHaveBeenCalledWith(
        "test-token",
        "run-1",
        "indoor",
      );
    });
    confirmSpy.mockRestore();
  });

  it("does not call the API when the confirm is dismissed", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      environment: "outdoor",
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    fireEvent.click(screen.getByRole("button", { name: "Indoor" }));

    expect(setRunningSessionEnvironmentMock).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

describe("RunningDetailPage — notes", () => {
  it("empty note shows the affordance; adding text saves it and renders it as prose", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      notes: null,
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    const affordance = await screen.findByRole("button", { name: "How did this run feel?" });
    fireEvent.click(affordance);

    const textarea = screen.getByPlaceholderText("How did this run feel?");
    fireEvent.change(textarea, { target: { value: "Felt smooth and controlled" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(updateRunningSessionNotesMock).toHaveBeenCalledWith(
        "test-token",
        "run-1",
        "Felt smooth and controlled",
      );
    });
    // The saved note renders as prose (whitespace-pre-wrap, click-to-edit).
    const prose = await screen.findByText("Felt smooth and controlled");
    expect(prose).toHaveClass("whitespace-pre-wrap");
  });

  it("rolls back and toasts when the note save fails", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      notes: null,
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);
    updateRunningSessionNotesMock.mockRejectedValue(new Error("nope"));

    render(<RunningDetailPage />);

    fireEvent.click(await screen.findByRole("button", { name: "How did this run feel?" }));
    const textarea = screen.getByPlaceholderText("How did this run feel?");
    fireEvent.change(textarea, { target: { value: "Rolled back" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("nope");
    });
    // The optimistic note reverts: the empty affordance is back, no prose.
    expect(
      await screen.findByRole("button", { name: "How did this run feel?" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Rolled back")).not.toBeInTheDocument();
  });
});

describe("RunningDetailPage — conditional recaps + map", () => {
  it("indoor run with no route renders no map slot", async () => {
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      environment: "indoor",
      route: undefined,
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(screen.queryByLabelText("Run route map")).not.toBeInTheDocument();
  });

  it("no-HR run hides the Heart rate recap and the zones section (pace + splits remain)", async () => {
    const noHr = {
      ...runningSession(
        synthesize([{ meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, sampleMeters: 10 }]),
      ),
      avg_heart_rate_bpm: null,
      max_heart_rate_bpm: null,
    };
    delete noHr.heart_rate_zones;
    getRunningSessionMock.mockResolvedValue(noHr);
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    // No HR recap (its <h3>Heart rate</h3>) and no zones widget/section.
    expect(screen.queryByRole("heading", { name: "Heart rate" })).not.toBeInTheDocument();
    expect(screen.queryByText("Heart rate zones")).not.toBeInTheDocument();
    expect(screen.queryByText("Time in heart-rate zones")).not.toBeInTheDocument();
    // Pace recap and splits still render.
    expect(screen.getByRole("heading", { name: "Pace" })).toBeInTheDocument();
  });

  it("no-elevation run hides the Elevation recap (no empty frame)", async () => {
    const noElev = {
      ...runningSession(
        synthesize([
          { meters: 2.2 * METERS_PER_MILE, paceSecPerKm: 300, hr: 150, sampleMeters: 10 },
        ]).map((t) => ({ ...t, elevation_meters: null })),
      ),
      elevation_gain_meters: null,
    };
    getRunningSessionMock.mockResolvedValue(noElev);
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    render(<RunningDetailPage />);

    await screen.findByText("Mi 1");
    expect(screen.queryByRole("heading", { name: "Elevation" })).not.toBeInTheDocument();
    // Pace still renders.
    expect(screen.getByRole("heading", { name: "Pace" })).toBeInTheDocument();
  });
});

describe("RunningDetailPage — calibration", () => {
  it("calibrating replaces the session so header distance matches the rescaled splits", async () => {
    // Start indoor at ~2.2 mi; the calibrate response carries a ~1.1 mi
    // distance AND rescaled server splits (one full mile + a 0.1 mi partial),
    // so the header and the splits table both reflect the new distance —
    // proving the whole session (splits included) was replaced.
    getRunningSessionMock.mockResolvedValue({
      ...runningSession(steadyTrackpoints()),
      environment: "indoor",
      distance_meters: 2.2 * METERS_PER_MILE,
      raw_distance_meters: 2.2 * METERS_PER_MILE,
    });
    getPlannedWorkoutBySessionMock.mockResolvedValue(null);

    const rescaledSplits: RunningSplit[] = [
      {
        index: 0,
        partial: false,
        distance_meters: METERS_PER_MILE,
        duration_seconds: 966,
        pace_sec_per_unit: 966,
        avg_hr_bpm: 150,
        elevation_delta_meters: null,
        fastest: false,
        slowest: false,
      },
      {
        index: 1,
        partial: true,
        distance_meters: 0.1 * METERS_PER_MILE,
        duration_seconds: 97,
        pace_sec_per_unit: 970,
        avg_hr_bpm: 150,
        elevation_delta_meters: null,
        fastest: false,
        slowest: false,
      },
    ];
    const rescaled = synthesize([
      { meters: 1.1 * METERS_PER_MILE, paceSecPerKm: 600, hr: 150, sampleMeters: 10 },
    ]);
    calibrateRunningSessionMock.mockResolvedValue({
      ...runningSession(rescaled),
      environment: "indoor",
      distance_meters: 1.1 * METERS_PER_MILE,
      raw_distance_meters: 2.2 * METERS_PER_MILE,
      duration_seconds: 1500,
      splits: rescaledSplits,
      strip_summary: { fastest_sec_per_unit: 960, slowest_sec_per_unit: 975, dropout_count: 0 },
      best_pace_sec_per_unit: 960,
      intervals: undefined,
    });

    render(<RunningDetailPage />);

    // Open modal, enter the corrected distance, submit.
    fireEvent.click(await screen.findByRole("button", { name: "Calibrate distance" }));
    const input = await screen.findByLabelText(/Corrected distance/);
    fireEvent.change(input, { target: { value: "1.1" } });
    fireEvent.click(screen.getByRole("button", { name: "Calibrate" }));

    await waitFor(() => {
      // 1.1 mi * 1609.344 = 1770.28 m; the active unit rides along.
      expect(calibrateRunningSessionMock).toHaveBeenCalledWith(
        "test-token",
        "run-1",
        expect.closeTo(1.1 * METERS_PER_MILE, 1),
        "mi",
      );
    });

    // Header distance now reads ~1.1 mi, and the provenance line shows the raw.
    const distanceLabel = await screen.findByText("Distance");
    const distanceCell = distanceLabel.closest("div");
    expect(within(distanceCell!).getByText(/1\.1\s*mi/)).toBeInTheDocument();
    expect(screen.getByText(/Calibrated from 2\.2 mi/)).toBeInTheDocument();
    // Only one full mile split now (the response's rescaled splits render).
    expect(screen.getByText("Mi 1")).toBeInTheDocument();
    expect(screen.queryByText("Mi 2")).not.toBeInTheDocument();
    // The rescaled pace (966 s → 16:06) renders verbatim in the Mi 1 row.
    const mi1Row = screen.getByText("Mi 1").closest("tr")!;
    expect(within(mi1Row).getAllByText("16:06").length).toBeGreaterThan(0);
  });
});
