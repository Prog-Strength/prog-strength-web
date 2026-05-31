"use client";

import { useEffect, useMemo, useState } from "react";
import {
  listExercises,
  listHeadlineExerciseDefaults,
  listMyHeadlineExercises,
  putMyHeadlineExercises,
  type Exercise,
  type HeadlineExercise,
} from "@/lib/api";

/**
 * Customize-your-headline-exercises modal.
 *
 * Opened from the Personal Records page. On mount, fetches in parallel:
 *   - the full exercise catalog (to render the picker grouped by muscle group)
 *   - the user's current selection (to pre-check the right boxes; falls
 *     back to defaults server-side when the user has never customized)
 *   - the curated defaults (to badge "(default)" on catalog items and
 *     implement "Reset to defaults")
 *
 * Save sends a single PUT that replaces the user's selection. On
 * success, calls `onSaved` so the parent page can refetch the PR list
 * and close the modal. Validation (cap, dupes, unknown slugs) lives
 * server-side; client only enforces the cap pre-emptively so the
 * "Save" button reflects valid state without a roundtrip.
 *
 * Dismissal ergonomics mirror the other modals in the app: Escape
 * key, backdrop click, explicit Close button. Body scroll locks
 * while open. See `components/workout-modal.tsx`.
 */

// Mirrors the backend's MaxHeadlineExercises constant. Worth
// duplicating: it's a small int we want the Save button to react to
// without a round-trip, and there are exactly two places we have to
// keep in sync.
const MAX_SELECTION = 12;

export function HeadlineExercisesModal({
  token,
  onSaved,
  onClose,
}: {
  token: string;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [catalog, setCatalog] = useState<Exercise[] | null>(null);
  // Selected exercise IDs in display order. Insertion order is the
  // order saves get persisted with — the user's act of checking a
  // box implies "add this to the end of my list."
  const [selectedIDs, setSelectedIDs] = useState<string[]>([]);
  // Slugs in the curated default set, used for the "(default)" badge.
  const [defaultIDs, setDefaultIDs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load — three calls in parallel. The modal renders a
  // spinner until all three resolve so the picker doesn't pop with
  // wrong check state. Initial loading/error state is set via
  // useState defaults; the effect only writes state from inside
  // async callbacks so the React 19 "no sync setState in effect"
  // lint rule is satisfied.
  useEffect(() => {
    Promise.all([
      listExercises(),
      listMyHeadlineExercises(token),
      listHeadlineExerciseDefaults(token),
    ])
      .then(([cat, mine, defaults]) => {
        setCatalog(cat);
        setSelectedIDs(mine.map((m: HeadlineExercise) => m.exercise_id));
        setDefaultIDs(new Set(defaults.map((d) => d.exercise_id)));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  // Escape closes the modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Group catalog by muscle group for the picker. An exercise that
  // targets multiple primary muscles appears once per group — the
  // checkbox state is keyed by exercise ID so checking it under
  // "Chest" simultaneously checks it under "Triceps" if it lives in
  // both. Acceptable; the lifter is selecting the exercise, not the
  // muscle-group instance.
  const byMuscleGroup = useMemo(() => {
    if (!catalog) return new Map<string, Exercise[]>();
    const m = new Map<string, Exercise[]>();
    for (const ex of catalog) {
      for (const mg of ex.muscle_groups) {
        const arr = m.get(mg) ?? [];
        arr.push(ex);
        m.set(mg, arr);
      }
    }
    // Sort exercises within each group by name so the picker reads
    // alphabetically — easier to scan than the catalog's source order.
    for (const [, arr] of m) {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return m;
  }, [catalog]);

  const selectedSet = useMemo(() => new Set(selectedIDs), [selectedIDs]);

  function toggle(exerciseID: string) {
    setSelectedIDs((prev) => {
      if (prev.includes(exerciseID)) {
        return prev.filter((id) => id !== exerciseID);
      }
      if (prev.length >= MAX_SELECTION) {
        // Silently refuse — the cap warning below tells the user
        // why. Avoids a confusing toggle that visually flips back.
        return prev;
      }
      return [...prev, exerciseID];
    });
  }

  function resetToDefaults() {
    setSelectedIDs(Array.from(defaultIDs));
  }

  async function save() {
    if (selectedIDs.length === 0) {
      setError("Pick at least one exercise.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await putMyHeadlineExercises(token, selectedIDs);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const atCap = selectedIDs.length >= MAX_SELECTION;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="headline-exercises-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !saving && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="headline-exercises-modal-title" className="text-base font-semibold">
              Customize headline lifts
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Pick the exercises you want surfaced on this page. Up to {MAX_SELECTION}.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && <p className="text-sm text-[var(--muted)]">Loading catalog…</p>}
          {!loading && error && (
            <div className="mb-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
          {!loading && catalog && (
            <div className="flex flex-col gap-5">
              {Array.from(byMuscleGroup.entries())
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([muscleGroup, exercises]) => (
                  <section
                    key={muscleGroup}
                    className="flex flex-col gap-2"
                    aria-labelledby={`mg-${muscleGroup}`}
                  >
                    <h3
                      id={`mg-${muscleGroup}`}
                      className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
                    >
                      {muscleGroup}
                    </h3>
                    <ul className="flex flex-col">
                      {exercises.map((ex) => {
                        const checked = selectedSet.has(ex.id);
                        const isDefault = defaultIDs.has(ex.id);
                        const disabled = !checked && atCap;
                        return (
                          <li key={`${muscleGroup}:${ex.id}`}>
                            <label
                              className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition hover:bg-[var(--surface)] ${
                                disabled ? "cursor-not-allowed opacity-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled || saving}
                                onChange={() => toggle(ex.id)}
                                className="h-4 w-4 accent-[var(--accent)]"
                              />
                              <span className="flex-1 truncate">{ex.name}</span>
                              {isDefault && (
                                <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
                                  default
                                </span>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-3">
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            <span>
              {selectedIDs.length} / {MAX_SELECTION} selected
            </span>
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={loading || saving}
              className="text-[var(--accent)] hover:underline disabled:opacity-50"
            >
              Reset to defaults
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={loading || saving || selectedIDs.length === 0}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
