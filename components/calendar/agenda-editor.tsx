"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Exercise } from "@/lib/api";
import { filterExercises } from "@/components/live-workout/exercise-search";

/**
 * The lift-agenda editor for the planned-workout form. Only ONE exercise is
 * editable at a time (the "focused" one shows the full set editor); every
 * other exercise collapses to a compact read card, so the form stays short
 * and legible no matter how many exercises the plan carries. Consecutive
 * exercises sharing a superset group render bracketed under a "Superset"
 * rail, mirroring how the app shows supersets elsewhere.
 *
 * The editor is controlled: it holds no exercise state of its own beyond
 * which row is focused, and reports every change up through `onChange`.
 */

export type PlannedSetDraft = {
  target_reps: string;
  target_weight: string;
  unit: "lb" | "kg";
  target_rpe: string;
  // AMRAP ("as many reps as possible") — no fixed rep target. When true, the
  // reps input is disabled and the set reads "AMRAP".
  amrap: boolean;
};

export type PlannedExerciseDraft = {
  exercise_id: string;
  notes: string;
  // Non-null groups this exercise into a superset with the exercises sharing
  // the same number; null is standalone. Groups are always consecutive runs.
  superset_group: number | null;
  sets: PlannedSetDraft[];
};

export function defaultSetDraft(): PlannedSetDraft {
  return { target_reps: "5", target_weight: "", unit: "lb", target_rpe: "", amrap: false };
}

export function AgendaEditor({
  exercises,
  catalog,
  onChange,
}: {
  exercises: PlannedExerciseDraft[];
  catalog: Exercise[];
  onChange: (next: PlannedExerciseDraft[]) => void;
}) {
  // Which exercise is expanded for editing. Defaults to the last one so a
  // freshly-added exercise opens focused.
  const [focused, setFocused] = useState<number>(exercises.length - 1);

  const exerciseMap = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);

  const update = (i: number, fn: (ex: PlannedExerciseDraft) => PlannedExerciseDraft) =>
    onChange(exercises.map((ex, idx) => (idx === i ? fn(ex) : ex)));

  const addExercise = () => {
    const next = [
      ...exercises,
      {
        exercise_id: catalog[0]?.id ?? "",
        notes: "",
        superset_group: null,
        sets: [defaultSetDraft()],
      } satisfies PlannedExerciseDraft,
    ];
    onChange(next);
    setFocused(next.length - 1);
  };

  const removeExercise = (i: number) => {
    const next = normalizeSupersets(exercises.filter((_, idx) => idx !== i));
    onChange(next);
    setFocused((f) => (f >= next.length ? next.length - 1 : f));
  };

  const toggleSuperset = (i: number) => onChange(toggleSupersetWithPrevious(exercises, i));

  const runs = useMemo(() => groupRuns(exercises), [exercises]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--foreground)]">Agenda</h3>
        <span className="text-[11px] text-[var(--muted)]">optional</span>
      </div>

      {exercises.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center text-xs text-[var(--muted)]">
          No agenda yet — add exercises, or start the workout and log as you go.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {runs.map((run) => {
            const block = (
              <div className={run.group != null ? "flex flex-col gap-1.5" : "contents"}>
                {run.indices.map((i) =>
                  i === focused ? (
                    <FocusedExercise
                      key={i}
                      exercise={exercises[i]}
                      catalog={catalog}
                      canSuperset={i > 0}
                      onChange={(fn) => update(i, fn)}
                      onRemove={() => removeExercise(i)}
                      onToggleSuperset={() => toggleSuperset(i)}
                    />
                  ) : (
                    <ReadCard
                      key={i}
                      exercise={exercises[i]}
                      name={exerciseMap.get(exercises[i].exercise_id)?.name}
                      onFocus={() => setFocused(i)}
                    />
                  ),
                )}
              </div>
            );
            // A real superset (2+ members) gets a bracket rail + label.
            return run.group != null && run.indices.length > 1 ? (
              <div
                key={`g-${run.group}`}
                className="rounded-lg border-l-2 border-[var(--accent)] bg-[var(--surface-2)]/30 py-2 pl-3 pr-1"
              >
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                  Superset
                </p>
                {block}
              </div>
            ) : (
              <div key={`s-${run.indices[0]}`}>{block}</div>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={addExercise}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] py-2 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)]/60 hover:bg-[var(--surface-2)]/40"
      >
        <PlusIcon /> Add exercise
      </button>
    </div>
  );
}

// --- focused (editable) exercise -------------------------------------------

