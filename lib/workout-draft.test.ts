/// <reference types="vitest/globals" />

import type { Workout } from "@/lib/api";
import {
  addExercise,
  addSet,
  buildPrefillMap,
  createSession,
  createSuperset,
  defaultSessionName,
  defaultSet,
  isSessionSaveable,
  logSupersetRound,
  nextSupersetGroup,
  removeExercise,
  removeSet,
  reorderExercise,
  sessionToPayload,
  setExerciseNotes,
  setName,
  setNotes,
  ungroupSuperset,
  updateSet,
  type ActiveSession,
  type DraftSet,
} from "./workout-draft";

// --- helpers ---------------------------------------------------------------

function baseSession(): ActiveSession {
  return {
    name: "Test",
    performed_at: "2026-06-14T10:00:00.000Z",
    exercises: [],
    restTimer: null,
    restDefaultSec: 90,
  };
}

const lbSet = (reps: number, weight: number): DraftSet => ({ reps, weight, unit: "lb" });

function workout(over: Partial<Workout> = {}): Workout {
  return {
    id: "w",
    user_id: "u",
    performed_at: "2026-06-01T10:00:00.000Z",
    exercises: [],
    created_at: "",
    updated_at: "",
    personal_records_set: [],
    ...over,
  };
}

// --- defaultSessionName / createSession ------------------------------------

describe("defaultSessionName", () => {
  it("formats as 'Workout — Wkday, Mon D'", () => {
    // Use a UTC-noon date so the local-date parts are stable across zones.
    const d = new Date("2026-06-14T12:00:00.000Z");
    const name = defaultSessionName(d);
    expect(name).toMatch(/^Workout — [A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}$/);
    expect(name).toContain(`${d.getDate()}`);
  });
});

describe("createSession", () => {
  it("stamps performed_at from the given date and uses the default name", () => {
    const now = new Date("2026-06-14T12:00:00.000Z");
    const s = createSession(now);
    expect(s.performed_at).toBe(now.toISOString());
    expect(s.name).toBe(defaultSessionName(now));
    expect(s.exercises).toEqual([]);
    expect(s.restTimer).toBeNull();
    expect(s.restDefaultSec).toBe(90);
  });
});

describe("defaultSet", () => {
  it("returns a zeroed set in the given unit", () => {
    expect(defaultSet("kg")).toEqual({ reps: 0, weight: 0, unit: "kg" });
  });
});

// --- exercise add/remove/reorder -------------------------------------------

describe("exercise mutators", () => {
  it("addExercise appends with no sets by default", () => {
    const s = addExercise(baseSession(), "bench");
    expect(s.exercises).toHaveLength(1);
    expect(s.exercises[0]).toEqual({ exercise_id: "bench", superset_group: null, sets: [] });
  });

  it("addExercise seeds a first set when provided", () => {
    const s = addExercise(baseSession(), "bench", lbSet(5, 135));
    expect(s.exercises[0].sets).toEqual([lbSet(5, 135)]);
  });

  it("does not mutate the input session", () => {
    const base = baseSession();
    addExercise(base, "bench");
    expect(base.exercises).toHaveLength(0);
  });

  it("removeExercise drops the indexed exercise", () => {
    let s = addExercise(baseSession(), "bench");
    s = addExercise(s, "squat");
    s = removeExercise(s, 0);
    expect(s.exercises.map((e) => e.exercise_id)).toEqual(["squat"]);
  });

  it("reorderExercise moves an exercise from->to", () => {
    let s = addExercise(baseSession(), "a");
    s = addExercise(s, "b");
    s = addExercise(s, "c");
    s = reorderExercise(s, 0, 2);
    expect(s.exercises.map((e) => e.exercise_id)).toEqual(["b", "c", "a"]);
  });

  it("reorderExercise is a no-op for out-of-range or equal indices", () => {
    let s = addExercise(baseSession(), "a");
    s = addExercise(s, "b");
    expect(reorderExercise(s, 1, 1)).toBe(s);
    expect(reorderExercise(s, -1, 0)).toBe(s);
    expect(reorderExercise(s, 0, 5)).toBe(s);
  });
});

// --- set add/update/remove --------------------------------------------------

