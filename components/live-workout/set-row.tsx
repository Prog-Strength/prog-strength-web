"use client";

/**
 * Shared set-editing primitives for the live-session cards. The
 * reps/weight/unit grid mirrors the WorkoutModal ExerciseCard layout so
 * the live ExerciseCard and SupersetCard read as siblings of the edit
 * modal. Kept in one place so the grid template, input styling, and the
 * trash icon don't drift between the two cards.
 */

import type { DraftSet } from "@/lib/workout-draft";

export const inputClasses =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none";

const GRID = "grid grid-cols-[1.5rem_1fr_1fr_auto_auto] items-center gap-2";

/** Column headers above a list of editable set rows. */
export function SetHeaderRow() {
  return (
    <div className={`${GRID} text-[10px] uppercase tracking-wide text-[var(--muted)]`}>
      <span>Set</span>
      <span>Reps</span>
      <span>Weight</span>
      <span>Unit</span>
      <span />
    </div>
  );
}

/** One editable reps/weight/unit row with a remove button. */
export function SetRow({
  index,
  set,
  onChange,
  onRemove,
}: {
  index: number;
  set: DraftSet;
  onChange: (patch: Partial<DraftSet>) => void;
  onRemove: () => void;
}) {
  return (
    <div className={GRID}>
      <span className="text-xs tabular-nums text-[var(--muted)]">{index + 1}</span>
      <input
        type="number"
        min={1}
        value={set.reps}
        onChange={(e) => onChange({ reps: parseInt(e.target.value, 10) || 0 })}
        className={inputClasses}
        aria-label={`Set ${index + 1} reps`}
      />
      <input
        type="number"
        min={0}
        step={0.5}
        value={set.weight}
        onChange={(e) => onChange({ weight: parseFloat(e.target.value) || 0 })}
        className={inputClasses}
        aria-label={`Set ${index + 1} weight`}
      />
      <select
        value={set.unit}
        onChange={(e) => onChange({ unit: e.target.value as "lb" | "kg" })}
        className={inputClasses}
        aria-label={`Set ${index + 1} unit`}
      >
        <option value="lb">lb</option>
        <option value="kg">kg</option>
      </select>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove set ${index + 1}`}
        className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
      >
        <TrashIcon small />
      </button>
    </div>
  );
}

export function TrashIcon({ small = false }: { small?: boolean }) {
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
