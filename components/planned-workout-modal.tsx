"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  createPlannedWorkout,
  updatePlannedWorkout,
  type CalendarDetail,
  type Exercise,
  type PlannedWorkout,
  type PlannedWorkoutPayload,
} from "@/lib/api";
import { localInputToRFC3339, rfc3339ToLocalInput } from "@/lib/datetime";

/**
 * Create / edit modal for a planned workout. Mirrors WorkoutModal's
 * raw-state form pattern: one mutable draft, immutable updates, Tailwind
 * inputs, submit via the api fns. The parent owns "which plan is being
 * edited" (`plan` null → create) and gets the saved plan back via
 * `onSaved` so it can refresh the calendar window.
 *
 * Agenda is optional — a plan can be a bare time block. The
 * `calendar_detail` select maps Default → null so the API falls back to
 * the user's `calendar_default_detail`. The "Sync to Google Calendar"
 * checkbox only shows when the calendar is connected, and (on create)
 * sends `calendar_sync: true` to trigger the best-effort push.
 */

type PlannedSetDraft = {
  target_reps: string;
  target_weight: string;
  unit: "lb" | "kg";
  target_rpe: string;
};

type PlannedExerciseDraft = {
  exercise_id: string;
  notes: string;
  sets: PlannedSetDraft[];
};

type PlannedDraft = {
  name: string;
  scheduled_start: string; // datetime-local value
  scheduled_end: string; // datetime-local value
  notes: string;
  // "" → Default (null), else the literal detail level.
  calendar_detail: "" | CalendarDetail;
  calendar_sync: boolean;
  exercises: PlannedExerciseDraft[];
};

export function PlannedWorkoutModal({
  plan,
  catalog,
  calendarConnected,
  defaultDate,
  onClose,
  onSaved,
}: {
  plan: PlannedWorkout | null;
  catalog: Exercise[];
  calendarConnected: boolean;
  // When creating, the day the calendar was looking at — seeds the start
  // time to 18:00 on that day and the end to an hour later.
  defaultDate?: Date;
  onClose: () => void;
  onSaved: (saved: PlannedWorkout) => void;
}) {
  const [draft, setDraft] = useState<PlannedDraft>(() =>
    plan ? planToDraft(plan) : freshDraft(defaultDate),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

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
      const payload = draftToPayload(draft);
      const saved = plan
        ? await updatePlannedWorkout(token, plan.id, payload)
        : await createPlannedWorkout(token, payload);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, plan, onSaved]);

  const updateField = <K extends keyof PlannedDraft>(key: K, value: PlannedDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateExercise = (i: number, fn: (ex: PlannedExerciseDraft) => PlannedExerciseDraft) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((ex, idx) => (idx === i ? fn(ex) : ex)),
    }));

  const updateSet = (exIdx: number, setIdx: number, fn: (s: PlannedSetDraft) => PlannedSetDraft) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIdx ? fn(s) : s)),
    }));

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        { exercise_id: catalog[0]?.id ?? "", notes: "", sets: [defaultSet()] },
      ],
    }));

  const removeExercise = (i: number) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, idx) => idx !== i) }));

  const addSet = (exIdx: number) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      sets: [...ex.sets, ex.sets[ex.sets.length - 1] ?? defaultSet()],
    }));

  const removeSet = (exIdx: number, setIdx: number) =>
    updateExercise(exIdx, (ex) => ({ ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planned-workout-modal-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 id="planned-workout-modal-title" className="text-base font-semibold">
            {plan ? "Edit planned workout" : "Plan a workout"}
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
              <Field label="Starts at" required>
                <input
                  type="datetime-local"
                  aria-label="Starts at"
                  value={draft.scheduled_start}
                  onChange={(e) => updateField("scheduled_start", e.target.value)}
                  className={inputClasses}
                />
              </Field>
              <Field label="Ends at" required>
                <input
                  type="datetime-local"
                  aria-label="Ends at"
                  value={draft.scheduled_end}
                  onChange={(e) => updateField("scheduled_end", e.target.value)}
                  className={inputClasses}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={draft.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={2}
                placeholder="Anything worth noting about this session"
                className={`${inputClasses} resize-y`}
              />
            </Field>

            <Field label="Calendar detail">
              <select
                aria-label="Calendar detail"
                value={draft.calendar_detail}
                onChange={(e) =>
                  updateField("calendar_detail", e.target.value as "" | CalendarDetail)
                }
                className={inputClasses}
              >
                <option value="">Default</option>
                <option value="time_block">Time block</option>
                <option value="full_agenda">Full agenda</option>
              </select>
            </Field>

            {calendarConnected && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.calendar_sync}
                  onChange={(e) => updateField("calendar_sync", e.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border)]"
                />
                <span>Sync to Google Calendar</span>
              </label>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Agenda (optional)</h3>
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
                  No agenda — this will be a bare time block.
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
              {saving ? "Saving…" : plan ? "Save changes" : "Plan workout"}
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
  exercise: PlannedExerciseDraft;
  catalog: Exercise[];
  onChange: (fn: (ex: PlannedExerciseDraft) => PlannedExerciseDraft) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onSetChange: (setIdx: number, fn: (s: PlannedSetDraft) => PlannedSetDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start gap-2">
        <select
          aria-label="Exercise"
          value={exercise.exercise_id}
          onChange={(e) => onChange((ex) => ({ ...ex, exercise_id: e.target.value }))}
          className={`${inputClasses} flex-1`}
        >
          {!catalog.some((c) => c.id === exercise.exercise_id) && (
            <option value={exercise.exercise_id}>{exercise.exercise_id || "Select…"}</option>
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
        <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
          <span>Reps</span>
          <span>Weight</span>
          <span>Unit</span>
          <span>RPE</span>
          <span />
        </div>
        {exercise.sets.map((s, setIdx) => (
          <div key={setIdx} className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-2">
            <input
              type="number"
              min={0}
              aria-label="Target reps"
              value={s.target_reps}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, target_reps: e.target.value }))
              }
              className={inputClasses}
            />
            <input
              type="number"
              min={0}
              step={0.5}
              aria-label="Target weight"
              value={s.target_weight}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, target_weight: e.target.value }))
              }
              className={inputClasses}
            />
            <select
              aria-label="Unit"
              value={s.unit}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, unit: e.target.value as "lb" | "kg" }))
              }
              className={inputClasses}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              aria-label="Target RPE"
              value={s.target_rpe}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, target_rpe: e.target.value }))
              }
              className={inputClasses}
            />
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

