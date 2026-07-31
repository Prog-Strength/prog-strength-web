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

/** One downsampled point on a workout's heart-rate-over-elapsed-time chart. */
export type WorkoutHRTrackpoint = {
  sequence: number;
  elapsed_seconds: number;
  heart_rate_bpm: number | null;
};

/**
 * The optional Garmin-TCX enrichment layer on a workout: heart rate, calories,
 * and (on the single-workout detail load only) the downsampled HR trackpoints.
 * Null/absent when the workout has no TCX attached (`activity_id` is null).
 * `trackpoints` is present only on the detail response, omitted on lists.
 */
export type WorkoutEnrichment = {
  source_activity_id: string;
  start_time: string; // RFC3339
  duration_seconds: number;
  avg_heart_rate_bpm: number | null;
  max_heart_rate_bpm: number | null;
  total_calories: number | null;
  trackpoints?: WorkoutHRTrackpoint[];
  // Backend-computed time-in-zone breakdown over the attached TCX's HR stream,
  // the same block a run or hike carries — the API emits it for any activity
  // type with per-point HR. Detail-only (it rides the trackpoints), and absent
  // when the TCX carries no usable heart rate.
  heart_rate_zones?: HeartRateZones;
};

/**
 * A logged training session.
 *
 * Since stage 3 of the unified-activity-model migration this shape is
 * produced by `activityToWorkout` from the unified `/activities` DTO for
 * the list/detail/create/update paths. `user_id`/`updated_at` are optional
 * because the unified DTO doesn't carry them (no web surface consumes
 * them); the workout-TCX endpoints still return the legacy DTO, which does.
 */
export type Workout = {
  id: string;
  user_id?: string;
  name?: string;
  performed_at: string; // RFC3339
  ended_at?: string | null;
  notes?: string;
  exercises: WorkoutExercise[];
  created_at: string;
  updated_at?: string;
  // PR break events this workout produced. Always present in API
  // responses (empty array when no PRs); the field is non-optional so
  // UIs can iterate without a null check.
  personal_records_set: PersonalRecordEvent[];
  // The linked activity holding this workout's TCX enrichment, or null when no
  // TCX is attached. A non-null value is the "has TCX" signal. The API always
  // includes it; optional here so existing Workout fixtures need not restate it.
  activity_id?: string | null;
  // Heart-rate / effort enrichment from the linked TCX. Null when activity_id
  // is null; carries `trackpoints` only on the single-workout detail load.
  enrichment?: WorkoutEnrichment | null;
  // User-attached photos, ordered by `position`. Threaded through from the
  // unified Activity DTO by `activityToWorkout` so the detail page renders the
  // photo strip off the same fetch. Present only on the detail read (and only
  // when photo storage is configured); absent on list rows.
  photos?: ActivityPhoto[];
};

/** A catalog entry — the canonical definition of an exercise. */
export type Exercise = {
  id: string; // slug
  name: string;
  description?: string;
  muscle_groups: string[];
  equipment: string[];
};

// --- Workout compat adapters (legacy surface over /activities) -----
//
// Every fetcher in this group is a thin compat adapter over the unified
// /activities surface: same exported name and consumer-facing shape as the
// old /workouts fetchers, implemented via listActivities/getActivity/
// createActivity/updateActivity/deleteActivity + activityToWorkout.
// PREFER THE UNIFIED FETCHERS FOR NEW CODE — these wrappers exist so the
// existing workout surfaces didn't have to migrate types in stage 3, and
// they're slated for removal once those surfaces consume Activity
// directly.

/**
 * Optional filters and pagination params for the workouts list. Mirrors
 * `ListActivitiesOptions` minus the type (fixed to strength_training):
 * two mutually exclusive query patterns — cursor (`limit`/`before`) or
 * range (`since`/`until`) — because the unified `/activities` endpoint
 * forbids mixing them. The prior offset pagination is gone with the
 * legacy `/workouts` shim.
 */
export type ListWorkoutsOptions = {
  // RFC3339 lower/upper bounds on performed_at (range form, uncapped).
  since?: string;
  until?: string;
  // Cursor form: page size (1–100, API default 50) + a prior page's
  // `next_before`.
  limit?: number;
  before?: string;
};

/**
 * One page of workouts plus the keyset cursor for the next page —
 * the unified list's pagination model. `next_before` is null on the
 * last page (and always null in the range form).
 */
export type WorkoutsPage = {
  items: Workout[];
  next_before: string | null;
};

/**
 * Compat adapter (prefer `listActivities` for new code). Lists the authed
 * user's strength sessions, most recent first, via
 * `GET /activities?type=strength_training` — the stage-3 replacement for
 * the deprecated `GET /workouts` shim. Each unified item's strength
 * `details` (exercises + personal_records_set, embedded per item by the
 * API's bulk loader) is adapted onto the legacy `Workout` shape so
 * consumers render unchanged.
 */
