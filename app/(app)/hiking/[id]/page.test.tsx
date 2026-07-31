/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { HeartRateZones, RunningSession, RunningTrackpoint } from "@/lib/api";

// Route + auth. The router object is hoisted and stable: the load effect
// depends on its identity, and a fresh object per render would re-run it.
const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useParams: () => ({ id: "hike-1" }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// API mock: spread the real module so types/helpers stay intact, then
// override only the network calls this page makes.
const getRunningSessionMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getRunningSession: getRunningSessionMock,
  renameRunningSession: vi.fn(),
  deleteRunningSession: vi.fn(),
  updateRunningSessionNotes: vi.fn(),
}));

// Distance-unit + toast contexts are mocked directly (matching the running
// detail suite) so render is provider-free and non-flaky.
const METERS_PER_MILE = 1609.344;
vi.mock("@/lib/distance-unit-context", () => ({
  METERS_PER_MILE: 1609.344,
  METERS_PER_KM: 1000,
  useDistanceUnit: () => ({
    unit: "mi",
    unitLabel: "mi",
    setUnit: vi.fn(),
    formatDistance: (m: number) => (m / 1609.344).toFixed(1),
    formatPace: () => "—",
    formatElevation: (m: number | null) =>
      m == null ? "—" : `${Math.round(m * 3.28084).toLocaleString("en-US")} ft`,
  }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// The page mounts MapView, which imports maplibre-gl; the real module touches
// browser APIs jsdom lacks at import time. The map has its own dedicated test.
const mapCtor = vi.hoisted(() => vi.fn());
vi.mock("maplibre-gl", () => ({ default: { Map: mapCtor }, Map: mapCtor }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import HikingDetailPage from "./page";
import { synthesize } from "@/lib/test-fixtures/running-trackpoints";
import { createMapStub } from "@/lib/test-fixtures/maplibre-stub";

/** ~2 mi of climbing track with heart rate on every sample. */
function hikeTrackpoints(): RunningTrackpoint[] {
  return synthesize([
    { meters: 2 * METERS_PER_MILE, paceSecPerKm: 900, hr: 130, sampleMeters: 20 },
  ]);
}

function hikeZones(): HeartRateZones {
  return {
    model: "percent_max_hr",
    max_hr_reference_bpm: 191,
    reference_source: "p99_recent_runs",
    reference_confidence: "calibrated",
    calibrating: false,
    total_hr_seconds: 5400,
    zones: [
      {
        zone: 1,
        name: "Recovery",
        lower_pct: 0.0,
        upper_pct: 0.6,
        min_bpm: 0,
        max_bpm: 114,
        time_seconds: 1080,
        time_pct: 0.2,
      },
      {
        zone: 2,
        name: "Aerobic",
        lower_pct: 0.6,
        upper_pct: 0.7,
        min_bpm: 115,
        max_bpm: 133,
        time_seconds: 2700,
        time_pct: 0.5,
      },
      {
        zone: 3,
        name: "Tempo",
        lower_pct: 0.7,
        upper_pct: 0.8,
        min_bpm: 134,
        max_bpm: 152,
        time_seconds: 1080,
        time_pct: 0.2,
      },
      {
        zone: 4,
        name: "Threshold",
        lower_pct: 0.8,
        upper_pct: 0.9,
        min_bpm: 153,
        max_bpm: 171,
        time_seconds: 540,
        time_pct: 0.1,
      },
      {
        zone: 5,
        name: "VO2max",
        lower_pct: 0.9,
        upper_pct: 1.0,
        min_bpm: 172,
        max_bpm: 191,
        time_seconds: 0,
        time_pct: 0,
      },
    ],
  };
}

function hikingSession(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "hike-1",
    activity_type: "hiking",
    ingest_source: "manual_tcx",
    source_activity_id: "src-hike-1",
    name: "Franconia Ridge",
    start_time: "2026-06-18T13:00:00Z",
    distance_meters: 2 * METERS_PER_MILE,
    raw_distance_meters: 2 * METERS_PER_MILE,
    environment: "outdoor",
    duration_seconds: 5400,
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: 130,
    max_heart_rate_bpm: 165,
    total_calories: 900,
    elevation_gain_meters: 900,
    elevation_loss_meters: 880,
    elevation_high_meters: 1600,
    elevation_low_meters: 700,
    created_at: "2026-06-18T16:00:00Z",
    trackpoints: hikeTrackpoints(),
    heart_rate_zones: hikeZones(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mapCtor.mockImplementation(createMapStub);
  getRunningSessionMock.mockResolvedValue(hikingSession());
});

// Issue #131: the zones widget is a standard activity-detail surface, not a
// running-only one. A hike with heart rate earns the same breakdown a run does.
describe("HikingDetailPage — heart-rate zones", () => {
  it("renders the zones widget from the session's heart_rate_zones block", async () => {
    render(<HikingDetailPage />);

    expect(await screen.findByText("Time in heart-rate zones")).toBeInTheDocument();
    expect(screen.getByText("Heart rate zones")).toBeInTheDocument();
    expect(screen.getByText("Recovery")).toBeInTheDocument();
    expect(screen.getByText("VO2max")).toBeInTheDocument();
    expect(screen.getByText(/172[–-]191 bpm/)).toBeInTheDocument();
    // Time and percent read straight off the block.
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("omits the section when the hike carries no heart_rate_zones block", async () => {
    const noZones = hikingSession();
    delete noZones.heart_rate_zones;
    getRunningSessionMock.mockResolvedValue(noZones);

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.queryByText("Time in heart-rate zones")).not.toBeInTheDocument();
    expect(screen.queryByText("Heart rate zones")).not.toBeInTheDocument();
  });

  it("shows the calibrating banner while the max-HR estimate is still settling", async () => {
    getRunningSessionMock.mockResolvedValue(
      hikingSession({
        heart_rate_zones: {
          ...hikeZones(),
          reference_confidence: "calibrating",
          calibrating: true,
        },
      }),
    );

    render(<HikingDetailPage />);

    expect(
      await screen.findByText(
        "Calibrating — zones will sharpen as Prog Strength learns your heart rate.",
      ),
    ).toBeInTheDocument();
  });
});