function FocusedExercise({
  exercise,
  catalog,
  canSuperset,
  onChange,
  onRemove,
  onToggleSuperset,
}: {
  exercise: PlannedExerciseDraft;
  catalog: Exercise[];
  canSuperset: boolean;
  onChange: (fn: (ex: PlannedExerciseDraft) => PlannedExerciseDraft) => void;
  onRemove: () => void;
  onToggleSuperset: () => void;
}) {
  const setSet = (j: number, fn: (s: PlannedSetDraft) => PlannedSetDraft) =>
    onChange((ex) => ({ ...ex, sets: ex.sets.map((s, k) => (k === j ? fn(s) : s)) }));
  const addSet = () =>
    onChange((ex) => ({
      ...ex,
      sets: [...ex.sets, ex.sets[ex.sets.length - 1] ?? defaultSetDraft()],
    }));
  const removeSet = (j: number) =>
    onChange((ex) => ({ ...ex, sets: ex.sets.filter((_, k) => k !== j) }));

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--surface)] p-3 shadow-sm ring-1 ring-[var(--accent)]/10">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <ExercisePicker
            value={exercise.exercise_id}
            catalog={catalog}
            onSelect={(id) => onChange((ex) => ({ ...ex, exercise_id: id }))}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove exercise"
          className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </div>

      <input
        type="text"
        value={exercise.notes}
        onChange={(e) => onChange((ex) => ({ ...ex, notes: e.target.value }))}
        placeholder="Notes for this exercise (optional)"
        className={inputClasses}
      />

      <div className="flex flex-col gap-1.5">
        <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto_auto] items-center gap-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          <span>
            Reps<span className="text-[var(--danger)]">*</span>
          </span>
          <span>Weight</span>
          <span>Unit</span>
          <span>RPE</span>
          <span className="text-center">AMRAP</span>
          <span />
        </div>
        {exercise.sets.map((s, j) => (
          <div key={j} className="grid grid-cols-[1fr_1fr_auto_1fr_auto_auto] items-center gap-2">
            <input
              type="number"
              min={0}
              aria-label="Target reps"
              value={s.amrap ? "" : s.target_reps}
              disabled={s.amrap}
              placeholder={s.amrap ? "AMRAP" : ""}
              onChange={(e) => setSet(j, (set) => ({ ...set, target_reps: e.target.value }))}
              className={`${cellClasses} ${s.amrap ? "italic text-[var(--muted)]" : ""}`}
            />
            <input
              type="number"
              min={0}
              step={0.5}
              aria-label="Target weight"
              value={s.target_weight}
              onChange={(e) => setSet(j, (set) => ({ ...set, target_weight: e.target.value }))}
              className={cellClasses}
            />
            <select
              aria-label="Unit"
              value={s.unit}
              onChange={(e) =>
                setSet(j, (set) => ({ ...set, unit: e.target.value as "lb" | "kg" }))
              }
              className={cellClasses}
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
              onChange={(e) => setSet(j, (set) => ({ ...set, target_rpe: e.target.value }))}
              className={cellClasses}
            />
            <button
              type="button"
              aria-label="Toggle AMRAP"
              aria-pressed={s.amrap}
              onClick={() => setSet(j, (set) => ({ ...set, amrap: !set.amrap }))}
              className={`rounded-md px-1.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition ${
                s.amrap
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              ∞
            </button>
            <button
              type="button"
              onClick={() => removeSet(j)}
              aria-label="Remove set"
              disabled={exercise.sets.length === 1}
              className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)] disabled:opacity-30"
            >
              <TrashIcon small />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addSet}
          className="text-xs font-medium text-[var(--accent)] transition hover:underline"
        >
          + Add set
        </button>
        {canSuperset && (
          <button
            type="button"
            onClick={onToggleSuperset}
            aria-pressed={exercise.superset_group != null}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
              exercise.superset_group != null
                ? "bg-[var(--accent)]/15 text-[var(--accent)]"
                : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            }`}
          >
            <LinkIcon />
            {exercise.superset_group != null ? "Supersetted with above" : "Superset with above"}
          </button>
        )}
      </div>
    </div>
  );
}

// --- read card (collapsed exercise) ----------------------------------------

function ReadCard({
  exercise,
  name,
  onFocus,
}: {
  exercise: PlannedExerciseDraft;
  name: string | undefined;
  onFocus: () => void;
}) {
  const summary = summarizeDraftSets(exercise.sets);
  return (
    <button
      type="button"
      onClick={onFocus}
      className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-left transition hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)]/50"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-[var(--foreground)]">
          {name ?? exercise.exercise_id ?? "Select exercise"}
        </span>
        {summary && (
          <span className="truncate text-[11px] tabular-nums text-[var(--muted)]">{summary}</span>
        )}
      </span>
      <span className="shrink-0 text-[var(--muted)]">
        <PencilIcon />
      </span>
    </button>
  );
}

// --- searchable exercise picker --------------------------------------------

