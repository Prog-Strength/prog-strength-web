import { afterEach, describe, expect, it, vi } from "vitest";
import {
  activityToWorkout,
  attachWorkoutTCX,
  calibrateRunningSession,
  checkUsernameAvailable,
  createActivity,
  createWorkout,
  createWorkoutFromTCX,
  deleteActivity,
  deletePlannedWorkout,
  deleteActivityPhoto,
  deleteWorkout,
  detachWorkoutTCX,
  getActivity,
  getDashboardSummary,
  getExerciseOneRMHistory,
  getPlannedWorkoutBySession,
  getProfile,
  getRunningBestEffortHistory,
  getRunningMaxEffort,
  getRunningMaxEffortSummary,
  getRunningSession,
  getWorkout,
  listActivities,
  listProgression,
  listRunningBestEfforts,
  listRunningSessions,
  listWhoopRecovery,
  listWorkouts,
  putDashboardLayout,
  removeFollower,
  reorderActivityPhotos,
  requestFollow,
  setRunningSessionEnvironment,
  unlinkPlannedWorkout,
  updateActivity,
  updateActivityPhotoCaption,
  updateRunningSessionNotes,
  updateWorkout,
  uploadActivityPhoto,
} from "@/lib/api";

// Unit tests for the running best-efforts + 1RM history client methods.
// There's no msw in this repo, so we stub the global `fetch` directly with
// a vi.fn returning a Response-like object ({ ok, status, json }). Each
// success body mirrors the API's `{data: ...}` envelope that `unwrap`
// strips; the error case asserts the thrown message carries the API's
// `error` field.

// config.apiUrl defaults to http://localhost:8080 (no NEXT_PUBLIC_API_URL
// set under vitest), so URLs are asserted against that base.
const BASE = "http://localhost:8080";
const TOKEN = "test-token";

