"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteWorkout,
  getWorkout,
  listExercises,
  type Exercise,
  type PersonalRecordEvent,
  type Workout,
  type WorkoutExercise,
} from "@/lib/api";
import { WorkoutDetailsBody, hasMeaningfulName } from "@/components/workout-details";
import { WorkoutDetailsEditModal } from "@/components/workout-details-edit-modal";
import { ExerciseEditModal, newExerciseGroup } from "@/components/exercise-edit-modal";
import { WorkoutSummaryStats } from "@/components/workout-summary-stats";
import { MuscleGroupRadarChart } from "@/components/muscle-group-radar-chart";
import { MuscleGroupSetBars } from "@/components/muscle-group-set-bars";

/**
 * Single-workout detail route — the one-stop shop for everything Prog
 * Strength captured about a session. Reached from the Personal Records
 * page's "View workout" links, the agent/chat, and anywhere a workout is
 * referenced by id.
 *
 * Reuses the shared WorkoutDetailsBody for the readonly rendering, but
 * opts into its edit affordances: a pencil on each exercise/superset opens
 * a focused ExerciseEditModal, the header "Edit details" opens the
 * workout-level field editor, and "Delete" removes the workout. Visual
 * summaries (stat tiles, body-part radar, per-muscle set bars) sit above
 * the body so the page reads as a modern session overview.
 */

// The exercise group currently open in the per-exercise editor: the group
// itself, plus whether we're editing it in place or adding a new one.
type GroupEdit = { group: WorkoutExercise[]; mode: "edit" | "add" };

export default function WorkoutDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editingDetails, setEditingDetails] = useState(false);
  const [groupEdit, setGroupEdit] = useState<GroupEdit | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    Promise.all([getWorkout(token, id), listExercises()])
      .then(([w, es]) => {
        setWorkout(w);
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
  }, [id, router]);

  const exerciseMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const handleSaved = (updated: Workout) => setWorkout(updated);

  const handleDelete = async () => {
    if (!workout) return;
    const label = hasMeaningfulName(workout.name) ? workout.name : formatDate(workout.performed_at);
    if (!window.confirm(`Delete "${label}"? This removes the workout from your history.`)) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setDeleting(true);
    try {
      await deleteWorkout(token, workout.id);
      router.replace("/activities?view=workouts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setDeleting(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <Link
          href="/activities?view=workouts"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Workouts
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {workout
                ? hasMeaningfulName(workout.name)
                  ? workout.name
                  : formatDate(workout.performed_at)
                : "Workout"}
            </h1>
            {workout && (
              <p className="mt-1 text-xs text-[var(--muted)]">
                {formatDate(workout.performed_at)}
                {workout.ended_at && ` · ${formatDuration(workout.performed_at, workout.ended_at)}`}
              </p>
            )}
          </div>
          {workout && (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditingDetails(true)}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
              >
                Edit details
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-sm text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && workout === null && (
            <p className="text-sm text-[var(--muted)]">Loading workout…</p>
          )}

          {workout && (
            <div className="flex flex-col gap-4">
              {workout.personal_records_set.length > 0 && (
                <PRBanner events={workout.personal_records_set} exerciseMap={exerciseMap} />
              )}

              <section className="flex flex-col gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <WorkoutSummaryStats workout={workout} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Body parts
                    </h2>
                    <MuscleGroupRadarChart workouts={[workout]} exercises={exercises} />
                  </div>
                  <div className="flex flex-col">
                    <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
                      Sets per muscle
                    </h2>
                    <div className="flex flex-1 items-center">
                      <div className="w-full">
                        <MuscleGroupSetBars workout={workout} exercises={exercises} />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-medium">Exercises</h2>
                  <button
                    type="button"
                    onClick={() =>
                      setGroupEdit({ group: newExerciseGroup(exercises), mode: "add" })
                    }
                    className="text-xs text-[var(--accent)] hover:underline"
                  >
                    + Add exercise
                  </button>
                </div>
                <WorkoutDetailsBody
                  workout={workout}
                  exerciseMap={exerciseMap}
                  showTotalVolume
                  onEditGroup={(group) => setGroupEdit({ group, mode: "edit" })}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {workout && editingDetails && (
        <WorkoutDetailsEditModal
          workout={workout}
          onClose={() => setEditingDetails(false)}
          onSaved={handleSaved}
        />
      )}

      {workout && groupEdit && (
        <ExerciseEditModal
          workout={workout}
          group={groupEdit.group}
          mode={groupEdit.mode}
          catalog={exercises}
          onClose={() => setGroupEdit(null)}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
}

function PRBanner({
  events,
  exerciseMap,
}: {
  events: PersonalRecordEvent[];
  exerciseMap: Map<string, Exercise>;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
      <div className="flex items-center gap-2">
        <TrophyIcon />
        <h2 className="text-sm font-semibold text-amber-200">
          {events.length === 1 ? "New personal record!" : `${events.length} new personal records!`}
        </h2>
      </div>
      <ul className="flex flex-col gap-1.5 text-sm">
        {events.map((e) => {
          const exerciseName = exerciseMap.get(e.exercise_id)?.name ?? e.exercise_id;
          return (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="font-medium">{exerciseName}</span>
              <span className="tabular-nums">
                {formatWeight(e.weight, e.unit)} × {e.reps}
              </span>
              {e.previous_weight !== null && (
                <span className="text-xs text-amber-200/80">
                  (up from {formatWeight(e.previous_weight, e.previous_unit)})
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TrophyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-amber-300"
      aria-hidden="true"
    >
      <path d="M8 4h8v6a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a2 2 0 0 0 0 4h3" />
      <path d="M16 6h3a2 2 0 0 1 0 4h-3" />
      <path d="M12 14v3" />
      <path d="M9 21h6" />
      <path d="M10 17h4l-1 4h-2l-1-4z" />
    </svg>
  );
}

// --- helpers --------------------------------------------------------------

function formatWeight(value: number, unit: string | null): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}${unit ? ` ${unit}` : ""}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
