/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { RunningMaxEffortDetail } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// The route param drives which distance the page renders; a mutable holder
// lets each test pick the key before rendering.
const params = vi.hoisted(() => ({ value: { distanceKey: "marathon" } }));
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
  useParams: () => params.value,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// Recharts is stubbed: jsdom has no layout, and this test asserts on the
// empty-state copy / absence of the chart, not the SVG.
vi.mock("recharts", () => {
  const Stub = () => <div data-testid="recharts-stub" />;
  return {
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    ComposedChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Area: Stub,
    Line: Stub,
    Scatter: Stub,
    CartesianGrid: Stub,
    XAxis: Stub,
    YAxis: Stub,
    Tooltip: Stub,
  };
});

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getRunningMaxEffort: vi.fn(async () => DETAIL),
  // DistanceUnitProvider calls getMe on mount; keep it off the network.
  getMe: vi.fn(async () => {
    throw new Error("no /me in test");
  }),
}));

import { getRunningMaxEffort } from "@/lib/api";
import RunningMaxEffortPage from "./page";

// --- fixture: an insufficient_data detail (null estimate) ------------------

const DETAIL: RunningMaxEffortDetail = {
  estimator_version: "v1",
  distance_key: "marathon",
  distance_label: "Marathon",
  distance_meters: 42195,
  estimate: null,
  actual_best: null,
  estimate_history: [],
  attempts: [],
  stats: {
    estimated_max_effort_seconds: null,
    current_best_seconds: null,
    gap_seconds: null,
    confidence: "low",
    data_summary: "insufficient data",
  },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DistanceUnitProvider>
        <RunningMaxEffortPage />
      </DistanceUnitProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
});

describe("RunningMaxEffortPage — insufficient_data", () => {
  it("renders the empty state and not the chart when the estimate is null", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Not enough data yet")).toBeInTheDocument();
    });
    // The empty-state body nudges the user to log a run.
    expect(screen.getByText(/Log a run at this distance/)).toBeInTheDocument();
    // The estimate chart is not rendered in the empty state.
    expect(screen.queryByText("Estimate over time")).toBeNull();
    expect(getRunningMaxEffort).toHaveBeenCalledWith("test-token", "marathon");
  });

  it("rejects a non-standard distance key without fetching", async () => {
    params.value = { distanceKey: "ultramarathon" };
    renderPage();

    expect(screen.getByText(/isn't one of the standard distances we estimate/)).toBeInTheDocument();
    expect(getRunningMaxEffort).not.toHaveBeenCalled();

    // Restore for any later tests.
    params.value = { distanceKey: "marathon" };
  });
});