function mockFetchOk(data: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ data }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mockFetchError(error: string) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: false,
    status: 500,
    json: async () => ({ error }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("listRunningBestEfforts", () => {
  const effort = {
    distance_key: "5k",
    distance_label: "5K",
    distance_meters: 5000,
    duration_seconds: 1184.7,
    pace_sec_per_km: 236.9,
    activity_id: "act_2c1",
    activity_start_time: "2026-04-18T06:45:00Z",
  };

  it("returns the inner best_efforts array and sends the bearer header", async () => {
    const fetchMock = mockFetchOk({ best_efforts: [effort] });

    const result = await listRunningBestEfforts(TOKEN);

    expect(result).toEqual([effort]);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/running/best-efforts`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("returns an empty array when the envelope data is empty", async () => {
    mockFetchOk({ best_efforts: [] });
    expect(await listRunningBestEfforts(TOKEN)).toEqual([]);
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(listRunningBestEfforts(TOKEN)).rejects.toThrow("boom");
  });
});

describe("getRunningBestEffortHistory", () => {
  const history = {
    distance_key: "5k",
    distance_label: "5K",
    distance_meters: 5000,
    points: [
      {
        activity_id: "act_8f3",
        activity_start_time: "2026-01-12T07:02:00Z",
        duration_seconds: 1340.2,
      },
    ],
  };

  it("returns the parsed history and URL-encodes the distance key", async () => {
    const fetchMock = mockFetchOk(history);

    const result = await getRunningBestEffortHistory(TOKEN, "half_marathon");

    expect(result).toEqual(history);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/running/best-efforts/half_marathon/history`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(getRunningBestEffortHistory(TOKEN, "5k")).rejects.toThrow("boom");
  });
});

describe("listProgression", () => {
  // A full response in the new shape: per-exercise trends + aggregate +
  // baseline_model + filter echo, with no top-level `trendline`.
  const progression = {
    filter: {
      movement_pattern: "push",
      muscle_groups_included: ["chest", "shoulders", "triceps"],
    },
    since: "2026-03-11T00:00:00Z",
    until: "2026-06-09T00:00:00Z",
    baseline_model: "recency_weighted_current",
    exercise_baselines: [
      {
        exercise_id: "barbell-bench-press",
        exercise_name: "Barbell Bench Press",
        baseline: 245.0,
        unit: "lb",
      },
    ],
    points: [
      {
        workout_id: "wk_2a",
        exercise_id: "barbell-bench-press",
        exercise_name: "Barbell Bench Press",
        performed_at: "2026-04-12T17:30:00Z",
        normalized_max: 0.927,
        avg_estimated_1rm: 220.4,
        max_estimated_1rm: 227.0,
        min_estimated_1rm: 215.0,
        set_count: 5,
        unit: "lb",
      },
    ],
    per_exercise_trends: [
      {
        exercise_id: "barbell-bench-press",
        session_count: 8,
        slope_per_month: 2.1,
        trendline: {
          start_at: "2026-03-11T00:00:00Z",
          start_value: 0.91,
          end_at: "2026-06-09T00:00:00Z",
          end_value: 0.99,
        },
      },
      {
        exercise_id: "overhead-press",
        session_count: 2,
        slope_per_month: null,
        trendline: null,
      },
    ],
    aggregate: {
      lifts_tracked: 5,
      lifts_progressing: 3,
      median_slope_per_month: 1.4,
      min_sessions_threshold: 3,
    },
  };

  it("builds a movement_pattern query string", async () => {
    const fetchMock = mockFetchOk(progression);

    await listProgression(
      TOKEN,
      { movementPattern: "push" },
      "2026-03-11T00:00:00Z",
      "2026-06-09T00:00:00Z",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/activities/progression?");
    expect(url).toContain("movement_pattern=push");
    expect(url).not.toContain("muscle_group=");
    expect(url).toContain("since=2026-03-11T00%3A00%3A00Z");
    expect(url).toContain("until=2026-06-09T00%3A00%3A00Z");
    expect(fetchMock.mock.calls[0][1]).toEqual({
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("builds a muscle_group query string for the legacy filter", async () => {
    const fetchMock = mockFetchOk(progression);

    await listProgression(TOKEN, { muscleGroup: "chest" });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("muscle_group=chest");
    expect(url).not.toContain("movement_pattern=");
  });

  it("round-trips the new response shape with no top-level trendline", async () => {
    mockFetchOk(progression);

    const result = await listProgression(TOKEN, { movementPattern: "push" });

    expect(result).toEqual(progression);
    expect(result.per_exercise_trends).toHaveLength(2);
    expect(result.aggregate?.median_slope_per_month).toBe(1.4);
    expect(result.baseline_model).toBe("recency_weighted_current");
    expect(result.filter.movement_pattern).toBe("push");
    expect(result).not.toHaveProperty("trendline");
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(listProgression(TOKEN, { movementPattern: "push" })).rejects.toThrow("boom");
  });
});

describe("getExerciseOneRMHistory", () => {
  const history = {
    exercise_id: "barbell-bench-press",
    exercise_name: "Barbell Bench Press",
    unit: "lb",
    points: [
      {
        workout_id: "wk_2a",
        performed_at: "2026-01-04T17:30:00Z",
        estimated_1rm: 305.4,
      },
    ],
  };

  it("returns the parsed history and URL-encodes the exercise id", async () => {
    const fetchMock = mockFetchOk(history);

    const result = await getExerciseOneRMHistory(TOKEN, "barbell-bench-press");

    expect(result).toEqual(history);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/activities/personal-records/barbell-bench-press/history`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(getExerciseOneRMHistory(TOKEN, "barbell-bench-press")).rejects.toThrow("boom");
  });
});

describe("getRunningMaxEffortSummary", () => {
  const summary = {
    estimator_version: "v1",
    distances: [
      {
        distance_key: "5k",
        distance_label: "5K",
        distance_meters: 5000,
        estimate_seconds: 1170.0,
        lower_seconds: 1140.0,
        upper_seconds: 1205.0,
        basis: "multi_distance_fit",
        confidence: "high",
        actual_best_seconds: 1184.7,
        actual_best_activity_id: "act_2c1",
        actual_best_achieved_at: "2026-04-18T06:45:00Z",
      },
      {
        distance_key: "marathon",
        distance_label: "Marathon",
        distance_meters: 42195,
        estimate_seconds: null,
        lower_seconds: null,
        upper_seconds: null,
        basis: "insufficient_data",
        confidence: "low",
        actual_best_seconds: null,
        actual_best_activity_id: null,
        actual_best_achieved_at: null,
      },
    ],
  };

  it("returns the parsed summary and sends the bearer header", async () => {
    const fetchMock = mockFetchOk(summary);

    const result = await getRunningMaxEffortSummary(TOKEN);

    expect(result).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/running/max-effort`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("falls back to an empty summary when the envelope data is missing", async () => {
    mockFetchOk(undefined);
    expect(await getRunningMaxEffortSummary(TOKEN)).toEqual({
      estimator_version: "",
      distances: [],
    });
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(getRunningMaxEffortSummary(TOKEN)).rejects.toThrow("boom");
  });
});

describe("getRunningMaxEffort", () => {
  const detail = {
    estimator_version: "v1",
    distance_key: "5k",
    distance_label: "5K",
    distance_meters: 5000,
    estimate: {
      seconds: 1170.0,
      lower_seconds: 1140.0,
      upper_seconds: 1205.0,
      basis: "multi_distance_fit",
      confidence: "high",
      n_points: 12,
      n_distances: 4,
    },
    actual_best: {
      seconds: 1184.7,
      activity_id: "act_2c1",
      achieved_at: "2026-04-18T06:45:00Z",
    },
    estimate_history: [
      {
        as_of: "2026-03-01T00:00:00Z",
        seconds: 1210.0,
        lower_seconds: 1180.0,
        upper_seconds: 1250.0,
      },
    ],
    attempts: [
      {
        activity_id: "act_2c1",
        achieved_at: "2026-04-18T06:45:00Z",
        duration_seconds: 1184.7,
        pace_sec_per_km: 236.9,
        source: "race_like",
      },
    ],
    stats: {
      estimated_max_effort_seconds: 1170.0,
      current_best_seconds: 1184.7,
      gap_seconds: -14.7,
      confidence: "high",
      data_summary: "12 efforts across 4 distances",
    },
  };

  it("returns the parsed detail and URL-encodes the distance key", async () => {
    const fetchMock = mockFetchOk(detail);

    const result = await getRunningMaxEffort(TOKEN, "half_marathon");

    expect(result).toEqual(detail);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/running/max-effort/half_marathon`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("unwraps a null-estimate (insufficient_data) detail response", async () => {
    const insufficient = {
      estimator_version: "v1",
      distance_key: "marathon",
      distance_label: "Marathon",
      distance_meters: 42195,
      estimate: null,
      actual_best: null,
      estimate_history: [],
      attempts: [],
      stats: {
        estimated_max_effort_seconds: null,
        current_best_seconds: null,
        gap_seconds: null,
        confidence: "low",
        data_summary: "insufficient data",
      },
    };
    mockFetchOk(insufficient);

    const result = await getRunningMaxEffort(TOKEN, "marathon");

    expect(result).toEqual(insufficient);
    expect(result.estimate).toBeNull();
    expect(result.attempts).toEqual([]);
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(getRunningMaxEffort(TOKEN, "5k")).rejects.toThrow("boom");
  });
});

// --- Social graph: profiles, follows, search ---------------------

describe("getProfile", () => {
  const prof = {
    user_id: "u_42",
    username: "lifter_sam",
    display_name: "Sam",
    avatar_url: null,
    relationship: "following" as const,
    follower_count: 12,
    following_count: 7,
  };

  it("unwraps the envelope and URL-encodes the username", async () => {
    const fetchMock = mockFetchOk(prof);

    const result = await getProfile(TOKEN, "lifter sam");

    expect(result).toEqual(prof);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/lifter%20sam`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("rejects with the API error text on a 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "user not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(getProfile(TOKEN, "ghost")).rejects.toThrow("user not found");
  });
});

describe("requestFollow", () => {
  it("posts the followee and returns the edge", async () => {
    const edge = {
      user_id: "u_9",
      username: "coach",
      display_name: "Coach",
      avatar_url: null,
      relationship: "requested" as const,
    };
    const fetchMock = mockFetchOk(edge);

    const result = await requestFollow(TOKEN, "coach");

    expect(result).toEqual(edge);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/follows`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ followee: "coach" }),
    });
  });

  it("rejects with the API error text on a 409", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: "already following" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestFollow(TOKEN, "coach")).rejects.toThrow("already following");
  });
});

describe("removeFollower", () => {
  it("resolves on a 204 without parsing a body", async () => {
    // The 204 path must not call resp.json() — give it a json that throws
    // so a regression that tries to unwrap an empty body would fail loudly.
    const json = vi.fn(async () => {
      throw new Error("should not parse a 204 body");
    });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json });
    vi.stubGlobal("fetch", fetchMock);

    await expect(removeFollower(TOKEN, "sam")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/followers/sam`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(json).not.toHaveBeenCalled();
  });

  it("rejects with the API error text on a non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "not a follower" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(removeFollower(TOKEN, "sam")).rejects.toThrow("not a follower");
  });
});

describe("checkUsernameAvailable", () => {
  it("returns true (available) on a 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "user not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkUsernameAvailable(TOKEN, "freehandle")).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/users/freehandle`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("returns false (taken) on a 200", async () => {
    mockFetchOk({
      user_id: "u_1",
      username: "taken",
      display_name: "Taken",
      avatar_url: null,
      relationship: "none",
      follower_count: 0,
      following_count: 0,
    });
    await expect(checkUsernameAvailable(TOKEN, "taken")).resolves.toBe(false);
  });

  it("throws on an unexpected non-2xx (e.g. 500)", async () => {
    mockFetchError("boom");
    await expect(checkUsernameAvailable(TOKEN, "x")).rejects.toThrow("boom");
  });
});

describe("getDashboardSummary", () => {
  const summary = {
    layout: ["running", "lifting", "steps", "nutrition", "bodyweight", "streak"],
    running: {
      current_week: { distance_meters: 21214.5, run_count: 3, delta_pct_vs_prior_week: 9.0 },
      recent_avg_pace_sec_per_km: 376.5,
      latest_run: {
        name: "Lunch Run",
        distance_meters: 8449.0,
        duration_seconds: 3184,
        start_time: "2026-06-18T18:02:00Z",
      },
      weekly_distance_spark: [12000.0, 0.0, 18500.0, 21214.5],
    },
    lifting: {
      current_week: { duration_seconds: 9780, sessions: 3, sets: 21, prs: 4 },
      headline_estimated_1rm: {
        exercise_name: "Barbell Bench Press",
        value: 326.9,
        unit: "lb",
      },
      weekly_volume_spark: [0.0, 14200.0, 18050.0],
      unit: "lb",
    },
    steps: { avg: 9400, today: 14000, goal: 10000, daily_spark: [8200, 9100, 0, 11000] },
    nutrition: {
      today: { calories: 1840.0, protein_g: 150.0, carbs_g: 190.0, fat_g: 60.0 },
      goals: { calories: 2100, protein_g: 180, carbs_g: 230, fat_g: 70 },
    },
    bodyweight: {
      current: 182.4,
      unit: "lb",
      rate_per_week: -0.3,
      goal: { weight: 178.0, unit: "lb" },
      trend_spark: [184.1, 183.6, 182.9, 182.4],
    },
    streak: {
      weeks: 25,
      active_days_this_week: 3,
      week: [true, false, true, false, true, false, false],
    },
  };

  it("returns the parsed summary and sends the bearer header with the timezone", async () => {
    const fetchMock = mockFetchOk(summary);

    const result = await getDashboardSummary(TOKEN, "America/Denver");

    expect(result).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/dashboard/summary?timezone=America%2FDenver`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("returns null when the envelope data is missing", async () => {
    mockFetchOk(undefined);
    expect(await getDashboardSummary(TOKEN, "America/Denver")).toBeNull();
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(getDashboardSummary(TOKEN, "America/Denver")).rejects.toThrow("boom");
  });
});

describe("putDashboardLayout", () => {
  it("PUTs the tile ids with the bearer header and resolves on a 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(putDashboardLayout(TOKEN, ["running", "hiking"])).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/dashboard/layout`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ tile_ids: ["running", "hiking"] }),
    });
  });

  it("throws on a non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 422 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(putDashboardLayout(TOKEN, ["running"])).rejects.toThrow(
      "PUT /dashboard/layout failed: 422",
    );
  });
});

describe("deletePlannedWorkout", () => {
  it("sends DELETE with the bearer header and resolves on ok", async () => {
    const fetchMock = mockFetchOk(null);
    await expect(deletePlannedWorkout(TOKEN, "p1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/planned-workouts/p1`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("treats a 404 as success — the plan is already gone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "planned workout not found" }),
      }),
    );
    await expect(deletePlannedWorkout(TOKEN, "p1")).resolves.toBeUndefined();
  });

  it("rejects with the API error text on other failures", async () => {
    mockFetchError("boom");
    await expect(deletePlannedWorkout(TOKEN, "p1")).rejects.toThrow("boom");
  });
});

