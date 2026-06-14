"use client";

/**
 * One standalone (non-superset) exercise in the live session. Sibling of
 * the WorkoutModal's ExerciseCard — same set grid + input styling — but
 * wired to the live-session action surface instead of a local draft.
 *
 * Responsibilities:
 *  - render the catalog name (falls back to the slug for unknown ids),
 *  - editable / removable reps-weight-unit set rows,
 *  - "+ Add set" (copies the last set's values, then starts the rest timer),
 *  - an exercise-notes input,
 *  - remove-exercise + up/down reorder,
 *  - a "Make superset" affordance: enters page-level selection mode so the
 *    user can pick this + another exercise to group.
 */

import type { Exercise } from "@/lib/api";
import { defaultSet, type DraftExercise, type DraftSet } from "@/lib/workout-draft";
import { SetHeaderRow, SetRow, TrashIcon } from "@/components/live-workout/set-row";

export function ExerciseCard({
  index,
  exercise,
  catalog,
  total,
  selecting,
  selected,
  onToggleSelected,
  onStartSelecting,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onSetNotes,
  onRemove,
  onReorder,
}: {
  index: number;
  exercise: DraftExercise;
  catalog: Map<string, Exercise>;
  total: number;
  selecting: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onStartSelecting: () => void;
  onAddSet: (set: DraftSet) => void;
  onUpdateSet: (setIdx: number, patch: Partial<DraftSet>) => void;
  onRemoveSet: (setIdx: number) => void;
  onSetNotes: (notes: string) => void;
  onRemove: () => void;
  onReorder: (to: number) => void;
}) {
  const name = catalog.get(exercise.exercise_id)?.name ?? `${exercise.exercise_id} (unknown)`;

  const addSet = () => {
    // Straight sets are the common case — copy the last set's
    // weight/unit/reps so the user only edits what changed.
    const last = exercise.sets[exercise.sets.length - 1];
    onAddSet(last ? { ...last } : defaultSet("lb"));
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-lg border bg-[var(--surface)] p-3 ${
        selected ? "border-[var(--accent)]" : "border-[var(--border)]"
      }`}
    >
      <div className="flex items-start gap-2">
        {selecting && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={`Select ${name} for superset`}
            className="mt-1.5 h-4 w-4 accent-[var(--accent)]"
          />
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="truncate text-sm font-semibold">{name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={() => onReorder(index - 1)}
            disabled={index === 0}
            aria-label="Move up"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <ArrowIcon up />
          </button>
          <button
            type="button"
            onClick={() => onReorder(index + 1)}
            disabled={index === total - 1}
            aria-label="Move down"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            <ArrowIcon />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove exercise"
            className="rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <SetHeaderRow />
        {exercise.sets.map((s, setIdx) => (
          <SetRow
            key={setIdx}
            index={setIdx}
            set={s}
            onChange={(patch) => onUpdateSet(setIdx, patch)}
            onRemove={() => onRemoveSet(setIdx)}
          />
        ))}
        <button
          type="button"
          onClick={addSet}
          className="self-start text-xs text-[var(--accent)] hover:underline"
        >
          + Add set
        </button>
      </div>

      <input
        type="text"
        value={exercise.notes ?? ""}
        onChange={(e) => onSetNotes(e.target.value)}
        placeholder="Notes for this exercise"
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
      />

      {!selecting && total > 1 && (
        <button
          type="button"
          onClick={onStartSelecting}
          className="self-start text-xs text-[var(--muted)] transition hover:text-[var(--accent)]"
        >
          Make superset
        </button>
      )}
    </div>
  );
}

function ArrowIcon({ up = false }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={up ? "" : "rotate-180"}
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}
