/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { DashboardData, BloodPressureView } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";

// The two self-fetching tiles in this switch read the network, so this file
// keeps the real module and overrides only their fetchers: `calendar` resolves
// to `not_connected`, which is the one calendar body that is stable and
// fetch-free, and the Whoop connection resolves to "absent" so the sleep cases
// below assert on their section alone rather than on a request that jsdom would
// have to actually make.
const getCalendarEventsMock = vi.hoisted(() => vi.fn(async () => ({ status: "not_connected" })));
const getWhoopConnectionMock = vi.hoisted(() => vi.fn(async () => ({ status: "absent" })));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getCalendarEvents: getCalendarEventsMock,
  getWhoopConnection: getWhoopConnectionMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

import { TileCard } from "./tile-renderer";
import { suppressedView } from "./recovery/fixtures";
import { ordinaryWeek } from "./running/fixtures";
import { scoredNightView } from "./sleep/fixtures";

function fixture(overrides: Partial<DashboardData> = {}): DashboardData {
  return {
    sections: [],
    running: { present: false },
    walking: { present: false },
    cycling: { present: false },
    hiking: { present: false },
    lifting: { present: false },
    steps: { present: false },
    nutrition: { present: false },
    bodyweight: { present: false },
    bloodPressure: { present: false },
    quote: { present: false },
    recovery: { present: false },
    sleep: { present: false },
    streak: { weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true },
    ...overrides,
  };
}

describe("TileCard", () => {
  it("renders the running card for id 'running'", () => {
    render(<TileCard id="running" data={fixture()} />);
    expect(screen.getByRole("heading", { name: "Training Load" })).toBeInTheDocument();
    // Empty section → its inviting CTA.
    expect(screen.getByText("Import a run to start tracking")).toBeInTheDocument();
  });

  it("renders the streak card for id 'streak'", () => {
    render(<TileCard id="streak" data={fixture()} />);
    expect(screen.getByRole("heading", { name: "Streak" })).toBeInTheDocument();
  });

  it("renders the Connect Whoop CTA when recovery is enabled but not present", () => {
    render(<TileCard id="recovery" data={fixture({ recovery: { present: false } })} />);
    expect(screen.getByRole("heading", { name: "Recovery" })).toBeInTheDocument();
    expect(screen.getByText("Connect Whoop to see recovery")).toBeInTheDocument();
  });

  const FAMILY: [TileId, string][] = [
    ["recovery", "Recovery"],
    ["hrv_balance", "HRV Balance"],
    ["morning_vitals", "Morning Vitals"],
    ["recovery_log", "Recovery Log"],
    ["resting_hr", "Resting HR"],
  ];

  it.each(FAMILY)("renders the %s card from the shared recovery section", (id, title) => {
    render(
      <TileCard id={id} data={fixture({ recovery: { present: true, ...suppressedView() } })} />,
    );
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Connect Whoop to see recovery")).not.toBeInTheDocument();
  });

  it.each(FAMILY)("renders the titled connect CTA for %s when recovery is absent", (id, title) => {
    render(<TileCard id={id} data={fixture({ recovery: { present: false } })} />);
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.getByText("Connect Whoop to see recovery")).toBeInTheDocument();
  });

  const RUNNING_FAMILY: [TileId, string][] = [
    ["running", "Training Load"],
    ["running_log", "Runs This Week"],
    ["running_effort", "Run Effort"],
    ["running_vertical", "Vertical Gain"],
  ];

  it.each(RUNNING_FAMILY)("renders the %s card from the shared running section", (id, title) => {
    render(
      <TileCard id={id} data={fixture({ running: { present: true, ...ordinaryWeek("mi") } })} />,
    );
    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Import a run to start tracking")).not.toBeInTheDocument();
  });

  it.each(RUNNING_FAMILY)(
    "renders the titled empty CTA for %s when running is absent",
    (id, title) => {
      render(<TileCard id={id} data={fixture()} />);
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
      expect(screen.getByText("Import a run to start tracking")).toBeInTheDocument();
    },
  );

  it("renders the sleep card for id 'sleep'", async () => {
    render(
      <TileCard id="sleep" data={fixture({ sleep: { present: true, ...scoredNightView() } })} />,
    );
    expect(await screen.findByRole("heading", { name: "Sleep" })).toBeInTheDocument();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
  });

  it("renders no sleep tile at all when there is no Whoop connection", () => {
    // The section is absent only for a user with no connection, and the SOW's
    // answer there is no tile — the grid slot stays empty rather than inviting
    // a connect flow the recovery family already owns.
    const { container } = render(<TileCard id="sleep" data={fixture()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the self-fetching calendar card for id 'calendar'", async () => {
    render(<TileCard id="calendar" data={fixture()} />);

    // Nothing on `data` feeds this tile — it holds its own request, its own
    // auth, and its own degradations, and resolves before the href assertion
    // because there is no calendar page to deep-link into.
    expect(await screen.findByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Connect Google Calendar/ })).toBeInTheDocument();
    expect(getCalendarEventsMock).toHaveBeenCalled();
  });

  it("renders the blood-pressure empty CTA when the section is absent", () => {
    render(<TileCard id="blood_pressure" data={fixture()} />);
    expect(screen.getByRole("heading", { name: "Blood Pressure" })).toBeInTheDocument();
    expect(screen.getByText("Log your first reading")).toBeInTheDocument();
  });

  it("renders the live blood-pressure card with reading, category, and dual spark", () => {
    const bloodPressure: BloodPressureView = {
      latest: { systolic: 122, diastolic: 78, measured_at: "2026-07-30T08:15:00Z" },
      category: "elevated",
      avg30: { systolic: 119, diastolic: 76 },
      systolicSpark: [118, 120, 124, 122, 121],
      diastolicSpark: [74, 76, 79, 78, 77],
    };
    const { container } = render(
      <TileCard
        id="blood_pressure"
        data={fixture({ bloodPressure: { present: true, ...bloodPressure } })}
      />,
    );
    // headline reading
    expect(screen.getByText("122/78")).toBeInTheDocument();
    // category label from BP_CATEGORIES
    expect(screen.getByText("Elevated")).toBeInTheDocument();
    // 30-day average
    expect(screen.getByText("119/76")).toBeInTheDocument();
    // dual sparkline → both series drawn (systolic + diastolic)
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("drops the 30-day average when it is null", () => {
    const bloodPressure: BloodPressureView = {
      latest: { systolic: 130, diastolic: 82, measured_at: "2026-07-30T08:15:00Z" },
      category: "stage_1",
      avg30: null,
      systolicSpark: [128, 130],
      diastolicSpark: [80, 82],
    };
    render(
      <TileCard
        id="blood_pressure"
        data={fixture({ bloodPressure: { present: true, ...bloodPressure } })}
      />,
    );
    expect(screen.getByText("Stage 1")).toBeInTheDocument();
    expect(screen.queryByText("30d avg")).not.toBeInTheDocument();
  });
});
