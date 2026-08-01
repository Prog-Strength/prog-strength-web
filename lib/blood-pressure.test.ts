import { describe, expect, test } from "vitest";
import { classify, dailyAverages, BP_CATEGORIES, BP_THRESHOLDS } from "./blood-pressure";

describe("classify", () => {
  // The full boundary table — mirrors the Go Classify ladder. The order of
  // the checks is load-bearing: a reading can satisfy multiple thresholds and
  // MUST resolve to the most severe one (descending ladder).
  test.each([
    [125, 85, "stage_1"],
    [135, 75, "stage_1"],
    [115, 95, "stage_2"],
    [119, 79, "normal"],
    [120, 79, "elevated"],
    [130, 80, "stage_1"],
    [140, 90, "stage_2"],
    [180, 120, "crisis"],
    [110, 70, "normal"],
    [122, 78, "elevated"],
  ])("%i/%i -> %s", (systolic, diastolic, expected) => {
    expect(classify(systolic, diastolic)).toBe(expected);
  });

  test("thresholds are exported for reuse by the modal/chart", () => {
    expect(BP_THRESHOLDS.crisis).toEqual({ systolic: 180, diastolic: 120 });
    expect(BP_THRESHOLDS.stage_2).toEqual({ systolic: 140, diastolic: 90 });
    expect(BP_THRESHOLDS.stage_1).toEqual({ systolic: 130, diastolic: 80 });
    expect(BP_THRESHOLDS.elevated).toEqual({ systolic: 120 });
  });
});

describe("BP_CATEGORIES", () => {
  test("every category has a label and a status tone", () => {
    expect(BP_CATEGORIES.normal).toEqual({ label: "Normal", tone: "var(--success)" });
    expect(BP_CATEGORIES.elevated).toEqual({ label: "Elevated", tone: "var(--warning)" });
    expect(BP_CATEGORIES.stage_1).toEqual({ label: "Stage 1", tone: "var(--warning)" });
    expect(BP_CATEGORIES.stage_2).toEqual({ label: "Stage 2", tone: "var(--danger)" });
    expect(BP_CATEGORIES.crisis).toEqual({ label: "Crisis", tone: "var(--danger)" });
  });
});

describe("dailyAverages", () => {
  test("averages multiple readings on the same day and rounds to nearest int", () => {
    const result = dailyAverages(
      [
        { systolic: 120, diastolic: 80, measured_at: "2026-06-10T08:00:00Z" },
        { systolic: 131, diastolic: 85, measured_at: "2026-06-10T20:00:00Z" },
      ],
      "UTC",
    );
    expect(result).toEqual([
      {
        day: "2026-06-10",
        // (120 + 131) / 2 = 125.5 -> 126; (80 + 85) / 2 = 82.5 -> 83
        systolic: 126,
        diastolic: 83,
        count: 2,
        category: "stage_1",
      },
    ]);
  });

  test("gap days are absent from the result (not zeroed)", () => {
    const result = dailyAverages(
      [
        { systolic: 118, diastolic: 76, measured_at: "2026-06-10T08:00:00Z" },
        { systolic: 122, diastolic: 78, measured_at: "2026-06-12T08:00:00Z" },
      ],
      "UTC",
    );
    expect(result.map((r) => r.day)).toEqual(["2026-06-10", "2026-06-12"]);
    expect(result.length).toBe(2);
  });

  test("buckets by LOCAL calendar day in the given time zone", () => {
    // 03:30 UTC on 2026-06-15 is 23:30 on 2026-06-14 in America/New_York (EDT).
    const result = dailyAverages(
      [{ systolic: 121, diastolic: 79, measured_at: "2026-06-15T03:30:00Z" }],
      "America/New_York",
    );
    expect(result).toEqual([
      {
        day: "2026-06-14",
        systolic: 121,
        diastolic: 79,
        count: 1,
        category: "elevated",
      },
    ]);
  });

  test("returns days oldest -> newest regardless of input order", () => {
    const result = dailyAverages(
      [
        { systolic: 122, diastolic: 78, measured_at: "2026-06-12T08:00:00Z" },
        { systolic: 118, diastolic: 76, measured_at: "2026-06-10T08:00:00Z" },
      ],
      "UTC",
    );
    expect(result.map((r) => r.day)).toEqual(["2026-06-10", "2026-06-12"]);
  });
});
