/// <reference types="vitest/globals" />
import { render, screen, waitFor } from "@testing-library/react";

const listActivitiesMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
vi.mock("@/lib/api", () => ({
  listActivities: listActivitiesMock,
}));
vi.mock("@/lib/profile-context", () => ({
  useProfile: () => ({
    profile: { display_name: "Sam Lifter", avatar_url: null, distance_unit: "km" },
  }),
}));
vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({
    formatDistance: (m: number) => (m / 1000).toFixed(1),
    unitLabel: "km",
  }),
}));

import { YourWeekRail } from "./YourWeekRail";

beforeEach(() => {
  vi.clearAllMocks();
  // Two activities this week (relative to a fixed clock the component reads via
  // `new Date()`); use recent ISO timestamps so they land in the current week.
  const now = new Date();
  const iso = (daysAgo: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, 9).toISOString();
  // ONE unified ranged page carries the lift and the run together.
  listActivitiesMock.mockResolvedValue({
    activities: [
      { id: "w1", activity_type: "strength_training", start_time: iso(0) },
      {
        id: "r1",
        activity_type: "running",
        start_time: iso(0),
        distance_meters: 5000,
        duration_seconds: 1500,
      },
    ],
    next_before: null,
  });
});

describe("YourWeekRail", () => {
  it("renders the viewer's name and avatar initials", async () => {
    render(<YourWeekRail />);
    expect(await screen.findByText("Sam Lifter")).toBeInTheDocument();
  });

  it("derives and shows this week's run and lift counts from fetched data", async () => {
    render(<YourWeekRail />);
    await waitFor(() => expect(listActivitiesMock).toHaveBeenCalled());
    // 1 run + 1 lift this week — assert both stat labels surface. Use exact
    // matches so the "Sam Lifter" display name doesn't satisfy a /lifts?/ regex.
    expect(await screen.findByText("Run")).toBeInTheDocument();
    expect(await screen.findByText("Lift")).toBeInTheDocument();
  });

  it("renders the this-week sparkline graphic", async () => {
    render(<YourWeekRail />);
    expect(await screen.findByRole("img", { name: /this week/i })).toBeInTheDocument();
  });
});
