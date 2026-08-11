import { describe, expect, it } from "vitest";
import type {
  DashboardRecovery,
  DashboardRecoveryBaseline,
  DashboardRecoveryBaselineTrend,
  DashboardRecoveryHrv,
  DashboardRunning,
  DashboardSleepNight,
  DashboardSummary,
  ResolvedProfile,
} from "@/lib/api";
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

function minimalRunning(overrides: Partial<DashboardRunning> = {}): DashboardRunning {
  return {
    current_week: {
      distance_meters: 5000,
      run_count: 1,
      delta_pct_vs_prior_week: null,
      duration_seconds: 1800,
      avg_pace_sec_per_km: 360,
      avg_heart_rate_bpm: null,
      elevation_gain_meters: null,
      heart_rate_runs: 0,
      elevation_runs: 0,
      longest_run_meters: 5000,
      days_run: 1,
    },
    baseline: null,
    recent_avg_pace_sec_per_km: null,
    latest_run: null,
    week_runs: [],
    weekly_load: [],
    ...overrides,
  };
}

const fullSummary: DashboardSummary = {
  sections: [
    {
      id: "s1",
      title: "",
      collapsed: false,
      tile_ids: ["running", "lifting", "steps", "nutrition", "bodyweight", "streak"],
    },
  ],
  running: {
    current_week: {
      distance_meters: 34278,
      run_count: 4,
      delta_pct_vs_prior_week: 10.9,
      duration_seconds: 12977,
      avg_pace_sec_per_km: 378.6,
      avg_heart_rate_bpm: 153,
      elevation_gain_meters: 274,
      heart_rate_runs: 3,
      elevation_runs: 3,
      longest_run_meters: 20438,
      days_run: 4,
    },
    baseline: {
      window_weeks: 4,
      weeks: 3,
      distance_meters: 27358,
      duration_seconds: 10440,
      avg_pace_sec_per_km: 381.2,
      avg_heart_rate_bpm: 150,
      elevation_gain_meters: 198,
      runs_per_week: 3.75,
    },
    recent_avg_pace_sec_per_km: 376.5,
    latest_run: {
      name: "Saturday long run",
      distance_meters: 20438,
      duration_seconds: 7784,
      start_time: "2026-08-01T11:02:00Z",
    },
    week_runs: [
      {
        activity_id: "a1",
        name: "Easy shakeout",
        start_time: "2026-07-27T11:00:00Z",
        local_date: "2026-07-27",
        distance_meters: 5633,
        duration_seconds: 2128,
        avg_pace_sec_per_km: 377.8,
        avg_heart_rate_bpm: 148,
        heart_rate_zone: 2,
        elevation_gain_meters: 38,
        environment: "outdoor",
      },
      {
        activity_id: "a2",
        name: null,
        start_time: "2026-07-28T10:30:00Z",
        local_date: "2026-07-28",
        distance_meters: 4184,
        duration_seconds: 1490,
        avg_pace_sec_per_km: 356.1,
        avg_heart_rate_bpm: 152,
        heart_rate_zone: null,
        elevation_gain_meters: null,
        environment: "indoor",
      },
    ],
    weekly_load: [
      {
        week_start: "2026-07-20",
        distance_meters: 30900,
        duration_seconds: 11760,
        run_count: 4,
        elevation_gain_meters: 231,
      },
      {
        week_start: "2026-07-27",
        distance_meters: 34278,
        duration_seconds: 12977,
        run_count: 4,
        elevation_gain_meters: null,
      },
    ],
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

    // 34278 m / 1609.344 = 21.3 mi
    expect(data.running.currentWeek.distance).toBe("21.3");
    expect(data.running.currentWeek.runCount).toBe(4);
    expect(data.running.currentWeek.deltaPct).toBe(10.9);
    // Week aggregate: 378.6 s/km → 10:09 per mile. 30-day: 376.5 → 10:06.
    expect(data.running.currentWeek.pace).toBe("10:09");
    expect(data.running.pace).toBe("10:06");
    // 274 m → 899 ft, with coverage counts passed through.
    expect(data.running.currentWeek.elevation).toBe("899 ft");
    expect(data.running.currentWeek.heartRateRuns).toBe(3);
    expect(data.running.currentWeek.elevationRuns).toBe(3);
    expect(data.running.currentWeek.longestRun).toBe("12.7");
    expect(data.running.currentWeek.daysRun).toBe(4);
    // Baseline converted once, raw sec/km retained for comparisons.
    expect(data.running.baseline?.distance).toBe("17.0");
    expect(data.running.baseline?.pace).toBe("10:13");
    expect(data.running.baseline?.paceSecPerKm).toBe(381.2);
    expect(data.running.baseline?.weeks).toBe(3);
    expect(data.running.baseline?.avgHeartRate).toBe(150);
    expect(data.running.baseline?.elevation).toBe("650 ft");
    expect(data.running.baseline?.runsPerWeek).toBe(3.75);
    expect(data.running.baseline?.durationSeconds).toBe(10440);
    // Week runs oldest→newest; nulls preserved (never coerced to 0).
    expect(data.running.weekRuns).toHaveLength(2);
    expect(data.running.weekRuns[0].distance).toBe("3.5");
    expect(data.running.weekRuns[0].heartRateZone).toBe(2);
    expect(data.running.weekRuns[1].indoor).toBe(true);
    expect(data.running.weekRuns[1].elevation).toBeNull();
    expect(data.running.weekRuns[1].avgHeartRate).toBe(152);
    // Weekly load in display units for charting.
    expect(data.running.weeklyLoad).toHaveLength(2);
    expect(data.running.weeklyLoad[0].distance).toBeCloseTo(19.2, 1);
    expect(data.running.weeklyLoad[1].runCount).toBe(4);
    expect(data.running.unit).toBe("mi");
  });

  it("no longer reads weekly_distance_spark from the running section", () => {
    // The deployed API still emits the legacy field during expand/contract;
    // the adapter must ignore it (and must not throw on its absence either).
    const withLegacy = {
      ...fullSummary,
      running: {
        ...fullSummary.running!,
        weekly_distance_spark: [1, 2, 3],
      },
    };
    const data = adaptDashboard(withLegacy, profile({ distance_unit: "mi" }));
    if (!data.running.present) throw new Error("running absent");
    expect("spark" in data.running).toBe(false);
  });

  it("converts running to km for a km profile", () => {
    const data = adaptDashboard(fullSummary, profile({ distance_unit: "km" }));
    if (!data.running.present) throw new Error("running absent");
    expect(data.running.currentWeek.distance).toBe("34.3");
    expect(data.running.currentWeek.pace).toBe("6:19");
    expect(data.running.currentWeek.elevation).toBe("274 m");
    expect(data.running.weekRuns[0].distance).toBe("5.6");
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
      sections: [
        {
          id: "s1",
          title: "",
          collapsed: false,
          tile_ids: [
            "running",
            "lifting",
            "steps",
            "nutrition",
            "bodyweight",
            "recovery",
            "streak",
          ],
        },
      ],
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
    expect(data.recovery).toEqual({ present: false });
  });

  it("collapses a null summary to all-empty sections and a brand-new streak", () => {
    const data = adaptDashboard(null, profile());
    expect(data.running).toEqual({ present: false });
    expect(data.lifting).toEqual({ present: false });
    expect(data.steps).toEqual({ present: false });
    expect(data.nutrition).toEqual({ present: false });
    expect(data.bodyweight).toEqual({ present: false });
    expect(data.recovery).toEqual({ present: false });
    expect(data.streak).toEqual({ weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true });
  });
});

