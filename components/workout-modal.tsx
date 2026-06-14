"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  updateWorkout,
  type Exercise,
  type Workout,
  type WorkoutPayload,
  type WorkoutSet,
} from "@/lib/api";
import { localInputToRFC3339, rfc3339ToLocalInput } from "@/lib/datetime";

/**
 * Edit modal for an existing workout. Same component is used by both
 * the Workouts page and the Calendar page — the parent owns the
 * "which workout is being edited" state, and this component owns the
 * form draft + submission.
 *
 * Form state model: we keep a single mutable draft object derived from
 * the incoming workout, and mutate it via immutable updates whenever a
 * field changes. That keeps the render path readable and avoids
 * pulling in a form library for this one screen.
 *
 * On successful save the parent's `onSaved(updated)` callback receives
 * the API's response so it can splice the new state into its local
 * list without an extra refetch.
 */

type SetDraft = WorkoutSet;

type ExerciseDraft = {
  exercise_id: string;
  notes: string;
  superset_group: number | null;
  sets: SetDraft[];
};

type WorkoutDraft = {
  name: string;
  performed_at: string; // datetime-local form value, e.g. "2026-05-17T18:30"
  ended_at: string; // datetime-local; empty string means "not set"
  notes: string;
  exercises: ExerciseDraft[];
};

