"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteWorkout,
  listExercises,
  listWorkouts,
  type Exercise,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from "@/lib/api";
import { WorkoutModal } from "@/components/workout-modal";

/**
 * Workouts overview. Lists the user's recent sessions, filtered by a
 * client-side timeframe selection. Clicking a row opens the edit modal
 * so the user can fix up anything that came in wrong from chat-driven
 * logging.
 *
 * Data is fetched once on mount: workouts (auth'd) + exercises (public)
 * in parallel. Filtering is purely client-side — the API caps results
 * at 50 and the handler doesn't yet expose since/until query params,
 * so a power user with >50 workouts in 90 days could see gaps.
 */

type Timeframe = "7d" | "30d" | "90d" | "all";

const TIMEFRAMES: { id: Timeframe; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All", days: null },
];

export default function WorkoutsPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [editing, setEditing] = useState<Workout | null>(null);
  // Tracks which rows have their readonly details panel open. Click on
  // the row body toggles; click on the pencil opens the edit modal.
  // Separate UI surfaces because reading and editing are different
  // mental modes — the modal is heavyweight for the read case.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([listWorkouts(token), listExercises()])
      .then(([ws, es]) => {
        setWorkouts(ws);
        setExercises(es);
      })
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  const filteredWorkouts = useMemo(() => {
    if (!workouts) return null;
    const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days;
    if (days === null || days === undefined) return workouts;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return workouts.filter((w) => new Date(w.performed_at).getTime() >= cutoff);
  }, [workouts, timeframe]);

  // Indexed lookup for the expanded view — turns `exercise_id` slugs
  // ("barbell-bench-press") into the user-facing name.
  const exerciseMap = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises],
  );

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Splice the modal's returned workout back into local state so the
  // row reflects edits immediately without a refetch round-trip.
  const handleSaved = (updated: Workout) =>
    setWorkouts((ws) =>
      ws ? ws.map((w) => (w.id === updated.id ? updated : w)) : ws,
    );

  // Destructive action; gate behind a native confirm() so users can't
  // mis-click and lose data. The label echoes the workout's identity
  // (real name when set, falls back to formatted date) so the user
  // sees what they're about to remove. Server-side this is a soft
  // delete — but from the user's perspective it's gone.
  const handleDelete = async (workout: Workout) => {
    const label = hasMeaningfulName(workout.name)
      ? workout.name
      : formatDate(workout.performed_at);
    if (!window.confirm(`Delete "${label}"? This removes the workout from your history.`)) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    try {
      await deleteWorkout(token, workout.id);
      setWorkouts((ws) =>
        ws ? ws.filter((w) => w.id !== workout.id) : ws,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Workouts</h1>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => {
            const active = tf.id === timeframe;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && workouts === null && (
            <p className="text-sm text-[var(--muted)]">Loading workouts…</p>
          )}

          {filteredWorkouts && filteredWorkouts.length === 0 && (
            <EmptyState />
          )}

          {filteredWorkouts && filteredWorkouts.length > 0 && (
            <ul className="flex flex-col gap-2">
              {filteredWorkouts.map((w) => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  expanded={expanded.has(w.id)}
                  onToggleExpanded={() => toggleExpanded(w.id)}
                  onEdit={() => setEditing(w)}
                  onDelete={() => handleDelete(w)}
                  exerciseMap={exerciseMap}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {editing && (
        <WorkoutModal
          workout={editing}
          catalog={exercises}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">No workouts in this timeframe</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Log a session from the chat by describing it in plain language —
        try &quot;log Tuesday&apos;s push day&quot;.
      </p>
    </div>
  );
}

function WorkoutRow({
  workout,
  expanded,
  onToggleExpanded,
  onEdit,
  onDelete,
  exerciseMap,
}: {
  workout: Workout;
  expanded: boolean;
  onToggleExpanded: () => void;
  onEdit: () => void;
  onDelete: () => void;
  exerciseMap: Map<string, Exercise>;
}) {
  const named = hasMeaningfulName(workout.name);
  return (
    <li className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      {/* Two sibling buttons in the header so the expand-vs-edit
          interaction is unambiguous. Nesting the pencil inside the
          row button would trip "buttons can't nest" and stop click
          events propagating. */}
      <div className="flex items-stretch">
        {/* min-w-0 on the flex children — both the button itself and
            the inner column — is what lets `truncate` on the <p>s
            actually clip. Without it, flex items default to
            min-width: auto, which means content can grow the item
            past its flex-1 share. That was pushing the pencil button
            off the right edge of the page when a workout had a long
            notes line. */}
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
        >
          <ChevronIcon expanded={expanded} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-sm font-medium">
              {named ? workout.name : formatDate(workout.performed_at)}
            </p>
            <p className="truncate text-xs text-[var(--muted)]">
              {named && `${formatDate(workout.performed_at)} · `}
              {formatDuration(workout.performed_at, workout.ended_at ?? null)}{" "}
              · {workout.exercises.length}{" "}
              {workout.exercises.length === 1 ? "exercise" : "exercises"}
            </p>
            {workout.notes && (
              <p className="truncate text-xs text-[var(--muted)]">
                {workout.notes}
              </p>
            )}
          </div>
        </button>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit workout"
          // Border-l only — the rest of the row's border is the card.
          // Title surfaces the action on hover since the icon alone
          // isn't fully self-explanatory.
          title="Edit workout"
          className="flex shrink-0 items-center border-l border-[var(--border)] px-3 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete workout"
          title="Delete workout"
          // Hover turns the icon danger-red so the destructive nature
          // of the action is unmistakable before the user clicks.
          className="flex shrink-0 items-center border-l border-[var(--border)] px-3 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {workout.notes && (
            <p className="mb-3 whitespace-pre-wrap text-sm">{workout.notes}</p>
          )}
          <ul className="flex flex-col gap-3">
            {/* A superset is conceptually a single "block" in the
                workout — the lifter performs it as one unit, alternating
                sets across the included exercises. So we number by
                group (1, 2, 3, …) rather than by individual exercise:
                a superset gets one number applied to its header, and
                its sub-exercises are unnumbered inside. */}
            {groupExercises(workout.exercises).map((group, gIdx) => {
              const groupNum = gIdx + 1;
              return (
                <li key={gIdx}>
                  {group.length > 1 ? (
                    <div className="rounded-r-md border-l-2 border-[var(--accent)] bg-[var(--surface-2)]/40 py-2 pl-3">
                      <p className="mb-2 flex items-baseline gap-2 text-sm font-medium">
                        <span>{groupNum}.</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                          Superset
                        </span>
                      </p>
                      <ul className="flex flex-col gap-2">
                        {group.map((we, i) => (
                          <li key={i}>
                            <ExerciseDetails
                              exercise={we}
                              exerciseMap={exerciseMap}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <ExerciseDetails
                      exercise={group[0]}
                      exerciseMap={exerciseMap}
                      index={groupNum}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </li>
  );
}

function ExerciseDetails({
  exercise,
  exerciseMap,
  index,
}: {
  exercise: WorkoutExercise;
  exerciseMap: Map<string, Exercise>;
  // Optional — standalone exercises receive their group number; sub-
  // exercises inside a superset are rendered without one (the superset's
  // own header carries the group number for the whole block).
  index?: number;
}) {
  const catalogEntry = exerciseMap.get(exercise.exercise_id);
  const setLines = formatSets(exercise.sets, catalogEntry);
  return (
    <div>
      <p className="text-sm font-medium">
        {index !== undefined && `${index}. `}
        {catalogEntry?.name ?? exercise.exercise_id}
      </p>
      {setLines.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--muted)] marker:text-[var(--muted)]">
          {setLines.map((line, j) => (
            <li key={j}>{line}</li>
          ))}
        </ul>
      )}
      {exercise.notes && (
        <p className="mt-1 text-xs italic text-[var(--muted)]">
          {exercise.notes}
        </p>
      )}
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
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
      className={`shrink-0 text-[var(--muted)] transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
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
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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

// --- formatting helpers ----------------------------------------------------

/**
 * Whether the workout's name field carries information beyond what the
 * date/time already conveys. See workout-modal.tsx for the same rule.
 */
function hasMeaningfulName(name: string | undefined): name is string {
  return !!name && !name.startsWith("Workout - ");
}

/**
 * Friendly date label. For very recent dates we use "Today" / "Yesterday"
 * since those are what lifters actually think in; older entries use the
 * full month + day so the timestamp is unambiguous.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThat.getTime()) / (24 * 60 * 60 * 1000),
  );

  let dayLabel: string;
  if (dayDiff === 0) dayLabel = "Today";
  else if (dayDiff === 1) dayLabel = "Yesterday";
  else if (dayDiff > 1 && dayDiff < 7)
    dayLabel = d.toLocaleDateString("en-US", { weekday: "long" });
  else
    dayLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dayLabel}, ${time}`;
}

/**
 * Duration as `Xh Ym` or `Mm` when under an hour. Returns an em-dash
 * for in-progress workouts (no ended_at recorded).
 */
function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Sets summary. Returns one human-readable line per *group* of sets,
 * where a group is a run of identical reps×weight×unit. A flat 5×5
 * across three sets renders as "5 reps × 3 sets @ 185 lbs" rather
 * than three duplicate bullets.
 *
 * For bilateral dumbbell exercises (where the recorded weight is the
 * per-dumbbell value, not the combined pair) the suffix "per dumbbell"
 * is appended so the meaning is unambiguous — e.g. `40 lbs per dumbbell`
 * tells the user they were holding two 40s, not a 40 lb combined load.
 *
 * Bodyweight (weight=0) drops the `@ weight` clause entirely.
 */
function formatSets(sets: WorkoutSet[], exercise?: Exercise): string[] {
  if (sets.length === 0) return [];
  const groups: { count: number; set: WorkoutSet }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && setsEqual(last.set, s)) {
      last.count += 1;
    } else {
      groups.push({ count: 1, set: s });
    }
  }

  const perDumbbell = isPerDumbbell(exercise);

  return groups.map((g) => {
    const repsPart = `${g.set.reps} ${pluralize("rep", g.set.reps)}`;
    const setsPart = `${g.count} ${pluralize("set", g.count)}`;
    let line = `${repsPart} × ${setsPart}`;
    if (g.set.weight > 0) {
      line += ` @ ${formatWeight(g.set.weight)} ${displayUnit(g.set.unit)}`;
      if (perDumbbell) {
        line += " per dumbbell";
      }
    }
    return line;
  });
}

function setsEqual(a: WorkoutSet, b: WorkoutSet): boolean {
  return a.reps === b.reps && a.weight === b.weight && a.unit === b.unit;
}

function formatWeight(w: number): string {
  // Strip trailing .0 for whole-number weights so "185" reads cleaner
  // than "185.0", but preserve the decimal for half-plate increments.
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}

/**
 * "lb" → "lbs" for plural-by-default display; kg stays as "kg" because
 * the technical abbreviation is invariant in casual usage.
 */
function displayUnit(unit: "lb" | "kg"): string {
  return unit === "lb" ? "lbs" : "kg";
}

function pluralize(noun: string, count: number): string {
  return count === 1 ? noun : `${noun}s`;
}

/**
 * Whether the recorded weight is per-implement (bilateral dumbbell
 * exercises) rather than the combined load. The signal is in the
 * exercise catalog: bilateral DB exercises carry "Record weight per
 * dumbbell, not the combined pair" in their description by convention
 * (see prog-strength-api/internal/exercise/catalog.go). Unilateral DB
 * exercises like dumbbell-tripod-row deliberately omit the phrase.
 *
 * The check is a substring match on description, gated by the
 * equipment field including "dumbbell" so an unrelated description
 * mentioning "per dumbbell" in passing can't trigger this.
 */
function isPerDumbbell(ex: Exercise | undefined): boolean {
  if (!ex) return false;
  if (!ex.equipment?.includes("dumbbell")) return false;
  return (ex.description ?? "").toLowerCase().includes("per dumbbell");
}

/**
 * Walk exercises in `order` and bucket consecutive entries that share
 * the same non-null `superset_group` into a single render group.
 * Standalone exercises (null superset_group) always start their own
 * single-element group.
 *
 * Why "consecutive same group" rather than "any same group anywhere":
 * supersets are physically performed back-to-back, so the order field
 * is the source of truth for sequence. Treating non-adjacent matches
 * as one group would let a malformed payload reshuffle the display
 * order in surprising ways.
 */
function groupExercises(exercises: WorkoutExercise[]): WorkoutExercise[][] {
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const groups: WorkoutExercise[][] = [];
  for (const ex of sorted) {
    const lastGroup = groups[groups.length - 1];
    const lastEx = lastGroup?.[lastGroup.length - 1];
    if (
      lastEx &&
      ex.superset_group != null &&
      lastEx.superset_group === ex.superset_group
    ) {
      lastGroup.push(ex);
    } else {
      groups.push([ex]);
    }
  }
  return groups;
}