function defaultSet(): PlannedSetDraft {
  return { target_reps: "5", target_weight: "", unit: "lb", target_rpe: "" };
}

/** A fresh draft seeded to 18:00 on `day` (or today), one hour long. */
function freshDraft(day?: Date): PlannedDraft {
  const base = day ? new Date(day) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 18, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const toInput = (d: Date) => rfc3339ToLocalInput(d.toISOString());
  return {
    name: "",
    scheduled_start: toInput(start),
    scheduled_end: toInput(end),
    notes: "",
    calendar_detail: "",
    calendar_sync: false,
    exercises: [],
  };
}

function planToDraft(p: PlannedWorkout): PlannedDraft {
  return {
    name: p.name ?? "",
    scheduled_start: rfc3339ToLocalInput(p.scheduled_start),
    scheduled_end: rfc3339ToLocalInput(p.scheduled_end),
    notes: p.notes ?? "",
    calendar_detail: p.calendar_detail ?? "",
    // We don't re-trigger a sync on edit unless the user opts in again.
    calendar_sync: false,
    exercises: p.exercises
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        exercise_id: ex.exercise_id,
        notes: ex.notes ?? "",
        sets: ex.sets
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((s) => ({
            target_reps: s.target_reps != null ? String(s.target_reps) : "",
            target_weight: s.target_weight != null ? String(s.target_weight) : "",
            unit: s.unit ?? "lb",
            target_rpe: s.target_rpe != null ? String(s.target_rpe) : "",
          })),
      })),
  };
}

function draftToPayload(d: PlannedDraft): PlannedWorkoutPayload {
  const payload: PlannedWorkoutPayload = {
    scheduled_start: localInputToRFC3339(d.scheduled_start),
    scheduled_end: localInputToRFC3339(d.scheduled_end),
    // null → Default (API falls back to the user's calendar_default_detail).
    calendar_detail: d.calendar_detail === "" ? null : d.calendar_detail,
  };
  if (d.name.trim()) payload.name = d.name.trim();
  if (d.notes.trim()) payload.notes = d.notes.trim();
  if (d.calendar_sync) payload.calendar_sync = true;
  // Only send `exercises` when the user built an agenda — omitting it on
  // update preserves any existing agenda (per the API contract).
  if (d.exercises.length > 0) {
    payload.exercises = d.exercises.map((ex) => {
      const out: NonNullable<PlannedWorkoutPayload["exercises"]>[number] = {
        exercise_id: ex.exercise_id,
        sets: ex.sets.map((s) => {
          const set: NonNullable<PlannedWorkoutPayload["exercises"]>[number]["sets"][number] = {};
          if (s.target_reps.trim() !== "") set.target_reps = Number(s.target_reps);
          if (s.target_weight.trim() !== "") {
            set.target_weight = Number(s.target_weight);
            set.unit = s.unit;
          }
          if (s.target_rpe.trim() !== "") set.target_rpe = Number(s.target_rpe);
          return set;
        }),
      };
      if (ex.notes.trim()) out.notes = ex.notes.trim();
      return out;
    });
  }
  return payload;
}

function isDraftValid(d: PlannedDraft): boolean {
  if (!d.scheduled_start || !d.scheduled_end) return false;
  // End must be after start.
  if (new Date(d.scheduled_end).getTime() <= new Date(d.scheduled_start).getTime()) return false;
  for (const ex of d.exercises) {
    if (!ex.exercise_id) return false;
    if (ex.sets.length === 0) return false;
  }
  return true;
}