const EMPTY_BASELINE: DashboardRecoveryBaseline = {
  window_days: 30,
  resting_hr_avg: null,
  resting_hr_days: 0,
  hrv_avg: null,
  hrv_std_dev: null,
  hrv_days: 0,
  recovery_score_avg: null,
  recovery_score_days: 0,
};

const UNKNOWN_HRV: DashboardRecoveryHrv = {
  status: "unknown",
  balanced_low: null,
  balanced_high: null,
  z_score: null,
  trend: "unknown",
  short_avg: null,
};

const UNKNOWN_BASELINE_TREND: DashboardRecoveryBaselineTrend = {
  direction: "unknown",
  delta_ms: null,
  from_avg: null,
  over_days: 28,
};

function recoveryBlock(over: Partial<DashboardRecovery>): DashboardRecovery {
  return {
    today: null,
    resting_hr_spark: [],
    days: [],
    baseline: EMPTY_BASELINE,
    hrv: UNKNOWN_HRV,
    baseline_trend: UNKNOWN_BASELINE_TREND,
    ...over,
  };
}

describe("adaptDashboard — recovery (Whoop)", () => {
  it("marks a null recovery section as not present (unconnected user)", () => {
    const data = adaptDashboard(fullSummary, profile());
    expect(data.recovery).toEqual({ present: false });
  });

  it("maps a recovery block's resting HR, score, and spark", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        today: {
          date: "2026-07-22",
          resting_heart_rate: 52,
          recovery_score: 78,
          hrv_rmssd_milli: 64.5,
        },
        resting_hr_spark: [55, 54, 53, 52, 52, 51, 52],
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");

    expect(data.recovery.restingToday).toBe(52);
    expect(data.recovery.recoveryScore).toBe(78);
    expect(data.recovery.spark).toEqual([55, 54, 53, 52, 52, 51, 52]);
  });

  it("keeps recovery present with null fields when Whoop has no reading yet today", () => {
    const noReading: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({ today: null, resting_hr_spark: [55, 54] }),
    };
    const data = adaptDashboard(noReading, profile());
    if (!data.recovery.present) throw new Error("recovery absent");

    expect(data.recovery.restingToday).toBeNull();
    expect(data.recovery.recoveryScore).toBeNull();
    expect(data.recovery.spark).toEqual([55, 54]);
  });

  it("sanitizes NaN/Infinity out of the resting-HR spark", () => {
    const dirty: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        today: {
          date: "2026-07-22",
          resting_heart_rate: 52,
          recovery_score: null,
          hrv_rmssd_milli: null,
        },
        resting_hr_spark: [Number.NaN, Number.POSITIVE_INFINITY, 52],
      }),
    };
    const data = adaptDashboard(dirty, profile());
    if (!data.recovery.present) throw new Error("recovery absent");
    for (const n of data.recovery.spark) {
      expect(Number.isFinite(n)).toBe(true);
    }
    expect(data.recovery.spark).toEqual([0, 0, 52]);
  });

  it("surfaces today's HRV (previously dropped by the adapter)", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        today: {
          date: "2026-07-02",
          resting_heart_rate: 52,
          recovery_score: 78,
          hrv_rmssd_milli: 91,
        },
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");
    expect(data.recovery.hrvToday).toBe(91);
  });

  it("preserves nulls in the days series (never zero-fills)", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        days: [
          {
            date: "2026-07-01",
            resting_heart_rate: null,
            recovery_score: null,
            hrv_rmssd_milli: null,
            baseline_avg: null,
            balanced_low: null,
            balanced_high: null,
            z_score: null,
            status: "unknown",
          },
          {
            date: "2026-07-02",
            resting_heart_rate: 52,
            recovery_score: 78,
            hrv_rmssd_milli: 91,
            baseline_avg: null,
            balanced_low: null,
            balanced_high: null,
            z_score: null,
            status: "unknown",
          },
        ],
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");
    expect(data.recovery.days![0]).toEqual({
      date: "2026-07-01",
      restingHr: null,
      recoveryScore: null,
      hrv: null,
      baselineAvg: null,
      balancedLow: null,
      balancedHigh: null,
      zScore: null,
      status: "unknown",
    });
    expect(data.recovery.days![1].hrv).toBe(91);
  });

  it("passes baseline and hrv figures through unchanged", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        baseline: {
          window_days: 30,
          resting_hr_avg: 52.4,
          resting_hr_days: 27,
          hrv_avg: 91.2,
          hrv_std_dev: 12.6,
          hrv_days: 26,
          recovery_score_avg: 68.1,
          recovery_score_days: 27,
        },
        hrv: {
          status: "suppressed",
          balanced_low: 78.6,
          balanced_high: 103.8,
          z_score: -1.37,
          trend: "falling",
          short_avg: 82.3,
        },
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");
    expect(data.recovery.baseline!.hrvAvg).toBe(91.2);
    expect(data.recovery.baseline!.hrvDays).toBe(26);
    expect(data.recovery.hrv!.status).toBe("suppressed");
    expect(data.recovery.hrv!.balancedLow).toBe(78.6);
    expect(data.recovery.hrv!.zScore).toBe(-1.37);
    expect(data.recovery.hrv!.trend).toBe("falling");
  });

  it('maps an unknown status/trend string to "unknown" (forward-compat)', () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        hrv: { ...UNKNOWN_HRV, status: "sideways", trend: "wobbling" },
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");
    expect(data.recovery.hrv!.status).toBe("unknown");
    expect(data.recovery.hrv!.trend).toBe("unknown");
  });

  it("passes per-day bands and the baseline trend straight through", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        days: [
          {
            date: "2026-08-09",
            resting_heart_rate: 59,
            recovery_score: 61,
            hrv_rmssd_milli: 77.4,
            baseline_avg: 88.2,
            balanced_low: 68.1,
            balanced_high: 108.3,
            z_score: -0.53,
            status: "balanced",
          },
        ],
        baseline_trend: {
          direction: "rising",
          delta_ms: 6.4,
          from_avg: 81.8,
          over_days: 28,
        },
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");

    expect(data.recovery.days![0]).toEqual({
      date: "2026-08-09",
      restingHr: 59,
      recoveryScore: 61,
      hrv: 77.4,
      baselineAvg: 88.2,
      balancedLow: 68.1,
      balancedHigh: 108.3,
      zScore: -0.53,
      status: "balanced",
    });
    expect(data.recovery.baselineTrend).toEqual({
      direction: "rising",
      deltaMs: 6.4,
      fromAvg: 81.8,
      overDays: 28,
    });
  });

  it("narrows unrecognised day status and drift direction to unknown", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        days: [
          {
            date: "2026-08-09",
            resting_heart_rate: 59,
            recovery_score: 61,
            hrv_rmssd_milli: 77.4,
            baseline_avg: null,
            balanced_low: null,
            balanced_high: null,
            z_score: null,
            status: "sideways",
          },
        ],
        baseline_trend: {
          direction: "sideways",
          delta_ms: null,
          from_avg: null,
          over_days: 28,
        },
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");

    expect(data.recovery.days![0].status).toBe("unknown");
    expect(data.recovery.baselineTrend!.direction).toBe("unknown");
  });

  it("carries a band that begins part-way across the series", () => {
    const withRecovery: DashboardSummary = {
      ...fullSummary,
      recovery: recoveryBlock({
        days: [
          {
            date: "2026-08-08",
            resting_heart_rate: 57,
            recovery_score: 66,
            hrv_rmssd_milli: 84.1,
            baseline_avg: null,
            balanced_low: null,
            balanced_high: null,
            z_score: null,
            status: "unknown",
          },
          {
            date: "2026-08-09",
            resting_heart_rate: 59,
            recovery_score: 61,
            hrv_rmssd_milli: 77.4,
            baseline_avg: 88.2,
            balanced_low: 68.1,
            balanced_high: 108.3,
            z_score: -0.53,
            status: "balanced",
          },
        ],
      }),
    };
    const data = adaptDashboard(withRecovery, profile());
    if (!data.recovery.present) throw new Error("recovery absent");

    // Day one is still calibrating: metrics present, band not yet earned.
    expect(data.recovery.days![0]).toEqual({
      date: "2026-08-08",
      restingHr: 57,
      recoveryScore: 66,
      hrv: 84.1,
      baselineAvg: null,
      balancedLow: null,
      balancedHigh: null,
      zScore: null,
      status: "unknown",
    });
    expect(data.recovery.days![1]).toEqual({
      date: "2026-08-09",
      restingHr: 59,
      recoveryScore: 61,
      hrv: 77.4,
      baselineAvg: 88.2,
      balancedLow: 68.1,
      balancedHigh: 108.3,
      zScore: -0.53,
      status: "balanced",
    });
  });
});

