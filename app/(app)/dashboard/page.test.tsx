/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { DashboardSummary, ResolvedProfile } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({ replace: replaceMock, push: pushMock }));
const getTokenMock = vi.hoisted(() => vi.fn(() => "test-token" as string | null));
const clearTokenMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

// Keep the real adaptDashboard + type exports; override only the fetchers.
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => PROFILE),
  getDashboardSummary: vi.fn(async () => summaryToReturn),
}));

import { getMe, getDashboardSummary } from "@/lib/api";
import DashboardPage from "./page";

// --- fixtures --------------------------------------------------------------

const PROFILE: ResolvedProfile = {
  id: "u1",
  email: "lifter@example.com",
  display_name: "Sam Lifter",
  weight_unit: "lb",
  distance_unit: "mi",
  height_cm: 180,
  avatar_url: null,
  timezone: "America/Denver",
  calendar_default_detail: "time_block",
  username: "sam",
  bio: null,
};

const FULL_SUMMARY: DashboardSummary = {
  running: {
    current_week: { distance_meters: 16093.44, run_count: 3, delta_pct_vs_prior_week: 12 },
    recent_avg_pace_sec_per_km: 300,
    latest_run: {
      name: "Morning run",
      distance_meters: 8046.72,
      duration_seconds: 2400,
      start_time: "2026-06-18T13:00:00Z",
    },
    weekly_distance_spark: [8000, 12000, 9000, 16093.44],
  },
  lifting: {
    current_week: { duration_seconds: 5400, sessions: 4, sets: 48, prs: 2 },
    headline_estimated_1rm: { exercise_name: "Back Squat", value: 315, unit: "lb" },
    weekly_volume_spark: [12000, 14000, 13500, 16000],
    unit: "lb",
  },
  steps: { avg: 9200, today: 11500, goal: 10000, daily_spark: [8000, 9000, 12000, 11500] },
  nutrition: {
    today: { calories: 2400, protein_g: 180, carbs_g: 250, fat_g: 70 },
    goals: { calories: 3000, protein_g: 200, carbs_g: 300, fat_g: 90 },
  },
  bodyweight: {
    current: 184,
    unit: "lb",
    rate_per_week: -0.5,
    goal: { weight: 175, unit: "lb" },
    trend_spark: [186, 185.5, 185, 184],
  },
  streak: {
    weeks: 6,
    active_days_this_week: 4,
    week: [true, true, false, true, true, false, false],
  },
};

const EMPTY_SUMMARY: DashboardSummary = {
  running: null,
  lifting: null,
  steps: null,
  nutrition: null,
  bodyweight: null,
  streak: {
    weeks: 0,
    active_days_this_week: 0,
    week: [false, false, false, false, false, false, false],
  },
};

let summaryToReturn: DashboardSummary | null = FULL_SUMMARY;

beforeEach(() => {
  vi.clearAllMocks();
  getTokenMock.mockReturnValue("test-token");
  summaryToReturn = FULL_SUMMARY;
});

// --- tests -----------------------------------------------------------------