describe("planned-workout reconciliation", () => {
  it("unlinkPlannedWorkout POSTs to /unlink and returns the updated plan", async () => {
    const plan = { id: "p1", status: "planned", completed_session_id: null } as unknown;
    const fetchMock = mockFetchOk(plan);
    const result = await unlinkPlannedWorkout(TOKEN, "p1");
    expect(result).toMatchObject({ id: "p1", status: "planned" });
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/planned-workouts/p1/unlink`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("getPlannedWorkoutBySession returns the plan when found", async () => {
    const plan = { id: "p1", status: "completed", completed_session_id: "act1" } as unknown;
    const fetchMock = mockFetchOk(plan);
    const result = await getPlannedWorkoutBySession(TOKEN, "act1", "activity");
    expect(result).toMatchObject({ id: "p1" });
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/planned-workouts/by-session?session_id=act1&session_kind=activity`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it("getPlannedWorkoutBySession returns null on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "no planned workout completed by this session" }),
      }),
    );
    const result = await getPlannedWorkoutBySession(TOKEN, "act1", "activity");
    expect(result).toBeNull();
  });
});

describe("getRunningSession", () => {
  it("GETs the activity with the default unit param and returns it", async () => {
    const activity = { id: "a1", trackpoints: [] };
    const fetchMock = mockFetchOk(activity);

    const result = await getRunningSession(TOKEN, "a1");

    expect(result).toEqual(activity);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/a1?unit=mi`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("passes an explicit unit param through", async () => {
    const fetchMock = mockFetchOk({ id: "a1", trackpoints: [] });

    await getRunningSession(TOKEN, "a1", "km");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/a1?unit=km`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("throws when the API returns no activity", async () => {
    mockFetchOk(null);
    await expect(getRunningSession(TOKEN, "a1")).rejects.toThrow("activity not found");
  });
});

describe("listRunningSessions", () => {
  // Stage 3 of the unified-activity-model migration: the running list
  // filters server-side via ?type=running. The client-side
  // strength_training guard from the hardening PR stays as a belt in case
  // an older API ignores the param.
  it("requests server-side type=running filtering", async () => {
    const fetchMock = mockFetchOk({ activities: [], next_before: null });

    await listRunningSessions(TOKEN);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`${BASE}/activities?`);
    expect(url).toContain("type=running");
  });

  it("keeps the client-side strength_training belt filter", async () => {
    const run = { id: "r1", activity_type: "running" };
    const lift = { id: "s1", activity_type: "strength_training" };
    mockFetchOk({ activities: [run, lift], next_before: null });

    const result = await listRunningSessions(TOKEN);

    expect(result.activities).toEqual([run]);
  });

  it("builds the range form without limit/before and passes the cursor through", async () => {
    const run = { id: "r1", activity_type: "running" };
    const fetchMock = mockFetchOk({ activities: [run], next_before: "cursor-1" });

    const result = await listRunningSessions(TOKEN, {
      since: "2026-06-01T00:00:00Z",
      until: "2026-07-01T00:00:00Z",
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("since=2026-06-01T00%3A00%3A00Z");
    expect(url).toContain("until=2026-07-01T00%3A00%3A00Z");
    expect(url).not.toContain("limit=");
    expect(result).toEqual({ activities: [run], next_before: "cursor-1" });
  });
});

describe("calibrateRunningSession", () => {
  // A calibrated session comes back carrying the new fields + rescaled
  // trackpoints, mirroring the full detail shape the API returns.
  const calibrated = {
    id: "run-9",
    activity_type: "running",
    environment: "indoor",
    distance_meters: 4828.03,
    raw_distance_meters: 5050,
    trackpoints: [{ sequence: 0, elapsed_seconds: 0, distance_meters: 0 }],
  };

  it("POSTs to /calibrate with the distance body + bearer and returns the session", async () => {
    const fetchMock = mockFetchOk(calibrated);

    const result = await calibrateRunningSession(TOKEN, "run-9", 4828.03);

    expect(result).toEqual(calibrated);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/run-9/calibrate?unit=mi`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ distance_meters: 4828.03 }),
    });
  });

  it("passes an explicit unit param through", async () => {
    const fetchMock = mockFetchOk(calibrated);

    await calibrateRunningSession(TOKEN, "run-9", 4828.03, "km");

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/activities/run-9/calibrate?unit=km`,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws when the API returns no activity", async () => {
    mockFetchOk(null);
    await expect(calibrateRunningSession(TOKEN, "run-9", 4828.03)).rejects.toThrow(
      "did not return the calibrated activity",
    );
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("tag the run as indoor before calibrating its distance");
    await expect(calibrateRunningSession(TOKEN, "run-9", 4828.03)).rejects.toThrow(
      "tag the run as indoor",
    );
  });
});

describe("setRunningSessionEnvironment", () => {
  const updated = {
    id: "run-9",
    activity_type: "running",
    environment: "indoor",
    distance_meters: 5050,
    raw_distance_meters: 5050,
  };

  it("PATCHes with the environment body + bearer and returns the session", async () => {
    const fetchMock = mockFetchOk(updated);

    const result = await setRunningSessionEnvironment(TOKEN, "run-9", "indoor");

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/run-9`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ environment: "indoor" }),
    });
  });

  it("throws when the API returns no activity", async () => {
    mockFetchOk(null);
    await expect(setRunningSessionEnvironment(TOKEN, "run-9", "outdoor")).rejects.toThrow(
      "did not return the updated activity",
    );
  });
});

describe("updateRunningSessionNotes", () => {
  const updated = {
    id: "run-9",
    activity_type: "running",
    environment: "outdoor",
    notes: "felt strong on the back half",
  };

  it("PATCHes with only the notes body + bearer and returns the session", async () => {
    const fetchMock = mockFetchOk(updated);

    const result = await updateRunningSessionNotes(TOKEN, "run-9", "felt strong on the back half");

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/run-9`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({ notes: "felt strong on the back half" }),
    });
    // The body carries exactly the notes key — no name/other fields.
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ notes: "felt strong on the back half" });
  });

  it("sends an empty string to clear the notes", async () => {
    const fetchMock = mockFetchOk({ ...updated, notes: null });

    await updateRunningSessionNotes(TOKEN, "run-9", "");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({ notes: "" });
  });

  it("throws when the API returns no activity", async () => {
    mockFetchOk(null);
    await expect(updateRunningSessionNotes(TOKEN, "run-9", "hi")).rejects.toThrow(
      "did not return the updated activity",
    );
  });
});