export function WorkoutModal({
  workout,
  catalog,
  onClose,
  onSaved,
}: {
  workout: Workout;
  catalog: Exercise[];
  onClose: () => void;
  onSaved: (updated: Workout) => void;
}) {
  const [draft, setDraft] = useState<WorkoutDraft>(() => workoutToDraft(workout));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape. Listening on the document means the keystroke
  // works even if focus is on a nested input (a native modal would
  // give us this for free, but <dialog> support + styling is still
  // uneven enough that hand-rolling the overlay is simpler).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll while the modal is open so the page behind doesn't
  // scroll when the cursor crosses the backdrop.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const canSave = useMemo(() => isDraftValid(draft), [draft]);

  const save = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateWorkout(token, workout.id, draftToPayload(draft));
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, workout.id, onClose, onSaved]);

  // Helpers that re-build the draft immutably. Defined inline so the
  // closures capture `setDraft` without prop-drilling.
  const updateField = <K extends keyof WorkoutDraft>(key: K, value: WorkoutDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateExercise = (i: number, fn: (ex: ExerciseDraft) => ExerciseDraft) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((ex, idx) => (idx === i ? fn(ex) : ex)),
    }));

  const updateSet = (exIdx: number, setIdx: number, fn: (s: SetDraft) => SetDraft) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIdx ? fn(s) : s)),
    }));

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          exercise_id: catalog[0]?.id ?? "",
          notes: "",
          superset_group: null,
          sets: [defaultSet()],
        },
      ],
    }));

  const removeExercise = (i: number) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.filter((_, idx) => idx !== i),
    }));

  const addSet = (exIdx: number) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      // Copy the last set's weight/unit as a sensible default —
      // straight sets are the common case, so reusing those values
      // saves the user typing them out repeatedly.
      sets: [...ex.sets, ex.sets[ex.sets.length - 1] ?? defaultSet()],
    }));

  const removeSet = (exIdx: number, setIdx: number) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.filter((_, j) => j !== setIdx),
    }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-modal-title"
    >
      {/* Backdrop: separate element so clicking it dismisses the modal
          without also catching clicks on the panel. */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 id="workout-modal-title" className="text-base font-semibold">
            Edit workout
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <input
                type="text"
                value={draft.name}
                onChange={(e) => updateField("name", e.target.value)}
                placeholder="e.g. Upper 1"
                className={inputClasses}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Performed at" required>
                <input
                  type="datetime-local"
                  value={draft.performed_at}
                  onChange={(e) => updateField("performed_at", e.target.value)}
                  className={inputClasses}
                />
              </Field>
              <Field label="Ended at">
                <input
                  type="datetime-local"
                  value={draft.ended_at}
                  onChange={(e) => updateField("ended_at", e.target.value)}
                  className={inputClasses}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={draft.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={2}
                placeholder="Anything worth remembering about this session"
                className={`${inputClasses} resize-y`}
              />
            </Field>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Exercises</h3>
                <button
                  type="button"
                  onClick={addExercise}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  + Add exercise
                </button>
              </div>

              {draft.exercises.length === 0 && (
                <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
                  A workout needs at least one exercise.
                </p>
              )}

              {draft.exercises.map((ex, exIdx) => (
                <ExerciseCard
                  key={exIdx}
                  exercise={ex}
                  catalog={catalog}
                  onChange={(fn) => updateExercise(exIdx, fn)}
                  onRemove={() => removeExercise(exIdx)}
                  onAddSet={() => addSet(exIdx)}
                  onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
                  onSetChange={(setIdx, fn) => updateSet(exIdx, setIdx, fn)}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && (
            <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave || saving}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

// --- nested components -----------------------------------------------------

function ExerciseCard({
  exercise,
  catalog,
  onChange,
  onRemove,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: {
  exercise: ExerciseDraft;
  catalog: Exercise[];
  onChange: (fn: (ex: ExerciseDraft) => ExerciseDraft) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onSetChange: (setIdx: number, fn: (s: SetDraft) => SetDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start gap-2">
        <select
          value={exercise.exercise_id}
          onChange={(e) => onChange((ex) => ({ ...ex, exercise_id: e.target.value }))}
          className={`${inputClasses} flex-1`}
        >
          {!catalog.some((c) => c.id === exercise.exercise_id) && (
            // Surface unknown slugs so the user notices a soft-deleted
            // or catalog-renamed exercise rather than silently picking
            // the first option.
            <option value={exercise.exercise_id}>{exercise.exercise_id} (unknown)</option>
          )}
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove exercise"
          className="rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </div>

      <input
        type="text"
        value={exercise.notes}
        onChange={(e) => onChange((ex) => ({ ...ex, notes: e.target.value }))}
        placeholder="Notes for this exercise"
        className={`${inputClasses} text-xs`}
      />

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
          <span>Reps</span>
          <span>Weight</span>
          <span>Unit</span>
          <span />
        </div>
        {exercise.sets.map((s, setIdx) => (
          <div key={setIdx} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
            <input
              type="number"
              min={1}
              value={s.reps}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({
                  ...set,
                  reps: parseInt(e.target.value, 10) || 0,
                }))
              }
              className={inputClasses}
            />
            <input
              type="number"
              min={0}
              step={0.5}
              value={s.weight}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({
                  ...set,
                  weight: parseFloat(e.target.value) || 0,
                }))
              }
              className={inputClasses}
            />
            <select
              value={s.unit}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({
                  ...set,
                  unit: e.target.value as "lb" | "kg",
                }))
              }
              className={inputClasses}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
            <button
              type="button"
              onClick={() => onRemoveSet(setIdx)}
              aria-label="Remove set"
              className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
              disabled={exercise.sets.length === 1}
            >
              <TrashIcon small />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddSet}
          className="self-start text-xs text-[var(--accent)] hover:underline"
        >
          + Add set
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-[var(--muted)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClasses =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none";

// --- icons -----------------------------------------------------------------

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function TrashIcon({ small = false }: { small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

// --- helpers ---------------------------------------------------------------

function defaultSet(): SetDraft {
  return { reps: 5, weight: 0, unit: "lb" };
}

function workoutToDraft(w: Workout): WorkoutDraft {
  return {
    name: w.name ?? "",
    performed_at: rfc3339ToLocalInput(w.performed_at),
    ended_at: w.ended_at ? rfc3339ToLocalInput(w.ended_at) : "",
    notes: w.notes ?? "",
    exercises: [...w.exercises]
      .sort((a, b) => a.order - b.order)
      .map((we) => ({
        exercise_id: we.exercise_id,
        notes: we.notes ?? "",
        superset_group: we.superset_group ?? null,
        sets: we.sets.map((s) => ({ ...s })),
      })),
  };
}

function draftToPayload(d: WorkoutDraft): WorkoutPayload {
  const payload: WorkoutPayload = {
    performed_at: localInputToRFC3339(d.performed_at),
    exercises: d.exercises.map((ex) => ({
      exercise_id: ex.exercise_id,
      // Only include these when they carry information — the API treats
      // missing keys as "don't set" so we avoid persisting empty strings.
      ...(ex.superset_group !== null && {
        superset_group: ex.superset_group,
      }),
      ...(ex.notes && { notes: ex.notes }),
      sets: ex.sets,
    })),
  };
  if (d.name) payload.name = d.name;
  if (d.ended_at) payload.ended_at = localInputToRFC3339(d.ended_at);
  if (d.notes) payload.notes = d.notes;
  return payload;
}

function isDraftValid(d: WorkoutDraft): boolean {
  if (!d.performed_at) return false;
  if (d.exercises.length === 0) return false;
  for (const ex of d.exercises) {
    if (!ex.exercise_id) return false;
    if (ex.sets.length === 0) return false;
    for (const s of ex.sets) {
      if (!Number.isFinite(s.reps) || s.reps <= 0) return false;
      if (!Number.isFinite(s.weight) || s.weight < 0) return false;
    }
  }
  return true;
}
