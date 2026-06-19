/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PersonalRecord } from "@/lib/api";

const historyMock = vi.hoisted(() =>
  vi.fn(async () => ({
    exercise_id: "barbell-bench-press",
    exercise_name: "Barbell Bench Press",
    unit: "lb",
    points: [
      { workout_id: "w1", performed_at: "2026-01-01T00:00:00Z", estimated_1rm: 300 },
      { workout_id: "w2", performed_at: "2026-03-01T00:00:00Z", estimated_1rm: 320 },
    ],
  })),
);

vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getExerciseOneRMHistory: historyMock,
}));

import { getExerciseOneRMHistory } from "@/lib/api";
import { LiftsView } from "./LiftsView";

const READY: PersonalRecord = {
  exercise_id: "barbell-bench-press",
  exercise_name: "Barbell Bench Press",
  workout_id: "wk_1",
  weight: 300,
  reps: 3,
  unit: "lb",
  achieved_at: "2026-04-01T00:00:00Z",
  current_estimated_1rm: 360,
  estimated_1rm_unit: "lb",
  recent_estimated_1rm_points: [300, 330, 360],
};
const FRESH: PersonalRecord = {
  exercise_id: "back-squat",
  exercise_name: "Back Squat",
  workout_id: "wk_2",
  weight: 405,
  reps: 2,
  unit: "lb",
  achieved_at: "2026-04-15T00:00:00Z",
  current_estimated_1rm: 410,
  estimated_1rm_unit: "lb",
  recent_estimated_1rm_points: [400, 405, 410],
};
const NO_SERIES: PersonalRecord = {
  ...FRESH,
  exercise_id: "deadlift",
  exercise_name: "Deadlift",
  recent_estimated_1rm_points: null,
};
const UNTESTED: PersonalRecord = {
  exercise_id: "overhead-press",
  exercise_name: "Overhead Press",
  workout_id: null,
  weight: null,
  reps: null,
  unit: null,
  achieved_at: null,
  current_estimated_1rm: null,
  estimated_1rm_unit: null,
  recent_estimated_1rm_points: null,
};

function renderView(records: PersonalRecord[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <LiftsView records={records} isPending={false} error={null} />
    </QueryClientProvider>,
  );
}

beforeEach(() => historyMock.mockClear());

describe("LiftsView (compact dashboard)", () => {
  it("renders a tile per record including the dashed untested tile", () => {
    renderView([READY, UNTESTED]);
    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Overhead Press")).toBeInTheDocument();
    expect(screen.getByText("untested")).toBeInTheDocument();
  });
  it("omits the spark when the series is null", () => {
    const { container } = renderView([NO_SERIES]);
    expect(container.querySelector("polyline")).toBeNull();
  });
  it("renders a spark when the series is present", () => {
    const { container } = renderView([READY]);
    expect(container.querySelector("polyline")).not.toBeNull();
  });
  it("shows the +delta for a due lift", () => {
    renderView([READY]);
    expect(screen.getByText(/\+60/)).toBeInTheDocument();
  });
  it("expands a tile and fires exactly one history query, reusing cache on re-expand", async () => {
    renderView([READY]);
    fireEvent.click(screen.getByRole("button", { name: /Barbell Bench Press/ }));
    await waitFor(() => expect(getExerciseOneRMHistory).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("link", { name: /View workout/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Barbell Bench Press/ }));
    fireEvent.click(screen.getByRole("button", { name: /Barbell Bench Press/ }));
    await waitFor(() => expect(getExerciseOneRMHistory).toHaveBeenCalledTimes(1));
  });
  it("does not make the untested tile expandable", () => {
    renderView([UNTESTED]);
    expect(screen.queryByRole("button", { name: /Overhead Press/ })).toBeNull();
  });
  it("renders the skeleton grid while pending", () => {
    const { container } = render(
      <QueryClientProvider client={new QueryClient()}>
        <LiftsView records={undefined} isPending={true} error={null} />
      </QueryClientProvider>,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });
  it("shows the empty message when there are no records", () => {
    renderView([]);
    expect(screen.getByText("No headline lifts configured.")).toBeInTheDocument();
  });
});
