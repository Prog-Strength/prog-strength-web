/// <reference types="vitest/globals" />

import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import type { CalendarEvent } from "./types";
import { buildEventsByDate, localDateKey } from "./merge-events";

// Fixtures are built with local Date(...) so the local-date keys the
// production code computes line up with what the tests expect, regardless
// of the machine timezone.
function iso(day: number, hour: number): string {
  return new Date(2026, 5, day, hour, 0, 0, 0).toISOString();
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w-1",
    user_id: "u-1",
    name: "Logged Lift",
    performed_at: iso(15, 8),
    ended_at: iso(15, 9),
    exercises: [],
    created_at: iso(15, 8),
    updated_at: iso(15, 8),
    personal_records_set: [],
    ...overrides,
  };
}

function makeRun(overrides: Partial<RunningSession> = {}): RunningSession {
  return {
    id: "r-1",
    activity_type: "running",
    ingest_source: "manual_tcx",
    source_activity_id: "src-r-1",
    name: "Logged Run",
    start_time: iso(15, 7),
    distance_meters: 5000,
    raw_distance_meters: 5000,
    environment: "outdoor",
    duration_seconds: 1500,
    avg_pace_sec_per_km: 300,
    best_pace_sec_per_km: 280,
    avg_heart_rate_bpm: 150,
    max_heart_rate_bpm: 170,
    total_calories: 350,
    elevation_gain_meters: 20,
    created_at: iso(15, 7),
    ...overrides,
  };
}

function makePlanned(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  return {
    id: "p-1",
    name: "W7 D1 - Easy Run",
    activity_kind: "run",
    scheduled_start: iso(15, 13),
    scheduled_end: iso(15, 14),
    timezone: "America/Denver",
    status: "planned",
    notes: null,
    completed_session_id: null,
    calendar_detail: null,
    google_event_id: null,
    google_sync_status: null,
    last_sync_error: null,
    run_type: "easy",
    run_details: null,
    exercises: [],
    created_at: iso(15, 12),
    updated_at: iso(15, 12),
    ...overrides,
  };
}

// All fixtures live on June 15, 2026 → one local-date key.
const KEY = localDateKey(new Date(2026, 5, 15));

function eventsOn(map: Map<string, CalendarEvent[]>, key = KEY): CalendarEvent[] {
  return map.get(key) ?? [];
}

describe("buildEventsByDate", () => {
  it("collapses a same-day completed plan + its linked run into one event", () => {
    const run = makeRun({ id: "r-link" });
    const planned = makePlanned({
      status: "completed",
      completed_session_id: "r-link",
    });

    const map = buildEventsByDate([], [run], [planned]);
    const events = eventsOn(map);

    // One merged event — neither a standalone run nor a standalone planned.
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(ev.kind).toBe("completed-planned");
    if (ev.kind !== "completed-planned") throw new Error("unreachable");
    expect(ev.planned.id).toBe("p-1");
    expect(ev.logged.kind).toBe("run");
    if (ev.logged.kind !== "run") throw new Error("unreachable");
    expect(ev.logged.run.id).toBe("r-link");
    // startMs is the logged session's actual start, not the planned slot.
    expect(ev.startMs).toBe(new Date(run.start_time).getTime());
  });

  it("collapses a same-day completed plan + its linked workout into one event", () => {
    const workout = makeWorkout({ id: "w-link" });
    const planned = makePlanned({
      activity_kind: "lift",
      run_type: null,
      status: "completed",
      completed_session_id: "w-link",
    });

    const events = eventsOn(buildEventsByDate([workout], [], [planned]));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("completed-planned");
  });

  it("does NOT collapse when the logged session is on a different day than the plan", () => {
    // Plan scheduled the 15th; the run was actually logged the 16th.
    const run = makeRun({ id: "r-link", start_time: iso(16, 7) });
    const planned = makePlanned({
      status: "completed",
      completed_session_id: "r-link",
      scheduled_start: iso(15, 13),
    });

    const map = buildEventsByDate([], [run], [planned]);
    // Planned stays on the 15th (as a planned event with its completion link).
    const day15 = eventsOn(map, localDateKey(new Date(2026, 5, 15)));
    const day16 = eventsOn(map, localDateKey(new Date(2026, 5, 16)));
    expect(day15.map((e) => e.kind)).toEqual(["planned"]);
    expect(day16.map((e) => e.kind)).toEqual(["run"]);
    // The standalone planned event still learns its logged session's kind
    // (derived by id resolution — the API no longer sends it), so the
    // digest's "View logged run →" link keeps working cross-day.
    const ev = day15[0];
    if (ev.kind !== "planned") throw new Error("unreachable");
    expect(ev.completedSessionKind).toBe("activity");
  });

  it("does NOT collapse when the linked logged session is missing from the window", () => {
    // completed_session_id points at a run not present in the fetched data
    // (e.g. it's in another month). Fall back to a standalone planned event.
    const planned = makePlanned({
      status: "completed",
      completed_session_id: "r-not-here",
    });

    const events = eventsOn(buildEventsByDate([], [], [planned]));
    expect(events.map((e) => e.kind)).toEqual(["planned"]);
    // Out-of-window session → the kind can't be derived; the digest hides
    // its "View logged" link rather than guessing.
    const ev = events[0];
    if (ev.kind !== "planned") throw new Error("unreachable");
    expect(ev.completedSessionKind).toBeUndefined();
  });

  it("leaves unlinked logged sessions and not-yet-completed plans untouched", () => {
    const run = makeRun({ id: "r-solo" });
    const planned = makePlanned({ id: "p-open", status: "planned" });

    const events = eventsOn(buildEventsByDate([], [run], [planned]));
    const kinds = events.map((e) => e.kind).sort();
    expect(kinds).toEqual(["planned", "run"]);
  });

  it("leaves a skipped plan untouched even if it carries a stale completed link", () => {
    const planned = makePlanned({
      status: "skipped",
      completed_session_id: "r-link",
    });
    const run = makeRun({ id: "r-link" });

    const events = eventsOn(buildEventsByDate([], [run], [planned]));
    const kinds = events.map((e) => e.kind).sort();
    expect(kinds).toEqual(["planned", "run"]);
  });

  it("sorts events within a day by start time", () => {
    const run = makeRun({ id: "r-solo", start_time: iso(15, 7) }); // 07:00
    const workout = makeWorkout({ id: "w-solo", performed_at: iso(15, 18) }); // 18:00
    const planned = makePlanned({ id: "p-open", scheduled_start: iso(15, 12) }); // 12:00

    const events = eventsOn(buildEventsByDate([workout], [run], [planned]));
    expect(events.map((e) => e.startMs)).toEqual(
      [...events.map((e) => e.startMs)].sort((a, b) => a - b),
    );
    expect(events[0].kind).toBe("run"); // 07:00 first
  });
});
