/// <reference types="vitest/globals" />
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DashboardRecovery } from "@/lib/api";
import type { RecoveryView } from "@/lib/dashboard";
import { defaultView, recordedMornings } from "./fixtures";
import { PLOT_HEIGHTS } from "./_components/deck";

const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
/**
 * ONE router object for the whole suite, not a fresh literal per render.
 *
 * `refetch` is a `useCallback` keyed on the router, so a `useRouter` that
 * returned a new object every render would churn its identity, re-run the mount
 * effect on every state update and fetch in a loop — which would make the
 * central assertion of this file ("one call per load") unfalsifiable. The real
 * `useRouter` is stable; the mock has to be too. (The dashboard and nutrition
 * page tests hold a stable `routerMock` for the same reason.)
 */
const routerMock = vi.hoisted(() => ({ replace: replaceMock, push: pushMock }));
const getWhoopConnectionMock = vi.hoisted(() => vi.fn());
const getRecoveryHistoryMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  getWhoopConnection: getWhoopConnectionMock,
  getRecoveryHistory: getRecoveryHistoryMock,
}));

import RecoveryPage from "./page";

// jsdom doesn't implement matchMedia; the deck, the ledger and the loading
// skeleton all subscribe to it via `useIsMobile`. A minimal, non-matching stub
// gives every test below the DESKTOP rendering.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

/**
 * The page is driven by the REAL fixture views, run backwards onto the wire.
 *
 * `getRecoveryHistory` returns a `DashboardRecovery` — the snake_case payload —
 * and the page maps it with `adaptRecovery`, so a test that handed the mock a
 * `RecoveryView` would be testing a page that does not exist. The two honest
 * options were to hand-author a wire payload or to invert the adapter over
 * `fixtures.ts`; this file inverts, for two reasons. It keeps the REAL
 * `adaptRecovery` in the path (mocking it would hide exactly the mis-mapping the
 * SOW made it exported to prevent), and it gives every test below the fixture's
 * fourteen deliberately unkind months — 428 date-aligned slots, 416 recorded,
 * a missing Friday — which is what makes the stored-mornings count, the ledger's
 * paging and the three window widths worth asserting at all. A hand-built
 * ten-day payload would assert the same code against data that could not fail.
 */
function toWire(view: RecoveryView): DashboardRecovery {
  const days = view.days ?? [];
  const { baseline, hrv, baselineTrend } = view;
  if (!baseline || !hrv || !baselineTrend) {
    throw new Error("fixture view is missing a derived block");
  }
  const today = days[days.length - 1];
  return {
    today: today
      ? {
          date: today.date,
          resting_heart_rate: today.restingHr,
          recovery_score: today.recoveryScore,
          hrv_rmssd_milli: today.hrv,
        }
      : null,
    resting_hr_spark: view.spark,
    days: days.map((d) => ({
      date: d.date,
      resting_heart_rate: d.restingHr,
      recovery_score: d.recoveryScore,
      hrv_rmssd_milli: d.hrv,
      baseline_avg: d.baselineAvg,
      balanced_low: d.balancedLow,
      balanced_high: d.balancedHigh,
      z_score: d.zScore,
      status: d.status,
    })),
    baseline: {
      window_days: baseline.windowDays,
      resting_hr_avg: baseline.restingHrAvg,
      resting_hr_days: baseline.restingHrDays,
      hrv_avg: baseline.hrvAvg,
      hrv_std_dev: baseline.hrvStdDev,
      hrv_days: baseline.hrvDays,
      recovery_score_avg: baseline.recoveryScoreAvg,
      recovery_score_days: baseline.recoveryScoreDays,
    },
    hrv: {
      status: hrv.status,
      balanced_low: hrv.balancedLow,
      balanced_high: hrv.balancedHigh,
      z_score: hrv.zScore,
      trend: hrv.trend,
      short_avg: hrv.shortAvg,
    },
    baseline_trend: {
      direction: baselineTrend.direction,
      delta_ms: baselineTrend.deltaMs,
      from_avg: baselineTrend.fromAvg,
      over_days: baselineTrend.overDays,
    },
  };
}

const VIEW = defaultView();
const WIRE = toWire(VIEW);
const RECORDED = recordedMornings(VIEW);

