"use client";

import { useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import { getWorkout, type Exercise, type Workout, type WorkoutExercise } from "@/lib/api";
import { WorkoutDetailsBody } from "@/components/workout-details";
import { MuscleGroupRadarChart } from "@/components/muscle-group-radar-chart";

/**
 * The workout body of a timeline card. The feed projection is denormalized
 * (title + metric chips only), so to surface the actual programming — which
 * lifts, how many sets, which muscles — we fetch the underlying workout by
 * `sourceId`. This mirrors the deep-link the card title already points at
 * (`/workouts/{id}`), so it only resolves for the viewer's own posts; that's
 * the same ownership scope the timeline has today.
 *
 * Two disclosure levels keep a feed card short by default:
 *   collapsed — the first {@link MAX_PREVIEW_EXERCISES} exercises by name +
 *               set count, with a "+N more" hint. Just enough to read the
 *               session at a glance without a wall of sets.
 *   expanded  — the full exercise/set breakdown (shared WorkoutDetailsBody)
 *               plus the muscle-group radar, for readers who want the detail.
 */

const MAX_PREVIEW_EXERCISES = 3;

export function WorkoutTimelineSummary({
  sourceId,
  // The shared exercise catalog, hydrated once by the feed and passed down so
  // every card can resolve slugs → names and feed the radar without its own
  // catalog fetch.
  exercises,
}: {
  sourceId: string;
  exercises: Exercise[];
}) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getWorkout(token, sourceId)
      .then((w) => {
        if (!cancelled) setWorkout(w);
      })
      .catch(() => {
        // Degrade silently to the bare card (title + metric chips) on any
        // failure — a missing exercise breakdown shouldn't break the feed.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  if (failed) return null;

  // Gate on both the workout and the catalog: names and the radar both need
  // the catalog, so rendering before it lands would flash slugs / an empty
  // chart.
  if (!workout || exercises.length === 0) {
    return <p className="text-xs text-[var(--muted)]">Loading exercises…</p>;
  }
  if (workout.exercises.length === 0) return null;

  const ordered = [...workout.exercises].sort((a, b) => a.order - b.order);
  const preview = ordered.slice(0, MAX_PREVIEW_EXERCISES);
  const remaining = ordered.length - preview.length;

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5">
      {expanded ? (
        <>
          <WorkoutDetailsBody workout={workout} exerciseMap={exerciseMap} />
          <div className="border-t border-[var(--border)] pt-2">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Muscle groups targeted
            </h3>
            <MuscleGroupRadarChart workouts={[workout]} exercises={exercises} />
          </div>
          <ToggleButton expanded onClick={() => setExpanded(false)} />
        </>
      ) : (
        <>
          <ul className="flex flex-col gap-1">
            {preview.map((we, i) => (
              <ExercisePreviewRow key={i} exercise={we} exerciseMap={exerciseMap} />
            ))}
          </ul>
          {remaining > 0 && (
            <p className="text-xs text-[var(--muted)]">
              +{remaining} more exercise{remaining === 1 ? "" : "s"}
            </p>
          )}
          <ToggleButton expanded={false} onClick={() => setExpanded(true)} />
        </>
      )}
    </div>
  );
}

/** One row of the collapsed preview: exercise name + a muted set count. */
function ExercisePreviewRow({
  exercise,
  exerciseMap,
}: {
  exercise: WorkoutExercise;
  exerciseMap: Map<string, Exercise>;
}) {
  const name = exerciseMap.get(exercise.exercise_id)?.name ?? exercise.exercise_id;
  const count = exercise.sets.length;
  return (
    <li className="flex items-baseline justify-between gap-2 text-sm">
      <span className="truncate text-[var(--foreground)]">{name}</span>
      {count > 0 && (
        <span className="shrink-0 text-xs tabular-nums text-[var(--muted)]">
          {count} {count === 1 ? "set" : "sets"}
        </span>
      )}
    </li>
  );
}

function ToggleButton({ expanded, onClick }: { expanded: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className="flex items-center gap-1 self-start text-xs font-medium text-[var(--accent)] transition hover:underline"
    >
      <ChevronIcon expanded={expanded} />
      {expanded ? "Hide details" : "More details"}
    </button>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