export async function listWorkouts(
  token: string,
  options: ListWorkoutsOptions = {},
): Promise<WorkoutsPage> {
  const page = await listActivities(token, { ...options, type: "strength_training" });
  return {
    items: page.activities.map(activityToWorkout),
    next_before: page.next_before,
  };
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
 * Compat adapter (prefer `getActivity` for new code). Fetches a single
 * strength session via `GET /activities/{id}` (the stage-3 replacement
 * for `GET /workouts/{id}`) and adapts it onto the
 * legacy `Workout` shape — exercises + personal_records_set from the
 * strength `details`, TCX enrichment (with HR trackpoints) from the base
 * row. 404s and non-strength ids both surface as "workout not found"
 * (deliberately indistinguishable, matching the legacy endpoint).
 */
export async function getWorkout(token: string, id: string): Promise<Workout> {
  let activity: Activity;
  try {
    activity = await getActivity(token, id);
  } catch (err) {
    if (err instanceof Error && err.message === "activity not found") {
      throw new Error("workout not found");
    }
    throw err;
  }
  if (activity.activity_type !== "strength_training") {
    throw new Error("workout not found");
  }
  return activityToWorkout(activity);
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
  // Compact ascending (oldest→newest) estimated-1RM trend for the Lifts
  // view spark. Nullable: an older API omits it and the spark just doesn't
  // render. (Additive field — see SOW personal-records-lifts.)
  recent_estimated_1rm_points: number[] | null;
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
  // Static body metric, canonical centimeters. Null/absent when the user
  // hasn't set a height; clients convert to in/cm at the display edge.
  height_cm?: number | null;
  // Resolved avatar URL from GET /me — a presigned S3 GET (when the user
  // uploaded one), the OAuth-provider avatar URL fallback, or null when
  // neither is available (client renders an initials placeholder).
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * The resolved profile returned by the four /me profile endpoints
 * (GET/PATCH /me, POST/DELETE /me/avatar). Mirrors the API's `meResponse`
 * DTO: a flat shape where `avatar_url` is already resolved server-side
 * (presigned S3 GET, OAuth fallback, or null) and `height_cm` is the
 * canonical centimeter value. It's a structural subset of `User`, so it
 * doubles as the seed for the DistanceUnitContext and Settings page.
 */
export type ResolvedProfile = {
  id: string;
  email: string;
  display_name: string;
  weight_unit: "lb" | "kg";
  distance_unit: "mi" | "km";
  height_cm: number | null;
  birthdate: string | null;
  sex: "male" | "female" | null;
  avatar_url: string | null;
  // IANA timezone (e.g. "America/Denver"). Anchors the day windows the
  // planned-workout + Google Calendar sync features push events into.
  timezone: string;
  // The user's default calendar-detail level for newly-planned workouts —
  // whether a synced Google event is a bare time block or a full agenda.
  calendar_default_detail: "time_block" | "full_agenda";
  // The user's chosen handle (the `/u/{username}` profile slug), or null when
  // they haven't set one yet. Editable via PATCH /me; see `updateMe`.
  username: string | null;
  // The user's free-text bio shown on their public profile, or null when
  // unset. Max 160 runes; editable via PATCH /me (empty string clears it).
  bio: string | null;
};

/**
 * GET /me. Returns the resolved profile — preferences plus `height_cm`
 * and a server-resolved `avatar_url`. Throws if the response carries no
 * user payload.
 */
export async function getMe(token: string): Promise<ResolvedProfile> {
  const resp = await fetch(`${config.apiUrl}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<ResolvedProfile | null>(resp, null);
  if (!got) {
    throw new Error("user not found");
  }
  return got;
}

/**
 * The authed user's daily AI-usage snapshot. Denominated only as a
 * percentage of the user's daily allowance — the API deliberately omits
 * any dollar figure (the cost model is operator-internal). `capped` is
 * the gate's source of truth; `resets_at` is the user's next local
 * midnight in UTC (RFC3339), which the frontend turns into a countdown.
 */
export type UsageData = { percent_used: number; capped: boolean; resets_at: string };

/**
 * GET /me/usage. Returns the authed user's daily AI-usage snapshot.
 * `tz` is the user's IANA timezone (e.g. "America/Denver"), used by the
 * API to anchor the daily-rollover window on the user's local midnight;
 * call sites pass `Intl.DateTimeFormat().resolvedOptions().timeZone`.
 */
export async function getMyUsage(token: string, tz: string): Promise<UsageData> {
  const resp = await fetch(`${config.apiUrl}/me/usage?tz=${encodeURIComponent(tz)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<UsageData>(resp, { percent_used: 0, capped: false, resets_at: "" });
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
    // Canonical centimeters; pass `null` to clear a previously-set height.
    height_cm?: number | null;
    birthdate?: string | null;
    sex?: "male" | "female" | null;
    weight_unit?: "lb" | "kg";
    distance_unit?: "mi" | "km";
    // IANA timezone name.
    timezone?: string;
    // Default detail level applied to newly-synced calendar events.
    calendar_default_detail?: "time_block" | "full_agenda";
    // New handle. The server validates charset/length and reserved words and
    // rejects with 400 (invalid/reserved) or 409 (already taken); those
    // surface as the unwrap'd `error` message for the caller to render.
    username?: string;
    // Free-text profile bio (max 160 runes; the server is authoritative).
    // Pass "" to clear a previously-set bio.
    bio?: string;
  },
): Promise<ResolvedProfile> {
  const resp = await fetch(`${config.apiUrl}/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  const updated = await unwrap<ResolvedProfile | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated user");
  }
  return updated;
}

/**
 * POST /me/avatar. Uploads an image as multipart/form-data under the
 * field `file` and returns the resolved profile (with the freshly
 * presigned `avatar_url`).
 *
 * We deliberately do NOT set a Content-Type header — the browser fills in
 * `multipart/form-data; boundary=...` for the FormData body, and setting
 * it manually would omit the boundary and break server-side parsing
 * (same pattern as `importActivityTcx`).
 *
 * The server is authoritative on size (2 MB) and content type
 * (image/png, image/jpeg, image/webp); callers should still guard
 * client-side for snappier UX. Non-2xx surfaces the API's `error`
 * envelope as the thrown message.
 */
export async function uploadAvatar(token: string, file: File): Promise<ResolvedProfile> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${config.apiUrl}/me/avatar`, {
    method: "POST",
    // No Content-Type: the browser sets the multipart boundary itself.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const updated = await unwrap<ResolvedProfile | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated profile");
  }
  return updated;
}

/**
 * DELETE /me/avatar. Clears the user's uploaded avatar and returns the
 * resolved profile, whose `avatar_url` now carries the OAuth fallback (or
 * null when none is available).
 */
export async function deleteAvatar(token: string): Promise<ResolvedProfile> {
  const resp = await fetch(`${config.apiUrl}/me/avatar`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  const updated = await unwrap<ResolvedProfile | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated profile");
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
 * One exercise's contribution to the progression chart's trend layer.
 * `slope_per_month` is the least-squares slope of that exercise's
 * normalized points, in percentage points per month relative to its
 * own baseline; `trendline` carries the regression's endpoints. Both
 * are null when `session_count` is below the backend's minimum-sessions
 * threshold (or the regression is degenerate) — the renderer treats
 * those as "not enough data" rather than fitting a line through two
 * points. See prog-strength-docs/sows/progress-page-modernization.md.
 */
export type PerExerciseTrend = {
  exercise_id: string;
  session_count: number;
  slope_per_month: number | null;
  trendline: Trendline | null;
};

/**
 * Defensible aggregate stats built on top of the per-exercise slopes.
 * `min_sessions_threshold` is surfaced so the UI's "not enough data"
 * copy isn't hard-coded. `median_slope_per_month` is null when no
 * exercise clears the session threshold.
 */
export type ProgressionAggregate = {
  lifts_tracked: number;
  lifts_progressing: number;
  median_slope_per_month: number | null;
  min_sessions_threshold: number;
};

/**
 * Echo of the request's filter plus the resolved set of muscle groups
 * behind it. Exactly one of `movement_pattern` / `muscle_group` is set,
 * mirroring the query parameter the caller supplied; the UI renders an
 * unobtrusive caption from `muscle_groups_included`.
 */
export type ProgressionFilterInfo = {
  movement_pattern?: string;
  muscle_group?: string;
  muscle_groups_included: string[];
};

/**
 * GET /workouts/progression response. Driven by either the
 * `movement_pattern` or the legacy `muscle_group` query parameter; the
 * backend resolves the filter into its constituent muscle groups,
 * normalizes each exercise against its own recency-weighted baseline,
 * and returns per-exercise trends + aggregate stats ready to plot.
 *
 * `baseline_model` is the discriminator the UI uses to label what
 * "100%" means (today: "recency_weighted_current"). The single
 * cross-exercise top-level trendline of the prior shape is gone — the
 * trend layer is now per-exercise. See
 * prog-strength-docs/sows/progress-page-modernization.md.
 */
export type MuscleGroupProgression = {
  filter: ProgressionFilterInfo;
  since: string;
  until: string;
  baseline_model: string;
  exercise_baselines: ExerciseBaseline[];
  points: MuscleGroupProgressionPoint[];
  per_exercise_trends: PerExerciseTrend[];
  aggregate: ProgressionAggregate | null;
};

/**
 * Exactly one filter selects the exercises that feed the progression
 * chart: a movement pattern (`push` | `pull` | `legs` | `core` | `all`,
 * resolved to its muscle groups server-side) or a single legacy
 * `muscle_group`. The API rejects supplying both or neither, so the
 * union type pushes that "pick one" contract onto the caller.
 */
export type ProgressionFilter = { movementPattern: string } | { muscleGroup: string };

/**
 * GET /activities/progression?{movement_pattern|muscle_group}=...&since=...&until=...
 * (the progression endpoint's canonical unified path; response shape
 * unchanged from its /workouts/progression days).
 *
 * Requires auth. The backend resolves the filter into every exercise
 * that targets it, reads each exercise's 1RM history, computes a
 * recency-weighted current baseline per exercise, and returns
 * normalized points + per-exercise trends + aggregate stats ready to
 * plot.
 *
 * Timestamps are RFC3339; if either is omitted, the server defaults
 * to the last 90 days.
 */
export async function listProgression(
  token: string,
  filter: ProgressionFilter,
  since?: string,
  until?: string,
): Promise<MuscleGroupProgression> {
  const params = new URLSearchParams();
  if ("movementPattern" in filter) {
    params.set("movement_pattern", filter.movementPattern);
  } else {
    params.set("muscle_group", filter.muscleGroup);
  }
  if (since) params.set("since", since);
  if (until) params.set("until", until);
  const resp = await fetch(`${config.apiUrl}/activities/progression?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // Force a non-null default — empty progression rather than throwing
  // on missing payload, so callers can render a clean empty state.
  const got = await unwrap<MuscleGroupProgression | null>(resp, null);
  return (
    got ?? {
      filter:
        "movementPattern" in filter
          ? { movement_pattern: filter.movementPattern, muscle_groups_included: [] }
          : { muscle_group: filter.muscleGroup, muscle_groups_included: [] },
      since: since ?? "",
      until: until ?? "",
      baseline_model: "recency_weighted_current",
      exercise_baselines: [],
      points: [],
      per_exercise_trends: [],
      aggregate: null,
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
 * Compat adapter (prefer `deleteActivity` for new code — this is a bare
 * delegation). Soft-deletes a strength session via
 * `DELETE /activities/{id}` (204;
 * subsequent reads treat the row as gone). Throws the API's `error`
 * envelope on non-2xx — typically a 404 if the ID doesn't exist or
 * isn't owned by this user.
 */
export async function deleteWorkout(token: string, id: string): Promise<void> {
  return deleteActivity(token, id);
}

/**
 * Maps the legacy WorkoutPayload (what every edit surface builds) onto the
 * unified create/update body: performed_at → start_time, ended_at →
 * duration_seconds, exercises → the strength `details` blob. The API
 * re-derives ended_at as start_time + duration on read. This is the WRITE
 * direction of the compat seam; `activityToWorkout` (in the unified
 * section below) is the READ direction.
 */
function workoutPayloadToActivityPayload(payload: WorkoutPayload): ActivityPayload {
  const body: ActivityPayload = {
    activity_type: "strength_training",
    start_time: payload.performed_at,
    details: { exercises: payload.exercises },
  };
  if (payload.ended_at) {
    body.duration_seconds = Math.round(
      (new Date(payload.ended_at).getTime() - new Date(payload.performed_at).getTime()) / 1000,
    );
  }
  if (payload.name) body.name = payload.name;
  if (payload.notes) body.notes = payload.notes;
  return body;
}

/**
 * Compat adapter (prefer `createActivity` for new code). Creates a
 * strength session via the typed `POST /activities`. Returns
 * the created Workout (including any personal_records_set the save
 * triggered — the unified response embeds them in the strength details)
 * so the caller can route to it and surface PRs without a follow-up
 * fetch. Throws the API's `error` envelope on non-2xx.
 */
export async function createWorkout(token: string, payload: WorkoutPayload): Promise<Workout> {
  const created = await createActivity(token, workoutPayloadToActivityPayload(payload));
  return activityToWorkout(created);
}

/**
 * Compat adapter (prefer `updateActivity` for new code). Full-replacement
 * update of a strength session via the typed `PUT /activities/{id}` — same semantics as the legacy PUT /workouts/{id}
 * (PRs recompute; TCX-enrichment vitals survive). Returns the updated
 * Workout so callers can splice it into local state without a refetch.
 */
export async function updateWorkout(
  token: string,
  id: string,
  payload: WorkoutPayload,
): Promise<Workout> {
  const updated = await updateActivity(token, id, workoutPayloadToActivityPayload(payload));
  return activityToWorkout(updated);
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

// --- Steps --------------------------------------------------------

/**
 * One day's step count. The log is date-keyed (one row per calendar
 * day): the API upserts on PUT /steps/{date}, so re-logging a day
 * overwrites rather than appending. See
 * prog-strength-docs/sows/daily-steps-logging.md.
 */
export type StepsEntry = {
  id: string;
  date: string; // YYYY-MM-DD
  steps: number;
  created_at: string;
  updated_at: string;
};

/**
 * A page of step entries, newest first. `next_before` is an opaque
 * cursor (a YYYY-MM-DD date) to pass back as `before` for the next
 * keyset page; null when the last page has been reached.
 */
export type StepsPage = {
  steps: StepsEntry[];
  next_before: string | null;
};

export type StepsGoal = {
  goal: number;
  created_at: string | null;
  updated_at: string | null;
};

/**
 * Lists step entries newest-first in one of two modes:
 *   - range: `since` + `until` (YYYY-MM-DD, both inclusive)
 *   - keyset: `limit` (+ optional `before`, a prior page's
 *     `next_before`; returns days strictly before that date)
 * Mixing the two is a server-side error, so callers pick one form.
 */
export async function listSteps(
  token: string,
  opts: { since?: string; until?: string; limit?: number; before?: string } = {},
): Promise<StepsPage> {
  const params = new URLSearchParams();
  if (opts.since) params.set("since", opts.since);
  if (opts.until) params.set("until", opts.until);
  if (opts.limit != null) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/steps${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<StepsPage>(resp, { steps: [], next_before: null });
}

/** Upserts the step count for a single day. PUT /steps/{date}. */
export async function upsertStepsForDate(
  token: string,
  date: string,
  steps: number,
): Promise<StepsEntry> {
  const resp = await fetch(`${config.apiUrl}/steps/${encodeURIComponent(date)}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ steps }),
  });
  const saved = await unwrap<StepsEntry | null>(resp, null);
  if (!saved) throw new Error("API did not return the saved steps entry");
  return saved;
}

/** Removes a single day from the step log. DELETE /steps/{date}. */
export async function deleteStepsForDate(token: string, date: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/steps/${encodeURIComponent(date)}`, {
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

export async function getStepsGoal(token: string): Promise<StepsGoal> {
  const resp = await fetch(`${config.apiUrl}/me/steps-goal`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<StepsGoal>(resp, { goal: 0, created_at: null, updated_at: null });
}

export async function putStepsGoal(token: string, goal: { goal: number }): Promise<StepsGoal> {
  const resp = await fetch(`${config.apiUrl}/me/steps-goal`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(goal),
  });
  const saved = await unwrap<StepsGoal | null>(resp, null);
  if (!saved) throw new Error("API did not return the saved steps goal");
  return saved;
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

// --- Activities (TCX import) --------------------------------------
//
// The API generalized the prior running-only domain into a sport-agnostic
// activity domain (see api migration 015). Routes moved from /running/*
// to /activities/*. The TS names on this side are kept as `RunningSession`
// + `RunningSessionsPage` for now: the web app is still a running app, the
// pages still live at /running/*, and renaming the user-facing routes is
// product work separate from this API cutover. Walks and rides will land
// in the API but the UI treats anything non-running as out of scope until
// a follow-up.

/**
 * Sport-agnostic activity type stored on every API row. `strength_training`
 * is included because the unified-activity-model migration (api PR #79)
 * makes `GET /activities` return every activity type, not just endurance
 * ones — the type needs the literal so call sites can filter it out under
 * `strict` without a same-type-required-for-comparison tsc error. The web
 * app doesn't otherwise render strength rows through this domain (workouts
 * cover that); see `listRunningSessions` below for the guard.
 */
export type ActivityType =
  | "running"
  | "walking"
  | "cycling"
  | "hiking"
  | "other"
  | "strength_training";

/**
 * How an activity entered the system. `manual` covers rows written by the
 * unified manual create surface (every strength session logged in-app);
 * the TCX/Garmin values cover imported endurance rows and TCX-enriched
 * lifts.
 */
export type IngestSource = "manual" | "manual_tcx" | "garmin_api";

/**
 * One imported activity (today: a run; tomorrow: also walks/rides).
 * Distances/elevations are stored in meters and paces in seconds-per-
 * kilometer server-side; the DistanceUnitContext converts toward the
 * user's preferred unit at render time. `trackpoints` is only present
 * on the per-id detail GET — the list endpoint omits it to keep payloads
 * small. See prog-strength-docs/sows/running-tracking-via-tcx-import.md.
 *
 * `avg_pace_sec_per_km` is nullable: pace is meaningful only for running
 * activities; cycling/walking rows return null.
 */
/**
 * One percent-of-max-HR zone in a run's heart-rate-zone breakdown.
 * `lower_pct`/`upper_pct` are the zone's boundary fractions of the
 * reference max HR; `min_bpm`/`max_bpm` are those boundaries resolved to
 * bpm; `time_seconds`/`time_pct` are the time spent in the zone (the
 * percentages sum to 1.0 over the HR-covered portion of the run).
 */
export type HeartRateZone = {
  zone: number;
  name: string;
  lower_pct: number;
  upper_pct: number;
  min_bpm: number;
  max_bpm: number;
  time_seconds: number;
  time_pct: number;
};

/**
 * The additive `heart_rate_zones` block on the running detail response —
 * a five-zone time-in-zone breakdown the backend computes against an
 * estimated reference max HR. `reference_confidence` degrades from
 * "estimated" (cold start) through "calibrating" to "calibrated"; the
 * widget shows a "calibrating" banner until the estimate is trusted.
 * Absent on the response when the run carries no per-point heart rate.
 */
export type HeartRateZones = {
  model: string;
  max_hr_reference_bpm: number;
  reference_source: string;
  reference_confidence: "estimated" | "calibrating" | "calibrated";
  calibrating: boolean;
  total_hr_seconds: number;
  zones: HeartRateZone[];
};

// A simplified GPS route as a GeoJSON Feature (RFC 7946): a MultiLineString
// whose coordinates are [longitude, latitude] pairs, plus a pre-computed
// bounding box the map fits its camera to. Present on the activity-detail
// response only for runs recorded with GPS; absent for indoor / no-GPS runs.
export type RouteBounds = {
  min_lat: number;
  min_lng: number;
  max_lat: number;
  max_lng: number;
};

export type RouteFeature = {
  type: "Feature";
  geometry: {
    type: "MultiLineString";
    coordinates: number[][][]; // [segment][point][lng, lat]
  };
  properties: {
    bounds: RouteBounds;
  };
};

export type RunningSession = {
  id: string;
  activity_type: ActivityType;
  ingest_source: IngestSource;
  source_activity_id: string;
  name: string | null;
  start_time: string; // RFC3339
  distance_meters: number;
  // Distance as originally ingested from the TCX, never mutated by
  // calibration. "Calibrated" is derivable as
  // raw_distance_meters !== distance_meters; a reset calibrates back to it.
  raw_distance_meters: number;
  // "indoor" (treadmill / no GPS) or "outdoor" (GPS). Indoor running is
  // user-calibratable and excluded from PRs/best-efforts.
  environment: "outdoor" | "indoor";
  duration_seconds: number;
  avg_pace_sec_per_km: number | null;
  best_pace_sec_per_km: number | null;
  avg_heart_rate_bpm: number | null;
  max_heart_rate_bpm: number | null;
  total_calories: number | null;
  elevation_gain_meters: number | null;
  elevation_loss_meters: number | null;
  elevation_high_meters: number | null;
  elevation_low_meters: number | null;
  created_at: string;
  // Present only on the detail GET; absent in list responses.
  trackpoints?: RunningTrackpoint[];
  // Free-text notes. Present only on the detail GET; omitted on list
  // responses, mirroring `trackpoints`. Null when the run has no notes.
  notes?: string | null;
  // Backend-computed time-in-zone breakdown; absent when the run has no HR.
  heart_rate_zones?: HeartRateZones;
  // Simplified GPS route for the map; present only on the detail GET for
  // GPS-recorded runs. Absent for indoor / no-GPS activities.
  route?: RouteFeature;
  // Server-derived detail blocks (running only; absent on list responses).
  // The page renders these verbatim — no client-side re-derivation.
  unit?: "mi" | "km";
  splits?: RunningSplit[];
  strip_summary?: RunningStripSummary;
  best_pace_sec_per_unit?: number;
  intervals?: RunningIntervalSegment[];
};

/** One distance bucket of the server-derived splits table. Pace is per the
 *  response's `unit` and equals duration_seconds/distance_meters normalized
 *  to one unit — the backend's invariant gate asserts it. */
export type RunningSplit = {
  index: number;
  partial: boolean;
  distance_meters: number;
  duration_seconds: number;
  pace_sec_per_unit: number | null;
  avg_hr_bpm: number | null;
  elevation_delta_meters: number | null;
  fastest: boolean;
  slowest: boolean;
};

/** Pace-chart header numbers, server-computed over clean samples only. */
export type RunningStripSummary = {
  fastest_sec_per_unit: number | null;
  slowest_sec_per_unit: number | null;
  dropout_count: number;
};

/** One labeled bout of a server-detected interval workout. */
export type RunningIntervalSegment = {
  kind: "warmup" | "work" | "recovery" | "cooldown";
  rep: number | null;
  label: string;
  distance_meters: number;
  duration_seconds: number;
  pace_sec_per_unit: number | null;
  avg_hr_bpm: number | null;
};

/** One sampled point along an activity's track, ordered by `sequence`. */
export type RunningTrackpoint = {
  sequence: number;
  elapsed_seconds: number;
  distance_meters: number;
  heart_rate_bpm: number | null;
  pace_sec_per_km: number | null;
  elevation_meters: number | null;
  // Server-owned plottability flag: the chart draws a gap where false
  // (per-point pace absent, non-positive, or slower than the device-dropout
  // threshold).
  clean_pace: boolean;
  // WGS84 coordinates of this sample; null where the source trackpoint had no
  // <Position>. These are what let the elevation profile drive a marker along
  // the route: the elevation strip is a straight map over this array, so strip
  // index i is trackpoint i. The simplified `route` geometry can't serve that —
  // it's RDP-reduced and not index-aligned with anything.
  latitude: number | null;
  longitude: number | null;
  // Server-owned signed slope in percent, measured over a smoothing window.
  // Null where it can't be measured honestly; 0 means genuinely flat.
  grade_percent: number | null;
};

/**
 * Aggregate running stats for the dashboard header tiles. The API
 * filters to activity_type='running' before aggregating, so walks and
 * rides don't contribute to these numbers.
 */
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

/**
 * One page of activities plus the cursor for the next page. The wire
 * field is `activities` (server-renamed from the prior `sessions` in API
 * migration 015); the TS name stays `activities` to match.
 */
export type RunningSessionsPage = {
  activities: RunningSession[];
  // Opaque cursor (a start_time) to pass as `before` for the next page;
  // null when there are no older activities.
  next_before: string | null;
};

// --- Unified /activities surface (stage 3) ------------------------
//
// The one typed surface over every activity type (SOW: unified-activity-
// model). `Activity` mirrors the Go unifiedReadDTO: the base-row fields
// (which `RunningSession` above already models — that type stays as the
// endurance-detail view of the same wire shape) plus the registry-driven
// `summary` card and the type-keyed `details` payload. The workout compat
// adapters bridge in both directions: `activityToWorkout` (below) reads a
// unified strength row back into the legacy `Workout` shape, and
// `workoutPayloadToActivityPayload` (beside createWorkout above) writes a
// legacy WorkoutPayload as a typed /activities body — so components keep
// their types.

/**
 * The registry-rendered card for a list row: title, subtitle, metric
 * chips. No web surface renders it yet (the current views derive their
 * own rollups); kept because it's part of the wire DTO `Activity`
 * mirrors, and the mobile twin's unified-surface port (mobile parity
 * phases) consumes the same shape.
 */
export type ActivitySummary = {
  title: string;
  subtitle: string;
  metrics: string[];
};

/**
 * The strength `details` payload: the session's exercises plus the PR
 * break events it produced, in the exact legacy /workouts DTO shape
 * (`personal_records_set` is never null — [] when no PRs). Embedded on
 * detail reads AND per-item on list responses (the API bulk-loads them).
 * `exercises` serializes as null for a zero-exercise session (e.g. a
 * fresh TCX import awaiting its exercises) — `activityToWorkout`
 * normalizes it to [].
 */
export type StrengthActivityDetails = {
  exercises: WorkoutExercise[] | null;
  personal_records_set: PersonalRecordEvent[];
};

/**
 * The endurance `details` payload (activity_run_details etc. projected
 * through the endurance detail store). Detail reads only; the running
 * surfaces read these same fields off the flattened base DTO instead, so
 * no web consumer reads it today. Kept (not YAGNI-deleted) because it
 * completes the `details` union — the `"exercises" in details` narrowing
 * is only type-safe with the non-strength branch typed — and the mobile
 * twin's unified-surface port consumes the same wire shape.
 */
export type EnduranceActivityDetails = {
  distance_meters: number;
  raw_distance_meters?: number;
  avg_pace_sec_per_km?: number;
  best_pace_sec_per_km?: number;
  elevation_gain_meters?: number;
  environment?: "outdoor" | "indoor";
  route_geojson?: string;
};

/**
 * One user-attached photo on an activity, as GET /activities/{id} embeds
 * it (and as the photo write endpoints return it). `url` is a full-size
 * presigned GET; `thumb_url` a downsized derivative for grids/covers.
 * `caption` is null when unset. `position` is the 0-based display order
 * the reorder endpoint maintains.
 */
export type ActivityPhoto = {
  id: string;
  url: string;
  thumb_url: string;
  width: number;
  height: number;
  caption: string | null;
  position: number;
};

/**
 * The compact cover derivative the timeline card carries for a post whose
 * source activity has photos — just enough to render the first photo's
 * thumbnail at the right aspect ratio. Null on posts with no photos.
 */
export type TimelinePhotoCover = {
  thumb_url: string;
  width: number;
  height: number;
};

/**
 * One unified activity as GET /activities returns it. Structurally the
 * base DTO `RunningSession` already models (same wire fields — see the
 * comment above), plus `summary` and `details`. `details` is present on
 * detail reads and, for strength items, on list rows too; discriminate
 * with `"exercises" in details` (or `activity_type`).
 *
 * `photos` is present on the detail read (`GET /activities/{id}`) only when
 * photo storage is configured — an empty array when the activity has none,
 * and the key is omitted entirely when storage is unconfigured (so absent
 * ≠ "no photos"; it means the feature is off).
 */
export type Activity = RunningSession & {
  // The owning user. Present on the unified read shape (the base
  // `RunningSession` DTO omits it because no running surface needs it); carried
  // here so ownership-gated detail affordances (e.g. the photo strip's owner
  // controls) can compare it against the viewer's profile id.
  user_id?: string;
  summary?: ActivitySummary;
  details?: StrengthActivityDetails | EnduranceActivityDetails;
  photos?: ActivityPhoto[];
};

/** One page of unified activities plus the keyset cursor for the next. */
export type ActivitiesPage = {
  activities: Activity[];
  next_before: string | null;
};

/**
 * Query params for GET /activities. Two mutually exclusive patterns:
 * cursor (`limit` + `before`) or range (`since` + `until`, half-open,
 * uncapped server-side). `type` narrows to one registered activity type.
 */
export type ListActivitiesOptions = {
  limit?: number;
  before?: string;
  since?: string;
  until?: string;
  type?: ActivityType;
};

/**
 * The typed POST/PUT /activities body: the base columns plus the
 * type-keyed `details` blob. Strength is the only type web writes through
 * this surface today, so `details` is typed as its exercises list (the
 * same shape POST /workouts accepted; the API assigns order from array
 * position).
 */
export type ActivityPayload = {
  activity_type: ActivityType;
  start_time: string; // RFC3339
  duration_seconds?: number;
  name?: string;
  notes?: string;
  avg_heart_rate_bpm?: number;
  max_heart_rate_bpm?: number;
  total_calories?: number;
  details?: { exercises: WorkoutPayload["exercises"] };
};

/**
 * GET /activities. Returns one page of the authed user's activities of
 * every type, most recent first. The API forbids mixing the range params
 * with the cursor params, so when `since`/`until` are present the cursor
 * params are dropped here — the range form is uncapped server-side and
 * the window itself bounds the result.
 */
export async function listActivities(
  token: string,
  opts: ListActivitiesOptions = {},
): Promise<ActivitiesPage> {
  const params = new URLSearchParams();
  if (opts.type) params.set("type", opts.type);
  const range = Boolean(opts.since || opts.until);
  if (opts.since) params.set("since", opts.since);
  if (opts.until) params.set("until", opts.until);
  if (!range && opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (!range && opts.before) params.set("before", opts.before);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/activities${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<ActivitiesPage>(resp, { activities: [], next_before: null });
}

/**
 * GET /activities/{id}. Returns a single activity of any type, including
 * detail-only blocks (trackpoints, strength/endurance `details`, and the
 * running-derived splits for runs). `unit` selects the display unit for
 * the running-derived blocks; irrelevant (but harmless) for other types.
 * 404s surface as a thrown "activity not found".
 */
export async function getActivity(
  token: string,
  id: string,
  unit: "mi" | "km" = "mi",
): Promise<Activity> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}?unit=${unit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<Activity | null>(resp, null);
  if (!got) {
    throw new Error("activity not found");
  }
  return got;
}

/**
 * POST /activities/{id}/photos. Uploads one photo as multipart/form-data
 * under the field `photo`, with an optional `caption` field, and returns
 * the created photo (with its presigned URLs, dimensions, and assigned
 * position).
 *
 * As with `uploadAvatar`, we deliberately do NOT set a Content-Type header
 * — the browser fills in `multipart/form-data; boundary=...` for the
 * FormData body, and setting it manually would drop the boundary and break
 * server-side parsing.
 *
 * The server is authoritative on size and content type; non-2xx surfaces
 * the API's `error` envelope as the thrown message (413 file_too_large,
 * 415 unsupported_media_type, 409 photo_limit_reached, 503
 * photo_storage_unavailable).
 */
export async function uploadActivityPhoto(
  token: string,
  activityId: string,
  file: File,
  caption?: string,
): Promise<ActivityPhoto> {
  const form = new FormData();
  form.append("photo", file);
  if (caption !== undefined) form.append("caption", caption);
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(activityId)}/photos`, {
    method: "POST",
    // No Content-Type: the browser sets the multipart boundary itself.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const created = await unwrap<ActivityPhoto | null>(resp, null);
  if (!created) throw new Error("API did not return the created photo");
  return created;
}

/**
 * PATCH /activities/{id}/photos/{photo_id}. Sets a photo's caption (pass
 * `null` to clear it) and returns the updated photo.
 */
export async function updateActivityPhotoCaption(
  token: string,
  activityId: string,
  photoId: string,
  caption: string | null,
): Promise<ActivityPhoto> {
  const resp = await fetch(
    `${config.apiUrl}/activities/${encodeURIComponent(activityId)}/photos/${encodeURIComponent(
      photoId,
    )}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ caption }),
    },
  );
  const updated = await unwrap<ActivityPhoto | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated photo");
  return updated;
}

/**
 * PUT /activities/{id}/photos/order. Reorders the activity's photos; the
 * body is the COMPLETE ordered list of photo ids (not a partial diff).
 * Returns the reordered `photos` array.
 */
export async function reorderActivityPhotos(
  token: string,
  activityId: string,
  photoIds: string[],
): Promise<ActivityPhoto[]> {
  const resp = await fetch(
    `${config.apiUrl}/activities/${encodeURIComponent(activityId)}/photos/order`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ photo_ids: photoIds }),
    },
  );
  return unwrap<ActivityPhoto[]>(resp, []);
}

/**
 * DELETE /activities/{id}/photos/{photo_id}. Removes a single photo.
 * Throws the API's `error` envelope on non-2xx.
 */
export async function deleteActivityPhoto(
  token: string,
  activityId: string,
  photoId: string,
): Promise<void> {
  const resp = await fetch(
    `${config.apiUrl}/activities/${encodeURIComponent(activityId)}/photos/${encodeURIComponent(
      photoId,
    )}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
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
 * POST /activities. Creates an activity through the typed unified
 * surface; the descriptor for `activity_type` owns validation and the
 * write path (strength routes through the workout machinery: PR
 * detection, 1RM history, timeline posts). Returns the created row in
 * the unified read shape — for strength, `details` embeds any PR events
 * the save produced.
 */
export async function createActivity(token: string, payload: ActivityPayload): Promise<Activity> {
  const resp = await fetch(`${config.apiUrl}/activities`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const created = await unwrap<Activity | null>(resp, null);
  if (!created) throw new Error("API did not return the created activity");
  return created;
}

/**
 * PUT /activities/{id}. Full-replacement typed update; the row's stored
 * type must match `activity_type` (a PUT can't change a session's type).
 * Returns the updated row in the unified read shape.
 */
export async function updateActivity(
  token: string,
  id: string,
  payload: ActivityPayload,
): Promise<Activity> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const updated = await unwrap<Activity | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated activity");
  return updated;
}

/**
 * DELETE /activities/{id}. Soft-deletes any activity type (204, no
 * body); throws the API's `error` envelope on non-2xx.
 */
export async function deleteActivity(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}`, {
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
 * Adapts one unified strength activity onto the legacy `Workout` shape
 * every workout surface consumes:
 *
 * - `performed_at`/`ended_at` ← `start_time` + `duration_seconds` (the
 *   unified model stores duration; 0 means an end-less lift → null).
 * - `exercises`/`personal_records_set` ← the strength `details` payload
 *   (absent details — a base-only read — degrade to empty arrays).
 * - `activity_id`/`enrichment` ← the base row's own TCX enrichment: since
 *   the single-row model, "has a TCX" is `source_activity_id` non-empty
 *   and the enrichment activity IS the workout row, so `activity_id`
 *   echoes the workout's own id (exactly what the legacy DTO returned).
 *   HR trackpoints ride along on detail reads only, projected onto the
 *   elapsed-time HR axis the workout chart consumes, as does the server's
 *   `heart_rate_zones` time-in-zone breakdown.
 */
export function activityToWorkout(a: Activity): Workout {
  const details = a.details && "exercises" in a.details ? a.details : undefined;
  const hasTcx = a.source_activity_id !== "";
  return {
    id: a.id,
    user_id: a.user_id,
    name: a.name ?? undefined,
    performed_at: a.start_time,
    ended_at:
      a.duration_seconds > 0
        ? new Date(new Date(a.start_time).getTime() + a.duration_seconds * 1000).toISOString()
        : null,
    notes: a.notes ?? undefined,
    exercises: details?.exercises ?? [],
    created_at: a.created_at,
    personal_records_set: details?.personal_records_set ?? [],
    // Photos ride along when the DTO carries them (detail read + storage
    // configured); left undefined otherwise so a photo-less strip renders.
    photos: a.photos,
    activity_id: hasTcx ? a.id : null,
    enrichment: hasTcx
      ? {
          source_activity_id: a.source_activity_id,
          start_time: a.start_time,
          duration_seconds: a.duration_seconds,
          avg_heart_rate_bpm: a.avg_heart_rate_bpm,
          max_heart_rate_bpm: a.max_heart_rate_bpm,
          total_calories: a.total_calories,
          ...(a.trackpoints && {
            trackpoints: a.trackpoints.map((tp) => ({
              sequence: tp.sequence,
              elapsed_seconds: tp.elapsed_seconds,
              heart_rate_bpm: tp.heart_rate_bpm,
            })),
          }),
          ...(a.heart_rate_zones && { heart_rate_zones: a.heart_rate_zones }),
        }
      : null,
  };
}

/**
 * Thrown by `importActivityTcx` when the API returns 409 — the activity
 * was already imported. Carries the existing activity's id so the import
 * modal can render an "already in your log" message with a View run link
 * instead of a generic error.
 */
export class DuplicateRunError extends Error {
  existingActivityId: string;
  constructor(message: string, existingActivityId: string) {
    super(message);
    this.name = "DuplicateRunError";
    this.existingActivityId = existingActivityId;
  }
}

/**
 * GET /activities. Returns one page of the authed user's activities,
 * most recent first. Two mutually exclusive query patterns:
 *   - cursor pagination: `limit` + `before` (a prior page's `next_before`)
 *   - date range:        `since` + `until` (half-open `[since, until)`)
 * The calendar uses the range form to fetch a whole month at once; the
 * activity list uses the cursor form. Mixing returns 400 from the API.
 */
export async function listRunningSessions(
  token: string,
  opts: { limit?: number; before?: string; since?: string; until?: string } = {},
): Promise<RunningSessionsPage> {
  // Stage 3 of the unified-activity-model migration: the running surfaces
  // filter server-side via ?type=running rather than pulling every type
  // and discarding. The client-side strength_training guard from the
  // hardening PR stays as a one-line belt in case an older API version
  // (which ignores unknown params) serves this client.
  const page = await listActivities(token, { ...opts, type: "running" });
  return {
    ...page,
    activities: page.activities.filter((a) => a.activity_type !== "strength_training"),
  };
}

/**
 * GET /activities filtered to `type=hiking`, newest first. Mirrors
 * `listRunningSessions` exactly (same signature, same pagination contract,
 * same belt-and-suspenders strength_training guard) so the hiking surfaces
 * fetch server-side rather than pulling every type and discarding.
 */
export async function listHikingSessions(
  token: string,
  opts: { limit?: number; before?: string; since?: string; until?: string } = {},
): Promise<RunningSessionsPage> {
  const page = await listActivities(token, { ...opts, type: "hiking" });
  return {
    ...page,
    activities: page.activities.filter((a) => a.activity_type !== "strength_training"),
  };
}

/**
 * GET /activities/{id}. Returns a single activity owned by the authed
 * user, including its `trackpoints`. 404 if the ID doesn't exist or
 * belongs to another user. `unit` selects the display unit for the
 * server-derived splits/strip-summary/best-pace blocks.
 * No strength_training guard here (unlike `listRunningSessions`): every
 * call site passes an id already known to be an endurance activity (run
 * detail routes), so there's nothing to filter.
 */
export async function getRunningSession(
  token: string,
  id: string,
  unit: "mi" | "km" = "mi",
): Promise<RunningSession> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}?unit=${unit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<RunningSession | null>(resp, null);
  if (!got) {
    throw new Error("activity not found");
  }
  return got;
}

/**
 * GET /activities/running-metrics. `timezone` is an IANA name (e.g.
 * "America/New_York"); the server uses it to bucket "this week" / "this
 * month". Call sites should pass
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`. The API filters
 * to running activities only; non-running rows don't contribute.
 */
export async function getRunningMetrics(token: string, timezone: string): Promise<RunningMetrics> {
  const params = new URLSearchParams({ timezone });
  const resp = await fetch(`${config.apiUrl}/activities/running-metrics?${params.toString()}`, {
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
 * PATCH /activities/{id}. Renames the activity; returns the updated row
 * so the caller can splice it into local state.
 */
export async function renameRunningSession(
  token: string,
  id: string,
  name: string,
): Promise<RunningSession> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name }),
  });
  const updated = await unwrap<RunningSession | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated activity");
  }
  return updated;
}

/**
 * PATCH /activities/{id}. Sets the free-text `notes` field (partial update;
 * an empty string clears it); returns the updated row so the caller can
 * splice it into local state.
 */
export async function updateRunningSessionNotes(
  token: string,
  id: string,
  notes: string,
): Promise<RunningSession> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ notes }),
  });
  const updated = await unwrap<RunningSession | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated activity");
  }
  return updated;
}