/** The page's own sub-line — the `<p>` under the `<h1>`, mixed text and spans. */
function headerSubline(): HTMLElement {
  return screen.getByText(
    (_, el) => el?.tagName === "P" && /mornings stored/.test(el.textContent ?? ""),
    { selector: "p" },
  );
}

/** The deck body, which is also the keyboard surface. */
function deckBody(): HTMLElement {
  return screen.getByRole("group", { name: /Recovery deck/ });
}

/** Every window pill, by its label. */
function pill(label: string): HTMLElement {
  return screen.getByRole("button", { name: label });
}

/** Waits for the healthy page: the ledger is the last register to arrive. */
async function loaded(): Promise<void> {
  await screen.findByText(/Ledger · all stored history/);
}

beforeEach(() => {
  getTokenMock.mockReturnValue("tok");
  getWhoopConnectionMock.mockResolvedValue({ status: "connected" });
  getRecoveryHistoryMock.mockResolvedValue(WIRE);
});

afterEach(() => {
  // Unmount before clearing, so an in-flight `.then` cannot resolve into the
  // next test's mocks.
  cleanup();
  vi.clearAllMocks();
});

describe("RecoveryPage — render gates", () => {
  it("renders a deck-shaped skeleton while the fetch is in flight", async () => {
    let land: (payload: DashboardRecovery) => void = () => {};
    getRecoveryHistoryMock.mockReturnValue(
      new Promise<DashboardRecovery>((resolve) => {
        land = resolve;
      }),
    );

    render(<RecoveryPage />);
    const skeleton = screen.getByRole("status", { name: /loading recovery history/i });
    // Deck-shaped, not a spinner: the strip block plus the deck's three rows.
    expect(skeleton.querySelectorAll(".animate-pulse").length).toBeGreaterThanOrEqual(4);
    // And deck-SIZED — the three plot blocks stand at the deck's own heights,
    // read from `deck.tsx`'s constant rather than from a second copy of the
    // numbers, so "no layout shift when the payload lands" cannot drift into
    // being false while this test still passes.
    const blocks = Array.from(skeleton.querySelectorAll<HTMLElement>("div[style]"));
    expect(blocks.map((el) => el.style.height)).toEqual([
      `${PLOT_HEIGHTS.hrv}px`,
      `${PLOT_HEIGHTS.score}px`,
      `${PLOT_HEIGHTS.rhr}px`,
    ]);
    // The header is already in its final shape, so nothing above the deck moves
    // when the payload lands.
    expect(screen.getByRole("heading", { name: "Recovery" })).toBeInTheDocument();
    expect(pill("90d")).toBeInTheDocument();

    land(WIRE);
    await loaded();
    expect(screen.queryByRole("status", { name: /loading recovery history/i })).toBeNull();
  });

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

  it("connected with no payload at all → first-night copy", async () => {
    getRecoveryHistoryMock.mockResolvedValue(null);
    render(<RecoveryPage />);
    expect(
      await screen.findByText(/your first recovery lands after tonight's sleep/i),
    ).toBeInTheDocument();
  });

  it("connected with materialized empty slots → first-night copy, not an empty deck", async () => {
    // The gate is on RECORDED MORNINGS, never on `days.length`. The endpoint
    // materializes a date-aligned window, so a connected user with no history
    // gets a non-empty array of hollow slots — gating on the array would draw a
    // deck of nothing.
    getRecoveryHistoryMock.mockResolvedValue({
      ...WIRE,
      days: WIRE.days.slice(-30).map((d) => ({
        ...d,
        resting_heart_rate: null,
        recovery_score: null,
        hrv_rmssd_milli: null,
      })),
    });
    render(<RecoveryPage />);
    expect(await screen.findByText(/no recovery data yet/i)).toBeInTheDocument();
    expect(screen.queryByText(/Ledger · all stored history/)).toBeNull();
  });

  it("connected with history → the five registers, opening on 90d", async () => {
    render(<RecoveryPage />);
    await loaded();

    expect(screen.getByRole("heading", { name: "Recovery" })).toBeInTheDocument();
    expect(pill("90d")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Last 90 days · window orientation/)).toBeInTheDocument();
    expect(screen.getByText(/Last 90 days · one axis/)).toBeInTheDocument();
    expect(deckBody()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage Whoop connection/ })).toHaveAttribute(
      "href",
      "/settings?tab=integrations",
    );
  });
});

