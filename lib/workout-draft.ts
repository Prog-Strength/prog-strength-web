import type { PlannedWorkout, WorkoutPayload, WorkoutSet, Workout } from "@/lib/api";

export type DraftSet = { reps: number; weight: number; unit: "lb" | "kg" };

export type DraftExercise = {
  exercise_id: string; // slug from the catalog
  superset_group: number | null;
  sets: DraftSet[];
  notes?: string;
};

export type ActiveSession = {
  name: string;
  performed_at: string; // RFC3339, stamped at start
  notes?: string;
  exercises: DraftExercise[]; // order is array order
  // The planned workout this session was started from, if any. Carried so
  // that on save the logged workout can be linked back to the plan
  // (completePlannedWorkout). Client-only, never part of the workout payload.
  plannedWorkoutId?: string | null;
  // client-only, never sent on save:
  restTimer?: { startedAt: string; durationSec: number } | null;
  restDefaultSec: number; // user-configurable default rest duration
};

/** "Workout — Sat, Jun 14" — mirrors the server's default-naming convention. */
export function defaultSessionName(now: Date): string {
  const weekday = now.toLocaleDateString("en-US", { weekday: "short" });
  const mon = now.toLocaleDateString("en-US", { month: "short" });
  return `Workout — ${weekday}, ${mon} ${now.getDate()}`;
}

/**
 * Start a fresh session. `init` lets a caller seed it — used when starting
 * from a planned workout: the plan's name + prefilled exercises become the
 * session's starting point, and `plannedWorkoutId` is carried so the saved
 * workout can be linked back to the plan. Omitting `init` yields the plain
 * empty session the Activities "Start workout" button creates.
 */
export function createSession(
  now: Date,
  init?: { name?: string; exercises?: DraftExercise[]; plannedWorkoutId?: string | null },
): ActiveSession {
  return {
    name: init?.name?.trim() ? init.name.trim() : defaultSessionName(now),
    performed_at: now.toISOString(),
    exercises: init?.exercises ?? [],
    plannedWorkoutId: init?.plannedWorkoutId ?? null,
    restTimer: null,
    restDefaultSec: 90,
  };
}

export function defaultSet(unit: "lb" | "kg"): DraftSet {
  return { reps: 0, weight: 0, unit };
}

// --- pure mutators (return a new session; never mutate the input) ---

export function addExercise(
  s: ActiveSession,
  exercise_id: string,
  firstSet?: DraftSet,
): ActiveSession {
  return {
    ...s,
    exercises: [
      ...s.exercises,
      { exercise_id, superset_group: null, sets: firstSet ? [firstSet] : [] },
    ],
  };
}

export function removeExercise(s: ActiveSession, idx: number): ActiveSession {
  return { ...s, exercises: s.exercises.filter((_, i) => i !== idx) };
}

export function reorderExercise(s: ActiveSession, from: number, to: number): ActiveSession {
  if (from === to || from < 0 || to < 0 || from >= s.exercises.length || to >= s.exercises.length)
    return s;
  const next = [...s.exercises];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return { ...s, exercises: next };
}

export function addSet(s: ActiveSession, exIdx: number, set: DraftSet): ActiveSession {
  return mapExercise(s, exIdx, (ex) => ({ ...ex, sets: [...ex.sets, set] }));
}

export function updateSet(
  s: ActiveSession,
  exIdx: number,
  setIdx: number,
  patch: Partial<DraftSet>,
): ActiveSession {
  return mapExercise(s, exIdx, (ex) => ({
    ...ex,
    sets: ex.sets.map((st, i) => (i === setIdx ? { ...st, ...patch } : st)),
  }));
}

export function removeSet(s: ActiveSession, exIdx: number, setIdx: number): ActiveSession {
  return mapExercise(s, exIdx, (ex) => ({ ...ex, sets: ex.sets.filter((_, i) => i !== setIdx) }));
}

/** Assign a fresh monotonic superset_group to the given exercise indices (2+). */
export function createSuperset(s: ActiveSession, idxs: number[]): ActiveSession {
  if (idxs.length < 2) return s;
  const group = nextSupersetGroup(s);
  const set = new Set(idxs);
  return {
    ...s,
    exercises: s.exercises.map((ex, i) => (set.has(i) ? { ...ex, superset_group: group } : ex)),
  };
}

/** Clear superset_group back to null for all members of a group. */
export function ungroupSuperset(s: ActiveSession, group: number): ActiveSession {
  return {
    ...s,
    exercises: s.exercises.map((ex) =>
      ex.superset_group === group ? { ...ex, superset_group: null } : ex,
    ),
  };
}

