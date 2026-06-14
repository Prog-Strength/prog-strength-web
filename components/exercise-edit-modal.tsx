"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  updateWorkout,
  type Exercise,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from "@/lib/api";
import { workoutToPayload } from "@/lib/workout-payload";

/**
 * Focused editor for ONE exercise group within a workout — a standalone
 * exercise or a whole superset block (every member edited together). The
 * detail page opens this from the pencil on each group, and in "add" mode
 * from the "+ Add exercise" button.
 *
 * The group is identified by the `order` values of its members (orders are
 * unique within a workout). On save we rebuild the workout's full exercise
 * list — keeping every exercise outside this group untouched, swapping in
 * the edited members — and round-trip it through the API's full-replacement
 * update. Members preserve their original `order`, so positions are stable;
 * a newly added exercise lands at the end.
 *
 * Scope: editing an existing superset's sets/notes/exercise choice and
 * removing members is supported. Creating a new superset or regrouping
 * exercises is intentionally out of scope here — those live on the heavier
 * authoring flows.
 */

type SetDraft = WorkoutSet;

type MemberDraft = {
  // Original order within the workout. For an added exercise this is a
  // placeholder (-1) and the real order is assigned on save.
  order: number;
  exercise_id: string;
  notes: string;
  superset_group: number | null;
  sets: SetDraft[];
};