describe("DashboardPage — auth guard", () => {
  it("redirects to /login when no token", () => {
    getTokenMock.mockReturnValue(null);
    render(<DashboardPage />);
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});

describe("DashboardPage — loading", () => {
  it("shows skeletons (not data) before the fetch resolves", () => {
    render(<DashboardPage />);
    // No headline values yet; skeletons present.
    expect(screen.queryByText("Back Squat")).not.toBeInTheDocument();
    // The command bar renders even during loading.
    expect(screen.getByLabelText("Command")).toBeInTheDocument();
  });
});

describe("DashboardPage — full payload", () => {
  it("fetches the summary with the browser timezone, not the saved profile tz", async () => {
    // Regression: the dashboard must anchor "today" on the browser zone (the
    // source the nutrition/chat/running surfaces use), NOT the profile tz —
    // a stale profile tz made the dashboard's nutrition day disagree with the
    // (correct) nutrition page and pull an adjacent day's entries. Profile tz
    // is Denver (above); force the browser zone to a different zone and assert
    // the fetch uses the browser zone.
    const realDTF = Intl.DateTimeFormat;
    const spy = vi
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation((...args: ConstructorParameters<typeof Intl.DateTimeFormat>) => {
        const inst = new realDTF(...args);
        const realResolved = inst.resolvedOptions.bind(inst);
        inst.resolvedOptions = () => ({ ...realResolved(), timeZone: "America/Chicago" });
        return inst;
      });
    try {
      render(<DashboardPage />);
      await waitFor(() => expect(getMe).toHaveBeenCalled());
      await waitFor(() =>
        expect(getDashboardSummary).toHaveBeenCalledWith("test-token", "America/Chicago"),
      );
    } finally {
      spy.mockRestore();
    }
  });

  it("renders the KPI strip and all six mini-cards with headline values", async () => {
    render(<DashboardPage />);
    // KPI strip labels (some collide with card titles, so scope to the
    // KPI-only labels Run / Lift / Fuel / Weight which never repeat).
    await waitFor(() => expect(screen.getByText("Run")).toBeInTheDocument());
    for (const label of ["Lift", "Fuel", "Weight"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // Card headlines: each card is a link titled by its domain.
    for (const title of ["Running", "Lifting", "Steps", "Nutrition", "Bodyweight", "Streak"]) {
      expect(screen.getByRole("link", { name: new RegExp(title, "i") })).toBeInTheDocument();
    }
    // Running headline: 16093.44 m → 10.0 mi (shown in both the KPI cell and the card).
    expect(screen.getAllByText("10.0").length).toBeGreaterThan(0);
    // Bodyweight current.
    expect(screen.getAllByText("184").length).toBeGreaterThan(0);
    // Lifting headline 1RM appears in the meta row.
    expect(screen.getByText(/315 lb/)).toBeInTheDocument();
  });

  it("links each card into its deep page", async () => {
    render(<DashboardPage />);
    await waitFor(() => expect(screen.getByRole("link", { name: /Running/i })).toBeInTheDocument());
    const hrefFor = (name: RegExp) => screen.getByRole("link", { name }).getAttribute("href");
    expect(hrefFor(/Running/i)).toBe("/activities?view=running");
    expect(hrefFor(/Lifting/i)).toBe("/workouts");
    expect(hrefFor(/Steps/i)).toBe("/activities?view=steps");
    expect(hrefFor(/Nutrition/i)).toBe("/nutrition");
    expect(hrefFor(/Bodyweight/i)).toBe("/bodyweight");
    expect(hrefFor(/Streak/i)).toBe("/activities");
  });
});

describe("DashboardPage — command bar", () => {
  it("routes to /chat?prompt=<encoded> on submit", async () => {
    render(<DashboardPage />);
    const input = await screen.findByLabelText("Command");
    fireEvent.change(input, { target: { value: "how was my week?" } });
    fireEvent.submit(input.closest("form")!);
    expect(pushMock).toHaveBeenCalledWith("/chat?prompt=how%20was%20my%20week%3F");
  });
});

describe("DashboardPage — empty / brand-new user", () => {
  beforeEach(() => {
    summaryToReturn = EMPTY_SUMMARY;
  });

  it("renders empty CTAs and 'start your streak', with no NaN or lone 0%", async () => {
    const { container } = render(<DashboardPage />);
    await waitFor(() => expect(screen.getByText("Running")).toBeInTheDocument());
    // Brand-new streak copy.
    expect(screen.getByText("start your streak")).toBeInTheDocument();
    // At least one inviting empty CTA.
    expect(screen.getByText(/Import a run to start tracking/)).toBeInTheDocument();
    expect(screen.getByText(/Log a meal to start tracking/)).toBeInTheDocument();
    // No NaN and no lone "0%" delta anywhere.
    expect(container.textContent).not.toMatch(/NaN/);
    expect(container.textContent).not.toMatch(/\b0%/);
  });
});

describe("DashboardPage — 401 handling", () => {
  it("clears the token and routes to /login on a 401 from getMe", async () => {
    (getMe as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("HTTP 401"));
    render(<DashboardPage />);
    await waitFor(() => expect(clearTokenMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
