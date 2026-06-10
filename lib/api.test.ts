import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getExerciseOneRMHistory,
  getRunningBestEffortHistory,
  listRunningBestEfforts,
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
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/personal-records/barbell-bench-press/history`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  });

  it("rejects with the API error text on a non-ok response", async () => {
    mockFetchError("boom");
    await expect(getExerciseOneRMHistory(TOKEN, "barbell-bench-press")).rejects.toThrow("boom");
  });
});
