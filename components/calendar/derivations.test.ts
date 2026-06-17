import { describe, it, expect } from "vitest";
import type { CalendarEvent } from "@/components/calendar/types";
import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import { disciplineOf, chipStateOf, isTrainedDay, monthConsistencyCopy } from "./derivations";

const workout = { id: "w1", performed_at: "2026-06-15T08:00:00Z" } as unknown as Workout;
const run = { id: "r1", start_time: "2026-06-15T07:00:00Z" } as unknown as RunningSession;
const liftPlan = {
  id: "p1",
  activity_kind: "lift",
  scheduled_start: "2026-06-15T17:00:00Z",
} as unknown as PlannedWorkout;
const runPlan = {
  id: "p2",
  activity_kind: "run",
  scheduled_start: "2026-06-15T17:00:00Z",
} as unknown as PlannedWorkout;

const evWorkout: CalendarEvent = { kind: "workout", startMs: 1, workout };
const evRun: CalendarEvent = { kind: "run", startMs: 1, run };
const evPlannedLift: CalendarEvent = { kind: "planned", startMs: 1, planned: liftPlan };
const evPlannedRun: CalendarEvent = { kind: "planned", startMs: 1, planned: runPlan };
const evCompletedLift: CalendarEvent = {
  kind: "completed-planned",
  startMs: 1,
  planned: liftPlan,
  logged: { kind: "workout", workout },
};
const evCompletedRun: CalendarEvent = {
  kind: "completed-planned",
  startMs: 1,
  planned: runPlan,
  logged: { kind: "run", run },
};

describe("disciplineOf", () => {
  it("maps logged workouts and run-fulfilled plans to the right discipline", () => {
    expect(disciplineOf(evWorkout)).toBe("lift");
    expect(disciplineOf(evRun)).toBe("run");
    expect(disciplineOf(evPlannedLift)).toBe("lift");
    expect(disciplineOf(evPlannedRun)).toBe("run");
    expect(disciplineOf(evCompletedLift)).toBe("lift");
    expect(disciplineOf(evCompletedRun)).toBe("run");
  });
});

describe("chipStateOf", () => {
  it("treats planned as planned and everything else (including completed-planned) as done", () => {
    expect(chipStateOf(evPlannedLift)).toBe("planned");
    expect(chipStateOf(evPlannedRun)).toBe("planned");
    expect(chipStateOf(evWorkout)).toBe("done");
    expect(chipStateOf(evRun)).toBe("done");
    expect(chipStateOf(evCompletedLift)).toBe("done");
    expect(chipStateOf(evCompletedRun)).toBe("done");
  });
});

describe("isTrainedDay", () => {
  it("is true when any event is done, false for empty or planned-only days", () => {
    expect(isTrainedDay([])).toBe(false);
    expect(isTrainedDay([evPlannedLift])).toBe(false);
    expect(isTrainedDay([evPlannedLift, evWorkout])).toBe(true);
    expect(isTrainedDay([evCompletedRun])).toBe(true);
  });
});

describe("monthConsistencyCopy", () => {
  it("greets by name and states trained days honestly", () => {
    expect(monthConsistencyCopy("Sam", 9)).toBe(
      "Nice work, Sam — you've trained 9 days this month.",
    );
    expect(monthConsistencyCopy("Sam", 1)).toBe(
      "Nice work, Sam — you've trained 1 day this month.",
    );
  });
  it("reads encouragingly, not scolding, for a zero-day month", () => {
    expect(monthConsistencyCopy("Sam", 0)).toBe("Welcome back, Sam — a fresh month to build on.");
  });
  it("falls back to a neutral greeting when no name is available", () => {
    expect(monthConsistencyCopy(null, 5)).toBe("Nice work — you've trained 5 days this month.");
    expect(monthConsistencyCopy(null, 0)).toBe("Welcome back — a fresh month to build on.");
  });
});