describe("RecoveryPage — one payload, three windows", () => {
  it("asks for ALL stored history once, with the browser timezone and no since", async () => {
    render(<RecoveryPage />);
    await loaded();

    expect(getWhoopConnectionMock).toHaveBeenCalledTimes(1);
    expect(getRecoveryHistoryMock).toHaveBeenCalledTimes(1);
    const [token, opts] = getRecoveryHistoryMock.mock.calls[0];
    expect(token).toBe("tok");
    expect(typeof opts.timezone).toBe("string");
    // No `since`: omitting it is what asks the endpoint for everything stored.
    expect(opts).toEqual({ timezone: opts.timezone });
  });

  it("switching windows re-slices in memory and issues NO new request", async () => {
    render(<RecoveryPage />);
    await loaded();
    const columns = () => screen.getByRole("img", { name: /mornings of recovery score/ });

    expect(columns()).toHaveAttribute("aria-label", expect.stringMatching(/^90 mornings/));

    fireEvent.click(pill("30d"));
    await waitFor(() =>
      expect(columns()).toHaveAttribute("aria-label", expect.stringMatching(/^30 mornings/)),
    );
    expect(screen.getByText(/Last 30 days · one axis/)).toBeInTheDocument();

    fireEvent.click(pill("1y"));
    await waitFor(() =>
      expect(columns()).toHaveAttribute("aria-label", expect.stringMatching(/^365 mornings/)),
    );
    expect(screen.getByText(/Last 12 months · one axis/)).toBeInTheDocument();

    // The window changed twice and the network did not move.
    expect(getRecoveryHistoryMock).toHaveBeenCalledTimes(1);
    expect(getWhoopConnectionMock).toHaveBeenCalledTimes(1);
  });

  it("prints the same stored-mornings count as the ledger — real rows, not slots", async () => {
    render(<RecoveryPage />);
    await loaded();

    // The fixture is 428 date-aligned slots with twelve mornings Whoop never
    // recorded; both registers must say 416.
    expect(RECORDED).toBeLessThan((VIEW.days ?? []).length);
    expect(headerSubline().textContent).toContain(`${RECORDED} mornings stored`);
    expect(screen.getByText(`${RECORDED} mornings`)).toBeInTheDocument();
  });
});

describe("RecoveryPage — failure", () => {
  it("clears the token and redirects on a 401", async () => {
    getWhoopConnectionMock.mockRejectedValue(new Error("HTTP 401 unauthorized"));
    getRecoveryHistoryMock.mockRejectedValue(new Error("HTTP 401 unauthorized"));
    render(<RecoveryPage />);
    await waitFor(() => expect(clearTokenMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login");
    // A page being navigated away from does not flash a banner on the way out.
    expect(screen.queryByText(/HTTP 401/)).toBeNull();
  });

  it("shows the inline banner on a failed fetch, and retrying re-issues it", async () => {
    getRecoveryHistoryMock.mockRejectedValue(new Error("HTTP 500 recovery history unavailable"));
    render(<RecoveryPage />);
    expect(await screen.findByText(/HTTP 500 recovery history unavailable/)).toBeInTheDocument();
    expect(screen.queryByText(/Ledger · all stored history/)).toBeNull();

    getRecoveryHistoryMock.mockResolvedValue(WIRE);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await loaded();
    expect(getRecoveryHistoryMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/HTTP 500 recovery history unavailable/)).toBeNull();
  });
});

describe("RecoveryPage — the selection never re-pages the ledger", () => {
  it("keeps the ledger where the user left it and offers the jump instead", async () => {
    render(<RecoveryPage />);
    await loaded();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

    // ArrowLeft with nothing selected steps back from the newest morning — a
    // morning that lives on page 1, while the ledger is being read on page 2.
    fireEvent.keyDown(deckBody(), { key: "ArrowLeft" });

    const jump = await screen.findByRole("button", { name: /is on page 1/ });
    expect(screen.getByText(/Page 2 of/)).toBeInTheDocument();

    // And it moves only when the user takes the offer.
    fireEvent.click(jump);
    expect(screen.getByText(/Page 1 of/)).toBeInTheDocument();
    expect(screen.queryByText(/Page 2 of/)).toBeNull();
  });
});
