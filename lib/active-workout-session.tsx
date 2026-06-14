"use client";

/**
 * Root-mounted owner of the live workout draft.
 *
 * Holds a single `ActiveSession | null` in state, mirrors every mutation
 * to `localStorage` (key `ps_active_workout_session`) so the draft
 * survives in-app navigation and a same-device restart, and exposes the
 * full action surface (wrapping the pure mutators in `lib/workout-draft`)
 * plus `start`/`discard`/`save`. The `session !== null` boolean drives the
 * app-wide "workout in progress" indicator.
 *
 * The draft is local-only until `save()` fires the single `POST /workouts`;
 * on success the draft is cleared, on failure the error is rethrown so the
 * caller can surface it and the draft is preserved.
 *
 * Mounted inside `ProfileProvider` (in `app/(app)/layout.tsx`) so it can
 * read `weight_unit` for new-set defaults; tolerates a null profile by
 * falling back to "lb".
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createWorkout, listWorkouts, type Workout } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { useProfile } from "@/lib/profile-context";
import {
  addExercise as addExerciseMut,
  addSet as addSetMut,
  buildPrefillMap,
  createSession,
  createSuperset as createSupersetMut,
  defaultSet,
  logSupersetRound as logSupersetRoundMut,
  removeExercise as removeExerciseMut,
  removeSet as removeSetMut,
  reorderExercise as reorderExerciseMut,
  sessionToPayload,
  setExerciseNotes as setExerciseNotesMut,
  setName as setNameMut,
  setNotes as setNotesMut,
  ungroupSuperset as ungroupSupersetMut,
  updateSet as updateSetMut,
  type ActiveSession,
  type DraftSet,
} from "@/lib/workout-draft";

const STORAGE_KEY = "ps_active_workout_session";

type ActiveWorkoutSessionContextValue = {
  session: ActiveSession | null;
  /** exercise_id → most-recent logged set, from the last page of workouts. */
  prefill: Map<string, DraftSet>;
  start: () => void;
  setName: (name: string) => void;
  addExercise: (exercise_id: string) => void;
  removeExercise: (idx: number) => void;
  reorderExercise: (from: number, to: number) => void;
  addSet: (exIdx: number, set: DraftSet) => void;
  updateSet: (exIdx: number, setIdx: number, patch: Partial<DraftSet>) => void;
  removeSet: (exIdx: number, setIdx: number) => void;
  createSuperset: (idxs: number[]) => void;
  ungroupSuperset: (group: number) => void;
  logSupersetRound: (group: number, sets: Record<number, DraftSet>) => void;
  setNotes: (notes: string) => void;
  setExerciseNotes: (exIdx: number, notes: string) => void;
  setTimes: (performed_at?: string, ended_at?: string) => void;
  startRestTimer: () => void;
  clearRestTimer: () => void;
  setRestDefault: (sec: number) => void;
  discard: () => void;
  save: (endedAt?: string, performedAt?: string) => Promise<Workout>;
};

const ActiveWorkoutSessionContext = createContext<ActiveWorkoutSessionContextValue | null>(null);