function ExercisePicker({
  value,
  catalog,
  onSelect,
}: {
  value: string;
  catalog: Exercise[];
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const selectedName = catalog.find((c) => c.id === value)?.name ?? "";
  const results = useMemo(() => filterExercises(catalog, query).slice(0, 8), [catalog, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        aria-label="Exercise"
        value={open ? query : selectedName}
        placeholder={selectedName || "Search exercises…"}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        className={inputClasses}
      />
      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] py-1 shadow-2xl"
        >
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(ex.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`flex w-full flex-col px-3 py-1.5 text-left transition hover:bg-[var(--surface-2)] ${
                  ex.id === value ? "text-[var(--accent)]" : "text-[var(--foreground)]"
                }`}
              >
                <span className="text-sm">{ex.name}</span>
                {ex.muscle_groups.length > 0 && (
                  <span className="text-[10px] text-[var(--muted)]">
                    {ex.muscle_groups.join(", ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- pure helpers (exported for tests) -------------------------------------

/** Next free superset group id: 1 + current max, or 1 when none exist. */
export function nextGroupId(exercises: PlannedExerciseDraft[]): number {
  const groups = exercises.map((e) => e.superset_group).filter((g): g is number => g != null);
  return groups.length ? Math.max(...groups) + 1 : 1;
}

/**
 * Toggle whether exercise `i` is supersetted with the exercise directly above
 * it (i-1). Turning it on joins the previous exercise's group (creating one if
 * needed); turning it off removes `i` from its group. The result is
 * normalized so no group is left with fewer than two consecutive members.
 */
export function toggleSupersetWithPrevious(
  exercises: PlannedExerciseDraft[],
  i: number,
): PlannedExerciseDraft[] {
  if (i <= 0 || i >= exercises.length) return exercises;
  const next = exercises.map((e) => ({ ...e }));
  const alreadyGrouped =
    next[i].superset_group != null && next[i].superset_group === next[i - 1].superset_group;
  if (alreadyGrouped) {
    next[i].superset_group = null;
  } else {
    const group = next[i - 1].superset_group ?? nextGroupId(exercises);
    next[i - 1].superset_group = group;
    next[i].superset_group = group;
  }
  return normalizeSupersets(next);
}

/**
 * Enforce the superset invariants: groups must be consecutive runs of 2+
 * exercises. Any group that ends up with a single isolated member (e.g. after
 * a removal split it) is cleared back to standalone.
 */
export function normalizeSupersets(exercises: PlannedExerciseDraft[]): PlannedExerciseDraft[] {
  const out = exercises.map((e) => ({ ...e }));
  let i = 0;
  while (i < out.length) {
    const g = out[i].superset_group;
    if (g == null) {
      i++;
      continue;
    }
    let j = i;
    while (j < out.length && out[j].superset_group === g) j++;
    if (j - i < 2) {
      for (let k = i; k < j; k++) out[k].superset_group = null;
    }
    i = j;
  }
  return out;
}

/**
 * Group exercises into consecutive render runs: a run of 2+ sharing a non-null
 * group is a superset; everything else is a singleton run (group null). Each
 * run carries the original indices so the editor can address exercises by
 * position.
 */
export function groupRuns(
  exercises: PlannedExerciseDraft[],
): { group: number | null; indices: number[] }[] {
  const runs: { group: number | null; indices: number[] }[] = [];
  exercises.forEach((ex, i) => {
    const last = runs[runs.length - 1];
    if (last && ex.superset_group != null && last.group === ex.superset_group) {
      last.indices.push(i);
    } else {
      runs.push({ group: ex.superset_group, indices: [i] });
    }
  });
  return runs;
}

/** Compact one-line summary of a draft exercise's sets for the read card. */
export function summarizeDraftSets(sets: PlannedSetDraft[]): string {
  const groups: { count: number; reps: string; weight: string; unit: string; amrap: boolean }[] =
    [];
  for (const s of sets) {
    const reps = s.target_reps.trim();
    const weight = s.target_weight.trim();
    const last = groups[groups.length - 1];
    if (
      last &&
      last.amrap === s.amrap &&
      last.reps === reps &&
      last.weight === weight &&
      last.unit === s.unit
    ) {
      last.count += 1;
    } else {
      groups.push({ count: 1, reps, weight, unit: s.unit, amrap: s.amrap });
    }
  }
  return groups
    .map((g) => {
      const reps = g.amrap ? "AMRAP" : g.reps !== "" ? g.reps : "—";
      let line = `${g.count}×${reps}`;
      if (g.weight !== "") line += ` @ ${g.weight} ${g.unit}`;
      return line;
    })
    .join(", ");
}

// --- styles + icons --------------------------------------------------------

const inputClasses =
  "w-full rounded-lg border border-transparent bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition focus-visible:border-[var(--accent)] focus-visible:outline-none";

const cellClasses =
  "w-full rounded-md border border-transparent bg-[var(--surface-2)] px-2 py-1.5 text-sm text-[var(--foreground)] transition focus-visible:border-[var(--accent)] focus-visible:outline-none";

function PlusIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PencilIcon() {
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
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon({ small = false }: { small?: boolean }) {
  const s = small ? 12 : 14;
  return (
    <svg
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