describe("listWhoopRecovery", () => {
  const rows = [
    { date: "2026-07-01", recovery_score: 72, resting_heart_rate: 54, hrv_rmssd_milli: 88.4 },
    { date: "2026-07-02", recovery_score: null, resting_heart_rate: null, hrv_rmssd_milli: null },
  ];

  it("sends timezone + local since/until dates and unwraps the keyed list envelope", async () => {
    // The API wraps lists in a keyed object: data = {recovery: [...]}, NOT the
    // bare array. This test previously mocked the bare-array shape the client
    // wished for, so the suite passed while prod threw rows.find-on-object.
    const fetchMock = mockFetchOk({ recovery: rows });
    const result = await listWhoopRecovery(TOKEN, {
      timezone: "America/Denver",
      since: "2026-06-03",
      until: "2026-07-02",
    });
    expect(result).toEqual(rows);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE}/whoop/recovery?timezone=America%2FDenver&since=2026-06-03&until=2026-07-02`,
      { headers: { Authorization: `Bearer ${TOKEN}` } },
    );
  });

  it("omits since/until when not provided", async () => {
    const fetchMock = mockFetchOk({ recovery: rows });
    await listWhoopRecovery(TOKEN, { timezone: "America/Denver" });
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/whoop/recovery?timezone=America%2FDenver`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("returns an empty list when the envelope data is missing", async () => {
    mockFetchOk(undefined);
    expect(await listWhoopRecovery(TOKEN, { timezone: "America/Denver" })).toEqual([]);
  });

  it("returns an empty list when the keyed field is missing or not an array", async () => {
    mockFetchOk({});
    expect(await listWhoopRecovery(TOKEN, { timezone: "America/Denver" })).toEqual([]);
    mockFetchOk({ recovery: "not-an-array" });
    expect(await listWhoopRecovery(TOKEN, { timezone: "America/Denver" })).toEqual([]);
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(listWhoopRecovery(TOKEN, { timezone: "America/Denver" })).rejects.toThrow("boom");
  });
});

// --- Unified /activities surface (stage 3) ------------------------
//
// The workout fetchers now ride the unified /activities surface: cursor or
// range list forms (never mixed with limit/before), the strength `details`
// payload carrying exercises + personal_records_set, and an explicit
// Activity → Workout adapter keeping every legacy consumer shape intact.

// A unified strength activity as GET /activities returns it after the
// api parity PR: base fields plus details.{exercises,personal_records_set}.
const strengthActivity = {
  id: "wk_1",
  activity_type: "strength_training",
  ingest_source: "manual",
  source_activity_id: "",
  name: "Push day",
  notes: "felt strong",
  start_time: "2026-07-01T10:00:00Z",
  distance_meters: 0,
  raw_distance_meters: 0,
  environment: "outdoor",
  duration_seconds: 3600,
  avg_pace_sec_per_km: null,
  best_pace_sec_per_km: null,
  avg_heart_rate_bpm: null,
  max_heart_rate_bpm: null,
  total_calories: null,
  elevation_gain_meters: null,
  elevation_loss_meters: null,
  elevation_high_meters: null,
  elevation_low_meters: null,
  created_at: "2026-07-01T11:00:00Z",
  summary: { title: "Push day", subtitle: "1 exercise", metrics: ["1 exercise", "5 sets"] },
  details: {
    exercises: [
      {
        exercise_id: "barbell-bench-press",
        order: 0,
        sets: [{ reps: 5, weight: 185, unit: "lb" }],
      },
    ],
    personal_records_set: [
      {
        id: "pr_1",
        exercise_id: "barbell-bench-press",
        workout_id: "wk_1",
        weight: 185,
        reps: 5,
        unit: "lb",
        previous_weight: null,
        previous_reps: null,
        previous_unit: null,
        achieved_at: "2026-07-01T10:00:00Z",
      },
    ],
  },
};

// The Workout shape the adapter must produce from strengthActivity —
// field-for-field what the legacy /workouts DTO consumers expect.
const adaptedWorkout = {
  id: "wk_1",
  name: "Push day",
  performed_at: "2026-07-01T10:00:00Z",
  ended_at: "2026-07-01T11:00:00.000Z",
  notes: "felt strong",
  exercises: strengthActivity.details.exercises,
  created_at: "2026-07-01T11:00:00Z",
  personal_records_set: strengthActivity.details.personal_records_set,
  activity_id: null,
  enrichment: null,
};

describe("listActivities", () => {
  it("builds the cursor form with limit/before and a type filter", async () => {
    const fetchMock = mockFetchOk({ activities: [], next_before: null });

    await listActivities(TOKEN, { limit: 100, before: "2026-07-01T00:00:00Z", type: "running" });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`${BASE}/activities?`);
    expect(url).toContain("type=running");
    expect(url).toContain("limit=100");
    expect(url).toContain("before=2026-07-01T00%3A00%3A00Z");
    expect(fetchMock.mock.calls[0][1]).toEqual({
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("drops limit/before in the range form (the API forbids mixing them)", async () => {
    const fetchMock = mockFetchOk({ activities: [], next_before: null });

    await listActivities(TOKEN, { since: "2026-06-01T00:00:00Z", limit: 100 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("since=2026-06-01T00%3A00%3A00Z");
    expect(url).not.toContain("limit=");
  });

  it("returns the page and cursor from the envelope", async () => {
    mockFetchOk({ activities: [strengthActivity], next_before: "c1" });

    const result = await listActivities(TOKEN);

    expect(result.activities).toEqual([strengthActivity]);
    expect(result.next_before).toBe("c1");
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(listActivities(TOKEN)).rejects.toThrow("boom");
  });
});

describe("getActivity / createActivity / updateActivity / deleteActivity", () => {
  it("getActivity fetches the detail with a unit param", async () => {
    const fetchMock = mockFetchOk(strengthActivity);

    const result = await getActivity(TOKEN, "wk_1");

    expect(result).toEqual(strengthActivity);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/wk_1?unit=mi`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("getActivity throws when the envelope carries no activity", async () => {
    mockFetchOk(null);
    await expect(getActivity(TOKEN, "nope")).rejects.toThrow("activity not found");
  });

  it("createActivity POSTs the typed payload and unwraps the created row", async () => {
    const fetchMock = mockFetchOk(strengthActivity);
    const payload = {
      activity_type: "strength_training" as const,
      start_time: "2026-07-01T10:00:00Z",
      duration_seconds: 3600,
      name: "Push day",
      details: {
        exercises: [
          {
            exercise_id: "barbell-bench-press",
            sets: [{ reps: 5, weight: 185, unit: "lb" as const }],
          },
        ],
      },
    };

    const result = await createActivity(TOKEN, payload);

    expect(result).toEqual(strengthActivity);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("updateActivity PUTs the typed payload to /activities/{id}", async () => {
    const fetchMock = mockFetchOk(strengthActivity);
    const payload = {
      activity_type: "strength_training" as const,
      start_time: "2026-07-01T10:00:00Z",
      details: { exercises: [] },
    };

    await updateActivity(TOKEN, "wk_1", payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/wk_1`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual(payload);
  });

  it("deleteActivity DELETEs and resolves on 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await deleteActivity(TOKEN, "wk_1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/wk_1`);
    expect(init.method).toBe("DELETE");
  });

  it("deleteActivity rejects with the API error text", async () => {
    mockFetchError("activity not found");
    await expect(deleteActivity(TOKEN, "nope")).rejects.toThrow("activity not found");
  });
});

describe("listWorkouts (unified adapter)", () => {
  it("uses the cursor form with type=strength_training and adapts items", async () => {
    const fetchMock = mockFetchOk({ activities: [strengthActivity], next_before: "c9" });

    const page = await listWorkouts(TOKEN, { limit: 100 });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain(`${BASE}/activities?`);
    expect(url).toContain("type=strength_training");
    expect(url).toContain("limit=100");
    expect(page.next_before).toBe("c9");
    expect(page.items).toEqual([expect.objectContaining(adaptedWorkout)]);
  });

  it("uses the range form (no limit) when since/until are present", async () => {
    const fetchMock = mockFetchOk({ activities: [], next_before: null });

    await listWorkouts(TOKEN, { since: "2026-06-01T00:00:00Z", until: "2026-07-01T00:00:00Z" });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("type=strength_training");
    expect(url).toContain("since=2026-06-01T00%3A00%3A00Z");
    expect(url).toContain("until=2026-07-01T00%3A00%3A00Z");
    expect(url).not.toContain("limit=");
  });

  it("returns an empty page when the envelope data is missing", async () => {
    mockFetchOk(undefined);
    expect(await listWorkouts(TOKEN)).toEqual({ items: [], next_before: null });
  });
});

describe("activityToWorkout adapter", () => {
  it("maps a manual strength activity onto the legacy Workout shape", () => {
    expect(activityToWorkout(strengthActivity as Parameters<typeof activityToWorkout>[0])).toEqual(
      adaptedWorkout,
    );
  });

  it("maps a TCX-enriched activity: activity_id + enrichment with trackpoints", () => {
    const enriched = {
      ...strengthActivity,
      ingest_source: "manual_tcx",
      source_activity_id: "garmin-123",
      avg_heart_rate_bpm: 120,
      max_heart_rate_bpm: 160,
      total_calories: 400,
      trackpoints: [
        {
          sequence: 0,
          elapsed_seconds: 0,
          distance_meters: 0,
          heart_rate_bpm: 100,
          pace_sec_per_km: null,
          elevation_meters: null,
          clean_pace: false,
        },
      ],
    };

    const w = activityToWorkout(enriched as Parameters<typeof activityToWorkout>[0]);

    expect(w.activity_id).toBe("wk_1");
    expect(w.enrichment).toEqual({
      source_activity_id: "garmin-123",
      start_time: "2026-07-01T10:00:00Z",
      duration_seconds: 3600,
      avg_heart_rate_bpm: 120,
      max_heart_rate_bpm: 160,
      total_calories: 400,
      trackpoints: [{ sequence: 0, elapsed_seconds: 0, heart_rate_bpm: 100 }],
    });
  });

  // The API emits heart_rate_zones for any activity carrying per-point HR, so a
  // TCX-enriched lift gets the same block a run does; the adapter has to carry
  // it onto the enrichment the workout page reads.
  it("carries heart_rate_zones through onto the enrichment", () => {
    const zones = {
      model: "percent_max_hr",
      max_hr_reference_bpm: 191,
      reference_source: "p99_recent_runs",
      reference_confidence: "calibrated",
      calibrating: false,
      total_hr_seconds: 3170,
      zones: [
        {
          zone: 1,
          name: "Recovery",
          lower_pct: 0,
          upper_pct: 0.6,
          min_bpm: 0,
          max_bpm: 114,
          time_seconds: 3170,
          time_pct: 1,
        },
      ],
    };
    const enriched = {
      ...strengthActivity,
      ingest_source: "manual_tcx",
      source_activity_id: "garmin-123",
      heart_rate_zones: zones,
    };

    const w = activityToWorkout(enriched as Parameters<typeof activityToWorkout>[0]);

    expect(w.enrichment?.heart_rate_zones).toEqual(zones);
  });

  // A lift whose TCX carries no usable HR: the key is absent on the wire, and
  // the adapter must not invent it (the card gates on presence).
  it("omits heart_rate_zones when the activity has none", () => {
    const enriched = {
      ...strengthActivity,
      ingest_source: "manual_tcx",
      source_activity_id: "garmin-123",
    };

    const w = activityToWorkout(enriched as Parameters<typeof activityToWorkout>[0]);

    expect(w.enrichment).not.toHaveProperty("heart_rate_zones");
  });

  it("normalizes a zero-exercise import (wire exercises: null) to []", () => {
    const imported = {
      ...strengthActivity,
      details: { exercises: null, personal_records_set: [] },
    };

    const w = activityToWorkout(imported as Parameters<typeof activityToWorkout>[0]);

    expect(w.exercises).toEqual([]);
    expect(w.personal_records_set).toEqual([]);
  });

  it("renders an end-less lift (duration 0) with ended_at null and empty details", () => {
    const bare = {
      ...strengthActivity,
      duration_seconds: 0,
      name: null,
      notes: null,
      details: undefined,
    };

    const w = activityToWorkout(bare as Parameters<typeof activityToWorkout>[0]);

    expect(w.ended_at).toBeNull();
    expect(w.name).toBeUndefined();
    expect(w.exercises).toEqual([]);
    expect(w.personal_records_set).toEqual([]);
  });
});

describe("getWorkout (unified adapter)", () => {
  it("fetches /activities/{id} and adapts the strength detail", async () => {
    const fetchMock = mockFetchOk(strengthActivity);

    const w = await getWorkout(TOKEN, "wk_1");

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/activities/wk_1?unit=mi`);
    expect(w).toEqual(expect.objectContaining(adaptedWorkout));
  });

  it("treats a non-strength activity as workout not found", async () => {
    mockFetchOk({ ...strengthActivity, activity_type: "running" });
    await expect(getWorkout(TOKEN, "r1")).rejects.toThrow("workout not found");
  });

  it("translates the missing-activity error to the legacy message", async () => {
    mockFetchOk(null);
    await expect(getWorkout(TOKEN, "nope")).rejects.toThrow("workout not found");
  });
});

describe("createWorkout / updateWorkout (unified adapter)", () => {
  const payload = {
    name: "Push day",
    performed_at: "2026-07-01T10:00:00Z",
    ended_at: "2026-07-01T11:00:00Z",
    notes: "felt strong",
    exercises: [
      { exercise_id: "barbell-bench-press", sets: [{ reps: 5, weight: 185, unit: "lb" as const }] },
    ],
  };

  it("createWorkout POSTs a typed /activities payload and adapts the response", async () => {
    const fetchMock = mockFetchOk(strengthActivity);

    const created = await createWorkout(TOKEN, payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      activity_type: "strength_training",
      start_time: "2026-07-01T10:00:00Z",
      duration_seconds: 3600,
      name: "Push day",
      notes: "felt strong",
      details: { exercises: payload.exercises },
    });
    expect(created).toEqual(expect.objectContaining(adaptedWorkout));
    expect(created.personal_records_set).toHaveLength(1);
  });

  it("createWorkout omits duration when the payload has no ended_at", async () => {
    const fetchMock = mockFetchOk(strengthActivity);

    await createWorkout(TOKEN, { ...payload, ended_at: undefined });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).not.toHaveProperty("duration_seconds");
  });

  it("updateWorkout PUTs the typed payload to /activities/{id}", async () => {
    const fetchMock = mockFetchOk(strengthActivity);

    await updateWorkout(TOKEN, "wk_1", payload);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/wk_1`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string).activity_type).toBe("strength_training");
  });

  it("rejects with the API error text on a validation failure", async () => {
    mockFetchError("invalid strength details");
    await expect(createWorkout(TOKEN, payload)).rejects.toThrow("invalid strength details");
  });
});

describe("deleteWorkout (unified)", () => {
  it("DELETEs /activities/{id}", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await deleteWorkout(TOKEN, "wk_1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/wk_1`);
    expect(init.method).toBe("DELETE");
  });
});

describe("workout TCX endpoints (unified aliases)", () => {
  const file = new File(["<tcx/>"], "workout.tcx", { type: "application/xml" });
  const legacyWorkout = {
    id: "wk_2",
    performed_at: "2026-07-01T10:00:00Z",
    exercises: [],
    personal_records_set: [],
    activity_id: "wk_2",
    enrichment: null,
  };

  it("createWorkoutFromTCX POSTs to /activities/imports", async () => {
    const fetchMock = mockFetchOk(legacyWorkout);

    const w = await createWorkoutFromTCX(TOKEN, file);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/imports`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect(w).toEqual(legacyWorkout);
  });

  it("attachWorkoutTCX POSTs to /activities/{id}/tcx", async () => {
    const fetchMock = mockFetchOk(legacyWorkout);

    await attachWorkoutTCX(TOKEN, "wk_2", file);

    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/activities/wk_2/tcx`);
  });

  it("detachWorkoutTCX DELETEs /activities/{id}/tcx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await detachWorkoutTCX(TOKEN, "wk_2");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/wk_2/tcx`);
    expect(init.method).toBe("DELETE");
  });
});