function readStored(): ActiveSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveSession;
  } catch {
    // Corrupt entry — drop it rather than crashing the whole app shell.
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function ActiveWorkoutSessionProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  // New-set default unit, with a null-profile fallback.
  const unit: "lb" | "kg" = profile?.weight_unit ?? "lb";

  // Hydrate once, synchronously, from localStorage. The lazy initializer
  // runs before the first paint so an in-progress session is never flashed
  // away on a reload. typeof-window guard inside `readStored` keeps SSR
  // safe (returns null on the server).
  const [session, setSession] = useState<ActiveSession | null>(() => readStored());
  const [prefill, setPrefill] = useState<Map<string, DraftSet>>(() => new Map());

  // Write through on every session change: persist when present, drop the
  // key when the session is cleared (discard / successful save). Skipped on
  // the server.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (session) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [session]);

  // Keep the latest unit/prefill in refs so the action callbacks can stay
  // referentially stable (they don't need to re-create when the unit or
  // prefill map changes — they read the current value at call time).
  const unitRef = useRef(unit);
  useEffect(() => {
    unitRef.current = unit;
  }, [unit]);
  const prefillRef = useRef(prefill);
  useEffect(() => {
    prefillRef.current = prefill;
  }, [prefill]);
  // Latest session, mirrored so `save` can read it synchronously without
  // depending on `session` (which would make the callback unstable).
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const start = useCallback(() => {
    setSession(createSession(new Date()));
    // Kick off last-time prefill. Degrade silently on any failure — prefill
    // is a convenience, never a blocker for starting a session.
    const token = getToken();
    if (!token) return;
    void listWorkouts(token, { limit: 50 })
      .then((page) => setPrefill(buildPrefillMap(page.items)))
      .catch(() => {
        /* prefill is best-effort */
      });
  }, []);

  // Generic guarded mutator: applies a pure mutator to the current session.
  // No-op when there is no session (actions are only reachable from the
  // live/review screens, which require a session).
  const mutate = useCallback((fn: (s: ActiveSession) => ActiveSession) => {
    setSession((prev) => (prev ? fn(prev) : prev));
  }, []);

  const setName = useCallback((name: string) => mutate((s) => setNameMut(s, name)), [mutate]);

  const addExercise = useCallback(
    (exercise_id: string) =>
      mutate((s) => {
        // Seed the first set from last-time prefill when we have it, else a
        // zeroed default in the user's preferred unit.
        const seed = prefillRef.current.get(exercise_id) ?? defaultSet(unitRef.current);
        return addExerciseMut(s, exercise_id, seed);
      }),
    [mutate],
  );

  const removeExercise = useCallback(
    (idx: number) => mutate((s) => removeExerciseMut(s, idx)),
    [mutate],
  );

  const reorderExercise = useCallback(
    (from: number, to: number) => mutate((s) => reorderExerciseMut(s, from, to)),
    [mutate],
  );

  const addSet = useCallback(
    (exIdx: number, set: DraftSet) => mutate((s) => addSetMut(s, exIdx, set)),
    [mutate],
  );

  const updateSet = useCallback(
    (exIdx: number, setIdx: number, patch: Partial<DraftSet>) =>
      mutate((s) => updateSetMut(s, exIdx, setIdx, patch)),
    [mutate],
  );

  const removeSet = useCallback(
    (exIdx: number, setIdx: number) => mutate((s) => removeSetMut(s, exIdx, setIdx)),
    [mutate],
  );

  const createSuperset = useCallback(
    (idxs: number[]) => mutate((s) => createSupersetMut(s, idxs)),
    [mutate],
  );

  const ungroupSuperset = useCallback(
    (group: number) => mutate((s) => ungroupSupersetMut(s, group)),
    [mutate],
  );

  const logSupersetRound = useCallback(
    (group: number, sets: Record<number, DraftSet>) =>
      mutate((s) => logSupersetRoundMut(s, group, sets)),
    [mutate],
  );

  const setNotes = useCallback((notes: string) => mutate((s) => setNotesMut(s, notes)), [mutate]);

  const setExerciseNotes = useCallback(
    (exIdx: number, notes: string) => mutate((s) => setExerciseNotesMut(s, exIdx, notes)),
    [mutate],
  );

  const setTimes = useCallback(
    // `ended_at` is not stored on the draft (ActiveSession has no such
    // field) — it is supplied to `save(endedAt)` at save time. The param is
    // kept in the signature so the review screen can call setTimes uniformly
    // and so the action surface matches the mobile client.
    (performed_at?: string, ended_at?: string) => {
      void ended_at;
      mutate((s) => (performed_at !== undefined ? { ...s, performed_at } : s));
    },
    [mutate],
  );

  const startRestTimer = useCallback(
    () =>
      mutate((s) => ({
        ...s,
        restTimer: { startedAt: new Date().toISOString(), durationSec: s.restDefaultSec },
      })),
    [mutate],
  );

  const clearRestTimer = useCallback(() => mutate((s) => ({ ...s, restTimer: null })), [mutate]);

  const setRestDefault = useCallback(
    (sec: number) => mutate((s) => ({ ...s, restDefaultSec: sec })),
    [mutate],
  );

  const discard = useCallback(() => {
    setSession(null);
  }, []);

  const save = useCallback(async (endedAt?: string, performedAt?: string): Promise<Workout> => {
    // Read the live session from the ref so `save` stays referentially
    // stable (no dependency on `session`).
    const current = sessionRef.current;
    if (!current) throw new Error("no active session to save");
    const token = getToken();
    if (!token) throw new Error("not authenticated");
    const payload = sessionToPayload(current, endedAt ?? new Date().toISOString());
    // An explicit performed_at override (e.g. the review screen's edited
    // "Started at") replaces the session's own performed_at. Passed in
    // directly so it doesn't depend on a not-yet-committed setTimes update.
    if (performedAt !== undefined) payload.performed_at = performedAt;
    // On success clear the draft; on failure rethrow so the caller can show
    // the error and the draft is preserved (no state change here).
    const created = await createWorkout(token, payload);
    setSession(null);
    return created;
  }, []);

  const value: ActiveWorkoutSessionContextValue = {
    session,
    prefill,
    start,
    setName,
    addExercise,
    removeExercise,
    reorderExercise,
    addSet,
    updateSet,
    removeSet,
    createSuperset,
    ungroupSuperset,
    logSupersetRound,
    setNotes,
    setExerciseNotes,
    setTimes,
    startRestTimer,
    clearRestTimer,
    setRestDefault,
    discard,
    save,
  };

  return (
    <ActiveWorkoutSessionContext.Provider value={value}>
      {children}
    </ActiveWorkoutSessionContext.Provider>
  );
}

/**
 * Returns the active-session state + actions. Throws if used outside an
 * `<ActiveWorkoutSessionProvider>` so a missing provider fails loudly.
 */
export function useActiveWorkoutSession(): ActiveWorkoutSessionContextValue {
  const ctx = useContext(ActiveWorkoutSessionContext);
  if (!ctx) {
    throw new Error("useActiveWorkoutSession must be used within an ActiveWorkoutSessionProvider");
  }
  return ctx;
}
