import { describe, expect, it } from "vitest";
import type { DashboardSummary, ResolvedProfile } from "@/lib/api";
import { adaptDashboard } from "@/lib/dashboard";

// A profile seed; only weight_unit/distance_unit matter to the adapter,
// but the full shape is supplied so the test mirrors a real /me payload.
function profile(overrides: Partial<ResolvedProfile> = {}): ResolvedProfile {
  return {
    id: "u_1",
    email: "a@b.com",
    display_name: "Sam",
    weight_unit: "lb",
    distance_unit: "mi",
    height_cm: null,
    birthdate: null,
    sex: null,
    avatar_url: null,
    timezone: "America/Denver",
    calendar_default_detail: "time_block",
    username: null,
    bio: null,
    ...overrides,
  };
}

const fullSummary: DashboardSummary = {
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
    headline_estimated_1rm: { exercise_name: "Barbell Bench Press", value: 326.9, unit: "lb" },
    weekly_volume_spark: [0.0, 14200.0, 18050.0],
    unit: "lb",
  },
  steps: {
    avg: 9400,
    today: 14000,
    goal: 10000,
    daily_spark: [8200, 9100, 0, 11000, 9400, 12000, 14000],
  },
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
  recovery: null,
  streak: {
    weeks: 25,
    active_days_this_week: 3,
    week: [true, false, true, false, true, false, false],
  },
};

describe("adaptDashboard — full payload", () => {
  it("converts running distances/pace to miles for a mi profile", () => {
    const data = adaptDashboard(fullSummary, profile({ distance_unit: "mi" }));
    expect(data.running.present).toBe(true);
    if (!data.running.present) throw new Error("running absent");

    // 21214.5 m / 1609.344 = 13.2 mi
    expect(data.running.currentWeek.distance).toBe("13.2");
    expect(data.running.currentWeek.runCount).toBe(3);
    expect(data.running.currentWeek.deltaPct).toBe(9.0);
    // 376.5 sec/km * 1.609344 ≈ 605.9 s → 10:06 per mile
    expect(data.running.pace).toBe("10:06");
    expect(data.running.unit).toBe("mi");
    expect(data.running.latestRun).toEqual({
      name: "Lunch Run",
      distance: "5.2", // 8449 / 1609.344
      durationSeconds: 3184,
      startTime: "2026-06-18T18:02:00Z",
    });
    // spark in miles
    expect(data.running.spark.unit).toBe("mi");
    expect(data.running.spark.points[0]).toBeCloseTo(12000 / 1609.344, 5);
    expect(data.running.spark.points[1]).toBe(0);
    expect(data.running.spark.points).toHaveLength(4);
  });

  it("converts running distances/pace to km for a km profile", () => {
    const data = adaptDashboard(fullSummary, profile({ distance_unit: "km" }));
    if (!data.running.present) throw new Error("running absent");

    expect(data.running.currentWeek.distance).toBe("21.2"); // 21214.5 / 1000
    expect(data.running.pace).toBe("6:17"); // 376.5 s/km → 6:16.5 → 6:17
    expect(data.running.unit).toBe("km");
    expect(data.running.spark.unit).toBe("km");
    expect(data.running.spark.points[2]).toBeCloseTo(18.5, 5);
  });

  it("passes lifting weights through in lb without conversion", () => {
    const data = adaptDashboard(fullSummary, profile({ weight_unit: "lb" }));
    if (!data.lifting.present) throw new Error("lifting absent");

    expect(data.lifting.currentWeek).toEqual({
      durationSeconds: 9780,
      sessions: 3,
      sets: 21,
      prs: 4,
    });
    expect(data.lifting.headline1rm).toEqual({
      exerciseName: "Barbell Bench Press",
      value: 326.9,
      unit: "lb",
    });
    expect(data.lifting.spark).toEqual([0.0, 14200.0, 18050.0]);
    expect(data.lifting.unit).toBe("lb");
  });

  it("passes lifting/bodyweight weights through in kg when the server returned kg", () => {
    const kgSummary: DashboardSummary = {
      ...fullSummary,
      lifting: {
        ...fullSummary.lifting!,
        headline_estimated_1rm: { exercise_name: "Squat", value: 150.0, unit: "kg" },
        unit: "kg",
      },
      bodyweight: {
        ...fullSummary.bodyweight!,
        current: 82.7,
        unit: "kg",
        goal: { weight: 80, unit: "kg" },
      },
    };
    const data = adaptDashboard(kgSummary, profile({ weight_unit: "kg" }));
    if (!data.lifting.present) throw new Error("lifting absent");
    if (!data.bodyweight.present) throw new Error("bodyweight absent");

    expect(data.lifting.unit).toBe("kg");
    expect(data.lifting.headline1rm?.value).toBe(150.0);
    expect(data.bodyweight.current).toBe(82.7);
    expect(data.bodyweight.unit).toBe("kg");
    expect(data.bodyweight.goal).toEqual({ weight: 80, unit: "kg" });
  });

  it("carries steps/nutrition/bodyweight through", () => {
    const data = adaptDashboard(fullSummary, profile());
    if (!data.steps.present) throw new Error("steps absent");
    if (!data.nutrition.present) throw new Error("nutrition absent");
    if (!data.bodyweight.present) throw new Error("bodyweight absent");

    expect(data.steps.avg).toBe(9400);
    expect(data.steps.today).toBe(14000);
    expect(data.steps.goal).toBe(10000);
    expect(data.steps.spark).toHaveLength(7);

    expect(data.nutrition.today.calories).toBe(1840);
    expect(data.nutrition.goals?.protein_g).toBe(180);

    expect(data.bodyweight.current).toBe(182.4);
    expect(data.bodyweight.ratePerWeek).toBe(-0.3);
    expect(data.bodyweight.spark).toEqual([184.1, 183.6, 182.9, 182.4]);
  });

  it("marks an active streak as not new", () => {
    const data = adaptDashboard(fullSummary, profile());
    expect(data.streak).toEqual({
      weeks: 25,
      activeDaysThisWeek: 3,
      week: [true, false, true, false, true, false, false],
      isNew: false,
    });
  });
});

