/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import type { RunningMetrics } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());

const getRunningMetricsMock = vi.hoisted(() => vi.fn());
const listRunningSessionsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  getRunningMetrics: getRunningMetricsMock,
  listRunningSessions: listRunningSessionsMock,
}));

vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({
    formatDistance: (m: number) => String(Math.round(m)),
    formatPace: (s: number) => String(s),
    unitLabel: "mi",
  }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

// Heavy children stubbed to simple divs so the test focuses on the
// metrics banner tiles. The StatTile is intentionally NOT mocked so the
// tone class is assertable against the real component.
vi.mock("@/components/running-analytics", () => ({
  RunningAnalytics: () => <div data-testid="running-analytics" />,
}));
vi.mock("../../app/(app)/running/_components/RunHistoryList", () => ({
  RunHistoryList: () => <div data-testid="run-history-list" />,
}));
vi.mock("../../app/(app)/running/_components/UploadTCXModal", () => ({
  UploadTCXModal: () => <div data-testid="upload-tcx-modal" />,
}));

import { RunningView } from "./running-view";

// --- helpers ---------------------------------------------------------------

function metricsFixture(deltaPct: number | null): RunningMetrics {
  return {
    current_week: { distance_meters: 5000, run_count: 3, delta_pct_vs_prior_week: deltaPct },
    current_month: { distance_meters: 20000, run_count: 12 },
    recent_avg_pace_sec_per_km: 300,
    all_time: { distance_meters: 100000, run_count: 60 },
  };
}

function renderView() {
  return render(<RunningView days={30} uploadModalOpen={false} onCloseUploadModal={() => {}} />);
}

/** The "This week" StatTile renders the value as the <p> immediately
 * preceding the label <p>. Locate it via the label's sibling. */
function weekValueElement(): HTMLElement {
  const label = screen.getByText("This week");
  const value = label.previousElementSibling as HTMLElement | null;
  if (!value) throw new Error("could not find the This week value element");
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  getTokenMock.mockReturnValue("tok");
  listRunningSessionsMock.mockResolvedValue({ activities: [] });
});

describe("RunningView — weekly delta", () => {
  it("renders an upward delta with the positive tone", async () => {
    getRunningMetricsMock.mockResolvedValue(metricsFixture(12));
    renderView();

    await screen.findByText("This week");
    expect(screen.getByText(/\+12% vs last week/)).toBeInTheDocument();
    expect(weekValueElement().className).toContain("text-[var(--success)]");
  });

  it("renders a downward delta with the negative tone", async () => {
    getRunningMetricsMock.mockResolvedValue(metricsFixture(-8));
    renderView();

    await screen.findByText("This week");
    expect(screen.getByText(/-8% vs last week/)).toBeInTheDocument();
    expect(weekValueElement().className).toContain("text-[var(--danger)]");
  });

  it("hides the delta and uses the neutral tone when delta is null", async () => {
    getRunningMetricsMock.mockResolvedValue(metricsFixture(null));
    renderView();

    await screen.findByText("This week");
    await waitFor(() => expect(screen.queryByText(/vs last week/)).not.toBeInTheDocument());
    expect(weekValueElement().className).toContain("text-[var(--foreground)]");
  });
});
