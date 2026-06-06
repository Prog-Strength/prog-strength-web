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

/**
 * One row of the personal record event log — captures the moment a
 * (user, exercise) PR was broken. Embedded inline on workouts that
 * produced one or more breaks so the workout list/detail UIs can
 * badge sessions inline without a second round trip.
 */
export type PersonalRecordEvent = {
  id: string;
  exercise_id: string;
  workout_id: string;
  weight: number;
  reps: number;
  unit: "lb" | "kg";
  // null when this was the user's first logged set on this exercise.
  previous_weight: number | null;
  previous_reps: number | null;
  previous_unit: "lb" | "kg" | null;
  achieved_at: string;
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
  // PR break events this workout produced. Always present in API
  // responses (empty array when no PRs); the field is non-optional so
  // UIs can iterate without a null check.
  personal_records_set: PersonalRecordEvent[];
};

/** A catalog entry — the canonical definition of an exercise. */
export type Exercise = {
  id: string; // slug
  name: string;
  description?: string;
  muscle_groups: string[];
  equipment: string[];
};

/** Optional filters and pagination params for GET /workouts. */
export type ListWorkoutsOptions = {
  // RFC3339 lower/upper bounds on performed_at.
  since?: string;
  until?: string;
  // Page size, 1–100. The API defaults to 50 when omitted.
  limit?: number;
  // Rows to skip, ≥ 0. Defaults to 0.
  offset?: number;
};

/**
 * One page of workouts plus the metadata callers need to render
 * pagination controls. Mirrors the API's data envelope shape.
 */
