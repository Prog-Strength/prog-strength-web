"use client";

/**
 * Review + save screen (`/workout/review`).
 *
 * The last step of the live-logging flow: a full, editable view of the
 * draft (name, notes, every exercise/set) plus the two timestamps the
 * live screen doesn't surface — `performed_at` and `ended_at`, edited as
 * `datetime-local` inputs. `ended_at` defaults to "now" so the common
 * "finished, save it" path needs no typing.
 *
 * Saving fires the single `POST /workouts` via the provider's `save()`:
 * on success the provider clears the draft, we surface any PRs as toasts
 * (they outlive the navigation because ToastProvider is mounted at the
 * root layout), and route to the saved workout's detail page. On failure
 * the error is shown inline and the draft is preserved so the user can
 * retry. A confirm-gated "Discard" is offered here too (per the SOW).
 *
 * Like the live screen this owns no draft of its own — every edit goes
 * through `useActiveWorkoutSession()`. Exercise/superset editing reuses
 * the live ExerciseCard / SupersetCard; superset *creation* is a
 * live-screen concern, so review runs the cards in non-selecting mode.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listExercises, type Exercise } from "@/lib/api";
import { useActiveWorkoutSession } from "@/lib/active-workout-session";
import { isSessionSaveable, type DraftExercise } from "@/lib/workout-draft";
import { localInputToRFC3339, rfc3339ToLocalInput } from "@/lib/datetime";
import { useToast } from "@/components/toast";
import { ExerciseCard } from "@/components/live-workout/exercise-card";
import { SupersetCard, type SupersetMember } from "@/components/live-workout/superset-card";

type StandaloneItem = { kind: "exercise"; index: number; exercise: DraftExercise };
type SupersetItem = { kind: "superset"; group: number; members: SupersetMember[] };
type RenderItem = StandaloneItem | SupersetItem;

/** Same collapsing logic as the live screen — keep the two in sync. */
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

const inputClasses =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none";

export default function ReviewWorkoutPage() {
  const router = useRouter();
  const toast = useToast();
  const {
    session,
    setName,
    setNotes,
    addSet,
    updateSet,
    removeSet,
    removeExercise,
    reorderExercise,
    setExerciseNotes,
    ungroupSuperset,
    logSupersetRound,
    setTimes,
    discard,
    save,
  } = useActiveWorkoutSession();

  const [catalog, setCatalog] = useState<Exercise[]>([]);
  // Local datetime-local form values. Seeded once at mount from the draft's
  // performed_at and "now" for ended_at (the session is hydrated
  // synchronously by the provider, so it's available on first render).
  // Held locally so editing is snappy and so later draft mutations (e.g.
  // editing a set) never clobber the user's timestamp edits; performed_at
  // is written through to the draft on save.
  const [performedAt, setPerformedAt] = useState(() =>
    session ? rfc3339ToLocalInput(session.performed_at) : "",
  );
  const [endedAt, setEndedAt] = useState(() =>
    session ? rfc3339ToLocalInput(new Date().toISOString()) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nothing to review without a session — bounce back to the workouts view.
  useEffect(() => {
    if (session === null) router.replace("/activities?view=workouts");
  }, [session, router]);

  // Catalog loads once for name resolution; degrades to slugs on failure.
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

  const canSave = isSessionSaveable(session);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      // Write the (possibly edited) performed_at back to the draft, then
      // save with the chosen ended_at. ended_at is passed straight to
      // save() — the draft has no ended_at field.
      const performedRFC = performedAt ? localInputToRFC3339(performedAt) : undefined;
      const endedRFC = endedAt ? localInputToRFC3339(endedAt) : undefined;
      if (performedRFC) setTimes(performedRFC);
      const created = await save(endedRFC);
      // Surface PRs before navigating; the toasts persist across the route
      // change because ToastProvider lives in the root layout.
      for (const pr of created.personal_records_set) {
        const name = catalogMap.get(pr.exercise_id)?.name ?? pr.exercise_id;
        toast.success(`New PR: ${name} ${pr.weight}${pr.unit} × ${pr.reps}`);
      }
      router.replace(`/workouts/${created.id}`);
    } catch (e) {
      // Draft is preserved by the provider on failure — show the error and
      // let the user retry.
      setError(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    if (window.confirm("Discard this workout? Everything you've logged will be lost.")) {
      discard();
      router.replace("/activities?view=workouts");
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-6">
        <h1 className="flex-1 text-base font-semibold">Review workout</h1>
        <button
          type="button"
          onClick={() => router.push("/workout/live")}
          className="shrink-0 rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          Back to logging
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Name</span>
            <input
              type="text"
              value={session.name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workout name"
              className={inputClasses}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--muted)]">
                Started at<span className="ml-0.5 text-[var(--danger)]">*</span>
              </span>
              <input
                type="datetime-local"
                value={performedAt}
                onChange={(e) => setPerformedAt(e.target.value)}
                className={inputClasses}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-medium text-[var(--muted)]">Ended at</span>
              <input
                type="datetime-local"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className={inputClasses}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-medium text-[var(--muted)]">Notes</span>
            <textarea
              value={session.notes ?? ""}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything worth remembering about this session"
              className={`${inputClasses} resize-y`}
            />
          </label>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium">Exercises</h2>
            {session.exercises.length === 0 && (
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 text-center text-sm text-[var(--muted)]">
                This workout has no exercises. Go back to logging to add some.
              </p>
            )}
            {items.map((item) =>
              item.kind === "exercise" ? (
                <ExerciseCard
                  key={`ex-${item.index}`}
                  index={item.index}
                  exercise={item.exercise}
                  catalog={catalogMap}
                  total={session.exercises.length}
                  selecting={false}
                  selected={false}
                  onToggleSelected={() => {}}
                  onStartSelecting={() => {}}
                  onAddSet={(set) => addSet(item.index, set)}
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
                  onLogRound={(sets) => logSupersetRound(item.group, sets)}
                  onUngroup={() => ungroupSuperset(item.group)}
                  onUpdateSet={(exIdx, setIdx, patch) => updateSet(exIdx, setIdx, patch)}
                  onRemoveSet={(exIdx, setIdx) => removeSet(exIdx, setIdx)}
                />
              ),
            )}
          </div>
        </div>
      </div>

      <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-4 py-3 sm:px-6">
        {error && (
          <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleDiscard}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save workout"}
          </button>
        </div>
      </footer>
    </main>
  );
}
