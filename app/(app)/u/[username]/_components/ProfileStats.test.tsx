/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { ProfileStats as ProfileStatsData } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const getProfileStatsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// getProfileStats is the component's only fetch; getMe is pulled in by the
// DistanceUnitProvider on mount — stub it to settle the unit on localStorage
// without hitting the network.
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getProfileStats: getProfileStatsMock,
  getMe: vi.fn(async () => {
    throw new Error("no /me in test");
  }),
}));

// Recharts has no layout in jsdom; stub it to passthrough divs so we can
// assert on the chart regions our component renders (each WeeklySeriesChart
// wraps its chart in a div[data-testid="weekly-series-chart"]).
vi.mock("recharts", () => {
  const stub = () => () => null;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AreaChart: ({ children }: { children: React.ReactNode }) => (
      <div data-recharts="AreaChart">{children}</div>
    ),
    Area: stub(),
    CartesianGrid: stub(),
    XAxis: stub(),
    YAxis: stub(),
    Tooltip: stub(),
  };
});

import { ProfileStats } from "./ProfileStats";

// --- helpers ---------------------------------------------------------------

const WEEKS = 12;

function series(values: number[]): ProfileStatsData["lift_session_minutes"] {
  return values.map((value, i) => ({
    week_start: new Date(2026, 2, 23 + i * 7).toISOString(),
    value,
  }));
}

function stats(over: Partial<ProfileStatsData> = {}): ProfileStatsData {
  return {
    lift_session_minutes: series(new Array(WEEKS).fill(0)),
    running_distance_meters: series(new Array(WEEKS).fill(0)),
    ...over,
  };
}

function renderStats() {
  window.localStorage.setItem("ps_distance_unit", "mi");
  return render(
    <DistanceUnitProvider>
      <ProfileStats username="sam" />
    </DistanceUnitProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("ProfileStats", () => {
  it("renders both weekly charts from a non-zero fixture", async () => {
    const nonZero = new Array(WEEKS).fill(0);
    nonZero[WEEKS - 1] = 90;
    getProfileStatsMock.mockResolvedValue(
      stats({
        lift_session_minutes: series(nonZero),
        running_distance_meters: series(nonZero.map((v) => v * 100)),
      }),
    );

    renderStats();

    // Both section headings render.
    expect(await screen.findByText("Weekly lifting time")).toBeInTheDocument();
    expect(screen.getByText("Weekly running distance")).toBeInTheDocument();
    // Two chart regions, one per series.
    expect(screen.getAllByTestId("weekly-series-chart")).toHaveLength(2);
  });

  it("renders the gated message and no charts when locked", async () => {
    getProfileStatsMock.mockResolvedValue(
      stats({ locked: true, lift_session_minutes: [], running_distance_meters: [] }),
    );

    renderStats();

    expect(
      await screen.findByText("This user's activity is visible to accepted followers."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("weekly-series-chart")).toBeNull();
  });

  it("renders the empty state and no charts when both series are all-zero", async () => {
    getProfileStatsMock.mockResolvedValue(stats());

    renderStats();

    expect(await screen.findByText("No activity yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("weekly-series-chart")).toBeNull();
  });

  it("clears the loading state once the fetch resolves", async () => {
    getProfileStatsMock.mockResolvedValue(stats());
    renderStats();
    await waitFor(() => expect(screen.queryByText("Loading stats…")).toBeNull());
  });
});
