/// <reference types="vitest/globals" />
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";

const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const getWhoopConnectionMock = vi.hoisted(() => vi.fn());
const listWhoopRecoveryMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  getWhoopConnection: getWhoopConnectionMock,
  listWhoopRecovery: listWhoopRecoveryMock,
}));

vi.mock("recharts", () => {
  // Pass-through stubs so the trend charts render without recharts' layout
  // engine. Named exports must be own keys (vitest rejects unknown-export
  // access on a mocked module), so we list the components the trends use.
  const Pass = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ResponsiveContainer: Pass,
    LineChart: Pass,
    Line: Pass,
    CartesianGrid: Pass,
    XAxis: Pass,
    YAxis: Pass,
    Tooltip: Pass,
    ReferenceArea: Pass,
    ReferenceLine: Pass,
  };
});

import RecoveryPage from "./page";

const dayRow = {
  date: "2026-07-02",
  recovery_score: 72,
  resting_heart_rate: 54,
  hrv_rmssd_milli: 88,
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 2, 12, 0, 0)); // 2026-07-02 local
  getTokenMock.mockReturnValue("tok");
  getWhoopConnectionMock.mockResolvedValue({ status: "connected" });
  listWhoopRecoveryMock.mockResolvedValue([dayRow]);
});

afterEach(() => {
  // Unmount before restoring real timers so a component's in-flight fetch
  // `.then` (which re-runs refetch) can't resolve into the next test's mocks.
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("RecoveryPage — render gate", () => {
  it("absent connection → Connect Whoop CTA into Settings", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
    render(<RecoveryPage />);
    const cta = await screen.findByRole("link", { name: /connect whoop/i });
    expect(cta).toHaveAttribute("href", "/settings?tab=integrations");
  });

  it("revoked connection → Connect Whoop CTA", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "revoked" });
    render(<RecoveryPage />);
    expect(await screen.findByRole("link", { name: /connect whoop/i })).toBeInTheDocument();
  });

  it("error connection → reconnect phrasing", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "error" });
    render(<RecoveryPage />);
    expect(await screen.findByText(/needs attention/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reconnect/i })).toHaveAttribute(
      "href",
      "/settings?tab=integrations",
    );
  });

  it("connected but zero rows → first-night copy", async () => {
    listWhoopRecoveryMock.mockResolvedValue([]);
    render(<RecoveryPage />);
    expect(
      await screen.findByText(/your first recovery lands after tonight's sleep/i),
    ).toBeInTheDocument();
  });

  it("connected with data → hero score + all three sections", async () => {
    render(<RecoveryPage />);
    await waitFor(() => expect(screen.getByTestId("recovery-score")).toHaveTextContent("72"));
    expect(screen.getByText("Recovery score")).toBeInTheDocument();
    expect(screen.getByText("Day log")).toBeInTheDocument();
  });
});

describe("RecoveryPage — range + fetch", () => {
  it("fetches with the browser timezone and 30-day default window", async () => {
    render(<RecoveryPage />);
    await waitFor(() => expect(listWhoopRecoveryMock).toHaveBeenCalled());
    const call = listWhoopRecoveryMock.mock.calls[0];
    expect(call[0]).toBe("tok");
    expect(call[1]).toMatchObject({ until: "2026-07-02" });
    expect(typeof call[1].timezone).toBe("string");
    expect(call[1].since).toBe("2026-06-03");
  });

  it("refetches with a wider window when 90d is selected", async () => {
    render(<RecoveryPage />);
    await waitFor(() => expect(listWhoopRecoveryMock).toHaveBeenCalled());
    listWhoopRecoveryMock.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "90d" }));
    // The mocked useRouter returns a fresh object each render, so refetch's
    // identity churns and an interim 30d refetch can fire before the range
    // state settles; assert the SETTLED (latest) call carries the 90d window.
    await waitFor(() => {
      const calls = listWhoopRecoveryMock.mock.calls;
      expect(calls.at(-1)?.[1].since).toBe("2026-04-04");
    });
  });

  it("clears the token and redirects on a 401", async () => {
    getWhoopConnectionMock.mockRejectedValue(new Error("HTTP 401 unauthorized"));
    listWhoopRecoveryMock.mockRejectedValue(new Error("HTTP 401 unauthorized"));
    render(<RecoveryPage />);
    await waitFor(() => expect(clearTokenMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