describe("activity photos", () => {
  const photo = {
    id: "ph_1",
    url: "https://cdn/full.jpg",
    thumb_url: "https://cdn/thumb.jpg",
    width: 1200,
    height: 800,
    caption: null,
    position: 0,
  };

  it("uploadActivityPhoto POSTs multipart with the photo field and no Content-Type", async () => {
    const fetchMock = mockFetchOk(photo);
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });

    const result = await uploadActivityPhoto(TOKEN, "act_1", file);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/act_1/photos`);
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("photo")).toBe(file);
    expect((init.body as FormData).has("caption")).toBe(false);
    expect(result).toEqual(photo);
  });

  it("uploadActivityPhoto appends caption when provided", async () => {
    const fetchMock = mockFetchOk(photo);
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });

    await uploadActivityPhoto(TOKEN, "act_1", file, "leg day");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.body as FormData).get("caption")).toBe("leg day");
  });

  it("uploadActivityPhoto surfaces the API error (e.g. 413)", async () => {
    mockFetchError("file_too_large");
    const file = new File(["x"], "shot.jpg", { type: "image/jpeg" });
    await expect(uploadActivityPhoto(TOKEN, "act_1", file)).rejects.toThrow("file_too_large");
  });

  it("updateActivityPhotoCaption PATCHes the caption JSON", async () => {
    const fetchMock = mockFetchOk({ ...photo, caption: "hi" });

    const result = await updateActivityPhotoCaption(TOKEN, "act_1", "ph_1", "hi");

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/act_1/photos/ph_1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ caption: "hi" }),
    });
    expect(result.caption).toBe("hi");
  });

  it("updateActivityPhotoCaption sends null to clear", async () => {
    const fetchMock = mockFetchOk(photo);

    await updateActivityPhotoCaption(TOKEN, "act_1", "ph_1", null);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ caption: null }));
  });

  it("reorderActivityPhotos PUTs the complete ordered id list", async () => {
    const fetchMock = mockFetchOk([photo]);

    const result = await reorderActivityPhotos(TOKEN, "act_1", ["ph_2", "ph_1"]);

    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/activities/act_1/photos/order`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify({ photo_ids: ["ph_2", "ph_1"] }),
    });
    expect(result).toEqual([photo]);
  });

  it("deleteActivityPhoto DELETEs the photo and resolves on 204", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteActivityPhoto(TOKEN, "act_1", "ph_1")).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/activities/act_1/photos/ph_1`);
    expect(init.method).toBe("DELETE");
    expect(init.headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
  });

  it("deleteActivityPhoto surfaces the API error on non-2xx", async () => {
    mockFetchError("not found");
    await expect(deleteActivityPhoto(TOKEN, "act_1", "ph_1")).rejects.toThrow("not found");
  });
});
