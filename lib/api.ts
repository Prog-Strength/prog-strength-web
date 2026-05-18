/**
 * Direct fetchers against the Prog Strength API.
 *
 * The agent service handles chat (Claude tool-use loop, SSE streaming).
 * For straight read endpoints like /workouts and /exercises, the
 * frontend calls the API directly — there's nothing the agent would
 * add to those requests beyond an extra hop.
 *
 * Auth: pass the user's JWT (from `getToken()` in lib/auth.ts) as a
 * Bearer token. Public endpoints (the exercise catalog) skip it.
 */

import { config } from "@/lib/config";

/**
 * A single set within a workout exercise.
 *
 * Named `WorkoutSet` rather than `Set` to avoid colliding with
 * TypeScript's built-in generic `Set<T>` — importing `Set` from this
 * module would shadow the global in files that use both.
 */
export type WorkoutSet = {
  reps: number;
  weight: number;
  unit: "lb" | "kg";
};

/** One exercise within a workout, with its sets. */
export type WorkoutExercise = {
  exercise_id: string;
  order: number;
  superset_group?: number | null;
  sets: WorkoutSet[];
  notes?: string;
};

/** A logged training session. */
export type Workout = {
  id: string;
  user_id: string;
  name?: string;
  performed_at: string; // RFC3339
  ended_at?: string | null;
  notes?: string;
  exercises: WorkoutExercise[];
  created_at: string;
  updated_at: string;
};

/** A catalog entry — the canonical definition of an exercise. */
export type Exercise = {
  id: string; // slug
  name: string;
  description?: string;
  muscle_groups: string[];
  equipment: string[];
};

/**
 * GET /workouts. Returns the authed user's workouts, most recent
 * first. The API currently caps the response at 50 and doesn't expose
 * server-side date filtering on the handler — when the beta outgrows
 * 50 workouts per user, add `since`/`until` query params on the
 * handler (the repository already supports them).
 */
