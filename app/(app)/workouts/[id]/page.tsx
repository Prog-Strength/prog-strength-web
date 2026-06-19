"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteWorkout,
  getPlannedWorkoutBySession,
  getWorkout,
  listExercises,
  type Exercise,
  type PlannedWorkout,
  type Workout,
  type WorkoutExercise,
} from "@/lib/api";
import { CompletesPlanBanner } from "@/components/completes-plan-banner";
import { hasMeaningfulName } from "@/components/workout-details";
import { WorkoutDetailsEditModal } from "@/components/workout-details-edit-modal";
import { ExerciseEditModal, newExerciseGroup } from "@/components/exercise-edit-modal";
import { predominantUnit, workoutVolume } from "@/lib/workout-volume";
import { formatRecapDate, leadHeadline, populatedCategories, prSubhead } from "@/lib/workout-recap";
import { RecapExerciseList } from "./_components/recap-exercise-list";

/**
 * Single-workout detail route — the one-stop record of a logged session,
 * reached from the Workouts list, the Personal Records "View workout" links,
 * the calendar, and the agent.
 *
 * Composed as the `session-recap` reading layout: a centered editorial column
 * that tells the session as a short story. The lifter's note is promoted to
 * the lead (an editorial headline + the reflection as prose), the PRs ride as
 * a celebratory `--warning` subhead, and the numbers, the muscle summary, and
 * the exercises support quietly beneath. The page still owns all data
 * (getWorkout, listExercises, getPlannedWorkoutBySession) and every mutation;
 * the edit affordances (Edit details, Delete, + Add exercise, per-exercise
 * pencil) are preserved and wired to the same handlers and modals as before.
 *
 * The shared WorkoutDetailsBody is intentionally NOT used here — the detail
 * page renders its own quiet RecapExerciseList, leaving the shared body to the
 * Workouts list, Calendar digest, and Timeline card unchanged.
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
  const [completesPlan, setCompletesPlan] = useState<PlannedWorkout | null>(null);
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
    // Best-effort: surface the plan this workout fulfilled (non-critical).
    getPlannedWorkoutBySession(token, id, "workout")
      .then(setCompletesPlan)
      .catch(() => {});
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
    const label = hasMeaningfulName(workout.name)
      ? workout.name
      : formatRecapDate(workout.performed_at);
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
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <Link
          href="/activities?view=workouts"
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← Workouts
        </Link>
        {workout && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            {/* The big name is intentionally demoted to a small subtitle —
                the hero is the editorial headline in the column below. */}
            <p className="text-xs text-[var(--muted)]">{headerSubtitle(workout)}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditingDetails(true)}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
              >
                Edit details
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-full border border-[var(--danger)]/35 px-3 py-1 text-xs text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-10">
        <div className="mx-auto max-w-2xl">
          {error && (
            <div className="mb-4 rounded-[14px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && workout === null && (
            <p className="text-sm text-[var(--muted)]">Loading workout…</p>
          )}

          {workout && (
            <article className="space-y-10">
              {completesPlan && (
                <CompletesPlanBanner
                  plan={completesPlan}
                  onUnlinked={() => setCompletesPlan(null)}
                />
              )}

              <Lead workout={workout} exerciseMap={exerciseMap} />

              <Reflection notes={workout.notes} />

              <StatLine workout={workout} />

              <WhatItTrained workout={workout} exercises={exercises} />

              <section className="space-y-1">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
                    The work
                  </p>
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
                <RecapExerciseList
                  exercises={workout.exercises}
                  exerciseMap={exerciseMap}
                  onEditGroup={(group) => setGroupEdit({ group, mode: "edit" })}
                />
              </section>
            </article>
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

// --- sections -------------------------------------------------------------

/**
 * The editorial lead: a date kicker, the large headline (the top PR story, or
 * the session's title when there were no PRs), and the celebratory `--warning`
 * PR subhead — rendered only when the session produced breaks.
 */
function Lead({ workout, exerciseMap }: { workout: Workout; exerciseMap: Map<string, Exercise> }) {
  const { kicker, headline } = leadHeadline(workout, exerciseMap);
  const prs = workout.personal_records_set;
  return (
    <div className="space-y-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        {kicker}
      </p>
      <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
        {headline}
      </h1>
      {prs.length > 0 && (
        <p className="text-base font-medium text-[var(--warning)]">{prSubhead(prs)}</p>
      )}
    </div>
  );
}

/** The reflection — the body of the story, or a quiet placeholder when empty. */
function Reflection({ notes }: { notes: string | undefined }) {
  const hasNote = Boolean(notes && notes.trim());
  return hasNote ? (
    <p className="whitespace-pre-wrap text-lg leading-[1.7] text-[var(--foreground)]">{notes}</p>
  ) : (
    <p className="text-base italic leading-relaxed text-[var(--faint)]">
      No reflection on this session.
    </p>
  );
}

/**
 * The quiet stat line — numbers support rather than lead. Honest tile-dropping
 * is preserved: no Duration without `ended_at`, no PRs tile at zero.
 */
function StatLine({ workout }: { workout: Workout }) {
  const unit = predominantUnit(workout);
  const volume = workoutVolume(workout, unit);
  const totalSets = workout.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const prCount = workout.personal_records_set.length;
  const duration = workout.ended_at ? formatDuration(workout.performed_at, workout.ended_at) : null;

  const stats: [string, string][] = [
    ["Volume", `${formatNumber(volume)} ${displayUnit(unit)}`],
    ["Sets", String(totalSets)],
    ["Exercises", String(workout.exercises.length)],
  ];
  if (duration) stats.push(["Duration", duration]);
  if (prCount > 0) stats.push(["PRs", String(prCount)]);

  return (
    <dl className="flex flex-wrap gap-x-10 gap-y-4 border-y border-[var(--border)] py-5">
      {stats.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "What it trained" — the two redundant muscle analytics (radar + bars)
 * collapse to a single quiet strip of the populated categories, largest first.
 * The degenerate near-empty radar is gone; an uncategorizable session simply
 * drops the strip rather than rendering an empty chart.
 */
function WhatItTrained({ workout, exercises }: { workout: Workout; exercises: Exercise[] }) {
  const trained = populatedCategories(workout, exercises);
  if (trained.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        What it trained
      </p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]">
        {trained.map((m, i) => (
          <span key={m.category}>
            <span className="text-[var(--foreground)]">{m.category}</span>
            <span className="text-[var(--faint)]"> {m.value}</span>
            {i < trained.length - 1 && <span className="px-1.5 text-[var(--faint)]">·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- helpers --------------------------------------------------------------

/**
 * The header subtitle: the meaningful workout name (omitted for an auto-named
 * session, so the date isn't restated), the date, and the duration when the
 * session has an `ended_at`.
 */
function headerSubtitle(workout: Workout): string {
  const parts = [
    hasMeaningfulName(workout.name) ? workout.name : null,
    formatRecapDate(workout.performed_at),
    workout.ended_at ? formatDuration(workout.performed_at, workout.ended_at) : null,
  ].filter((p): p is string => Boolean(p));
  return parts.join(" · ");
}

function displayUnit(unit: "lb" | "kg"): string {
  return unit === "lb" ? "lbs" : "kg";
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
