"use client";

/**
 * The live workout-logging screen (`/workout/live`).
 *
 * Owns no draft of its own — every mutation goes through
 * `useActiveWorkoutSession()`; the screen is a view over that session.
 * On mount: if there's no session there's nothing to log, so we bounce
 * back to the workouts view. The exercise catalog (public, unauthed) is
 * fetched once for name resolution + the add-exercise search.
 *
 * Layout: a sticky header with the inline-editable name, a ticking
 * duration clock, and "Finish" (→ review); a scrollable body with the
 * add-exercise search and the ordered list of exercise/superset cards;
 * a footer with a confirm-gated "Discard". The floating rest timer is
 * rendered alongside.
 *
 * Supersets: exercises carry a `superset_group`; the list is rendered by
 * walking the array in order and collapsing each contiguous run of one
 * group into a single SupersetCard, so a superset shows where its first
 * member sits.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listExercises, type Exercise } from "@/lib/api";
import { useActiveWorkoutSession } from "@/lib/active-workout-session";
import type { DraftExercise } from "@/lib/workout-draft";
import { DurationClock } from "@/components/live-workout/duration-clock";
import { ExerciseSearch } from "@/components/live-workout/exercise-search";
import { ExerciseCard } from "@/components/live-workout/exercise-card";
import { SupersetCard, type SupersetMember } from "@/components/live-workout/superset-card";
import { RestTimer } from "@/components/live-workout/rest-timer";

type StandaloneItem = { kind: "exercise"; index: number; exercise: DraftExercise };
type SupersetItem = { kind: "superset"; group: number; members: SupersetMember[] };
type RenderItem = StandaloneItem | SupersetItem;

/**
 * Collapse the ordered exercise array into render items: a standalone
 * exercise stays a single item; a contiguous run sharing one
 * `superset_group` becomes one superset item anchored where the run
 * starts. Non-contiguous members of the same group (shouldn't happen via
 * the UI, but be defensive) merge into the group's first occurrence.
 */
function buildRenderItems(exercises: DraftExercise[]): RenderItem[] {
  const items: RenderItem[] = [];
  const groupItem = new Map<number, SupersetItem>();
  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    if (ex.superset_group === null) {
      items.push({ kind: "exercise", index: i, exercise: ex });
      continue;
    }
    const existing = groupItem.get(ex.superset_group);
    if (existing) {
      existing.members.push({ index: i, exercise: ex });
    } else {
      const item: SupersetItem = {
        kind: "superset",
        group: ex.superset_group,
        members: [{ index: i, exercise: ex }],
      };
      groupItem.set(ex.superset_group, item);
      items.push(item);
    }
  }
  return items;
}

export default function LiveWorkoutPage() {
  const router = useRouter();
  const {
    session,
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
    setExerciseNotes,
    startRestTimer,
    discard,
  } = useActiveWorkoutSession();

  const [catalog, setCatalog] = useState<Exercise[]>([]);
  // Superset-building selection mode: indices the user has checked.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Nothing to log without a session — send the user back to start one.
  useEffect(() => {
    if (session === null) router.replace("/activities?view=workouts");
  }, [session, router]);

  // Catalog loads once; name resolution degrades to the slug if it fails.
  useEffect(() => {
    listExercises()
      .then(setCatalog)
      .catch(() => {
        /* names fall back to slugs */
      });
  }, []);

  const catalogMap = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);
  const items = useMemo(() => (session ? buildRenderItems(session.exercises) : []), [session]);

  if (!session) return null;

  const toggleSelected = (index: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const cancelSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };

  const confirmSuperset = () => {
    if (selected.size >= 2) createSuperset([...selected]);
    cancelSelecting();
  };

  const handleAddSet = (exIdx: number, set: Parameters<typeof addSet>[1]) => {
    addSet(exIdx, set);
    startRestTimer();
  };

  const handleLogRound = (group: number, sets: Record<number, Parameters<typeof addSet>[1]>) => {
    logSupersetRound(group, sets);
    startRestTimer();
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <input
          type="text"
          value={session.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Workout name"
          aria-label="Workout name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-1 text-base font-semibold text-[var(--foreground)] hover:border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
        />
        <DurationClock performedAt={session.performed_at} />
        <button
          type="button"
          onClick={() => router.push("/workout/review")}
          className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90"
        >
          Finish
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <ExerciseSearch catalog={catalog} onAdd={addExercise} />

          {selecting && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-2 text-xs">
              <span className="text-[var(--muted)]">
                Select 2 or more exercises to group, then confirm.
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={cancelSelecting}
                  className="rounded-md border border-[var(--border)] px-2 py-1 transition hover:bg-[var(--surface-2)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSuperset}
                  disabled={selected.size < 2}
                  className="rounded-md bg-[var(--accent)] px-2 py-1 font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
                >
                  Group {selected.size > 0 ? `(${selected.size})` : ""}
                </button>
              </div>
            </div>
          )}

          {session.exercises.length === 0 && (
            <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--muted)]">
              Search above to add your first exercise.
            </p>
          )}

          <div className="flex flex-col gap-4">
            {items.map((item) =>
              item.kind === "exercise" ? (
                <ExerciseCard
                  key={`ex-${item.index}`}
                  index={item.index}
                  exercise={item.exercise}
                  catalog={catalogMap}
                  total={session.exercises.length}
                  selecting={selecting}
                  selected={selected.has(item.index)}
                  onToggleSelected={() => toggleSelected(item.index)}
                  onStartSelecting={() => {
                    setSelecting(true);
                    setSelected(new Set([item.index]));
                  }}
                  onAddSet={(set) => handleAddSet(item.index, set)}
                  onUpdateSet={(setIdx, patch) => updateSet(item.index, setIdx, patch)}
                  onRemoveSet={(setIdx) => removeSet(item.index, setIdx)}
                  onSetNotes={(notes) => setExerciseNotes(item.index, notes)}
                  onRemove={() => removeExercise(item.index)}
                  onReorder={(to) => reorderExercise(item.index, to)}
                />
              ) : (
                <SupersetCard
                  key={`ss-${item.group}`}
                  members={item.members}
                  catalog={catalogMap}
                  onLogRound={(sets) => handleLogRound(item.group, sets)}
                  onUngroup={() => ungroupSuperset(item.group)}
                  onUpdateSet={(exIdx, setIdx, patch) => updateSet(exIdx, setIdx, patch)}
                  onRemoveSet={(exIdx, setIdx) => removeSet(exIdx, setIdx)}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => {
            if (window.confirm("Discard this workout? Everything you've logged will be lost.")) {
              discard();
              router.replace("/activities?view=workouts");
            }
          }}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
        >
          Discard
        </button>
        <span className="text-xs text-[var(--muted)]">
          {session.exercises.length} {session.exercises.length === 1 ? "exercise" : "exercises"}
        </span>
      </footer>

      <RestTimer />
    </main>
  );
}
