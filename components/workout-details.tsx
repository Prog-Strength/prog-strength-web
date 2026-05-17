"use client";

import { useEffect } from "react";
import type {
  Exercise,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/api";

/**
 * Readonly workout details — shared between the Workouts page (rendered
 * inline inside an expandable dropdown) and the Calendar page (rendered
 * inside a readonly modal). Single source of truth for how a workout's
 * exercises, sets, supersets, and muscle pills look — any change here
 * propagates to both surfaces.
 *
 * Pure presentation: the component reads from the workout payload and
 * the catalog map; it does not fetch or mutate. Edit affordances live
 * outside this component (the Workouts page renders a pencil button
 * next to each row that opens the edit modal; the Calendar page has
 * no edit affordance by design).
 */
export function WorkoutDetails({
  workout,
  exerciseMap,
}: {
  workout: Workout;
  exerciseMap: Map<string, Exercise>;
}) {
  return (
    <div>
      {workout.notes && (
        <p className="mb-3 whitespace-pre-wrap text-sm">{workout.notes}</p>
      )}
      <ul className="flex flex-col gap-3">
        {/* A superset is conceptually a single "block" in the
            workout — performed alternating-set style as one unit.
            So numbering is by group (1, 2, 3, …): a superset gets
            its number on the header; its sub-exercises render
            unnumbered inside. */}
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
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2
            id="workout-details-title"
            className="truncate text-base font-semibold"
          >
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
          <WorkoutDetails workout={workout} exerciseMap={exerciseMap} />
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
export function hasMeaningfulName(
  name: string | undefined,
): name is string {
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
        <p className="mt-1 text-xs italic text-[var(--muted)]">
          {exercise.notes}
        </p>
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

// --- muscle group pills --------------------------------------------------

/**
 * One filled-pill color per muscle group so a workout's targeted areas
 * read at a glance. Tailwind 500-shade palette with /15 background +
 * 300 text + /30 border gives a uniformly subtle look that reads on
 * the dark background without competing with the surrounding type.
 * Unknown muscle groups fall back to a neutral zinc.
 */
const MUSCLE_GROUP_CLASSES: Record<string, string> = {
  chest: "bg-red-500/15 text-red-300 border-red-500/30",
  back: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  shoulders: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  biceps: "bg-teal-500/15 text-teal-300 border-teal-500/30",
  triceps: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  forearms: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  core: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  quads: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
  hamstrings: "bg-lime-500/15 text-lime-300 border-lime-500/30",
  glutes: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  calves: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

function MuscleGroupPill({ muscleGroup }: { muscleGroup: string }) {
  const classes =
    MUSCLE_GROUP_CLASSES[muscleGroup] ??
    "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  return (
    <span
      className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${classes}`}
    >
      {humanizeMuscleGroup(muscleGroup)}
    </span>
  );
}

function humanizeMuscleGroup(mg: string): string {
  return mg
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// --- icons ---------------------------------------------------------------

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