/** Append one set to each member of the group (a "round"). Defaults each member's set from its previous set. */
export function logSupersetRound(
  s: ActiveSession,
  group: number,
  sets: Record<number, DraftSet>,
): ActiveSession {
  return {
    ...s,
    exercises: s.exercises.map((ex, i) => {
      if (ex.superset_group !== group) return ex;
      const next = sets[i] ?? ex.sets[ex.sets.length - 1] ?? defaultSet(ex.sets[0]?.unit ?? "lb");
      return { ...ex, sets: [...ex.sets, next] };
    }),
  };
}

export function setName(s: ActiveSession, name: string): ActiveSession {
  return { ...s, name };
}
export function setNotes(s: ActiveSession, notes: string): ActiveSession {
  return { ...s, notes };
}
export function setExerciseNotes(s: ActiveSession, exIdx: number, notes: string): ActiveSession {
  return mapExercise(s, exIdx, (ex) => ({ ...ex, notes }));
}

/** Monotonic within the session: 1 + current max group, or 1 if none. */
export function nextSupersetGroup(s: ActiveSession): number {
  const groups = s.exercises.map((e) => e.superset_group).filter((g): g is number => g !== null);
  return groups.length ? Math.max(...groups) + 1 : 1;
}

/**
 * Serialize a session to the create-workout body. `endedAt` is stamped at
 * save unless the user overrode it on the review screen (pass the override
 * RFC3339 string, or undefined to omit). Drops empty optional fields like
 * the WorkoutModal does, and skips exercises with zero sets.
 */
export function sessionToPayload(s: ActiveSession, endedAt: string | undefined): WorkoutPayload {
  const payload: WorkoutPayload = {
    performed_at: s.performed_at,
    exercises: s.exercises
      .filter((ex) => ex.sets.length > 0 && ex.exercise_id)
      .map((ex) => ({
        exercise_id: ex.exercise_id,
        ...(ex.superset_group !== null && { superset_group: ex.superset_group }),
        ...(ex.notes && { notes: ex.notes }),
        sets: ex.sets.map(
          (st) => ({ reps: st.reps, weight: st.weight, unit: st.unit }) as WorkoutSet,
        ),
      })),
  };
  if (s.name) payload.name = s.name;
  if (endedAt) payload.ended_at = endedAt;
  if (s.notes) payload.notes = s.notes;
  return payload;
}

export function isSessionSaveable(s: ActiveSession): boolean {
  const exs = s.exercises.filter((ex) => ex.sets.length > 0 && ex.exercise_id);
  if (exs.length === 0) return false;
  for (const ex of exs) {
    for (const st of ex.sets) {
      if (!Number.isFinite(st.reps) || st.reps <= 0) return false;
      if (!Number.isFinite(st.weight) || st.weight < 0) return false;
    }
  }
  return true;
}

/**
 * Build a map of exercise_id → most-recent logged set, from a page of recent
 * workouts (newest first by performed_at). Used for last-time prefill. Read-
 * only convenience; callers degrade silently if the source fetch failed.
 */
export function buildPrefillMap(workouts: Workout[]): Map<string, DraftSet> {
  const sorted = [...workouts].sort((a, b) => b.performed_at.localeCompare(a.performed_at));
  const map = new Map<string, DraftSet>();
  for (const w of sorted) {
    for (const ex of w.exercises) {
      if (map.has(ex.exercise_id)) continue;
      const last = ex.sets[ex.sets.length - 1];
      if (last) map.set(ex.exercise_id, { reps: last.reps, weight: last.weight, unit: last.unit });
    }
  }
  return map;
}

function mapExercise(
  s: ActiveSession,
  idx: number,
  fn: (ex: DraftExercise) => DraftExercise,
): ActiveSession {
  return { ...s, exercises: s.exercises.map((ex, i) => (i === idx ? fn(ex) : ex)) };
}

/**
 * Map a planned workout's agenda into live-session draft exercises, so
 * "Start workout" opens the session pre-loaded with the plan. Each target
 * set becomes a starting set: target reps/weight seed the inputs, an unset
 * target weight starts at 0 (the user fills it in while lifting). Planned
 * workouts have no supersets, so every exercise is standalone. Exercises
 * and sets are emitted in their stored order_index order.
 */
export function plannedToDraftExercises(plan: PlannedWorkout): DraftExercise[] {
  return plan.exercises
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((ex) => ({
      exercise_id: ex.exercise_id,
      superset_group: null,
      ...(ex.notes ? { notes: ex.notes } : {}),
      sets: ex.sets
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((s) => ({
          reps: s.target_reps ?? 0,
          weight: s.target_weight ?? 0,
          unit: s.unit ?? "lb",
        })),
    }));
}
