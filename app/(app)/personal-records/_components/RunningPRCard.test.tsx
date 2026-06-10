/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DistanceUnitProvider, type DistanceUnit } from "@/lib/distance-unit-context";
import type { RunningBestEffort } from "@/lib/api";
import { RunningPRCard } from "./RunningPRCard";

// getMe is called by DistanceUnitProvider on mount when a token exists; we
// stub the auth + api modules so the provider settles on the localStorage
// unit and never hits the network. The pace assertions then depend only on
// the seeded unit, not on an in-flight /me reconcile.
vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: vi.fn(async () => {
    throw new Error("no /me in test");
  }),
}));

const ENTRY: RunningBestEffort = {
  distance_key: "5k",
  distance_label: "5K",
  distance_meters: 5000,
  duration_seconds: 1184.7,
  pace_sec_per_km: 236.9,
  activity_id: "act_2c1",
  activity_start_time: "2026-04-18T06:45:00Z",
};

function renderCard(unit: DistanceUnit, entry: RunningBestEffort | null) {
  // Seed the provider's localStorage so it picks the unit deterministically.
  window.localStorage.setItem("ps_distance_unit", unit);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DistanceUnitProvider>
        <RunningPRCard distanceKey={entry?.distance_key ?? "5k"} distanceLabel="5K" entry={entry} />
      </DistanceUnitProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe("RunningPRCard", () => {
  it("renders pace per-mile under the mi unit", () => {
    renderCard("mi", ENTRY);
    // 236.9 sec/km * 1.609344 = 381.25 sec/mi → 6:21.
    expect(screen.getByText(/6:21 \/mi/)).toBeInTheDocument();
    // Best time headline is unit-independent.
    expect(screen.getByText(/19:45/)).toBeInTheDocument();
  });

  it("renders pace per-km under the km unit", () => {
    renderCard("km", ENTRY);
    // 236.9 sec/km → 3:57.
    expect(screen.getByText(/3:57 \/km/)).toBeInTheDocument();
  });

  it("links 'View activity →' to /running/{activity_id}", () => {
    renderCard("mi", ENTRY);
    const link = screen.getByRole("link", { name: /View activity/ });
    expect(link).toHaveAttribute("href", "/running/act_2c1");
  });

  it("suppresses the expand chevron in the empty-state variant", () => {
    renderCard("mi", null);
    expect(screen.getByText("No record yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /progression/i })).toBeNull();
    // And no "View activity" link in the empty state.
    expect(screen.queryByRole("link", { name: /View activity/ })).toBeNull();
  });
});