export function ExerciseEditModal({
  workout,
  group,
  mode,
  catalog,
  onClose,
  onSaved,
}: {
  workout: Workout;
  // The exercises this modal edits. One entry for a standalone exercise,
  // N for a superset. In "add" mode a single synthetic entry.
  group: WorkoutExercise[];
  mode: "edit" | "add";
  catalog: Exercise[];
  onClose: () => void;
  onSaved: (updated: Workout) => void;
}) {
  const [members, setMembers] = useState<MemberDraft[]>(() => group.map(toMemberDraft));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Orders of the exercises this group occupied at open time. Everything
  // NOT in this set is preserved verbatim on save.
  const originalOrders = useMemo(() => new Set(group.map((g) => g.order)), [group]);
  const isSuperset = group.length > 1;

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

  const canSave = useMemo(() => members.length > 0 && members.every(isMemberValid), [members]);

  const updateMember = (i: number, fn: (m: MemberDraft) => MemberDraft) =>
    setMembers((ms) => ms.map((m, idx) => (idx === i ? fn(m) : m)));

  const removeMember = (i: number) => setMembers((ms) => ms.filter((_, idx) => idx !== i));

  const addSet = (i: number) =>
    updateMember(i, (m) => ({
      ...m,
      // Reuse the last set's load as the default — straight sets are the
      // common case, so this saves retyping.
      sets: [...m.sets, m.sets[m.sets.length - 1] ?? defaultSet()],
    }));

  const removeSet = (i: number, setIdx: number) =>
    updateMember(i, (m) => ({ ...m, sets: m.sets.filter((_, j) => j !== setIdx) }));

  const updateSet = (i: number, setIdx: number, fn: (s: SetDraft) => SetDraft) =>
    updateMember(i, (m) => ({
      ...m,
      sets: m.sets.map((s, j) => (j === setIdx ? fn(s) : s)),
    }));

  const persist = useCallback(
    async (nextExercises: WorkoutExercise[]) => {
      const token = getToken();
      if (!token) {
        setError("Not signed in.");
        return;
      }
      if (nextExercises.length === 0) {
        setError("A workout must keep at least one exercise.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const next: Workout = { ...workout, exercises: nextExercises };
        const updated = await updateWorkout(token, workout.id, workoutToPayload(next));
        onSaved(updated);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [workout, onClose, onSaved],
  );

  const save = useCallback(() => {
    // Everything outside this group, untouched.
    const kept =
      mode === "add"
        ? [...workout.exercises]
        : workout.exercises.filter((ex) => !originalOrders.has(ex.order));

    if (mode === "add") {
      const maxOrder = workout.exercises.reduce((mx, e) => Math.max(mx, e.order), -1);
      const added = members.map((m, i) => memberToExercise(m, maxOrder + 1 + i));
      void persist([...kept, ...added]);
      return;
    }

    const edited = members.map((m) => memberToExercise(m, m.order));
    void persist([...kept, ...edited]);
  }, [mode, workout.exercises, originalOrders, members, persist]);

  const removeGroup = useCallback(() => {
    const label = isSuperset ? "this superset" : "this exercise";
    if (!window.confirm(`Remove ${label} from the workout?`)) return;
    const kept = workout.exercises.filter((ex) => !originalOrders.has(ex.order));
    void persist(kept);
  }, [isSuperset, workout.exercises, originalOrders, persist]);

  const title = mode === "add" ? "Add exercise" : isSuperset ? "Edit superset" : "Edit exercise";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exercise-edit-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 id="exercise-edit-title" className="text-base font-semibold">
            {title}
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
          <div className="flex flex-col gap-3">
            {isSuperset && (
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Superset · {members.length} {members.length === 1 ? "exercise" : "exercises"}
              </p>
            )}
            {members.map((m, i) => (
              <MemberCard
                key={i}
                member={m}
                catalog={catalog}
                // Only allow removing a member inline when more than one
                // remains; the last member is removed via "Remove from
                // workout" so the intent (delete the group) is explicit.
                canRemove={members.length > 1}
                onChange={(fn) => updateMember(i, fn)}
                onRemove={() => removeMember(i)}
                onAddSet={() => addSet(i)}
                onRemoveSet={(setIdx) => removeSet(i, setIdx)}
                onSetChange={(setIdx, fn) => updateSet(i, setIdx, fn)}
              />
            ))}
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && (
            <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            {mode === "edit" ? (
              <button
                type="button"
                onClick={removeGroup}
                disabled={saving}
                className="rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-sm text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-40"
              >
                Remove from workout
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
                {saving ? "Saving…" : mode === "add" ? "Add exercise" : "Save changes"}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// --- member card ----------------------------------------------------------

function MemberCard({
  member,
  catalog,
  canRemove,
  onChange,
  onRemove,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: {
  member: MemberDraft;
  catalog: Exercise[];
  canRemove: boolean;
  onChange: (fn: (m: MemberDraft) => MemberDraft) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onSetChange: (setIdx: number, fn: (s: SetDraft) => SetDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start gap-2">
        <select
          value={member.exercise_id}
          onChange={(e) => onChange((m) => ({ ...m, exercise_id: e.target.value }))}
          className={`${inputClasses} flex-1`}
        >
          {!catalog.some((c) => c.id === member.exercise_id) && (
            <option value={member.exercise_id}>{member.exercise_id} (unknown)</option>
          )}
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove exercise from superset"
            className="rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      <input
        type="text"
        value={member.notes}
        onChange={(e) => onChange((m) => ({ ...m, notes: e.target.value }))}
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
        {member.sets.map((s, setIdx) => (
          <div key={setIdx} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2">
            <input
              type="number"
              min={1}
              value={s.reps}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, reps: parseInt(e.target.value, 10) || 0 }))
              }
              className={inputClasses}
            />
            <input
              type="number"
              min={0}
              step={0.5}
              value={s.weight}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, weight: parseFloat(e.target.value) || 0 }))
              }
              className={inputClasses}
            />
            <select
              value={s.unit}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, unit: e.target.value as "lb" | "kg" }))
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
              className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)] disabled:opacity-30"
              disabled={member.sets.length === 1}
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

// --- helpers --------------------------------------------------------------

function defaultSet(): SetDraft {
  return { reps: 5, weight: 0, unit: "lb" };
}

function toMemberDraft(we: WorkoutExercise): MemberDraft {
  return {
    order: we.order,
    exercise_id: we.exercise_id,
    notes: we.notes ?? "",
    superset_group: we.superset_group ?? null,
    sets: we.sets.map((s) => ({ ...s })),
  };
}

function memberToExercise(m: MemberDraft, order: number): WorkoutExercise {
  return {
    exercise_id: m.exercise_id,
    order,
    superset_group: m.superset_group,
    notes: m.notes.trim() || undefined,
    sets: m.sets.map((s) => ({ ...s })),
  };
}

function isMemberValid(m: MemberDraft): boolean {
  if (!m.exercise_id) return false;
  if (m.sets.length === 0) return false;
  return m.sets.every(
    (s) => Number.isFinite(s.reps) && s.reps > 0 && Number.isFinite(s.weight) && s.weight >= 0,
  );
}

/**
 * A fresh standalone-exercise group for "add" mode — first catalog entry,
 * one default set, no superset.
 */
export function newExerciseGroup(catalog: Exercise[]): WorkoutExercise[] {
  return [
    {
      exercise_id: catalog[0]?.id ?? "",
      order: -1,
      superset_group: null,
      sets: [defaultSet()],
    },
  ];
}

const inputClasses =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none";

// --- icons ----------------------------------------------------------------

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