/** A night with every metric absent — the shape of a date in the window that
 *  has no record at all. Overrides fill in the ones a case cares about. */
function sleepNight(over: Partial<DashboardSleepNight> = {}): DashboardSleepNight {
  return {
    date: "2026-08-10",
    in_bed_milli: null,
    awake_milli: null,
    no_data_milli: null,
    light_sleep_milli: null,
    slow_wave_sleep_milli: null,
    rem_sleep_milli: null,
    sleep_cycle_count: null,
    disturbance_count: null,
    need_baseline_milli: null,
    need_from_sleep_debt_milli: null,
    need_from_strain_milli: null,
    need_from_nap_milli: null,
    respiratory_rate: null,
    performance_pct: null,
    consistency_pct: null,
    efficiency_pct: null,
    ...over,
  };
}

describe("adaptDashboard — sleep (Whoop)", () => {
  it("marks an absent sleep section as not present (tile not in the layout)", () => {
    const data = adaptDashboard(fullSummary, profile());
    expect(data.sleep).toEqual({ present: false });
  });

  it("marks a null sleep section as not present (unconnected user)", () => {
    const data = adaptDashboard({ ...fullSummary, sleep: null }, profile());
    expect(data.sleep).toEqual({ present: false });
  });

  it("collapses a null summary's sleep to not present", () => {
    expect(adaptDashboard(null, profile()).sleep).toEqual({ present: false });
  });

  it("renames last night's figures without converting or re-deriving them", () => {
    const data = adaptDashboard(
      {
        ...fullSummary,
        sleep: {
          last_night: sleepNight({
            date: "2026-08-11",
            in_bed_milli: 27_720_000,
            awake_milli: 1_800_000,
            no_data_milli: 0,
            light_sleep_milli: 12_600_000,
            slow_wave_sleep_milli: 7_020_000,
            rem_sleep_milli: 6_300_000,
            sleep_cycle_count: 5,
            disturbance_count: 9,
            need_baseline_milli: 28_800_000,
            need_from_sleep_debt_milli: 1_200_000,
            need_from_strain_milli: 900_000,
            need_from_nap_milli: -600_000,
            respiratory_rate: 14.7,
            performance_pct: 88,
            consistency_pct: 74,
            efficiency_pct: 93.5,
          }),
          nights: [],
        },
      },
      profile(),
    );
    if (!data.sleep.present) throw new Error("sleep absent");

    // Milliseconds stay milliseconds: the tile formats, the adapter does not.
    expect(data.sleep.lastNight).toEqual({
      date: "2026-08-11",
      inBedMilli: 27_720_000,
      awakeMilli: 1_800_000,
      noDataMilli: 0,
      lightSleepMilli: 12_600_000,
      slowWaveSleepMilli: 7_020_000,
      remSleepMilli: 6_300_000,
      sleepCycleCount: 5,
      disturbanceCount: 9,
      needBaselineMilli: 28_800_000,
      needFromSleepDebtMilli: 1_200_000,
      needFromStrainMilli: 900_000,
      // A nap DISCHARGES need, so this component is legitimately negative and
      // must survive the adapter with its sign.
      needFromNapMilli: -600_000,
      respiratoryRate: 14.7,
      performancePct: 88,
      consistencyPct: 74,
      efficiencyPct: 93.5,
    });
  });

  it("keeps a null last_night null rather than promoting a night out of the window", () => {
    const data = adaptDashboard(
      {
        ...fullSummary,
        sleep: { last_night: null, nights: [sleepNight({ date: "2026-08-09" })] },
      },
      profile(),
    );
    if (!data.sleep.present) throw new Error("sleep absent");
    expect(data.sleep.lastNight).toBeNull();
    expect(data.sleep.nights).toHaveLength(1);
  });

  it("keeps the nights window oldest→newest with its gaps as null-metric entries", () => {
    const data = adaptDashboard(
      {
        ...fullSummary,
        sleep: {
          last_night: null,
          nights: [
            sleepNight({ date: "2026-08-09", in_bed_milli: 25_200_000, performance_pct: 71 }),
            // An interior gap: the date is present, its metrics are null. A
            // night with no data and a night of zero sleep are different facts.
            sleepNight({ date: "2026-08-10" }),
            sleepNight({ date: "2026-08-11", in_bed_milli: 28_800_000, performance_pct: 90 }),
          ],
        },
      },
      profile(),
    );
    if (!data.sleep.present) throw new Error("sleep absent");

    expect(data.sleep.nights.map((n) => n.date)).toEqual([
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
    ]);
    expect(data.sleep.nights[1].inBedMilli).toBeNull();
    expect(data.sleep.nights[1].performancePct).toBeNull();
    // Never coerced to 0 — that would read as "slept nothing".
    expect(data.sleep.nights[1].inBedMilli).not.toBe(0);
    expect(data.sleep.nights[2].inBedMilli).toBe(28_800_000);
  });
});

