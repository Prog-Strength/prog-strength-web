/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { UsageSnapshot } from "@/lib/usage-context";

// --- module mocks ----------------------------------------------------------

const useUsageMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// getMe never resolves in these tests — the Usage section under test
// doesn't depend on it, and a pending promise keeps the weight toggle in
// its loading state without interfering.
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(() => new Promise(() => {})),
  updateMe: vi.fn(),
}));

vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({ unit: "mi", setUnit: vi.fn() }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

vi.mock("@/lib/usage-context", () => ({
  useUsage: useUsageMock,
}));

import SettingsPage from "./page";

// --- helpers ---------------------------------------------------------------

function snapshot(
  over: Partial<UsageSnapshot> = {},
): UsageSnapshot & { refresh: () => Promise<void> } {
  return {
    percentUsed: 0,
    capped: false,
    // ~5h out so the countdown copy is non-trivial.
    resetsAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
    ...over,
  };
}

function progressFill(): HTMLElement {
  return screen.getByRole("progressbar", { name: "Daily AI allowance" });
}

describe("Settings — Usage section", () => {
  it("renders a 0% accent bar", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 0 }));
    render(<SettingsPage />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    const fill = progressFill();
    expect(fill).toHaveStyle({ width: "0%" });
    expect(fill.style.backgroundColor).toBe("var(--accent)");
    expect(screen.getByText(/Resets in/)).toBeInTheDocument();
  });

  it("renders a 50% accent bar", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 50 }));
    render(<SettingsPage />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    const fill = progressFill();
    expect(fill).toHaveStyle({ width: "50%" });
    expect(fill.style.backgroundColor).toBe("var(--accent)");
  });

  it("renders an amber bar at 80%", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 80 }));
    render(<SettingsPage />);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(progressFill().style.backgroundColor).toBe("var(--warning)");
  });

  it("renders a red bar at 100% with the flipped copy", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 100, capped: true }));
    render(<SettingsPage />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(progressFill().style.backgroundColor).toBe("var(--danger)");
    expect(screen.getByText(/You've used your daily AI allowance/)).toBeInTheDocument();
    expect(screen.queryByText(/^Resets in/)).not.toBeInTheDocument();
  });

  it("renders a disabled bar with the unavailable copy on error", () => {
    useUsageMock.mockReturnValue(snapshot({ error: "boom" }));
    render(<SettingsPage />);
    expect(screen.getByText("Usage unavailable right now.")).toBeInTheDocument();
    // The progress bar is replaced by a hatched/disabled track on error.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("usage-bar-unavailable")).toBeInTheDocument();
  });
});
