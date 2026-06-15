/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { DistanceUnitProvider } from "@/lib/distance-unit-context";
import type { RunningSession, Workout } from "@/lib/api";
import type { CalendarEvent } from "./types";
import { DayDigest } from "./day-digest";

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w-1",
    user_id: "u-1",
    name: "Upper 1",
    performed_at: "2026-06-08T17:00:00Z",
    exercises: [],
    created_at: "2026-06-08T18:00:00Z",
    updated_at: "2026-06-08T18:00:00Z",
    personal_records_set: [],
    ...overrides,
  };
}

function makeRun(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "r-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-1",
    name: "Morning Run",
    start_time: "2026-06-08T07:00:00Z",
    distance_meters: 5000,
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 280,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 168,
    total_calories: 320,
    elevation_gain_meters: 40,
    created_at: "2026-06-08T08:00:00Z",
    ...overrides,
  };
}

function workoutEvent(workout: Workout): CalendarEvent {
  return { kind: "workout", startMs: new Date(workout.performed_at).getTime(), workout };
}

function runEvent(run: RunningSession): CalendarEvent {
  return { kind: "run", startMs: new Date(run.start_time).getTime(), run };
}

function renderDigest(date: Date, events: CalendarEvent[], steps?: number | null) {
  return render(
    <DistanceUnitProvider>
      <DayDigest
        date={date}
        events={events}
        steps={steps}
        exerciseMap={new Map()}
        onNavigateWorkout={() => {}}
        onNavigateRun={() => {}}
        onPlanWorkout={() => {}}
      />
    </DistanceUnitProvider>,
  );
}

describe("DayDigest", () => {
  it("renders the long-form date header", () => {
    renderDigest(new Date(2026, 5, 8), []);
    expect(screen.getByText("Monday, June 8, 2026")).toBeInTheDocument();
  });

  it("renders one banner per event", () => {
    const events = [runEvent(makeRun()), workoutEvent(makeWorkout())];
    renderDigest(new Date(2026, 5, 8), events);

    expect(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(screen.getByText("Upper 1")).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(2);
  });

  it("renders the empty state when there are no events and no steps", () => {
    renderDigest(new Date(2026, 5, 8), []);
    expect(screen.getByText(/No activities on/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Plan a workout/ })).toBeInTheDocument();
  });

  it("shows the day's step count when steps were logged", () => {
    renderDigest(new Date(2026, 5, 8), [], 8432);
    expect(screen.getByTestId("steps-banner")).toHaveTextContent("8,432 steps");
    // A steps-only day is not "empty".
    expect(screen.queryByText(/No activities on/)).not.toBeInTheDocument();
  });

  it("shows steps alongside activity banners", () => {
    renderDigest(new Date(2026, 5, 8), [runEvent(makeRun())], 12000);
    expect(screen.getByText("Morning Run")).toBeInTheDocument();
    expect(screen.getByTestId("steps-banner")).toHaveTextContent("12,000 steps");
  });

  it("ignores a zero or missing step count", () => {
    renderDigest(new Date(2026, 5, 8), [runEvent(makeRun())], 0);
    expect(screen.queryByText(/steps/)).not.toBeInTheDocument();
  });

  it("renders banners in start-time order even when passed reversed", () => {
    // Run starts 07:00, workout starts 17:00. Pass them reversed (later
    // first) and assert the earlier-start run still renders before the
    // workout — DayDigest sorts defensively.
    const run = makeRun({ name: "Morning Run", start_time: "2026-06-08T07:00:00Z" });
    const workout = makeWorkout({ name: "Evening Lift", performed_at: "2026-06-08T17:00:00Z" });
    renderDigest(new Date(2026, 5, 8), [workoutEvent(workout), runEvent(run)]);

    const runTitle = screen.getByText("Morning Run");
    const workoutTitle = screen.getByText("Evening Lift");
    expect(
      runTitle.compareDocumentPosition(workoutTitle) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
