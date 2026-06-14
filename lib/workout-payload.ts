/**
 * Converts a fetched `Workout` into the `WorkoutPayload` shape the API's
 * PUT /workouts/{id} expects. The update endpoint is a full replacement,
 * so every edit surface on the detail page (per-exercise sets, workout
 * name/notes/dates, add/remove exercise) applies its change to the
 * in-memory workout and round-trips the whole thing through here.
 *
 * Mirrors the field-omission rules WorkoutModal.draftToPayload uses: only
 * emit optional keys when they carry information, so we never persist
 * empty strings or a null superset_group the API would otherwise store.
 */

import type { Workout, WorkoutExercise, WorkoutPayload } from "@/lib/api";

export function workoutToPayload(w: Workout): WorkoutPayload {
  const payload: WorkoutPayload = {
    performed_at: w.performed_at,
    // Sort by `order` so the persisted sequence matches what the user
    // sees; the API re-derives `order` from array position.
    exercises: [...w.exercises].sort((a, b) => a.order - b.order).map(exerciseToPayload),
  };
  if (w.name) payload.name = w.name;
  if (w.ended_at) payload.ended_at = w.ended_at;
  if (w.notes) payload.notes = w.notes;
  return payload;
}

function exerciseToPayload(ex: WorkoutExercise): WorkoutPayload["exercises"][number] {
  return {
    exercise_id: ex.exercise_id,
    ...(ex.superset_group != null && { superset_group: ex.superset_group }),
    ...(ex.notes && { notes: ex.notes }),
    sets: ex.sets.map((s) => ({ ...s })),
  };
}