describe("adaptDashboard — null sections", () => {
  it("marks each null section as not present", () => {
    const empty: DashboardSummary = {
      running: null,
      lifting: null,
      steps: null,
      nutrition: null,
      bodyweight: null,
      recovery: null,
      streak: {
        weeks: 0,
        active_days_this_week: 0,
        week: [false, false, false, false, false, false, false],
      },
    };
    const data = adaptDashboard(empty, profile());

    expect(data.running).toEqual({ present: false });
    expect(data.lifting).toEqual({ present: false });
    expect(data.steps).toEqual({ present: false });
    expect(data.nutrition).toEqual({ present: false });
    expect(data.bodyweight).toEqual({ present: false });
  });

  it("collapses a null summary to all-empty sections and a brand-new streak", () => {
    const data = adaptDashboard(null, profile());
    expect(data.running).toEqual({ present: false });
    expect(data.lifting).toEqual({ present: false });
    expect(data.steps).toEqual({ present: false });
    expect(data.nutrition).toEqual({ present: false });
    expect(data.bodyweight).toEqual({ present: false });
    expect(data.streak).toEqual({ weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true });
  });
});

describe("adaptDashboard — null goals / deltas", () => {
  it("preserves null pace, null delta, and null latest run", () => {
    const sparse: DashboardSummary = {
      ...fullSummary,
      running: {
        current_week: { distance_meters: 5000, run_count: 1, delta_pct_vs_prior_week: null },
        recent_avg_pace_sec_per_km: null,
        latest_run: null,
        weekly_distance_spark: [5000],
      },
    };
    const data = adaptDashboard(sparse, profile({ distance_unit: "km" }));
    if (!data.running.present) throw new Error("running absent");

    expect(data.running.currentWeek.deltaPct).toBeNull();
    expect(data.running.pace).toBe("—");
    expect(data.running.latestRun).toBeNull();
  });

  it("preserves null steps goal, null nutrition goals, null bodyweight goal/rate, null headline 1rm", () => {
    const noGoals: DashboardSummary = {
      ...fullSummary,
      lifting: { ...fullSummary.lifting!, headline_estimated_1rm: null },
      steps: { ...fullSummary.steps!, goal: null },
      nutrition: { today: fullSummary.nutrition!.today, goals: null },
      bodyweight: { ...fullSummary.bodyweight!, rate_per_week: null, goal: null },
    };
    const data = adaptDashboard(noGoals, profile());
    if (!data.lifting.present) throw new Error("lifting absent");
    if (!data.steps.present) throw new Error("steps absent");
    if (!data.nutrition.present) throw new Error("nutrition absent");
    if (!data.bodyweight.present) throw new Error("bodyweight absent");

    expect(data.lifting.headline1rm).toBeNull();
    expect(data.steps.goal).toBeNull();
    expect(data.nutrition.goals).toBeNull();
    expect(data.bodyweight.ratePerWeek).toBeNull();
    expect(data.bodyweight.goal).toBeNull();
  });

  it("distinguishes a present-but-zero steps goal from no goal", () => {
    const zeroGoal: DashboardSummary = {
      ...fullSummary,
      steps: { ...fullSummary.steps!, goal: 0 },
    };
    const data = adaptDashboard(zeroGoal, profile());
    if (!data.steps.present) throw new Error("steps absent");
    expect(data.steps.goal).toBe(0);
  });
});

describe("adaptDashboard — sanitization", () => {
  it("never emits NaN/Infinity in spark series", () => {
    const dirty: DashboardSummary = {
      ...fullSummary,
      running: {
        ...fullSummary.running!,
        weekly_distance_spark: [Number.NaN, Number.POSITIVE_INFINITY, 1000],
      },
      lifting: { ...fullSummary.lifting!, weekly_volume_spark: [Number.NaN, 5] },
      steps: { ...fullSummary.steps!, daily_spark: [Number.NaN, 100] },
      bodyweight: { ...fullSummary.bodyweight!, trend_spark: [Number.POSITIVE_INFINITY, 80] },
    };
    const data = adaptDashboard(dirty, profile({ distance_unit: "km" }));
    if (!data.running.present) throw new Error("running absent");
    if (!data.lifting.present) throw new Error("lifting absent");
    if (!data.steps.present) throw new Error("steps absent");
    if (!data.bodyweight.present) throw new Error("bodyweight absent");

    for (const series of [
      data.running.spark.points,
      data.lifting.spark,
      data.steps.spark,
      data.bodyweight.spark,
    ]) {
      for (const n of series) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
    expect(data.running.spark.points[0]).toBe(0);
    expect(data.lifting.spark[0]).toBe(0);
  });
});