describe("adaptDashboard — null goals / deltas", () => {
  it("preserves null pace, null delta, and null latest run", () => {
    const sparse: DashboardSummary = {
      ...fullSummary,
      running: minimalRunning(),
    };
    const data = adaptDashboard(sparse, profile({ distance_unit: "km" }));
    if (!data.running.present) throw new Error("running absent");

    expect(data.running.currentWeek.deltaPct).toBeNull();
    expect(data.running.pace).toBe("—");
    expect(data.running.latestRun).toBeNull();
    expect(data.running.baseline).toBeNull();
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
    // sanitizeSpark now only backs the endurance (walking/cycling/hiking)
    // widgets — running no longer reads a spark, so this pins the walking
    // spark instead.
    const dirty: DashboardSummary = {
      ...fullSummary,
      walking: {
        current_week: { distance_meters: 3218.688, session_count: 5, duration_seconds: 2400 },
        latest_session: null,
        weekly_distance_spark: [Number.NaN, Number.POSITIVE_INFINITY, 1000],
      },
      lifting: { ...fullSummary.lifting!, weekly_volume_spark: [Number.NaN, 5] },
      steps: { ...fullSummary.steps!, daily_spark: [Number.NaN, 100] },
      bodyweight: { ...fullSummary.bodyweight!, trend_spark: [Number.POSITIVE_INFINITY, 80] },
    };
    const data = adaptDashboard(dirty, profile({ distance_unit: "km" }));
    if (!data.walking.present) throw new Error("walking absent");
    if (!data.lifting.present) throw new Error("lifting absent");
    if (!data.steps.present) throw new Error("steps absent");
    if (!data.bodyweight.present) throw new Error("bodyweight absent");

    for (const series of [
      data.walking.spark.points,
      data.lifting.spark,
      data.steps.spark,
      data.bodyweight.spark,
    ]) {
      for (const n of series) {
        expect(Number.isFinite(n)).toBe(true);
      }
    }
    expect(data.walking.spark.points[0]).toBe(0);
    expect(data.lifting.spark[0]).toBe(0);
  });
});