describe("set mutators", () => {
  it("addSet appends a set to an exercise", () => {
    let s = addExercise(baseSession(), "bench");
    s = addSet(s, 0, lbSet(5, 135));
    s = addSet(s, 0, lbSet(5, 145));
    expect(s.exercises[0].sets).toEqual([lbSet(5, 135), lbSet(5, 145)]);
  });

  it("updateSet patches one set in place", () => {
    let s = addExercise(baseSession(), "bench", lbSet(5, 135));
    s = updateSet(s, 0, 0, { weight: 155 });
    expect(s.exercises[0].sets[0]).toEqual(lbSet(5, 155));
  });

  it("removeSet drops the indexed set", () => {
    let s = addExercise(baseSession(), "bench");
    s = addSet(s, 0, lbSet(5, 135));
    s = addSet(s, 0, lbSet(5, 145));
    s = removeSet(s, 0, 0);
    expect(s.exercises[0].sets).toEqual([lbSet(5, 145)]);
  });
});

// --- supersets --------------------------------------------------------------

describe("supersets", () => {
  it("nextSupersetGroup is 1 when none exist", () => {
    expect(nextSupersetGroup(baseSession())).toBe(1);
  });

  it("createSuperset assigns a shared monotonic group", () => {
    let s = addExercise(baseSession(), "a");
    s = addExercise(s, "b");
    s = addExercise(s, "c");
    s = createSuperset(s, [0, 1]);
    expect(s.exercises[0].superset_group).toBe(1);
    expect(s.exercises[1].superset_group).toBe(1);
    expect(s.exercises[2].superset_group).toBeNull();
    // nextSupersetGroup increments past the assigned group.
    expect(nextSupersetGroup(s)).toBe(2);
    s = createSuperset(s, [2, 0]);
    expect(s.exercises[2].superset_group).toBe(2);
  });

  it("createSuperset is a no-op for fewer than 2 indices", () => {
    const s = addExercise(baseSession(), "a");
    expect(createSuperset(s, [0])).toBe(s);
  });

  it("ungroupSuperset clears all members of a group", () => {
    let s = addExercise(baseSession(), "a");
    s = addExercise(s, "b");
    s = createSuperset(s, [0, 1]);
    s = ungroupSuperset(s, 1);
    expect(s.exercises.every((e) => e.superset_group === null)).toBe(true);
  });

  it("logSupersetRound appends one set per member", () => {
    let s = addExercise(baseSession(), "a", lbSet(8, 50));
    s = addExercise(s, "b", lbSet(10, 30));
    s = createSuperset(s, [0, 1]);
    s = logSupersetRound(s, 1, { 0: lbSet(8, 55), 1: lbSet(10, 35) });
    expect(s.exercises[0].sets).toEqual([lbSet(8, 50), lbSet(8, 55)]);
    expect(s.exercises[1].sets).toEqual([lbSet(10, 30), lbSet(10, 35)]);
  });

  it("logSupersetRound defaults from the previous set when not provided", () => {
    let s = addExercise(baseSession(), "a", lbSet(8, 50));
    s = addExercise(s, "b", lbSet(10, 30));
    s = createSuperset(s, [0, 1]);
    s = logSupersetRound(s, 1, {});
    expect(s.exercises[0].sets).toEqual([lbSet(8, 50), lbSet(8, 50)]);
    expect(s.exercises[1].sets).toEqual([lbSet(10, 30), lbSet(10, 30)]);
  });

  it("logSupersetRound tolerates members with differing set counts", () => {
    let s = addExercise(baseSession(), "a", lbSet(8, 50));
    s = addExercise(s, "b"); // no sets yet
    s = createSuperset(s, [0, 1]);
    s = logSupersetRound(s, 1, { 0: lbSet(8, 55) });
    expect(s.exercises[0].sets).toHaveLength(2);
    // member b had no prior set; falls back to a default set.
    expect(s.exercises[1].sets).toEqual([defaultSet("lb")]);
  });

  it("logSupersetRound only touches the named group", () => {
    let s = addExercise(baseSession(), "a", lbSet(8, 50));
    s = addExercise(s, "b", lbSet(10, 30));
    s = createSuperset(s, [0, 1]);
    s = addExercise(s, "c", lbSet(5, 100));
    s = logSupersetRound(s, 1, {});
    expect(s.exercises[2].sets).toHaveLength(1);
  });
});

// --- notes ------------------------------------------------------------------

describe("notes mutators", () => {
  it("setName / setNotes / setExerciseNotes update the right field", () => {
    let s = setName(baseSession(), "Leg Day");
    s = setNotes(s, "felt strong");
    s = addExercise(s, "squat");
    s = setExerciseNotes(s, 0, "paused reps");
    expect(s.name).toBe("Leg Day");
    expect(s.notes).toBe("felt strong");
    expect(s.exercises[0].notes).toBe("paused reps");
  });
});