export type WorkoutsPage = {
  items: Workout[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

/**
 * GET /workouts. Returns one page of the authed user's workouts,
 * most recent first. Pass `since`/`until` for server-side timeframe
 * filtering; pass `limit`/`offset` for pagination.
 */
export async function listWorkouts(
  token: string,
  options: ListWorkoutsOptions = {},
): Promise<WorkoutsPage> {
  const params = new URLSearchParams();
  if (options.since) params.set("since", options.since);
  if (options.until) params.set("until", options.until);
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/workouts${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Empty page fallback so callers can render a clean empty state
  // rather than throw on missing payload.
  return await unwrap<WorkoutsPage>(resp, {
    items: [],
    total: 0,
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    has_more: false,
  });
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
 * GET /workouts/{id}. Returns a single workout owned by the authed
 * user. Used by the workout detail route reachable from the Personal
 * Records page. 404 if the ID doesn't exist or belongs to another
 * user (deliberately indistinguishable so IDs can't be enumerated).
 */
export async function getWorkout(token: string, id: string): Promise<Workout> {
  const resp = await fetch(`${config.apiUrl}/workouts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<Workout | null>(resp, null);
  if (!got) {
    throw new Error("workout not found");
  }
  return got;
}

/**
 * One row of the Personal Records page — a headline lift plus the
 * user's current PR for it (nullable if never set) and the current
 * recency-weighted estimated 1RM for comparison.
 *
 * The set of headline lifts is curated server-side, so this response
 * always returns one row per headline lift even for lifts the user
 * has never trained. The frontend renders empty-state cards for those.
 */
export type PersonalRecord = {
  exercise_id: string;
  exercise_name: string;
  workout_id: string | null;
  weight: number | null;
  reps: number | null;
  unit: "lb" | "kg" | null;
  achieved_at: string | null;
  current_estimated_1rm: number | null;
  estimated_1rm_unit: "lb" | "kg" | null;
};

/**
 * GET /personal-records. Returns one row per backend-curated headline
 * lift; entries the user hasn't yet PR'd appear with null PR fields.
 */
export async function listPersonalRecords(token: string): Promise<PersonalRecord[]> {
  const resp = await fetch(`${config.apiUrl}/personal-records`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<PersonalRecord[]>(resp, []);
}

/**
 * One entry in the user's headline-exercise selection — the per-user
 * curated set of exercises surfaced on the Personal Records page.
 * `is_default` indicates whether the slug is also in the global
 * curated default list, so the modal can show "(default)" annotations
 * without a second fetch. See
 * prog-strength-docs/sows/custom-headline-lifts.md.
 */
export type HeadlineExercise = {
  exercise_id: string;
  exercise_name: string;
  position: number;
  is_default: boolean;
};

/** One entry in the curated default headline-exercise list. */
export type DefaultHeadlineExercise = {
  exercise_id: string;
  exercise_name: string;
};

/**
 * GET /me/headline-exercises. Returns the authed user's selection in
 * display order; falls back server-side to the curated defaults when
 * the user has no rows yet. Used by the customize modal to pre-check
 * the right boxes when it opens.
 */
export async function listMyHeadlineExercises(token: string): Promise<HeadlineExercise[]> {
  const resp = await fetch(`${config.apiUrl}/me/headline-exercises`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<HeadlineExercise[]>(resp, []);
}

/**
 * PUT /me/headline-exercises. Replaces the user's selection wholesale
 * — the body is the complete ordered set, not a partial diff. The
 * server returns the saved list in the same shape as the GET so the
 * caller can splice it back into local state without a refetch.
 *
 * Server-side validation: at least one slug, at most 12, no
 * duplicates, every slug must exist in the exercise catalog. Failures
 * surface as the API's standard `error` envelope; we throw with that
 * message so callers can render it inline in the modal.
 */
export async function putMyHeadlineExercises(
  token: string,
  exerciseIDs: string[],
): Promise<HeadlineExercise[]> {
  const resp = await fetch(`${config.apiUrl}/me/headline-exercises`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ exercise_ids: exerciseIDs }),
  });
  return unwrap<HeadlineExercise[]>(resp, []);
}

/**
 * GET /headline-exercises/defaults. Returns the curated default list
 * — the same one new users land on before they customize. The modal
 * uses this to annotate "(default)" badges across the full exercise
 * catalog and to implement "Reset to defaults" without baking slugs
 * into the frontend.
 */
export async function listHeadlineExerciseDefaults(
  token: string,
): Promise<DefaultHeadlineExercise[]> {
  const resp = await fetch(`${config.apiUrl}/headline-exercises/defaults`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<DefaultHeadlineExercise[]>(resp, []);
}

/**
 * The authenticated user. `weight_unit` is the user's preferred display
 * unit; bodyweight and workout-volume UIs convert history toward it.
 */
export type User = {
  id: string;
  email: string;
  display_name?: string;
  weight_unit: "lb" | "kg";
  // Preferred display unit for running distances/paces. Drives the
  // DistanceUnitContext seed and the settings toggle.
  distance_unit: "mi" | "km";
  created_at: string;
  updated_at: string;
};

/**
 * GET /me. Returns the authed user, including their preferred
 * `weight_unit`. Throws if the response carries no user payload.
 */
export async function getMe(token: string): Promise<User> {
  const resp = await fetch(`${config.apiUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<User | null>(resp, null);
  if (!got) {
    throw new Error("user not found");
  }
  return got;
}

/**
 * PATCH /me. Partial update of the authed user's profile/preferences;
 * omit a field to leave it unchanged. Returns the updated user so the
 * caller can splice it into local state / re-seed contexts without a
 * follow-up GET.
 */
export async function updateMe(
  token: string,
  patch: {
    display_name?: string;
    weight_unit?: "lb" | "kg";
    distance_unit?: "mi" | "km";
  },
): Promise<User> {
  const resp = await fetch(`${config.apiUrl}/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const updated = await unwrap<User | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated user");
  }
  return updated;
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
 * chart. `normalized_max` is the field plotted on the Y-axis — the
 * exercise's per-workout MAX estimated 1RM divided by that exercise's
 * current recency-weighted baseline. 1.0 means the lifter's heaviest
 * set today matched their current capability on that exercise; >1.0
 * above, <1.0 below. Max (not avg) is used so warmup sets don't
 * deflate the signal; the raw fields are carried for tooltips so the
 * UI can show absolute load alongside the normalized percentage.
 */
export type MuscleGroupProgressionPoint = {
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  performed_at: string; // RFC3339
  normalized_max: number;
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
  const resp = await fetch(`${config.apiUrl}/workouts/progression?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  ended_at?: string; // RFC3339, optional
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

// --- Nutrition (pantry + log) -------------------------------------

/**
 * One user-saved food entry. Macros are per serving; "5 eggs" is
 * represented as a log entry with quantity=5 against an item whose
 * serving_size=1 and serving_unit="egg". See
 * prog-strength-docs/sows/daily-nutrition-log.md.
 */
export type PantryItem = {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  serving_size: number;
  serving_unit: string;
  created_at: string;
  updated_at: string;
};

/** Payload for creating or updating a pantry item. */
export type PantryItemPayload = {
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  serving_size: number;
  serving_unit: string;
};

/**
 * Which meal bucket a nutrition log entry rolls into on the
 * /nutrition UI. Hard enum mirrored on the API side; new values
 * require schema CHECK + handler changes there first.
 */
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

/**
 * One consumption event. Macros are denormalized at log time so
 * historical totals are immutable under future pantry-item edits.
 * Earlier phases set only pantry_item_id; later work lifted that to
 * also support recipe_id, and the meal bucket landed alongside the
 * per-meal section UI.
 */
export type NutritionLogEntry = {
  id: string;
  consumed_at: string;
  pantry_item_id?: string | null;
  recipe_id?: string | null;
  custom_meal_name: string | null;
  quantity: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal: MealType;
  created_at: string;
};

/**
 * Payload for creating a log entry. Exactly one of `pantry_item_id`
 * and `recipe_id` must be set — server returns 400 otherwise. `meal`
 * is required.
 */
export type CreateLogEntryPayload = {
  pantry_item_id?: string;
  recipe_id?: string;
  quantity: number;
  meal: MealType;
  consumed_at?: string; // RFC3339; server defaults to now
};

/**
 * Payload for creating a custom (one-off) log entry — a meal the user
 * typed in directly, not backed by a saved pantry item or recipe. The
 * macros are the totals as consumed (quantity is always 1 server-side).
 */
export type CreateCustomLogEntryPayload = {
  name: string;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal: MealType;
  consumed_at?: string; // RFC3339; server defaults to now
};

/**
 * Payload for editing a log entry. Omit a field to leave it unchanged.
 * The `name`/`calories`/`protein_g`/`fat_g`/`carbs_g` fields are only
 * accepted for custom entries; the server rejects them for pantry- or
 * recipe-backed rows.
 */
export type UpdateLogEntryPayload = {
  quantity?: number;
  consumed_at?: string;
  meal?: MealType;
  name?: string;
  calories?: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
};

/** Per-day aggregate from GET /nutrition-log/daily. */
export type DailyMacros = {
  date: string; // YYYY-MM-DD, user-local calendar date
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  entry_count: number;
};

export async function listPantryItems(token: string, query?: string): Promise<PantryItem[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/pantry-items${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<PantryItem[]>(resp, []);
}

export async function getPantryItem(token: string, id: string): Promise<PantryItem> {
  const resp = await fetch(`${config.apiUrl}/pantry-items/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<PantryItem | null>(resp, null);
  if (!got) throw new Error("pantry item not found");
  return got;
}

export async function createPantryItem(
  token: string,
  payload: PantryItemPayload,
): Promise<PantryItem> {
  const resp = await fetch(`${config.apiUrl}/pantry-items`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const created = await unwrap<PantryItem | null>(resp, null);
  if (!created) throw new Error("API did not return the created pantry item");
  return created;
}

export async function updatePantryItem(
  token: string,
  id: string,
  payload: PantryItemPayload,
): Promise<PantryItem> {
  const resp = await fetch(`${config.apiUrl}/pantry-items/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const updated = await unwrap<PantryItem | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated pantry item");
  return updated;
}

export async function deletePantryItem(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/pantry-items/${encodeURIComponent(id)}`, {
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
 * Request shape for the nutrition read endpoints. `timezone` is always
 * required (IANA name, e.g. "America/New_York"); the server resolves the
 * calendar day(s) in that zone. Provide `date` for a single day, or
 * `startDate`/`endDate` for an inclusive range. All dates are YYYY-MM-DD.
 */
export type NutritionDateQuery = {
  timezone: string;
  date?: string; // YYYY-MM-DD, single day
  startDate?: string; // YYYY-MM-DD, inclusive range start
  endDate?: string; // YYYY-MM-DD, inclusive range end
};

function nutritionDateParams(query: NutritionDateQuery): URLSearchParams {
  const params = new URLSearchParams();
  params.set("timezone", query.timezone);
  if (query.date) params.set("date", query.date);
  if (query.startDate) params.set("start_date", query.startDate);
  if (query.endDate) params.set("end_date", query.endDate);
  return params;
}

/**
 * GET /nutrition-log. Filters `consumed_at` by the user-local calendar
 * day(s) implied by `query` (date or start_date/end_date) in `timezone`.
 * Returns most-recent-first.
 */
export async function listNutritionLog(
  token: string,
  query: NutritionDateQuery,
): Promise<NutritionLogEntry[]> {
  const params = nutritionDateParams(query);
  const resp = await fetch(`${config.apiUrl}/nutrition-log?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<NutritionLogEntry[]>(resp, []);
}

export async function createNutritionLogEntry(
  token: string,
  payload: CreateLogEntryPayload,
): Promise<NutritionLogEntry> {
  const resp = await fetch(`${config.apiUrl}/nutrition-log`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const created = await unwrap<NutritionLogEntry | null>(resp, null);
  if (!created) throw new Error("API did not return the created log entry");
  return created;
}

/**
 * POST /nutrition-log/custom. Logs a one-off meal the user typed in,
 * not backed by a saved pantry item or recipe. Mirrors
 * `createNutritionLogEntry`'s fetch/unwrap pattern.
 */
export async function createCustomNutritionLogEntry(
  token: string,
  payload: CreateCustomLogEntryPayload,
): Promise<NutritionLogEntry> {
  const resp = await fetch(`${config.apiUrl}/nutrition-log/custom`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const created = await unwrap<NutritionLogEntry | null>(resp, null);
  if (!created) throw new Error("API did not return the created log entry");
  return created;
}

export async function updateNutritionLogEntry(
  token: string,
  id: string,
  payload: UpdateLogEntryPayload,
): Promise<NutritionLogEntry> {
  const resp = await fetch(`${config.apiUrl}/nutrition-log/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const updated = await unwrap<NutritionLogEntry | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated log entry");
  return updated;
}

export async function deleteNutritionLogEntry(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/nutrition-log/${encodeURIComponent(id)}`, {
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
 * GET /nutrition-log/daily. Returns one row per user-local calendar date
 * (in `query.timezone`) within the requested range that has at least one
 * entry. Empty days are omitted; the frontend's daily widget treats that
 * as zeros.
 */
export async function getDailyMacros(
  token: string,
  query: NutritionDateQuery,
): Promise<DailyMacros[]> {
  const params = nutritionDateParams(query);
  const resp = await fetch(`${config.apiUrl}/nutrition-log/daily?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<DailyMacros[]>(resp, []);
}

// --- Macro goals --------------------------------------------------

/**
 * The user's daily macro targets. created_at / updated_at are nullable
 * because the API returns a zero-valued row with null timestamps when
 * the user has never set goals — the UI uses the null timestamps as
 * the "render the empty-state ring outline" signal. See
 * prog-strength-docs/sows/daily-macro-goals.md.
 */
export type MacroGoals = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories: number;
  created_at: string | null;
  updated_at: string | null;
};

/** Payload for PUT /me/macro-goals. All four fields required. */
export type PutMacroGoalsPayload = {
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  calories: number;
};

/**
 * GET /me/macro-goals. Always 200 — when goals were never set the
 * response carries zeros and null timestamps. Callers should check
 * `created_at === null` to render the empty state rather than
 * comparing the numbers against zero (the user may have legitimately
 * set everything to 0 to clear a target).
 */
export async function getMacroGoals(token: string): Promise<MacroGoals> {
  const resp = await fetch(`${config.apiUrl}/me/macro-goals`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<MacroGoals>(resp, {
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    calories: 0,
    created_at: null,
    updated_at: null,
  });
}

/** PUT /me/macro-goals. Set-replacement; returns the persisted row. */
export async function putMacroGoals(
  token: string,
  payload: PutMacroGoalsPayload,
): Promise<MacroGoals> {
  const resp = await fetch(`${config.apiUrl}/me/macro-goals`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  return unwrap<MacroGoals>(resp, {
    ...payload,
    created_at: null,
    updated_at: null,
  });
}

// --- Bodyweight ---------------------------------------------------

/**
 * One scale reading. Unit is denormalized per row so a user changing
 * their preferred unit doesn't reinterpret history. See
 * prog-strength-docs/sows/daily-nutrition-log.md (Phase 3).
 */
export type BodyweightEntry = {
  id: string;
  weight: number;
  unit: "lb" | "kg";
  measured_at: string; // RFC3339
  created_at: string;
};

/** Payload for creating a bodyweight entry. */
export type CreateBodyweightPayload = {
  weight: number;
  unit?: "lb" | "kg"; // server defaults to the user's preferred unit
  measured_at?: string; // RFC3339; server defaults to now
};

export async function listBodyweight(
  token: string,
  options: { since?: string; until?: string } = {},
): Promise<BodyweightEntry[]> {
  const params = new URLSearchParams();
  if (options.since) params.set("since", options.since);
  if (options.until) params.set("until", options.until);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/bodyweight${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<BodyweightEntry[]>(resp, []);
}

export async function createBodyweightEntry(
  token: string,
  payload: CreateBodyweightPayload,
): Promise<BodyweightEntry> {
  const resp = await fetch(`${config.apiUrl}/bodyweight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const created = await unwrap<BodyweightEntry | null>(resp, null);
  if (!created) throw new Error("API did not return the created bodyweight entry");
  return created;
}

export async function deleteBodyweightEntry(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/bodyweight/${encodeURIComponent(id)}`, {
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

export type BodyweightGoal = {
  weight: number;
  unit: "lb" | "kg";
  created_at: string | null;
  updated_at: string | null;
};

export async function getBodyweightGoal(token: string): Promise<BodyweightGoal> {
  const resp = await fetch(`${config.apiUrl}/me/bodyweight-goal`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<BodyweightGoal>(resp, {
    weight: 0,
    unit: "lb",
    created_at: null,
    updated_at: null,
  });
}

export async function putBodyweightGoal(
  token: string,
  goal: { weight: number; unit: "lb" | "kg" },
): Promise<BodyweightGoal> {
  const resp = await fetch(`${config.apiUrl}/me/bodyweight-goal`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(goal),
  });
  const saved = await unwrap<BodyweightGoal | null>(resp, null);
  if (!saved) throw new Error("API did not return the saved bodyweight goal");
  return saved;
}

export async function updateBodyweightEntry(
  token: string,
  id: string,
  payload: { weight?: number; unit?: "lb" | "kg"; measured_at?: string },
): Promise<BodyweightEntry> {
  const resp = await fetch(`${config.apiUrl}/bodyweight/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const updated = await unwrap<BodyweightEntry | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated bodyweight entry");
  return updated;
}

// --- Recipes ------------------------------------------------------

/**
 * One pantry-item component inside a recipe. Quantity is the number
 * of pantry-item servings in one batch of the recipe.
 */
export type RecipeComponent = {
  id: string;
  pantry_item_id: string;
  quantity: number;
  position: number;
};

/** Derived macros for one batch of a recipe. */
export type RecipeMacros = {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

/**
 * A user-saved recipe — a named bag of pantry-item components with
 * derived macros for one batch. Recipe macros are NOT stored on the
 * recipe row; the API computes them on every read by joining
 * `recipe_items` to `pantry_items`. This means editing a component
 * pantry item updates the recipe's apparent macros — but log entries
 * already created against the recipe stay frozen at their original
 * macros (denormalized at log time).
 */
export type Recipe = {
  id: string;
  name: string;
  components: RecipeComponent[];
  macros: RecipeMacros;
  created_at: string;
  updated_at: string;
};

/** Payload for creating or updating a recipe. */
export type RecipePayload = {
  name: string;
  components: { pantry_item_id: string; quantity: number }[];
};

export async function listRecipes(token: string): Promise<Recipe[]> {
  const resp = await fetch(`${config.apiUrl}/recipes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<Recipe[]>(resp, []);
}

export async function getRecipe(token: string, id: string): Promise<Recipe> {
  const resp = await fetch(`${config.apiUrl}/recipes/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<Recipe | null>(resp, null);
  if (!got) throw new Error("recipe not found");
  return got;
}

export async function createRecipe(token: string, payload: RecipePayload): Promise<Recipe> {
  const resp = await fetch(`${config.apiUrl}/recipes`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const created = await unwrap<Recipe | null>(resp, null);
  if (!created) throw new Error("API did not return the created recipe");
  return created;
}

export async function updateRecipe(
  token: string,
  id: string,
  payload: RecipePayload,
): Promise<Recipe> {
  const resp = await fetch(`${config.apiUrl}/recipes/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const updated = await unwrap<Recipe | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated recipe");
  return updated;
}

export async function deleteRecipe(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/recipes/${encodeURIComponent(id)}`, {
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

// --- Chat sessions -----------------------------------------------

/**
 * One persistent chat conversation. The API returns these from
 * /chat-sessions list/get endpoints. The companion `messages` array
 * is only present on the per-id GET (and after POST on
 * /chat-sessions/{id}/messages).
 */
export type ChatSession = {
  id: string;
  user_id: string;
  title: string; // empty until the LLM-title PATCH lands
  created_at: string;
  updated_at: string;
  last_message_at: string;
};

export type ChatSessionListItem = ChatSession & {
  message_count: number;
};

export type ChatMessage = {
  id: number;
  session_id: string;
  position: number;
  role: "user" | "assistant";
  content: string;
  model?: string | null;
  tools_json?: string | null;
  created_at: string;
};

export type ChatSessionWithMessages = ChatSession & {
  messages: ChatMessage[];
};

/** Payload for appending one turn to a session. */
export type ChatTurnPayload = {
  user: { content: string };
  assistant: {
    content: string;
    model?: string;
    tools_json?: string;
  };
};

export async function listChatSessions(token: string): Promise<ChatSessionListItem[]> {
  const resp = await fetch(`${config.apiUrl}/chat-sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<ChatSessionListItem[]>(resp, []);
}

export async function createChatSession(token: string, id: string): Promise<ChatSession> {
  const resp = await fetch(`${config.apiUrl}/chat-sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id }),
  });
  const created = await unwrap<ChatSession | null>(resp, null);
  if (!created) throw new Error("API did not return the created chat session");
  return created;
}

export async function getChatSession(token: string, id: string): Promise<ChatSessionWithMessages> {
  const resp = await fetch(`${config.apiUrl}/chat-sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<ChatSessionWithMessages | null>(resp, null);
  if (!got) throw new Error("chat session not found");
  return got;
}

/**
 * Update the session's title. Server validates 1..80 chars after
 * trimming; on invalid input the unwrap throws with the API's
 * "title must be 1–80 characters" error message.
 */
export async function patchChatSessionTitle(
  token: string,
  id: string,
  title: string,
): Promise<ChatSession> {
  const resp = await fetch(`${config.apiUrl}/chat-sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ title }),
  });
  const updated = await unwrap<ChatSession | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated chat session");
  return updated;
}

export async function deleteChatSession(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/chat-sessions/${encodeURIComponent(id)}`, {
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
 * Append one turn (user + assistant) to a session in a single
 * transaction server-side. The response includes the updated session
 * (with bumped last_message_at) and the two newly-created message
 * rows.
 */
export async function appendChatTurn(
  token: string,
  sessionId: string,
  turn: ChatTurnPayload,
): Promise<ChatSessionWithMessages> {
  const resp = await fetch(
    `${config.apiUrl}/chat-sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(turn),
    },
  );
  const appended = await unwrap<ChatSessionWithMessages | null>(resp, null);
  if (!appended) throw new Error("API did not return the appended turn");
  return appended;
}

// --- Running (TCX import) -----------------------------------------

/**
 * One imported run. Distances/elevations are stored in meters and paces
 * in seconds-per-kilometer server-side; the DistanceUnitContext converts
 * toward the user's preferred unit at render time. `trackpoints` is only
 * present on the per-id detail GET — the list endpoint omits it to keep
 * payloads small. See prog-strength-docs/sows/running-tracking-via-tcx-import.md.
 */
export type RunningSession = {
  id: string;
  garmin_activity_id: string;
  name: string | null;
  start_time: string; // RFC3339
  distance_meters: number;
  duration_seconds: number;
  avg_pace_sec_per_km: number;
  best_pace_sec_per_km: number | null;
  avg_heart_rate_bpm: number | null;
  max_heart_rate_bpm: number | null;
  total_calories: number | null;
  elevation_gain_meters: number | null;
  created_at: string;
  // Present only on the detail GET; absent in list responses.
  trackpoints?: RunningTrackpoint[];
};

/** One sampled point along a run's track, ordered by `sequence`. */
export type RunningTrackpoint = {
  sequence: number;
  elapsed_seconds: number;
  distance_meters: number;
  heart_rate_bpm: number | null;
  pace_sec_per_km: number | null;
  elevation_meters: number | null;
};

/** Aggregate running stats for the dashboard header tiles. */
export type RunningMetrics = {
  current_week: {
    distance_meters: number;
    run_count: number;
    delta_pct_vs_prior_week: number | null;
  };
  current_month: {
    distance_meters: number;
    run_count: number;
  };
  recent_avg_pace_sec_per_km: number | null;
  all_time: {
    distance_meters: number;
    run_count: number;
  };
};

/** One page of running sessions plus the cursor for the next page. */
export type RunningSessionsPage = {
  sessions: RunningSession[];
  // Opaque cursor (a start_time) to pass as `before` for the next page;
  // null when there are no older sessions.
  next_before: string | null;
};

/**
 * Thrown by `importRunningTcx` when the API returns 409 — the activity
 * was already imported. Carries the existing session's id so the import
 * modal can render an "already in your log" message with a View run link
 * instead of a generic error.
 */
export class DuplicateRunError extends Error {
  existingSessionId: string;
  constructor(message: string, existingSessionId: string) {
    super(message);
    this.name = "DuplicateRunError";
    this.existingSessionId = existingSessionId;
  }
}

/**
 * GET /running/sessions. Returns one page of the authed user's runs,
 * most recent first. Two mutually exclusive query patterns:
 *   - cursor pagination: `limit` + `before` (a prior page's `next_before`)
 *   - date range:        `since` + `until` (half-open `[since, until)`)
 * The calendar uses the range form to fetch a whole month at once; the
 * run list uses the cursor form. Mixing returns 400 from the API.
 */
export async function listRunningSessions(
  token: string,
  opts: { limit?: number; before?: string; since?: string; until?: string } = {},
): Promise<RunningSessionsPage> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  if (opts.since) params.set("since", opts.since);
  if (opts.until) params.set("until", opts.until);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/running/sessions${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<RunningSessionsPage>(resp, { sessions: [], next_before: null });
}

/**
 * GET /running/sessions/{id}. Returns a single run owned by the authed
 * user, including its `trackpoints`. 404 if the ID doesn't exist or
 * belongs to another user.
 */
export async function getRunningSession(token: string, id: string): Promise<RunningSession> {
  const resp = await fetch(`${config.apiUrl}/running/sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<RunningSession | null>(resp, null);
  if (!got) {
    throw new Error("running session not found");
  }
  return got;
}

/**
 * GET /running/metrics. `timezone` is an IANA name (e.g.
 * "America/New_York"); the server uses it to bucket "this week" / "this
 * month". Call sites should pass
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 */
export async function getRunningMetrics(token: string, timezone: string): Promise<RunningMetrics> {
  const params = new URLSearchParams({ timezone });
  const resp = await fetch(`${config.apiUrl}/running/metrics?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<RunningMetrics>(resp, {
    current_week: { distance_meters: 0, run_count: 0, delta_pct_vs_prior_week: null },
    current_month: { distance_meters: 0, run_count: 0 },
    recent_avg_pace_sec_per_km: null,
    all_time: { distance_meters: 0, run_count: 0 },
  });
}

/**
 * PATCH /running/sessions/{id}. Renames the run; returns the updated
 * session so the caller can splice it into local state.
 */
export async function renameRunningSession(
  token: string,
  id: string,
  name: string,
): Promise<RunningSession> {
  const resp = await fetch(`${config.apiUrl}/running/sessions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  const updated = await unwrap<RunningSession | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated running session");
  }
  return updated;
}

/**
 * DELETE /running/sessions/{id}. 204 on success (no body); throws the
 * API's `error` envelope on non-2xx.
 */
export async function deleteRunningSession(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/running/sessions/${encodeURIComponent(id)}`, {
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
 * POST /running/sessions/imports. Uploads a Garmin .tcx file as
 * multipart/form-data under the field `file` and returns the created
 * session.
 *
 * We deliberately do NOT set a Content-Type header — the browser fills
 * in `multipart/form-data; boundary=...` for the FormData body, and
 * setting it manually would omit the boundary and break parsing.
 *
 * Error mapping:
 *  - 409 → DuplicateRunError carrying `existing_session_id` so the
 *    modal can link to the run already in the user's log.
 *  - 413 → friendly "File is too large (max 10 MB)." message.
 *  - 415 / 400 → the server's `error` text (unsupported/invalid file).
 *  - other non-2xx → `error` text or `HTTP {status}`.
 */
export async function importRunningTcx(token: string, file: File): Promise<RunningSession> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${config.apiUrl}/running/sessions/imports`, {
    method: "POST",
    // No Content-Type: the browser sets the multipart boundary itself.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (resp.status === 409) {
    let body: { error?: string; code?: string; existing_session_id?: string } = {};
    try {
      body = await resp.json();
    } catch {
      // fall through to defaults below
    }
    throw new DuplicateRunError(
      body.error || "This run is already in your log.",
      body.existing_session_id ?? "",
    );
  }

  if (!resp.ok) {
    if (resp.status === 413) {
      throw new Error("File is too large (max 10 MB).");
    }
    let detail: string;
    try {
      detail = (await resp.json())?.error ?? `HTTP ${resp.status}`;
    } catch {
      detail = `HTTP ${resp.status}`;
    }
    throw new Error(detail);
  }

  const created = await unwrap<RunningSession | null>(resp, null);
  if (!created) {
    throw new Error("API did not return the imported running session");
  }
  return created;
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
