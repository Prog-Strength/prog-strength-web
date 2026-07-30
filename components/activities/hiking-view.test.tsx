/// <reference types="vitest/globals" />

import { render, screen, within } from "@testing-library/react";
import type { RunningSession } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());

const listHikingSessionsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  listHikingSessions: listHikingSessionsMock,
}));

// Formatters kept simple so tile/list values are asserted directly.
// `formatElevation` returns "—" for null so the em-dash tiles are
// distinguishable from a real "0 m" value.
vi.mock("@/lib/distance-unit-context", () => ({
  // Re-export the conversion constants deriveHikingStats depends on so the
  // whole-module mock doesn't strip them.
  METERS_PER_MILE: 1609.344,
  METERS_PER_KM: 1000,
  useDistanceUnit: () => ({
    formatDistance: (m: number) => String(Math.round(m)),
    formatPace: (s: number) => String(s),
    formatElevation: (m: number | null) => (m == null ? "—" : `${Math.round(m)} m`),
    unit: "mi",
    unitLabel: "mi",
  }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// The upload modal is stubbed; the history list is intentionally NOT
// mocked so its real rows render and can be asserted against.
vi.mock("../../app/(app)/running/_components/UploadTCXModal", () => ({
  UploadTCXModal: () => <div data-testid="upload-tcx-modal" />,
}));

import { HikingView } from "./hiking-view";

// --- helpers ---------------------------------------------------------------

let seq = 0;
const id = () => `id-${seq++}`;

function hike(
  opts: Partial<RunningSession> & { distance_meters: number; duration_seconds: number },
): RunningSession {
  return {
    id: id(),
    activity_type: "hiking",
    ingest_source: "garmin_api",
    source_activity_id: id(),
    name: null,
    start_time: new Date("2026-06-22T07:00:00").toISOString(),
    raw_distance_meters: opts.distance_meters,
    environment: "outdoor",
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: null,
    max_heart_rate_bpm: null,
    total_calories: null,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: new Date("2026-06-22T07:00:00").toISOString(),
    ...opts,
  } as RunningSession;
}

function renderView() {
  return render(<HikingView days={30} uploadModalOpen={false} onCloseUploadModal={() => {}} />);
}

/** The value <p> sits immediately before the label <p> in a StatTile. */
function tileValue(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const value = labelEl.previousElementSibling as HTMLElement | null;
  if (!value) throw new Error(`could not find the ${label} tile value element`);
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  seq = 0;
  getTokenMock.mockReturnValue("tok");
});

describe("HikingView", () => {
  it("renders the six tiles with derived values for a small hikes fixture", async () => {
    listHikingSessionsMock.mockResolvedValue({
      activities: [
        hike({
          distance_meters: 10000,
          duration_seconds: 3600,
          elevation_gain_meters: 300,
          elevation_high_meters: 1200,
          elevation_low_meters: 800,
        }),
      ],
    });
    renderView();

    await screen.findByText("DISTANCE");
    // DISTANCE: 10000 m → "10000 mi" (stubbed formatter).
    expect(tileValue("DISTANCE")).toHaveTextContent("10000 mi");
    // VERTICAL GAIN: total gain 300 m.
    expect(tileValue("VERTICAL GAIN")).toHaveTextContent("300 m");
    // GAIN / MI under the mi unit: 300 / (10000 / 1609.344) ≈ 48 m.
    expect(tileValue("GAIN / MI")).toHaveTextContent("48 m");
  });

  it("renders em-dashes for high/low point and gain when the window has no elevation", async () => {
    listHikingSessionsMock.mockResolvedValue({
      activities: [
        hike({ distance_meters: 5000, duration_seconds: 3600 }),
        hike({ distance_meters: 3000, duration_seconds: 2400 }),
      ],
    });
    renderView();

    await screen.findByText("HIGH POINT");
    expect(tileValue("HIGH POINT")).toHaveTextContent("—");
    expect(tileValue("LOW POINT")).toHaveTextContent("—");
    expect(tileValue("GAIN / MI")).toHaveTextContent("—");
  });

  it("renders history rows for the fetched hikes", async () => {
    listHikingSessionsMock.mockResolvedValue({
      activities: [hike({ name: "Summit Loop", distance_meters: 8000, duration_seconds: 5400 })],
    });
    renderView();

    const list = await screen.findByRole("list");
    expect(within(list).getByText("Summit Loop")).toBeInTheDocument();
  });
});
