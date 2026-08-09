/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type {
  Activity,
  ActivityWeather,
  HeartRateZones,
  RouteFeature,
  RunningTrackpoint,
} from "@/lib/api";

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

vi.mock("@/lib/profile-context", () => ({
  useProfile: () => ({ profile: { id: "user-1", display_name: "Sam" } }),
}));

// The photo strip is stubbed to a marker; its own behavior is covered by
// PhotoStrip.test.tsx. This keeps the detail-page test focused on layout/wiring.
vi.mock("@/components/activity-detail/PhotoStrip", () => ({
  PhotoStrip: () => <div data-testid="photo-strip" />,
}));

// The video strip is stubbed to a marker echoing its count; its own behavior is
// covered by VideoStrip.test.tsx. What each PAGE suite must prove is that the
// route renders it at all — the regression the photo rollout shipped.
vi.mock("@/components/activity-detail/VideoStrip", () => ({
  VideoStrip: ({ videos }: { videos: unknown[] }) => (
    <div data-testid="video-strip" data-video-count={videos.length} />
  ),
}));

// API mock: spread the real module so types/helpers stay intact, then
// override only the network calls this page makes.
const getActivityMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getActivity: getActivityMock,
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
    formatTemperature: (c: number | null) => (c == null ? "—" : `${Math.round(c * 1.8 + 32)}°F`),
    formatWindSpeed: (kmh: number | null) =>
      kmh == null ? "—" : `${Math.round((kmh * 1000) / 1609.344)} mph`,
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

function hikingSession(overrides: Partial<Activity> = {}): Activity {
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
  getActivityMock.mockResolvedValue(hikingSession());
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
    getActivityMock.mockResolvedValue(noZones);

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.queryByText("Time in heart-rate zones")).not.toBeInTheDocument();
    expect(screen.queryByText("Heart rate zones")).not.toBeInTheDocument();
  });

  it("shows the calibrating banner while the max-HR estimate is still settling", async () => {
    getActivityMock.mockResolvedValue(
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

// The activity-photos SOW's motivating story is a summit selfie on a hike, but
// the strip shipped only on the workout detail page. These pin it here.
describe("HikingDetailPage — photos", () => {
  it("renders the photo strip for the owner even with no photos yet", async () => {
    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.getByTestId("photo-strip")).toBeInTheDocument();
  });

  it("renders the strip when the hike already carries photos", async () => {
    getActivityMock.mockResolvedValue(
      hikingSession({
        photos: [
          {
            id: "ph_1",
            url: "https://example.test/full.jpg",
            thumb_url: "https://example.test/thumb.jpg",
            width: 1200,
            height: 900,
            caption: "Summit",
            position: 0,
            status: "ready" as const,
          },
        ],
      }),
    );

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.getByTestId("photo-strip")).toBeInTheDocument();
  });

  // Photo storage unconfigured: the API omits the key entirely. The owner still
  // gets the Add affordance rather than the page hiding media outright.
  it("still renders the strip when the photos key is absent", async () => {
    const noPhotos = hikingSession();
    delete noPhotos.photos;
    getActivityMock.mockResolvedValue(noPhotos);

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.getByTestId("photo-strip")).toBeInTheDocument();
  });
});

// Route coverage, hiking. The SOW makes this a completion criterion rather than
// a detail: a shared component with one call site is how the photo strip
// shipped broken for runs and hikes.
describe("HikingDetailPage — videos", () => {
  it("renders the video strip for the owner even with no videos yet", async () => {
    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.getByTestId("video-strip")).toHaveAttribute("data-video-count", "0");
  });

  it("threads the hike's videos into the strip", async () => {
    getActivityMock.mockResolvedValue(
      hikingSession({
        videos: [
          {
            id: "vid_1",
            url: "https://example.test/v.mp4",
            poster_url: "https://example.test/p.jpg",
            content_type: "video/mp4",
            byte_size: 1234,
            duration_seconds: 12,
            width: 1920,
            height: 1080,
            caption: null,
            position: 0,
          },
        ],
      }),
    );

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.getByTestId("video-strip")).toHaveAttribute("data-video-count", "1");
  });

  // Video storage unconfigured: the API omits the key entirely, which is not
  // the same as an empty list. The owner still gets the Add affordance.
  it("still renders the strip when the videos key is absent", async () => {
    const noVideos = hikingSession();
    delete noVideos.videos;
    getActivityMock.mockResolvedValue(noVideos);

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.getByTestId("video-strip")).toBeInTheDocument();
  });
});

// Route coverage, hiking. The widget's own behaviour is covered by
// WeatherRecap.test.tsx; what the PAGE suite must prove is that the route
// renders it, in the beat the SOW places it in — between the map and the
// elevation profile.
describe("HikingDetailPage — conditions", () => {
  /** A one-segment route so MapView renders and the slot is assertable. */
  const route: RouteFeature = {
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [-71.64, 44.14],
          [-71.65, 44.16],
        ],
      ],
    },
    properties: { bounds: { min_lat: 44.14, min_lng: -71.65, max_lat: 44.16, max_lng: -71.64 } },
  };

  const weather: ActivityWeather = {
    status: "ok",
    observed_at: "2026-06-18T13:00:00Z",
    temp_c: 12.4,
    feels_like_c: 9.8,
    dew_point_c: 7.2,
    humidity: 71,
    wind_kmh: 22.5,
    wind_deg: 315,
    precip_mm: 0,
    condition: "Clouds",
    icon: "03d",
  };

  /** The base fixture carries no elevation, so the profile section — the
   *  beat the widget must precede — would self-hide. Give it a climb. */
  function climbingTrackpoints(): RunningTrackpoint[] {
    return synthesize([
      { meters: METERS_PER_MILE, paceSecPerKm: 900, hr: 130, elevation: 700, sampleMeters: 20 },
      { meters: METERS_PER_MILE, paceSecPerKm: 900, hr: 130, elevation: 1600, sampleMeters: 20 },
    ]);
  }

  it("renders the conditions beat after the map and before the elevation profile", async () => {
    getActivityMock.mockResolvedValue(
      hikingSession({ route, weather, trackpoints: climbingTrackpoints() }),
    );

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    const map = screen.getByLabelText("Hike route map");
    const conditions = screen.getByText("Conditions");
    const profile = screen.getByText("Elevation profile");
    // 54°F / 14 mph — formatted client-side off the active unit (mi).
    expect(screen.getByText("54°F")).toBeInTheDocument();
    expect(screen.getByText("14 mph NW")).toBeInTheDocument();

    expect(map.compareDocumentPosition(conditions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      conditions.compareDocumentPosition(profile) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("omits the beat for an indoor hike that still carries a stored reading", async () => {
    getActivityMock.mockResolvedValue(hikingSession({ environment: "indoor", weather }));

    render(<HikingDetailPage />);

    await screen.findByText("Franconia Ridge");
    expect(screen.queryByText("Conditions")).not.toBeInTheDocument();
    expect(screen.queryByText("54°F")).not.toBeInTheDocument();
  });
});
