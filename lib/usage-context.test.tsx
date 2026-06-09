/// <reference types="vitest/globals" />

import { render, screen, act, waitFor, cleanup } from "@testing-library/react";
import { UsageProvider, useUsage } from "@/lib/usage-context";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getMyUsageMock = vi.hoisted(() => vi.fn());
const clearTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMyUsage: getMyUsageMock,
}));

// --- harness ---------------------------------------------------------------

// A probe that surfaces the snapshot + a button to fire refresh() so tests
// can assert coalescing of concurrent calls.
function Probe() {
  const { percentUsed, capped, loading, refresh } = useUsage();
  return (
    <div>
      <span data-testid="percent">{percentUsed}</span>
      <span data-testid="capped">{String(capped)}</span>
      <span data-testid="loading">{String(loading)}</span>
      <button
        type="button"
        onClick={() => {
          // Two concurrent refresh() calls in one tick — should share one
          // underlying fetch.
          void refresh();
          void refresh();
        }}
      >
        double-refresh
      </button>
    </div>
  );
}

function ok(percent: number, capped = false) {
  return { percent_used: percent, capped, resets_at: "2026-06-10T06:00:00Z" };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMyUsageMock.mockReset();
  getMyUsageMock.mockResolvedValue(ok(0));
});

// Unmount any mounted tree between tests so a previous provider's focus
// listener / interval can't leak into the next test and inflate fetch
// counts. (Belt-and-suspenders alongside RTL's auto-cleanup.)
afterEach(() => {
  cleanup();
});

describe("UsageProvider / useUsage", () => {
  it("fetches on mount and exposes the snapshot", async () => {
    getMyUsageMock.mockResolvedValueOnce(ok(64, false));
    render(
      <UsageProvider>
        <Probe />
      </UsageProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("percent").textContent).toBe("64"));
    expect(getMyUsageMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("loading").textContent).toBe("false");
  });

  it("refetches on window focus", async () => {
    // Distinct mount vs. focus payloads so we can wait for the mount
    // fetch to fully settle (percent === 5) before dispatching focus —
    // otherwise the in-flight coalescing guard swallows the focus call.
    getMyUsageMock.mockResolvedValueOnce(ok(5));
    getMyUsageMock.mockResolvedValueOnce(ok(7));
    render(
      <UsageProvider>
        <Probe />
      </UsageProvider>,
    );
    await waitFor(() => expect(screen.getByTestId("percent").textContent).toBe("5"));
    expect(getMyUsageMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(screen.getByTestId("percent").textContent).toBe("7"));
    expect(getMyUsageMock).toHaveBeenCalledTimes(2);
  });

  it("refetches on the 60s interval", async () => {
    vi.useFakeTimers();
    try {
      render(
        <UsageProvider>
          <Probe />
        </UsageProvider>,
      );
      // Flush the mount fetch + its state update (advanceTimersByTimeAsync
      // also drains the microtask queue, so the in-flight ref clears).
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });
      expect(getMyUsageMock).toHaveBeenCalledTimes(1);

      // One interval tick → one more fetch.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(getMyUsageMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("coalesces concurrent refresh() calls into one fetch", async () => {
    // Hold the fetch open so both refresh() calls in the click handler
    // observe the same in-flight promise.
    let resolveFetch: (v: ReturnType<typeof ok>) => void = () => {};
    getMyUsageMock.mockReset();
    getMyUsageMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );

    render(
      <UsageProvider>
        <Probe />
      </UsageProvider>,
    );
    // The mount fetch is the in-flight one. A double-refresh while it's
    // open must not start additional fetches.
    await act(async () => {
      screen.getByText("double-refresh").click();
    });
    expect(getMyUsageMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch(ok(10));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("percent").textContent).toBe("10"));
  });

  it("clears the token and redirects to /login on 401", async () => {
    getMyUsageMock.mockRejectedValueOnce(new Error("HTTP 401"));
    render(
      <UsageProvider>
        <Probe />
      </UsageProvider>,
    );
    await waitFor(() => expect(clearTokenMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