export async function listWorkouts(token: string): Promise<Workout[]> {
  const resp = await fetch(`${config.apiUrl}/workouts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<Workout[]>(resp, []);
}

/**
 * GET /exercises. Public — no token. Returns the shared, admin-curated
 * catalog. Used by the workouts page to map exercise_id slugs to
 * human names.
 */
export async function listExercises(): Promise<Exercise[]> {
  const resp = await fetch(`${config.apiUrl}/exercises`);
  return unwrap<Exercise[]>(resp, []);
}

/**
 * Two endpoints of a least-squares trendline, evaluated at the query's
 * `since` and `until`. The frontend connects them with a straight line;
 * the regression math lives on the server.
 */
export type Trendline = {
  start_at: string;
  start_value: number;
  end_at: string;
  end_value: number;
};

/**
 * One (workout, exercise) contribution to the muscle-group progression
 * chart. `normalized_avg` is the field plotted on the Y-axis — the
 * exercise's per-workout avg estimated 1RM divided by that exercise's
 * current recency-weighted baseline. 1.0 means the lifter performed
 * exactly at their current capability on that exercise; >1.0 means
 * above; <1.0 below. The raw fields are carried for tooltips so the
 * UI can show absolute load alongside the normalized percentage.
 */
export type MuscleGroupProgressionPoint = {
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  performed_at: string; // RFC3339
  normalized_avg: number;
  avg_estimated_1rm: number;
  max_estimated_1rm: number;
  min_estimated_1rm: number;
  set_count: number;
  unit: "lb" | "kg";
};

/**
 * Per-exercise baseline used to normalize one exercise's contributions
 * to the chart. Sorted by `exercise_name` server-side for stable
 * rendering in legend/tooltip layouts.
 */
export type ExerciseBaseline = {
  exercise_id: string;
  exercise_name: string;
  baseline: number;
  unit: "lb" | "kg" | "";
};

/**
 * GET /workouts/progression response. Currently driven by the
 * `muscle_group` query parameter; future filters (exercise_id,
 * equipment, etc.) will produce different response shapes returned
 * from the same endpoint. See
 * prog-strength-docs/sows/estimated-one-rep-max-time-series-table.md.
 */
export type MuscleGroupProgression = {
  muscle_group: string;
  since: string;
  until: string;
  exercise_baselines: ExerciseBaseline[];
  points: MuscleGroupProgressionPoint[];
  // Single combined trendline through every normalized point.
  // Null when there are fewer than 2 points or all share the same X.
  trendline: Trendline | null;
};

/**
 * GET /workouts/progression?muscle_group=...&since=...&until=...
 *
 * Requires auth. The backend resolves the muscle-group filter into
 * every exercise that targets it, reads each exercise's 1RM history,
 * computes a recency-weighted current baseline per exercise, and
 * returns normalized points + a single trendline ready to plot.
 *
 * Timestamps are RFC3339; if either is omitted, the server defaults
 * to the last 90 days.
 */
export async function listProgression(
  token: string,
  muscleGroup: string,
  since?: string,
  until?: string,
): Promise<MuscleGroupProgression> {
  const params = new URLSearchParams({ muscle_group: muscleGroup });
  if (since) params.set("since", since);
  if (until) params.set("until", until);
  const resp = await fetch(
    `${config.apiUrl}/workouts/progression?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  // Force a non-null default — empty progression rather than throwing
  // on missing payload, so callers can render a clean empty state.
  const got = await unwrap<MuscleGroupProgression | null>(resp, null);
  return (
    got ?? {
      muscle_group: muscleGroup,
      since: since ?? "",
      until: until ?? "",
      exercise_baselines: [],
      points: [],
      trendline: null,
    }
  );
}

/**
 * Payload shape for create/update. Matches the Go handler's
 * createWorkoutRequest (which the PUT handler also accepts).
 * Timestamps are RFC3339 strings; the caller is responsible for
 * converting datetime-local form values before calling this.
 */
export type WorkoutPayload = {
  name?: string;
  performed_at: string; // RFC3339, required by the API
  ended_at?: string;    // RFC3339, optional
  notes?: string;
  exercises: {
    exercise_id: string;
    superset_group?: number | null;
    notes?: string;
    sets: WorkoutSet[];
  }[];
};

/**
 * DELETE /workouts/{id}. Soft-deletes the workout server-side (sets
 * deleted_at; subsequent reads treat the row as gone). Throws on non-
 * 2xx with the API's `error` envelope as the message — typically a
 * 404 if the ID doesn't exist or isn't owned by this user.
 */
export async function deleteWorkout(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/workouts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    let detail: string;
    try {
      detail = (await resp.json())?.error ?? `HTTP ${resp.status}`;
    } catch {
      detail = `HTTP ${resp.status}`;
    }
    throw new Error(detail);
  }
}

/**
 * PUT /workouts/{id}. Full replacement — the body is the complete
 * workout state, not a partial diff. Ownership is enforced server-side;
 * a non-2xx response means the API rejected the payload (validation
 * error) or the workout doesn't belong to this user.
 *
 * Returns the updated Workout from the API response so callers can
 * splice it into local state without a follow-up refetch.
 */
export async function updateWorkout(
  token: string,
  id: string,
  payload: WorkoutPayload,
): Promise<Workout> {
  const resp = await fetch(`${config.apiUrl}/workouts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  // For mutations we don't fall back to an empty value — if the
  // response shape is wrong, that's a bug worth surfacing as an error.
  const updated = await unwrap<Workout | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated workout");
  }
  return updated;
}

/**
 * Common envelope unwrapper. The API wraps every success response in
 * `{service, message, data}`; the caller only cares about `data`.
 * Errors come back as `{service, error}` — we surface `error` as the
 * thrown message so callers don't have to repeat the envelope parsing.
 *
 * The `empty` parameter is the value to return when `data` is missing
 * or null (typically `[]` for list endpoints, since the server uses
 * `omitempty` on the envelope field).
 */
async function unwrap<T>(resp: Response, empty: T): Promise<T> {
  if (!resp.ok) {
    let detail: string;
    try {
      const body = await resp.json();
      detail = body?.error ?? `HTTP ${resp.status}`;
    } catch {
      detail = `HTTP ${resp.status}`;
    }
    throw new Error(detail);
  }
  const body = await resp.json();
  return (body?.data as T | undefined) ?? empty;
}