// --- sessionToPayload -------------------------------------------------------

describe("sessionToPayload", () => {
  it("derives order from array index and drops empty optionals", () => {
    let s = baseSession();
    s = addExercise(s, "a", lbSet(5, 100));
    s = addExercise(s, "b", lbSet(5, 200));
    const payload = sessionToPayload(s, undefined);
    expect(payload.performed_at).toBe(s.performed_at);
    expect(payload.name).toBe("Test");
    expect(payload.ended_at).toBeUndefined();
    expect(payload.notes).toBeUndefined();
    expect(payload.exercises).toHaveLength(2);
    expect(payload.exercises[0].exercise_id).toBe("a");
    expect(payload.exercises[1].exercise_id).toBe("b");
    // superset_group / notes omitted when not present.
    expect("superset_group" in payload.exercises[0]).toBe(false);
    expect("notes" in payload.exercises[0]).toBe(false);
  });

  it("omits zero-set exercises", () => {
    let s = baseSession();
    s = addExercise(s, "a", lbSet(5, 100));
    s = addExercise(s, "b"); // no sets
    const payload = sessionToPayload(s, undefined);
    expect(payload.exercises.map((e) => e.exercise_id)).toEqual(["a"]);
  });

  it("includes superset_group and notes when present", () => {
    let s = baseSession();
    s = addExercise(s, "a", lbSet(5, 100));
    s = addExercise(s, "b", lbSet(5, 100));
    s = createSuperset(s, [0, 1]);
    s = setExerciseNotes(s, 0, "tempo");
    const payload = sessionToPayload(s, undefined);
    expect(payload.exercises[0].superset_group).toBe(1);
    expect(payload.exercises[0].notes).toBe("tempo");
  });

  it("includes ended_at and notes only when provided", () => {
    let s = setNotes(baseSession(), "good session");
    s = addExercise(s, "a", lbSet(5, 100));
    const payload = sessionToPayload(s, "2026-06-14T11:00:00.000Z");
    expect(payload.ended_at).toBe("2026-06-14T11:00:00.000Z");
    expect(payload.notes).toBe("good session");
  });
});

// --- isSessionSaveable ------------------------------------------------------

describe("isSessionSaveable", () => {
  it("rejects an empty session", () => {
    expect(isSessionSaveable(baseSession())).toBe(false);
  });

  it("rejects exercises with only zero sets", () => {
    const s = addExercise(baseSession(), "a");
    expect(isSessionSaveable(s)).toBe(false);
  });

  it("rejects non-positive reps", () => {
    const s = addExercise(baseSession(), "a", lbSet(0, 100));
    expect(isSessionSaveable(s)).toBe(false);
  });

  it("rejects negative weight", () => {
    const s = addExercise(baseSession(), "a", lbSet(5, -1));
    expect(isSessionSaveable(s)).toBe(false);
  });

  it("accepts a valid session (bodyweight zero weight allowed)", () => {
    const s = addExercise(baseSession(), "a", lbSet(5, 0));
    expect(isSessionSaveable(s)).toBe(true);
  });
});

// --- buildPrefillMap --------------------------------------------------------

describe("buildPrefillMap", () => {
  it("picks the most-recent set per exercise across workouts", () => {
    const older = workout({
      performed_at: "2026-06-01T10:00:00.000Z",
      exercises: [
        { exercise_id: "bench", order: 0, sets: [{ reps: 5, weight: 135, unit: "lb" }] },
        { exercise_id: "squat", order: 1, sets: [{ reps: 5, weight: 225, unit: "lb" }] },
      ],
    });
    const newer = workout({
      performed_at: "2026-06-10T10:00:00.000Z",
      exercises: [
        {
          exercise_id: "bench",
          order: 0,
          sets: [
            { reps: 5, weight: 145, unit: "lb" },
            { reps: 3, weight: 155, unit: "lb" },
          ],
        },
      ],
    });
    // Pass in non-sorted order to confirm internal sort by performed_at.
    const map = buildPrefillMap([older, newer]);
    // bench comes from the newer workout's last set.
    expect(map.get("bench")).toEqual({ reps: 3, weight: 155, unit: "lb" });
    // squat only exists in the older workout.
    expect(map.get("squat")).toEqual({ reps: 5, weight: 225, unit: "lb" });
  });

  it("returns an empty map for no workouts", () => {
    expect(buildPrefillMap([]).size).toBe(0);
  });
});
