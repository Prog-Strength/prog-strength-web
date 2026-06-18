/// <reference types="vitest/globals" />

import { render } from "@testing-library/react";
import type { RunningSession, Workout } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

// Recharts mocked to passthrough/stub divs: ResponsiveContainer renders
// nothing under jsdom's zero width, so we stub it. `Line` exposes its
// `name`/`dataKey` as data-attributes so we can assert both series render.
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children?: React.ReactNode }) => (
    <div data-recharts="LineChart">{children}</div>
  ),
  Line: ({ name, dataKey }: { name?: string; dataKey?: string }) => (
    <div data-recharts="Line" data-name={name} data-key={dataKey} />
  ),
  CartesianGrid: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />,
}));

import { ActivitiesCombinedChart } from "./activities-combined-chart";

// --- fixtures --------------------------------------------------------------

// buildCombined reads only `performed_at` and `ended_at` from a Workout
// (the span ended − performed gives the lifting minutes). Everything else is
// padding to satisfy the type.
function workout(performed_at: string, durationMinutes: number): Workout {
  const ended_at = new Date(
    new Date(performed_at).getTime() + durationMinutes * 60_000,
  ).toISOString();
  return {
    id: performed_at,
    user_id: "u1",
    performed_at,
    ended_at,
    exercises: [],
    personal_records_set: [],
    created_at: performed_at,
    updated_at: performed_at,
  } as Workout;
}

// buildCombined reads only `start_time` and `duration_seconds` from a
// RunningSession (running minutes = duration_seconds / 60).
function session(start_time: string, durationMinutes: number): RunningSession {
  return {
    id: start_time,
    start_time,
    duration_seconds: durationMinutes * 60,
    distance_meters: 5000,
  } as RunningSession;
}

// Anchor fixtures to "now" so they land inside the days=30 window regardless
// of when the suite runs.
const now = Date.now();
const daysAgo = (n: number) => new Date(now - n * 24 * 60 * 60 * 1000).toISOString();

describe("ActivitiesCombinedChart — dual single-stroke lines", () => {
  it("renders both Lifting and Running lines for a non-empty window", () => {
    const { container, queryByText } = render(
      <ActivitiesCombinedChart
        workouts={[workout(daysAgo(10), 60)]}
        sessions={[session(daysAgo(3), 30)]}
        days={30}
        truncated={false}
        fetchLimit={100}
      />,
    );

    expect(queryByText("No activity in this window.")).not.toBeInTheDocument();
    expect(container.querySelector('[data-name="Lifting"]')).toBeInTheDocument();
    expect(container.querySelector('[data-name="Running"]')).toBeInTheDocument();
    expect(container.querySelector('[data-key="workout_minutes"]')).toBeInTheDocument();
    expect(container.querySelector('[data-key="running_minutes"]')).toBeInTheDocument();
  });

  it("shows the empty state and no lines when every week is all-zero", () => {
    const { container, getByText } = render(
      <ActivitiesCombinedChart
        workouts={[]}
        sessions={[]}
        days={30}
        truncated={false}
        fetchLimit={100}
      />,
    );

    expect(getByText("No activity in this window.")).toBeInTheDocument();
    expect(container.querySelector('[data-recharts="Line"]')).not.toBeInTheDocument();
  });

  it("still renders both lines when one modality has a rest (zero) week", () => {
    // Lifting only — running stays at zero across the whole window. The
    // overlay must keep both lines so the running series doesn't vanish.
    const { container, queryByText } = render(
      <ActivitiesCombinedChart
        workouts={[workout(daysAgo(20), 45), workout(daysAgo(5), 90)]}
        sessions={[]}
        days={30}
        truncated={false}
        fetchLimit={100}
      />,
    );

    expect(queryByText("No activity in this window.")).not.toBeInTheDocument();
    expect(container.querySelector('[data-name="Lifting"]')).toBeInTheDocument();
    expect(container.querySelector('[data-name="Running"]')).toBeInTheDocument();
  });

  it("shows a loading state while either input is still null", () => {
    const { getByText, container } = render(
      <ActivitiesCombinedChart
        workouts={null}
        sessions={[]}
        days={30}
        truncated={false}
        fetchLimit={100}
      />,
    );

    expect(getByText("Loading…")).toBeInTheDocument();
    expect(container.querySelector('[data-recharts="Line"]')).not.toBeInTheDocument();
  });
});