describe("adaptDashboard — layout-aware sections", () => {
  const hikingBlock = {
    current_week: { distance_meters: 16093.44, session_count: 2, duration_seconds: 7200 },
    latest_session: {
      name: "Ridge Loop",
      distance_meters: 8046.72,
      duration_seconds: 3600,
      start_time: "2026-07-20T15:00:00Z",
    },
    weekly_distance_spark: [0.0, 8046.72, 16093.44],
    elevation_gain_meters: 610.0,
  };

  it("carries sections, adapts present tiles, and marks absent/null tiles not present", () => {
    const summary: DashboardSummary = {
      sections: [
        {
          id: "s1",
          title: "",
          collapsed: false,
          tile_ids: ["running", "hiking", "steps", "streak"],
        },
      ],
      hiking: hikingBlock,
      steps: null,
      streak: {
        weeks: 4,
        active_days_this_week: 2,
        week: [true, true, false, false, false, false, false],
      },
    };
    const data = adaptDashboard(summary, profile({ distance_unit: "mi" }));

    expect(data.sections).toEqual([
      { id: "s1", title: "", collapsed: false, tile_ids: ["running", "hiking", "steps", "streak"] },
    ]);

    // hiking present, distance converted to miles (16093.44 / 1609.344 = 10.0)
    expect(data.hiking.present).toBe(true);
    if (!data.hiking.present) throw new Error("hiking absent");
    expect(data.hiking.currentWeek.distance).toBe("10.0");

    // enabled-but-null → not present
    expect(data.steps.present).toBe(false);
    // absent key → not present
    expect(data.running.present).toBe(false);
    expect(data.walking.present).toBe(false);
    expect(data.cycling.present).toBe(false);
  });

  it("repairs a layout naming the retired recovery_trend tile", () => {
    // The API drops retired ids on read, but the two repos deploy separately —
    // this client must not depend on the API having caught up. The retired tile
    // becomes the tile that absorbed it, in the slot it already occupied.
    const summary: DashboardSummary = {
      sections: [
        { id: "s1", title: "", collapsed: false, tile_ids: ["recovery_trend", "steps"] },
      ] as DashboardSummary["sections"],
    };
    const data = adaptDashboard(summary, profile({ distance_unit: "mi" }));
    expect(data.sections[0].tile_ids).toEqual(["hrv_balance", "steps"]);
  });

  it("keeps one tile when a layout holds both the retired id and its replacement", () => {
    // Resolving the retired id can collide with a tile the layout already has,
    // and the same tile twice would render twice and desync on remove.
    const summary: DashboardSummary = {
      sections: [
        { id: "s1", title: "", collapsed: false, tile_ids: ["hrv_balance"] },
        { id: "s2", title: "", collapsed: false, tile_ids: ["recovery_trend", "unknown_tile"] },
      ] as DashboardSummary["sections"],
    };
    const data = adaptDashboard(summary, profile({ distance_unit: "mi" }));
    expect(data.sections[0].tile_ids).toEqual(["hrv_balance"]);
    expect(data.sections[1].tile_ids).toEqual([]);
  });

  it("converts hiking distances per unit and passes elevation gain through", () => {
    const summary: DashboardSummary = {
      sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["hiking"] }],
      hiking: hikingBlock,
    };

    const mi = adaptDashboard(summary, profile({ distance_unit: "mi" }));
    if (!mi.hiking.present) throw new Error("hiking absent");
    expect(mi.hiking.currentWeek.distance).toBe("10.0"); // 16093.44 / 1609.344
    expect(mi.hiking.unit).toBe("mi");
    expect(mi.hiking.spark.unit).toBe("mi");
    expect(mi.hiking.spark.points[2]).toBeCloseTo(10.0, 5);
    expect(mi.hiking.latest?.distance).toBe("5.0"); // 8046.72 / 1609.344
    expect(mi.hiking.durationSeconds).toBe(7200);
    expect(mi.hiking.currentWeek.sessionCount).toBe(2);
    expect(mi.hiking.elevationGainMeters).toBe(610.0);

    const km = adaptDashboard(summary, profile({ distance_unit: "km" }));
    if (!km.hiking.present) throw new Error("hiking absent");
    expect(km.hiking.currentWeek.distance).toBe("16.1"); // 16093.44 / 1000
    expect(km.hiking.spark.points[2]).toBeCloseTo(16.09344, 5);
    expect(km.hiking.elevationGainMeters).toBe(610.0);
  });

  it("adapts walking and cycling endurance tiles", () => {
    const summary: DashboardSummary = {
      sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["walking", "cycling"] }],
      walking: {
        current_week: { distance_meters: 3218.688, session_count: 5, duration_seconds: 2400 },
        latest_session: null,
        weekly_distance_spark: [1000, 2000],
      },
      cycling: {
        current_week: { distance_meters: 32186.88, session_count: 1, duration_seconds: 3600 },
        latest_session: null,
        weekly_distance_spark: [0, 32186.88],
      },
    };
    const data = adaptDashboard(summary, profile({ distance_unit: "mi" }));

    if (!data.walking.present) throw new Error("walking absent");
    if (!data.cycling.present) throw new Error("cycling absent");
    expect(data.walking.currentWeek.distance).toBe("2.0"); // 3218.688 / 1609.344
    expect(data.walking.currentWeek.sessionCount).toBe(5);
    expect(data.walking.latest).toBeNull();
    expect(data.cycling.currentWeek.distance).toBe("20.0"); // 32186.88 / 1609.344
    expect(data.cycling.durationSeconds).toBe(3600);
  });

  it("collapses a null summary to no sections and a brand-new streak", () => {
    const data = adaptDashboard(null, profile());
    expect(data.sections).toEqual([]);
    expect(data.running).toEqual({ present: false });
    expect(data.walking).toEqual({ present: false });
    expect(data.cycling).toEqual({ present: false });
    expect(data.hiking).toEqual({ present: false });
    expect(data.lifting).toEqual({ present: false });
    expect(data.steps).toEqual({ present: false });
    expect(data.nutrition).toEqual({ present: false });
    expect(data.bodyweight).toEqual({ present: false });
    expect(data.recovery).toEqual({ present: false });
    expect(data.quote).toEqual({ present: false });
    expect(data.streak.isNew).toBe(true);
  });

  it("falls back to a brand-new streak when the streak tile is absent", () => {
    const data = adaptDashboard(
      { sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["running"] }] },
      profile(),
    );
    expect(data.streak).toEqual({ weeks: 0, activeDaysThisWeek: 0, week: [], isNew: true });
  });

  it("marks the quote absent when the tile is not in the layout", () => {
    const data = adaptDashboard(
      { sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["running"] }] },
      profile(),
    );
    expect(data.quote).toEqual({ present: false });
  });

  it("passes the quote through, keeping the offset for the reroll button", () => {
    const data = adaptDashboard(
      {
        sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["quote"] }],
        quote: {
          id: "camus-invincible-summer",
          text: "In the depth of winter, I finally learned that within me there lay an invincible summer.",
          author: "Albert Camus",
          source: "Return to Tipasa",
          offset: 0,
        },
      },
      profile(),
    );
    expect(data.quote).toEqual({
      present: true,
      id: "camus-invincible-summer",
      text: "In the depth of winter, I finally learned that within me there lay an invincible summer.",
      author: "Albert Camus",
      source: "Return to Tipasa",
      offset: 0,
    });
  });

  it("maps the wikipedia links across the snake_case boundary", () => {
    const data = adaptDashboard(
      {
        sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["quote"] }],
        quote: {
          id: "coelho-dream-come-true",
          text: "It's the possibility of having a dream come true that makes life interesting.",
          author: "Paulo Coelho",
          author_url: "https://en.wikipedia.org/wiki/Paulo_Coelho",
          source: "The Alchemist",
          source_url: "https://en.wikipedia.org/wiki/The_Alchemist_(novel)",
          offset: 0,
        },
      },
      profile(),
    );
    if (!data.quote.present) throw new Error("quote absent");
    expect(data.quote.authorUrl).toBe("https://en.wikipedia.org/wiki/Paulo_Coelho");
    expect(data.quote.sourceUrl).toBe("https://en.wikipedia.org/wiki/The_Alchemist_(novel)");
  });

  it("leaves the links undefined when the corpus has no article", () => {
    const data = adaptDashboard(
      {
        sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["quote"] }],
        quote: {
          id: "camus-invincible-summer",
          text: "In the depth of winter, I finally learned that within me there lay an invincible summer.",
          author: "Albert Camus",
          author_url: "https://en.wikipedia.org/wiki/Albert_Camus",
          source: "Return to Tipasa",
          offset: 0,
        },
      },
      profile(),
    );
    if (!data.quote.present) throw new Error("quote absent");
    expect(data.quote.authorUrl).toBe("https://en.wikipedia.org/wiki/Albert_Camus");
    expect(data.quote.sourceUrl).toBeUndefined();
  });

  it("leaves source undefined for an unverified attribution", () => {
    const data = adaptDashboard(
      {
        sections: [{ id: "s1", title: "", collapsed: false, tile_ids: ["quote"] }],
        quote: {
          id: "sinatra-best-revenge",
          text: "The best revenge is massive success.",
          author: "Frank Sinatra",
          offset: 3,
        },
      },
      profile(),
    );
    if (!data.quote.present) throw new Error("quote absent");
    expect(data.quote.source).toBeUndefined();
    expect(data.quote.offset).toBe(3);
  });
});