/**
 * POST /activities/{id}/calibrate. Rescales an indoor run to
 * `distanceMeters`, recomputing pace and every trackpoint server-side in one
 * transaction. Returns the full activity detail INCLUDING its rescaled
 * `trackpoints`, so the caller replaces its session state wholesale (the
 * detail page derives splits/pace from trackpoints — keeping stale ones would
 * make the header and splits disagree). Indoor-only; the API rejects an
 * outdoor run with a machine-readable code the thrown message carries.
 * `unit` selects the display unit for the returned derived blocks.
 */
export async function calibrateRunningSession(
  token: string,
  id: string,
  distanceMeters: number,
  unit: "mi" | "km" = "mi",
): Promise<RunningSession> {
  const resp = await fetch(
    `${config.apiUrl}/activities/${encodeURIComponent(id)}/calibrate?unit=${unit}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ distance_meters: distanceMeters }),
    },
  );
  const updated = await unwrap<RunningSession | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the calibrated activity");
  }
  return updated;
}

/**
 * PATCH /activities/{id} with an environment override ("outdoor" | "indoor").
 * Tagging a run indoor removes it from running PRs/best-efforts; outdoor
 * restores them. Returns the updated activity summary (no trackpoints —
 * environment changes don't rescale trackpoints).
 */
export async function setRunningSessionEnvironment(
  token: string,
  id: string,
  environment: "outdoor" | "indoor",
): Promise<RunningSession> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ environment }),
  });
  const updated = await unwrap<RunningSession | null>(resp, null);
  if (!updated) {
    throw new Error("API did not return the updated activity");
  }
  return updated;
}

/**
 * DELETE /activities/{id}. 204 on success (no body); throws the API's
 * `error` envelope on non-2xx.
 */
export async function deleteRunningSession(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(id)}`, {
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
 * POST /activities/tcx. Uploads a Garmin .tcx file as multipart/form-data
 * under the field `file` and returns the created activity. When
 * `activityType` is provided (and non-empty), it's sent alongside as the
 * `activity_type` field so the caller can pin the imported activity's sport
 * (e.g. classify a walk-paced TCX as a hike) rather than letting the
 * server infer it.
 *
 * We deliberately do NOT set a Content-Type header — the browser fills
 * in `multipart/form-data; boundary=...` for the FormData body, and
 * setting it manually would omit the boundary and break parsing.
 *
 * Error mapping:
 *  - 409 → DuplicateRunError carrying `existing_activity_id` so the
 *    modal can link to the activity already in the user's log.
 *  - 413 → friendly "File is too large (max 10 MB)." message.
 *  - 415 / 400 → the server's `error` text (unsupported/invalid file).
 *  - other non-2xx → `error` text or `HTTP {status}`.
 */
export async function importActivityTcx(
  token: string,
  file: File,
  activityType?: ActivityType,
): Promise<RunningSession> {
  const form = new FormData();
  form.append("file", file);
  if (activityType) {
    form.append("activity_type", activityType);
  }
  const resp = await fetch(`${config.apiUrl}/activities/tcx`, {
    method: "POST",
    // No Content-Type: the browser sets the multipart boundary itself.
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (resp.status === 409) {
    let body: { error?: string; code?: string; existing_activity_id?: string } = {};
    try {
      body = await resp.json();
    } catch {
      // fall through to defaults below
    }
    throw new DuplicateRunError(
      body.error || "This activity is already in your log.",
      body.existing_activity_id ?? "",
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
    throw new Error("API did not return the imported activity");
  }
  return created;
}

// --- Workout TCX enrichment --------------------------------------
//
// The inverse of the run import: a strength workout's exercises are the
// record, and a Garmin "Strength Training" TCX adds an optional heart-rate /
// effort layer. Three operations — create a workout from a TCX, attach a TCX
// to an existing workout, detach it — all return the enriched Workout (the
// detail shape, with enrichment.trackpoints) except detach (204, no body).

/**
 * Thrown when an uploaded TCX is already in the user's log (409
 * `duplicate_activity`). `existingKind`/`existingId` point at where it lives —
 * a "run" (a running activity) or a "workout" — so the modal can link to it.
 */
export class DuplicateActivityError extends Error {
  existingKind: "run" | "workout";
  existingId: string;
  constructor(message: string, existingKind: "run" | "workout", existingId: string) {
    super(message);
    this.name = "DuplicateActivityError";
    this.existingKind = existingKind;
    this.existingId = existingId;
  }
}

/**
 * Thrown when attaching a second TCX to a workout that already has one (409
 * `workout_tcx_exists`). The user must detach the existing file first.
 */
export class WorkoutTcxExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkoutTcxExistsError";
  }
}

/**
 * Shared handling for the workout-TCX upload responses: translate the typed
 * 409s and the 413 cap into precise errors, then unwrap the enriched Workout.
 * Detach uses a separate path (it returns 204 with no body).
 */
async function unwrapWorkoutTcxResponse(resp: Response): Promise<Workout> {
  if (resp.status === 409) {
    let body: {
      error?: string;
      code?: string;
      existing?: { kind?: "run" | "workout"; id?: string };
    } = {};
    try {
      body = await resp.json();
    } catch {
      // fall through to defaults
    }
    if (body.code === "workout_tcx_exists") {
      throw new WorkoutTcxExistsError(
        body.error || "This workout already has a file attached — detach it first.",
      );
    }
    throw new DuplicateActivityError(
      body.error || "This file is already in your log.",
      body.existing?.kind === "workout" ? "workout" : "run",
      body.existing?.id ?? "",
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

  const workout = await unwrap<Workout | null>(resp, null);
  if (!workout) {
    throw new Error("API did not return the workout");
  }
  return workout;
}

/**
 * Create a new, empty workout from a Garmin strength TCX (the "Log from TCX"
 * path). The TCX seeds performed_at/ended_at and the enrichment; the user adds
 * exercises afterward on the returned workout's detail page.
 */
export async function createWorkoutFromTCX(token: string, file: File): Promise<Workout> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${config.apiUrl}/activities/imports`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return unwrapWorkoutTcxResponse(resp);
}

/** Attach a TCX to an existing workout. Does not change the workout's times. */
export async function attachWorkoutTCX(
  token: string,
  workoutId: string,
  file: File,
): Promise<Workout> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(workoutId)}/tcx`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return unwrapWorkoutTcxResponse(resp);
}

/** Detach a workout's TCX (clears the link, soft-deletes the activity). */
export async function detachWorkoutTCX(token: string, workoutId: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/activities/${encodeURIComponent(workoutId)}/tcx`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok && resp.status !== 204) {
    let detail: string;
    try {
      detail = (await resp.json())?.error ?? `HTTP ${resp.status}`;
    } catch {
      detail = `HTTP ${resp.status}`;
    }
    throw new Error(detail);
  }
}

// --- Running best efforts + progression history ------------------
//
// "Best efforts" are running PRs: the fastest window of each standard
// distance (1mi, 2mi, 5K, 10K, half marathon, marathon) found inside any
// of the user's running activities — including a fast segment embedded in
// a longer run. The API stays metric (distance in meters, pace in
// seconds-per-kilometer); the DistanceUnitContext converts toward the
// user's preferred unit at render time. See
// prog-strength-docs/sows/running-best-efforts.md §API Surface.

/**
 * One running PR row: the user's current best at a single standard
 * distance, plus the activity that set it. `pace_sec_per_km` is derived
 * server-side from `duration_seconds / (distance_meters / 1000)`.
 */
export type RunningBestEffort = {
  distance_key: string;
  distance_label: string;
  distance_meters: number;
  duration_seconds: number;
  pace_sec_per_km: number;
  activity_id: string;
  activity_start_time: string; // RFC3339
};

/**
 * One point in a distance's progression series — an activity that
 * achieved a best effort at that distance, with the time it ran.
 */
export type BestEffortPoint = {
  activity_id: string;
  activity_start_time: string; // RFC3339
  duration_seconds: number;
};

/**
 * Progression history for a single standard distance: every activity that
 * achieved a best effort at it, ascending by `activity_start_time`, so a
 * line chart consumes `points` without re-sorting.
 */
export type RunningBestEffortHistory = {
  distance_key: string;
  distance_label: string;
  distance_meters: number;
  points: BestEffortPoint[];
};

/**
 * One point in an exercise's estimated-1RM progression series — the max
 * estimated 1RM across a single workout's sets on that exercise.
 */
export type OneRMHistoryPoint = {
  workout_id: string;
  performed_at: string; // RFC3339
  estimated_1rm: number;
};

/**
 * Per-exercise estimated-1RM time series. `unit` is the lifter's stored
 * weight unit for the series; `points` is one entry per workout in which
 * the exercise was performed, ascending by `performed_at`.
 */
export type ExerciseOneRMHistory = {
  exercise_id: string;
  exercise_name: string;
  unit: "lb" | "kg";
  points: OneRMHistoryPoint[];
};

/**
 * GET /running/best-efforts. Returns the authed user's current best across
 * each standard distance, sorted shortest first. Distances the user has
 * never covered are omitted from the list.
 */
export async function listRunningBestEfforts(token: string): Promise<RunningBestEffort[]> {
  const resp = await fetch(`${config.apiUrl}/running/best-efforts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<{ best_efforts: RunningBestEffort[] }>(resp, { best_efforts: [] });
  return got.best_efforts ?? [];
}

/**
 * GET /running/best-efforts/{distance_key}/history. Returns the
 * progression series for one standard distance. 404 (surfaced as a thrown
 * Error) if `distanceKey` isn't a standard distance.
 */
export async function getRunningBestEffortHistory(
  token: string,
  distanceKey: string,
): Promise<RunningBestEffortHistory> {
  const resp = await fetch(
    `${config.apiUrl}/running/best-efforts/${encodeURIComponent(distanceKey)}/history`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return unwrap<RunningBestEffortHistory>(resp, {
    distance_key: distanceKey,
    distance_label: "",
    distance_meters: 0,
    points: [],
  });
}

// --- Running max-effort estimates --------------------------------
//
// A "max-effort estimate" projects the time the user could run at each
// standard distance today — fitted from their best efforts across
// distances (a critical-speed / power-law style model) rather than only
// the times they've actually logged at that exact distance. The API
// stays metric (distance in meters, durations in seconds, pace in
// seconds-per-kilometer); the DistanceUnitContext converts toward the
// user's preferred unit at render time. Every estimate carries a
// confidence band (`lower_seconds`/`upper_seconds`) and a `basis`
// describing how it was derived. See
// prog-strength-docs/sows/running-max-effort-estimates.md.

/**
 * One row of the max-effort summary — the estimate (and the user's
 * actual best, if any) for a single standard distance. `estimate_*` are
 * null when there isn't enough data to fit a model at this distance;
 * `actual_best_*` are null when the user has never covered it.
 */
export type RunningMaxEffortDistanceSummary = {
  distance_key: string;
  distance_label: string;
  distance_meters: number;
  estimate_seconds: number | null;
  lower_seconds: number | null;
  upper_seconds: number | null;
  basis: string;
  confidence: string;
  actual_best_seconds: number | null;
  actual_best_activity_id: string | null;
  actual_best_achieved_at: string | null;
};

/**
 * GET /running/max-effort response: the estimator version plus one row
 * per standard distance, shortest first.
 */
export type RunningMaxEffortSummary = {
  estimator_version: string;
  distances: RunningMaxEffortDistanceSummary[];
};

/**
 * The fitted estimate for one distance. `n_points` / `n_distances` count
 * the best-effort samples and distinct distances that fed the fit, so the
 * UI can caption how the number was derived. Null on the detail response
 * when `basis` is "insufficient_data".
 */
export type RunningMaxEffortEstimate = {
  seconds: number;
  lower_seconds: number;
  upper_seconds: number;
  raw_seconds?: number;
  floored_at_logged_best?: boolean;
  basis: string;
  confidence: string;
  n_points: number;
  n_distances: number;
};

/** The user's actual current best at one distance, if they've covered it. */
export type RunningMaxEffortActualBest = {
  seconds: number;
  activity_id: string;
  achieved_at: string; // RFC3339
};

/**
 * One point in the estimate's history series — the model's projection as
 * of a past date, so the detail chart can show how the estimate moved as
 * the user logged more efforts. Ascending by `as_of`.
 */
export type RunningMaxEffortHistoryPoint = {
  as_of: string; // RFC3339
  seconds: number;
  lower_seconds: number;
  upper_seconds: number;
};

/**
 * One real effort the user ran at (or close to) this distance, overlaid
 * on the estimate chart and listed in the attempts table. `source`
 * describes how the window was found (e.g. "race_like", "long_run").
 */
export type RunningMaxEffortAttempt = {
  activity_id: string;
  achieved_at: string; // RFC3339
  duration_seconds: number;
  pace_sec_per_km: number;
  source: string;
  pace_ratio?: number;
  hr_z4_z5_pct?: number;
};

/**
 * GET /running/max-effort/{distance_key} response. `estimate` is null
 * when `stats.data_summary` reports insufficient data (the API still
 * returns 200); `attempts` / `estimate_history` may be empty.
 */
export type RunningMaxEffortDetail = {
  estimator_version: string;
  distance_key: string;
  distance_label: string;
  distance_meters: number;
  estimate: RunningMaxEffortEstimate | null;
  actual_best: RunningMaxEffortActualBest | null;
  estimate_history: RunningMaxEffortHistoryPoint[];
  attempts: RunningMaxEffortAttempt[];
  stats: {
    estimated_max_effort_seconds: number | null;
    current_best_seconds: number | null;
    gap_seconds: number | null;
    confidence: string;
    data_summary: string;
  };
};

/**
 * GET /running/max-effort. Returns the authed user's max-effort estimate
 * across each standard distance, shortest first. Distances always appear
 * (with null estimate/actual fields when there's no data), so the caller
 * can render every standard distance without a client-side merge.
 */
export async function getRunningMaxEffortSummary(token: string): Promise<RunningMaxEffortSummary> {
  const resp = await fetch(`${config.apiUrl}/running/max-effort`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<RunningMaxEffortSummary>(resp, { estimator_version: "", distances: [] });
}

/**
 * GET /running/max-effort/{distance_key}. Returns the detail view for one
 * standard distance: the fitted estimate (null when basis is
 * "insufficient_data"), the actual best, the estimate-history series, the
 * user's attempts, and headline stats. 404 (surfaced as a thrown Error)
 * if `distanceKey` isn't a standard distance.
 */
export async function getRunningMaxEffort(
  token: string,
  distanceKey: string,
): Promise<RunningMaxEffortDetail> {
  const resp = await fetch(
    `${config.apiUrl}/running/max-effort/${encodeURIComponent(distanceKey)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return unwrap<RunningMaxEffortDetail>(resp, {
    estimator_version: "",
    distance_key: distanceKey,
    distance_label: "",
    distance_meters: 0,
    estimate: null,
    actual_best: null,
    estimate_history: [],
    attempts: [],
    stats: {
      estimated_max_effort_seconds: null,
      current_best_seconds: null,
      gap_seconds: null,
      confidence: "",
      data_summary: "",
    },
  });
}

/**
 * GET /activities/personal-records/{exercise_id}/history — the unified
 * alias for the legacy /personal-records/{exercise_id}/history (identical
 * payload). Returns the per-workout estimated-1RM series for one
 * exercise. 404 (surfaced as a thrown Error) if the slug isn't in the
 * exercise catalog.
 */
export async function getExerciseOneRMHistory(
  token: string,
  exerciseId: string,
): Promise<ExerciseOneRMHistory> {
  const resp = await fetch(
    `${config.apiUrl}/activities/personal-records/${encodeURIComponent(exerciseId)}/history`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return unwrap<ExerciseOneRMHistory>(resp, {
    exercise_id: exerciseId,
    exercise_name: "",
    unit: "lb",
    points: [],
  });
}

// --- User timeline (feed) ----------------------------------------
//
// The timeline is a reverse-chronological feed of the user's own training
// activity (completed workouts, imported runs, lifting PRs, running best
// efforts) rendered as cards the user can react to and comment on. The API
// owns the projection: each post carries a denormalized `content` block
// (title/subtitle/metrics/href) so the card renders without a per-source
// join, plus a reaction summary and a comment count. See
// prog-strength-docs/sows/user-timeline-feed.md.

/**
 * Which source DOMAIN a timeline post was projected from — not which sport.
 * Every training session, whatever its type, is an `activity` post; the sport
 * lives on `TimelinePost.activity_type`. `pr` and `best_effort` are the two
 * genuinely different domains (a personal-record event, a running best
 * effort), which is why they remain distinct members.
 *
 * This replaced the old `"workout" | "run"` split in api PR for issue #90: a
 * per-sport source type meant the API needed a schema migration for every new
 * activity type, and a hike therefore never reached the feed at all. Switch
 * per-sport rendering on `activity_type` instead — and always handle the
 * unknown case, since a type can now appear in the feed before this file
 * learns its name.
 */
export type TimelineSourceType = "activity" | "pr" | "best_effort";

/** The four reaction types a post accepts. Mirrored on the API side. */
export type ReactionType = "like" | "strong" | "fire" | "celebrate";

/**
 * The reaction state for a post: `summary` is a per-type count map (a type
 * is absent when its count is zero), and `mine` lists the types the authed
 * viewer has applied. Returned inline on every post and, after a toggle,
 * from the PUT/DELETE reaction endpoints so the client can reconcile.
 */
export type ReactionSummary = {
  summary: Record<string, number>;
  mine: string[];
};

/**
 * The post/comment author, embedded by the API on every feed post and
 * comment so the UI can render an avatar + display name without a per-row
 * profile fetch. `username` is nullable (a handle-less user still resolves
 * by `user_id`); the name links to `/u/{username}` only when present. This
 * is a thinner shape than ProfileSummary — it carries no `relationship`.
 */
export type TimelineAuthor = {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
};

/**
 * A compact, render-ready route geometry for a run card's map slot. This is
 * the FUTURE shape the API will project once run geometry is captured
 * (see prog-strength-docs/sows/run-route-geometry-capture.md); today nothing
 * populates it, so <RouteMap> renders its placeholder. Defined now so the
 * RouteMap boundary is stable: when geometry lands, the card needs no rework.
 *
 * `points` is a simplified polyline of [lat, lng] pairs in track order;
 * `bounds` is the lat/lng extent for fitting the polyline to the slot.
 */
export type TimelineRoute = {
  points: [number, number][];
  bounds: { min_lat: number; min_lng: number; max_lat: number; max_lng: number };
};

/**
 * One feed entry. `content` is the API's denormalized render block so the
 * card needs no per-source fetch; `href` deep-links to the source detail
 * page (e.g. /workouts/{id}, /running/{id}). `occurred_at` is the source
 * event's timestamp (RFC3339), which is what the feed orders and paginates
 * on — NOT the row's created_at. `author` is embedded so the card can render
 * the poster's identity without a per-post profile fetch.
 */
export type TimelinePost = {
  id: string;
  source_type: TimelineSourceType;
  /**
   * The sport of the underlying session, present on `activity` posts and
   * absent on `pr`/`best_effort` (which aren't sessions). Typed as a wider
   * `string` than `ActivityType` on purpose: the API's type registry can
   * register a new sport without a web deploy, so a card must render an
   * unfamiliar value rather than assume the union is exhaustive.
   */
  activity_type?: ActivityType | (string & {});
  source_id: string;
  occurred_at: string; // RFC3339
  visibility: string;
  author: TimelineAuthor;
  content: {
    title: string;
    subtitle: string;
    metrics: string[];
    href: string;
    // Future run geometry (see TimelineRoute). Absent on every current API
    // response; <RouteMap> renders a placeholder until this is populated.
    route?: TimelineRoute | null;
    // Cover thumbnail for the source activity's first photo (null when it
    // has none). `photo_count` is the total attached, so the card can badge
    // "+N" over the cover. Both are omitted when photo storage is
    // unconfigured server-side.
    photo?: TimelinePhotoCover | null;
    photo_count?: number;
  };
  reactions: ReactionSummary;
  comment_count: number;
};

/** One comment on a post. `user_id` identifies the author so the UI can
 * show a delete affordance only on the viewer's own comments; `author`
 * carries the embedded identity (avatar + display name) for the row. */
export type TimelineComment = {
  id: string;
  post_id: string;
  user_id: string;
  author: TimelineAuthor;
  body: string;
  created_at: string; // RFC3339
};

/**
 * One page of the feed plus the cursor for the next page. `next_before`
 * is an opaque cursor (an `occurred_at`) to pass back as `before`; null
 * when there are no older posts. Mirrors the activities feed shape.
 */
export type TimelineFeedPage = {
  posts: TimelinePost[];
  next_before: string | null;
};

/** A post with its comments, returned by the per-id detail GET. */
export type TimelinePostWithComments = TimelinePost & {
  comments: TimelineComment[];
};

/**
 * GET /timeline. Returns one page of the authed user's feed, newest
 * first. `limit` caps the page size (the API defaults it when omitted);
 * `before` is a prior page's `next_before` cursor for pagination.
 */
export async function listTimeline(
  token: string,
  opts: { limit?: number; before?: string } = {},
): Promise<TimelineFeedPage> {
  const params = new URLSearchParams();
  if (opts.limit !== undefined) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/timeline${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<TimelineFeedPage>(resp, { posts: [], next_before: null });
}

/**
 * GET /timeline/posts/{id}. Returns a single post with its full comment
 * thread (oldest-first). Used to lazy-load comments when the user expands
 * a card. Throws if the post isn't found / not owned by this user.
 */
export async function getTimelinePost(
  token: string,
  id: string,
): Promise<TimelinePostWithComments> {
  const resp = await fetch(`${config.apiUrl}/timeline/posts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<TimelinePostWithComments | null>(resp, null);
  if (!got) {
    throw new Error("timeline post not found");
  }
  return got;
}

/**
 * POST /timeline/posts/{id}/comments. Appends a comment and returns the
 * created row (201). Server validates the body (non-empty, ≤2000 chars);
 * an invalid body surfaces as the API's `error` envelope.
 */
export async function addTimelineComment(
  token: string,
  postId: string,
  body: string,
): Promise<TimelineComment> {
  const resp = await fetch(
    `${config.apiUrl}/timeline/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ body }),
    },
  );
  const created = await unwrap<TimelineComment | null>(resp, null);
  if (!created) {
    throw new Error("API did not return the created comment");
  }
  return created;
}

/**
 * DELETE /timeline/posts/{id}/comments/{commentId}. 204 on success (no
 * body); throws the API's `error` envelope on non-2xx — typically a 404
 * when the comment isn't the viewer's own.
 */
export async function deleteTimelineComment(
  token: string,
  postId: string,
  commentId: string,
): Promise<void> {
  const resp = await fetch(
    `${config.apiUrl}/timeline/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(
      commentId,
    )}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
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
 * PUT /timeline/posts/{id}/reactions/{type}. Idempotently applies a
 * reaction and returns the updated summary + the viewer's reaction set so
 * the client can reconcile its optimistic state. `type` is one of the
 * four ReactionType values.
 */
export async function addTimelineReaction(
  token: string,
  postId: string,
  type: ReactionType,
): Promise<ReactionSummary> {
  const resp = await fetch(
    `${config.apiUrl}/timeline/posts/${encodeURIComponent(postId)}/reactions/${encodeURIComponent(
      type,
    )}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return unwrap<ReactionSummary>(resp, { summary: {}, mine: [] });
}

/**
 * DELETE /timeline/posts/{id}/reactions/{type}. 204 on success (no body);
 * idempotent — removing a reaction the viewer never applied still
 * succeeds. Throws the API's `error` envelope on non-2xx.
 */
export async function removeTimelineReaction(
  token: string,
  postId: string,
  type: ReactionType,
): Promise<void> {
  const resp = await fetch(
    `${config.apiUrl}/timeline/posts/${encodeURIComponent(postId)}/reactions/${encodeURIComponent(
      type,
    )}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );
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

// --- Planned workouts + Google Calendar sync ----------------------
//
// A planned workout is a forward-looking training intent: a named lift
// scheduled into a time window, optionally with a target agenda
// (exercises + target sets) and optionally pushed to the user's Google
// Calendar. Status moves planned → completed (when linked to a logged
// session) or planned → skipped. Google sync fields track the best-effort
// push to Calendar so the UI can surface a synced / failed indicator and
// a resync affordance. See the SOW's Phase 3 + Phase 4.

/** Lifecycle of a planned workout. */
export type PlannedWorkoutStatus = "planned" | "completed" | "skipped";

/**
 * Detail level of the synced Google Calendar event. `time_block` is a
 * bare scheduled block; `full_agenda` spells the exercises out in the
 * event body. `null` means "use the user's default" (see
 * `calendar_default_detail` on the profile).
 */
export type CalendarDetail = "time_block" | "full_agenda";

/** Per-plan Google push state; null until a sync is attempted. */
export type GoogleSyncStatus = "pending" | "synced" | "failed";

/** Which logged-session domain fulfilled a completed plan. */
export type CompletedSessionKind = "workout" | "activity";

/** The kind of training a plan represents. */
export type ActivityKind = "lift" | "run";

/**
 * The kind of run a planned run represents. Optional on a run plan — a run
 * can omit it and just block time (or describe everything in `run_details`).
 */
export type RunType = "easy" | "threshold" | "intervals";

/** One target set inside a planned exercise. All targets are optional. */
export type PlannedSet = {
  id: string;
  order_index: number;
  target_reps: number | null;
  target_weight: number | null;
  unit: "lb" | "kg" | null;
  target_rpe: number | null;
  // AMRAP ("as many reps as possible"): no fixed rep target. When true,
  // target_reps is ignored for display.
  amrap: boolean;
};

/** One exercise on a planned workout's agenda, with its target sets. */
export type PlannedExercise = {
  id: string;
  exercise_id: string;
  order_index: number;
  notes: string | null;
  // Non-null groups exercises performed as a superset (alternating sets);
  // exercises sharing a value belong to the same superset, null = standalone.
  superset_group: number | null;
  sets: PlannedSet[];
};

/** A planned (scheduled) workout, as returned by the API. */
export type PlannedWorkout = {
  id: string;
  name: string | null;
  activity_kind: ActivityKind;
  scheduled_start: string; // RFC3339
  scheduled_end: string; // RFC3339
  timezone: string;
  status: PlannedWorkoutStatus;
  notes: string | null;
  completed_session_id: string | null;
  // Removed from API responses in unified-cleanup (api #81) — derive the
  // kind from the completed session's own activity_type client-side
  // instead (see components/calendar/merge-events.ts and the planned
  // detail page). Optional so both wire shapes parse during the deploy
  // overlap; CompletedSessionKind itself stays: the complete/lookup
  // REQUEST params still carry it.
  completed_session_kind?: CompletedSessionKind | null;
  calendar_detail: CalendarDetail | null;
  google_event_id: string | null;
  google_sync_status: GoogleSyncStatus | null;
  last_sync_error: string | null;
  // Run agenda — populated only when activity_kind is "run".
  run_type: RunType | null;
  run_details: string | null;
  // Lift agenda — populated only when activity_kind is "lift".
  exercises: PlannedExercise[];
  created_at: string;
  updated_at: string;
};

/**
 * Body for create/update. Timestamps are RFC3339 (the caller converts
 * datetime-local values first). Omit `exercises` on update to keep the
 * existing agenda; send it (even empty) to replace it. `calendar_sync`
 * triggers a best-effort Google push on create.
 */
export type PlannedWorkoutPayload = {
  name?: string;
  // Defaults to "lift" server-side when omitted. Send "run" for a run plan.
  activity_kind?: ActivityKind;
  scheduled_start: string;
  scheduled_end: string;
  timezone?: string;
  notes?: string;
  calendar_detail?: CalendarDetail | null;
  calendar_sync?: boolean;
  // Run agenda — send for run plans. Both optional (a run can be a bare block).
  run_type?: RunType;
  run_details?: string;
  exercises?: {
    exercise_id: string;
    notes?: string;
    superset_group?: number;
    sets: {
      target_reps?: number;
      target_weight?: number;
      unit?: "lb" | "kg";
      target_rpe?: number;
      amrap?: boolean;
    }[];
  }[];
};

/**
 * GET /planned-workouts?since=&until=. Bounds are RFC3339 (since
 * inclusive, until exclusive); the calendar fetches the visible window.
 */
export async function listPlannedWorkouts(
  token: string,
  options: { since?: string; until?: string } = {},
): Promise<PlannedWorkout[]> {
  const params = new URLSearchParams();
  if (options.since) params.set("since", options.since);
  if (options.until) params.set("until", options.until);
  const qs = params.toString();
  const resp = await fetch(`${config.apiUrl}/planned-workouts${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<PlannedWorkout[]>(resp, []);
}

/** GET /planned-workouts/{id}. */
export async function getPlannedWorkout(token: string, id: string): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<PlannedWorkout | null>(resp, null);
  if (!got) throw new Error("planned workout not found");
  return got;
}

/** POST /planned-workouts. Returns the created plan. */
export async function createPlannedWorkout(
  token: string,
  body: PlannedWorkoutPayload,
): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const created = await unwrap<PlannedWorkout | null>(resp, null);
  if (!created) throw new Error("API did not return the created planned workout");
  return created;
}

/**
 * PUT /planned-workouts/{id}. Same body as create; omit `exercises` to
 * keep the agenda, send it to replace.
 */
export async function updatePlannedWorkout(
  token: string,
  id: string,
  body: PlannedWorkoutPayload,
): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const updated = await unwrap<PlannedWorkout | null>(resp, null);
  if (!updated) throw new Error("API did not return the updated planned workout");
  return updated;
}

/**
 * DELETE /planned-workouts/{id}. A 404 counts as success — the plan is
 * already gone (deleted from another tab or by the coach), which is the
 * outcome the caller wanted.
 */
export async function deletePlannedWorkout(token: string, id: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) return;
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

/** POST /planned-workouts/{id}/skip. Returns the plan (status skipped). */
export async function skipPlannedWorkout(token: string, id: string): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}/skip`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const updated = await unwrap<PlannedWorkout | null>(resp, null);
  if (!updated) throw new Error("API did not return the skipped planned workout");
  return updated;
}

/**
 * POST /planned-workouts/{id}/schedule. Best-effort Google push; the
 * returned plan's `google_sync_status` reflects synced/failed.
 */
export async function schedulePlannedWorkout(
  token: string,
  id: string,
  body: { detail_level?: CalendarDetail } = {},
): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}/schedule`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const updated = await unwrap<PlannedWorkout | null>(resp, null);
  if (!updated) throw new Error("API did not return the scheduled planned workout");
  return updated;
}

/** POST /planned-workouts/{id}/resync. Re-attempts the Google push. */
export async function resyncPlannedWorkout(token: string, id: string): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}/resync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const updated = await unwrap<PlannedWorkout | null>(resp, null);
  if (!updated) throw new Error("API did not return the resynced planned workout");
  return updated;
}

/**
 * POST /planned-workouts/{id}/unlink. Detaches the plan from its
 * completing session; returns the plan (status back to planned).
 */
export async function unlinkPlannedWorkout(token: string, id: string): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}/unlink`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  });
  const updated = await unwrap<PlannedWorkout | null>(resp, null);
  if (!updated) throw new Error("API did not return the unlinked planned workout");
  return updated;
}

/**
 * GET /planned-workouts/by-session. Returns the planned workout a logged
 * session completes, or null when none does (a 404 from the API is the
 * common case).
 */
export async function getPlannedWorkoutBySession(
  token: string,
  sessionId: string,
  sessionKind: CompletedSessionKind,
): Promise<PlannedWorkout | null> {
  const params = new URLSearchParams({ session_id: sessionId, session_kind: sessionKind });
  const resp = await fetch(`${config.apiUrl}/planned-workouts/by-session?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) return null;
  return unwrap<PlannedWorkout | null>(resp, null);
}

/**
 * POST /planned-workouts/{id}/complete. Links the plan to a logged
 * session; returns the plan (status completed).
 */
export async function completePlannedWorkout(
  token: string,
  id: string,
  body: { session_id: string; session_kind: CompletedSessionKind },
): Promise<PlannedWorkout> {
  const resp = await fetch(`${config.apiUrl}/planned-workouts/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const updated = await unwrap<PlannedWorkout | null>(resp, null);
  if (!updated) throw new Error("API did not return the completed planned workout");
  return updated;
}

/** The user's Google Calendar connection state. */
export type CalendarConnection = {
  status: "connected" | "revoked" | "absent";
  google_calendar_id?: string;
  scopes?: string;
  connected_at?: string;
};

/** GET /me/calendar/connection. */
export async function getCalendarConnection(token: string): Promise<CalendarConnection> {
  const resp = await fetch(`${config.apiUrl}/me/calendar/connection`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<CalendarConnection>(resp, { status: "absent" });
}

/** DELETE /me/calendar/connection. Revokes the Google connection. */
export async function disconnectCalendar(token: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/me/calendar/connection`, {
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

/** The user's Whoop connection state. */
export type WhoopConnection = {
  status: "connected" | "revoked" | "error" | "absent";
  connected_at?: string;
};

/** GET /me/whoop/connection. */
export async function getWhoopConnection(token: string): Promise<WhoopConnection> {
  const resp = await fetch(`${config.apiUrl}/me/whoop/connection`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<WhoopConnection>(resp, { status: "absent" });
}

/** DELETE /me/whoop/connection. Revokes the Whoop connection. */
export async function disconnectWhoop(token: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/me/whoop/connection`, {
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
 * A single day's Whoop recovery row. `date` is the user-local calendar day
 * (YYYY-MM-DD) the reading belongs to; all three metrics are nullable because
 * Whoop may have no scored recovery for a day (PENDING/UNSCORABLE, or a night
 * with no sleep). `hrv_rmssd_milli` is HRV in milliseconds.
 */
export type WhoopRecoveryDay = {
  date: string; // YYYY-MM-DD
  recovery_score: number | null;
  resting_heart_rate: number | null;
  hrv_rmssd_milli: number | null;
};

/**
 * GET /whoop/recovery. Returns the user's daily recovery rows ordered by date
 * for the local-date window implied by `since`/`until` (inclusive, YYYY-MM-DD)
 * in `timezone` (IANA name, e.g. "America/Denver"), per the house
 * timezone+local-date convention. Call sites pass local dates + the browser
 * timezone; the client never constructs UTC instants. A user with no Whoop
 * connection simply yields an empty list.
 */
export async function listWhoopRecovery(
  token: string,
  opts: { timezone: string; since?: string; until?: string },
): Promise<WhoopRecoveryDay[]> {
  const params = new URLSearchParams();
  params.set("timezone", opts.timezone);
  if (opts.since) params.set("since", opts.since);
  if (opts.until) params.set("until", opts.until);
  const resp = await fetch(`${config.apiUrl}/whoop/recovery?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  // The API wraps list payloads in a keyed object — data is {recovery: [...]},
  // not the bare array (same convention as GET /steps). Unwrapping it as a
  // bare array shipped the /recovery page calling rows.find on an object,
  // which threw straight to Next's error page.
  const body = await unwrap<{ recovery: WhoopRecoveryDay[] }>(resp, { recovery: [] });
  return Array.isArray(body.recovery) ? body.recovery : [];
}

// --- Social graph: profiles, follows, search ---------------------
//
// The social layer adds public profiles addressable by `username`, a
// follow graph with an approval state machine (request → accept/reject,
// plus cancel/unfollow/remove-follower), user search, and a viewer-scoped
// timeline. Every list endpoint paginates with an opaque keyset `cursor`
// (echoed back as `next_cursor`, null on the last page). The follow
// mutations return the affected edge's `relationship` so the caller can
// reconcile a profile/list row without a refetch. See
// prog-strength-docs/sows/followers-profile-search-and-social-timeline.md.

/**
 * The viewer's relationship to another user, from the viewer's side of the
 * edge:
 *   - "none"             no edge in either direction
 *   - "requested"        viewer asked to follow; awaiting the target's accept
 *   - "pending_incoming" the target asked to follow the viewer; viewer can
 *                        accept/reject
 *   - "following"        viewer follows the target (accepted)
 *   - "self"             the target is the viewer
 */
export type Relationship = "none" | "requested" | "pending_incoming" | "following" | "self";

/**
 * The compact card shape used across search results, follower/following
 * lists, and follow-request rows. `username` is nullable because a user may
 * not have chosen a handle yet (the row still resolves by `user_id`).
 */
export type ProfileSummary = {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  relationship: Relationship;
};

/**
 * A full public profile (GET /users/{username}) — a `ProfileSummary` plus
 * the aggregate follower/following counts the profile header renders.
 */
export type PublicProfile = ProfileSummary & {
  follower_count: number;
  following_count: number;
  // The user's free-text bio, or null when unset. Rendered under the @handle
  // in the profile header (max 160 runes server-side).
  bio: string | null;
};

/**
 * One pending follow request — a `ProfileSummary` for the other party plus
 * `created_at` (RFC3339) so the inbox can sort/relativize the request age.
 */
export type FollowRequest = ProfileSummary & {
  created_at: string;
};

/**
 * One page of profile summaries plus the keyset cursor for the next page.
 * `next_cursor` is opaque; pass it back as `cursor` to advance. Null when
 * there are no more rows. Shared by search and the follower/following lists.
 */
export type ProfilePage = {
  users: ProfileSummary[];
  next_cursor: string | null;
};

/** One page of follow requests plus the keyset cursor for the next page. */
export type FollowRequestPage = {
  requests: FollowRequest[];
  next_cursor: string | null;
};

/**
 * GET /users/{username}. Returns the public profile addressed by handle.
 * Throws (via unwrap's error path) when the handle is unknown — the API
 * returns a 404 whose `error` envelope becomes the thrown message.
 */
export async function getProfile(token: string, username: string): Promise<PublicProfile> {
  const resp = await fetch(`${config.apiUrl}/users/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const got = await unwrap<PublicProfile | null>(resp, null);
  if (!got) {
    throw new Error("profile not found");
  }
  return got;
}

/**
 * GET /users/search?q=. Returns one page of matching profiles, ranked
 * server-side. `cursor` advances the keyset; omit it for the first page.
 */
export async function searchProfiles(
  token: string,
  q: string,
  cursor?: string,
): Promise<ProfilePage> {
  const params = new URLSearchParams();
  params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  const resp = await fetch(`${config.apiUrl}/users/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<ProfilePage>(resp, { users: [], next_cursor: null });
}

/**
 * GET /users/{username}/followers. One page of the users who follow
 * `username`, newest-first. `cursor` advances the keyset.
 */
export async function listFollowers(
  token: string,
  username: string,
  cursor?: string,
): Promise<ProfilePage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  const resp = await fetch(
    `${config.apiUrl}/users/${encodeURIComponent(username)}/followers${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return unwrap<ProfilePage>(resp, { users: [], next_cursor: null });
}

/**
 * GET /users/{username}/following. One page of the users `username`
 * follows, newest-first. `cursor` advances the keyset.
 */
export async function listFollowing(
  token: string,
  username: string,
  cursor?: string,
): Promise<ProfilePage> {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  const resp = await fetch(
    `${config.apiUrl}/users/${encodeURIComponent(username)}/following${qs ? `?${qs}` : ""}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return unwrap<ProfilePage>(resp, { users: [], next_cursor: null });
}

/**
 * GET /follows/requests?direction=. Lists the viewer's pending follow
 * requests in the given direction: "incoming" (others asking to follow the
 * viewer — the inbox to accept/reject) or "outgoing" (the viewer's own
 * pending requests they can cancel). `cursor` advances the keyset.
 */
export async function listFollowRequests(
  token: string,
  direction: "incoming" | "outgoing",
  cursor?: string,
): Promise<FollowRequestPage> {
  const params = new URLSearchParams();
  params.set("direction", direction);
  if (cursor) params.set("cursor", cursor);
  const resp = await fetch(`${config.apiUrl}/follows/requests?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<FollowRequestPage>(resp, { requests: [], next_cursor: null });
}

/**
 * POST /follows. Follows `followee` (a username or user_id). For a public
 * target this takes effect immediately (relationship → "following"); for a
 * private one it creates a pending request (relationship → "requested").
 * Returns the affected edge so the caller can reconcile its row. Throws the
 * API's `error` envelope on 400/404/409/429.
 */
export async function requestFollow(token: string, followee: string): Promise<ProfileSummary> {
  const resp = await fetch(`${config.apiUrl}/follows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ followee }),
  });
  const edge = await unwrap<ProfileSummary | null>(resp, null);
  if (!edge) {
    throw new Error("API did not return the follow edge");
  }
  return edge;
}

/**
 * POST /follows/{username}/accept. Accepts an incoming follow request (the
 * other user now follows the viewer). Returns the updated edge so the inbox
 * can reconcile the row. Throws the API's `error` envelope on non-2xx.
 */
export async function acceptFollow(token: string, username: string): Promise<ProfileSummary> {
  const resp = await fetch(`${config.apiUrl}/follows/${encodeURIComponent(username)}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const edge = await unwrap<ProfileSummary | null>(resp, null);
  if (!edge) {
    throw new Error("API did not return the follow edge");
  }
  return edge;
}

/**
 * POST /follows/{username}/reject. Rejects an incoming follow request. 204
 * on success (no body); throws the API's `error` envelope on non-2xx.
 */
export async function rejectFollow(token: string, username: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/follows/${encodeURIComponent(username)}/reject`, {
    method: "POST",
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
 * DELETE /follows/{username}. Tears down the viewer's outbound edge to
 * `username`: cancels a still-pending request, or unfollows an accepted
 * one. 204 on success (no body); throws the API's `error` envelope on
 * non-2xx.
 */
export async function cancelOrUnfollow(token: string, username: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/follows/${encodeURIComponent(username)}`, {
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
 * DELETE /followers/{username}. Removes `username` from the viewer's
 * followers (the inbound edge). 204 on success (no body); throws the API's
 * `error` envelope on non-2xx.
 */
export async function removeFollower(token: string, username: string): Promise<void> {
  const resp = await fetch(`${config.apiUrl}/followers/${encodeURIComponent(username)}`, {
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
 * GET /timeline?user={username}. The viewer-scoped feed for another user's
 * profile, reusing the timeline feed shape. When the viewer isn't allowed
 * to see the user's activity the API returns `locked: true` with an empty
 * `posts` array (the profile renders a gated state rather than throwing);
 * `locked` is absent / false on an accessible feed. `before` is a prior
 * page's `next_before` cursor for pagination.
 */
export async function listUserTimeline(
  token: string,
  username: string,
  before?: string,
): Promise<TimelineFeedPage & { locked?: boolean }> {
  const params = new URLSearchParams();
  params.set("user", username);
  if (before) params.set("before", before);
  const resp = await fetch(`${config.apiUrl}/timeline?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<TimelineFeedPage & { locked?: boolean }>(resp, {
    posts: [],
    next_before: null,
    locked: false,
  });
}

/**
 * A single weekly point in a profile-stats series: the Monday-anchored
 * `week_start` (ISO string) and the week's aggregated `value`. The unit of
 * `value` depends on the series (minutes for lifts, meters for running).
 */
export type StatsPoint = { week_start: string; value: number };

/**
 * The public-profile weekly graphs payload from GET /users/{username}/stats.
 * Each series is a dense 12-element, zero-filled array. `locked: true` (with
 * both series empty) when the viewer is neither the user nor an accepted
 * follower; `locked` is absent / false on an accessible profile.
 */
export type ProfileStats = {
  lift_session_minutes: StatsPoint[];
  running_distance_meters: StatsPoint[];
  locked?: boolean;
};

/**
 * GET /users/{username}/stats — the weekly lift-minutes and running-distance
 * series powering the profile graphs. Mirrors `listUserTimeline`: a locked
 * profile is a normal response (`locked: true`, empty series) rather than an
 * error, so this returns the parsed body as-is without throwing on locked.
 * Non-2xx responses still throw (so callers can clear the token on a 401).
 */
export async function getProfileStats(token: string, username: string): Promise<ProfileStats> {
  const resp = await fetch(`${config.apiUrl}/users/${encodeURIComponent(username)}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return unwrap<ProfileStats>(resp, {
    lift_session_minutes: [],
    running_distance_meters: [],
    locked: false,
  });
}

/**
 * Availability probe for a candidate username, used by the Settings handle
 * editor to give snappy "available / taken" feedback before the user saves.
 * Implemented against GET /users/{username}: a 200 means the handle resolves
 * to an existing profile (taken → false); a 404 means no such profile
 * (available → true). Because a 404 is the expected/non-error outcome here,
 * this inspects `resp.status` directly rather than going through `unwrap`
 * (which would throw on the 404). Any other non-2xx is surfaced as an error
 * so the caller can fall back to letting the server be authoritative on save.
 */
export async function checkUsernameAvailable(token: string, username: string): Promise<boolean> {
  const resp = await fetch(`${config.apiUrl}/users/${encodeURIComponent(username)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resp.status === 404) return true; // no such profile → available
  if (resp.ok) return false; // resolves to a profile → taken
  let detail: string;
  try {
    detail = (await resp.json())?.error ?? `HTTP ${resp.status}`;
  } catch {
    detail = `HTTP ${resp.status}`;
  }
  throw new Error(detail);
}

// --- Dashboard summary -------------------------------------------

/**
 * The dashboard's running widget. `current_week` carries this week's
 * distance/run-count plus the week-over-week delta (null when there's no
 * prior week to compare against). `recent_avg_pace_sec_per_km` and
 * `latest_run` are nullable when the data is too sparse to compute.
 * `weekly_distance_spark` is ~8 weekly distances (meters), oldest→newest.
 * All distances are metric meters; convert at the display edge.
 */
export type DashboardRunning = {
  current_week: {
    distance_meters: number;
    run_count: number;
    delta_pct_vs_prior_week: number | null;
  };
  recent_avg_pace_sec_per_km: number | null;
  latest_run: {
    name: string | null;
    distance_meters: number;
    duration_seconds: number;
    start_time: string;
  } | null;
  weekly_distance_spark: number[];
};

/**
 * The dashboard's lifting widget. `current_week` carries this week's
 * training volume/session/set/PR counts. `headline_estimated_1rm` is the
 * user's standout estimated 1RM (nullable when none qualifies); its
 * `value` is already in `unit`. `weekly_volume_spark` is weekly volume
 * oldest→newest. Weights pass through in the user's stored `unit`.
 */
export type DashboardLifting = {
  current_week: {
    duration_seconds: number;
    sessions: number;
    sets: number;
    prs: number;
  };
  headline_estimated_1rm: {
    exercise_name: string;
    value: number;
    unit: "lb" | "kg";
  } | null;
  weekly_volume_spark: number[];
  unit: "lb" | "kg";
};

/**
 * The dashboard's steps widget. `goal` is nullable (no goal set).
 * `daily_spark` is 7 daily counts, oldest→newest.
 */
export type DashboardSteps = {
  avg: number;
  today: number;
  goal: number | null;
  daily_spark: number[];
};

/** One day's (or goal's) macro totals for the dashboard nutrition widget. */
export type DashboardMacros = {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/**
 * The dashboard's nutrition widget. `today` is the day's logged totals;
 * `goals` is nullable (no macro goals set).
 */
export type DashboardNutrition = {
  today: DashboardMacros;
  goals: DashboardMacros | null;
};

/**
 * The dashboard's bodyweight widget. `current` is the latest reading in
 * `unit`. `rate_per_week` (lb/kg per week, signed) and `goal` are
 * nullable. `trend_spark` is the recent trend, oldest→newest. Weights
 * pass through in the user's stored `unit`.
 */
export type DashboardBodyweight = {
  current: number;
  unit: "lb" | "kg";
  rate_per_week: number | null;
  goal: {
    weight: number;
    unit: "lb" | "kg";
  } | null;
  trend_spark: number[];
};

/**
 * The dashboard's recovery widget, sourced from Whoop. Present only for
 * users with a connected Whoop account (omitted → null otherwise).
 * `today` is the latest daily recovery snapshot (null when Whoop has no
 * reading yet); `resting_hr_spark` is the recent resting-HR trend,
 * oldest→newest.
 */
export type DashboardRecovery = {
  today: {
    date: string;
    resting_heart_rate: number | null;
    recovery_score: number | null;
    hrv_rmssd_milli: number | null;
  } | null;
  resting_hr_spark: number[];
};

/**
 * The dashboard's streak widget. ALWAYS present (zeroed for a brand-new
 * user). `week` is 7 booleans Mon→Sun marking which days had activity.
 */
export type DashboardStreak = {
  weeks: number;
  active_days_this_week: number;
  week: boolean[];
};

/**
 * GET /dashboard/summary response payload (the envelope's `data`). Each
 * section is null when the user has no data for it (e.g. `running: null`
 * with no logged runs); `streak` is always present. Distances are metric
 * meters; weights are in the user's stored unit. Mirrors the API contract
 * exactly (snake_case); the display adapter in lib/dashboard.ts converts
 * toward the user's preferred units.
 */
export type DashboardSummary = {
  running: DashboardRunning | null;
  lifting: DashboardLifting | null;
  steps: DashboardSteps | null;
  nutrition: DashboardNutrition | null;
  bodyweight: DashboardBodyweight | null;
  recovery: DashboardRecovery | null;
  streak: DashboardStreak;
};

/**
 * GET /dashboard/summary?timezone=<IANA>. Returns the dashboard's
 * single-shot summary across running, lifting, steps, nutrition,
 * bodyweight, and the activity streak. `timezone` anchors the day/week
 * windows on the user's local calendar; call sites pass
 * `Intl.DateTimeFormat().resolvedOptions().timeZone`. Returns null when
 * the envelope carries no payload (the page renders a global empty state).
 */
export async function getDashboardSummary(
  token: string,
  timezone: string,
): Promise<DashboardSummary | null> {
  const resp = await fetch(
    `${config.apiUrl}/dashboard/summary?timezone=${encodeURIComponent(timezone)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  return unwrap<DashboardSummary | null>(resp, null);
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
