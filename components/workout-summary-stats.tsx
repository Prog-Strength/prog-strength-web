"use client";

import type { Workout } from "@/lib/api";
import { predominantUnit, workoutVolume } from "@/lib/workout-volume";

/**
 * At-a-glance numeric summary of a single workout, rendered as a row of
 * compact tiles above the detail body. Pure presentation — every figure
 * is derived from the passed-in workout, no fetching.
 *
 * Tiles: total volume (reps × weight, in the workout's predominant unit),
 * total sets, exercise count, elapsed duration, and PR count. The
 * duration tile is omitted when the workout has no `ended_at` (an open or
 * never-finalized session has no meaningful span); the PR tile is omitted
 * when the session produced none, so the row stays honest rather than
 * padding with zeros.
 */
export function WorkoutSummaryStats({ workout }: { workout: Workout }) {
  const unit = predominantUnit(workout);
  const volume = workoutVolume(workout, unit);
  const totalSets = workout.exercises.reduce((n, ex) => n + ex.sets.length, 0);
  const exerciseCount = workout.exercises.length;
  const prCount = workout.personal_records_set.length;
  const duration = workout.ended_at ? formatDuration(workout.performed_at, workout.ended_at) : null;

  const tiles: { label: string; value: string }[] = [
    { label: "Volume", value: `${formatNumber(volume)} ${displayUnit(unit)}` },
    { label: totalSets === 1 ? "Set" : "Sets", value: String(totalSets) },
    { label: exerciseCount === 1 ? "Exercise" : "Exercises", value: String(exerciseCount) },
  ];
  if (duration) tiles.push({ label: "Duration", value: duration });
  if (prCount > 0) tiles.push({ label: prCount === 1 ? "PR" : "PRs", value: String(prCount) });

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2"
        >
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {tile.label}
          </dt>
          <dd className="mt-0.5 text-xl font-semibold tracking-tight tabular-nums">{tile.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// --- helpers --------------------------------------------------------------

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
