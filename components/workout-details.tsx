"use client";

import { useEffect } from "react";
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/lib/api";
import { MuscleGroupPill } from "@/components/muscle-group-pill";
import { predominantUnit, workoutVolume } from "@/lib/workout-volume";

/**
 * Readonly workout details — shared between the Workouts page (rendered
 * inline inside an expandable dropdown) and the Calendar page (rendered
 * inside a readonly modal). Single source of truth for how a workout's
 * exercises, sets, supersets, and muscle pills look — any change here
 * propagates to both surfaces.
 *
 * Pure presentation: the component reads from the workout payload and
 * the catalog map; it does not fetch or mutate. Edit affordances are
 * opt-in via `onEditGroup` — when omitted (the Workouts list inline view
 * and the Calendar modal) the component is fully read-only; when provided
 * (the workout detail page) each group renders a pencil that hands the
 * group back to the caller to open a focused editor.
 */
export function WorkoutDetailsBody({
  workout,
  exerciseMap,
  // When true, append a total-volume footer (sum of reps × weight across
  // every set). Off by default so the inline/modal surfaces stay unchanged.
  showTotalVolume = false,
  // When provided, each rendered group (a standalone exercise or a whole
  // superset) shows an edit pencil that calls this with the group's
  // exercises and its zero-based index. Omitted ⇒ read-only.
  onEditGroup,
}: {
  workout: Workout;
  exerciseMap: Map<string, Exercise>;
  showTotalVolume?: boolean;
  onEditGroup?: (group: WorkoutExercise[], groupIndex: number) => void;
}) {
  return (
    <div>
      {workout.notes && <p className="mb-3 whitespace-pre-wrap text-sm">{workout.notes}</p>}
      <ul className="flex flex-col gap-3">
        {/* A superset is conceptually a single "block" in the
            workout — performed alternating-set style as one unit.
            So numbering is by group (1, 2, 3, …): a superset gets
            its number on the header; its sub-exercises render
            unnumbered inside. */}
        {groupExercises(workout.exercises).map((group, gIdx) => {
          const groupNum = gIdx + 1;
          const body =
            group.length > 1 ? (
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
                      <ExerciseDetails exercise={we} exerciseMap={exerciseMap} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <ExerciseDetails exercise={group[0]} exerciseMap={exerciseMap} index={groupNum} />
            );

          return (
            <li key={gIdx}>
              {onEditGroup ? (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">{body}</div>
                  <button
                    type="button"
                    onClick={() => onEditGroup(group, gIdx)}
                    aria-label={group.length > 1 ? "Edit superset" : "Edit exercise"}
                    className="mt-0.5 shrink-0 rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
                  >
                    <PencilIcon />
                  </button>
                </div>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
      {showTotalVolume && (
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs font-medium text-[var(--muted)]">
          Total volume:{" "}
          <span className="text-[var(--foreground)]">
            {workoutVolume(workout, predominantUnit(workout)).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            {displayUnit(predominantUnit(workout))}
          </span>
        </p>
      )}
    </div>
  );
}

/**
 * Overlay-style modal wrapper for the readonly view. Used by the
 * Calendar page so clicking a workout pill brings up the full details
 * without giving the user an edit affordance (calendar is intentionally
 * read-only; edits happen from the Workouts page).
 *
 * Same dismissal ergonomics as the edit modal — Escape key, backdrop
 * click, and a close button. Body scroll is locked while open.
 */
export function WorkoutDetailsModal({
  workout,
  exerciseMap,
  onClose,
}: {
  workout: Workout;
  exerciseMap: Map<string, Exercise>;
  onClose: () => void;
}) {
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

  // Title: real name when set, otherwise the workout's date in
  // long form. Same fallback rule the rest of the UI applies.
  const title = hasMeaningfulName(workout.name)
    ? workout.name
    : new Date(workout.performed_at).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-details-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 id="workout-details-title" className="truncate text-base font-semibold">
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
          <WorkoutDetailsBody workout={workout} exerciseMap={exerciseMap} />
        </div>
      </div>
    </div>
  );
}

/**
 * Whether the workout's name field carries information beyond what
 * the date/time already conveys. The API auto-generates "Workout -
 * <date>" for create requests with no explicit name — those should
 * fall back to date-based display rather than restating the timestamp.
 *
 * Exported because the Workouts page row metadata and the Calendar
 * page pills also use this rule; keeping one source of truth here
 * means tweaks (e.g. catching a new auto-generated prefix) only
 * happen in one place.
 */
export function hasMeaningfulName(name: string | undefined): name is string {
  return !!name && !name.startsWith("Workout - ");
}

// --- per-exercise rendering ----------------------------------------------

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
  const muscleGroups = catalogEntry?.muscle_groups ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">
          {index !== undefined && `${index}. `}
          {catalogEntry?.name ?? exercise.exercise_id}
        </p>
        {muscleGroups.map((mg) => (
          <MuscleGroupPill key={mg} muscleGroup={mg} />
        ))}
      </div>
      {setLines.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-[var(--muted)] marker:text-[var(--muted)]">
          {setLines.map((line, j) => (
            <li key={j}>{line}</li>
          ))}
        </ul>
      )}
      {exercise.notes && (
        <p className="mt-1 text-xs italic text-[var(--muted)]">{exercise.notes}</p>
      )}
    </div>
  );
}

// --- helpers --------------------------------------------------------------

/**
 * Walk exercises in `order` and bucket consecutive entries that share
 * the same non-null `superset_group` into a single render group.
 * Standalone exercises (null superset_group) always start their own
 * single-element group. Non-adjacent same-group matches are
 * intentionally NOT merged — supersets are physically performed back-
 * to-back, so the order field is the source of truth for sequence.
 */
function groupExercises(exercises: WorkoutExercise[]): WorkoutExercise[][] {
  const sorted = [...exercises].sort((a, b) => a.order - b.order);
  const groups: WorkoutExercise[][] = [];
  for (const ex of sorted) {
    const lastGroup = groups[groups.length - 1];
    const lastEx = lastGroup?.[lastGroup.length - 1];
    if (lastEx && ex.superset_group != null && lastEx.superset_group === ex.superset_group) {
      lastGroup.push(ex);
    } else {
      groups.push([ex]);
    }
  }
  return groups;
}

/**
 * Sets summary. Returns one human-readable line per *group* of sets,
 * where a group is a run of identical reps×weight×unit. A flat 5×5
 * across three sets renders as "5 reps × 3 sets @ 185 lbs" rather
 * than three duplicate bullets.
 *
 * For bilateral dumbbell exercises (where the recorded weight is the
 * per-dumbbell value, not the combined pair) the suffix "per dumbbell"
 * is appended so the meaning is unambiguous.
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
 */
function isPerDumbbell(ex: Exercise | undefined): boolean {
  if (!ex) return false;
  if (!ex.equipment?.includes("dumbbell")) return false;
  return (ex.description ?? "").toLowerCase().includes("per dumbbell");
}

// --- icons ---------------------------------------------------------------

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

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
