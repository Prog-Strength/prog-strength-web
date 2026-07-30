/// <reference types="vitest/globals" />

import { deriveOverviewStats, formatHm, type OverviewStats } from "./activities-overview-stats";
import type { RunningSession, StepsEntry, Workout } from "./api";

const METERS_PER_MILE = 1609.344;

// "Today" for every fixture — a real local Date, pinned for determinism.
const NOW = new Date(2026, 5, 22, 12, 0, 0); // 2026-06-22 (local)

// --- builders --------------------------------------------------------------

let seq = 0;
const id = () => `id-${seq++}`;

/** A completed lifting session spanning `minutes` from a local `date`. */
function workout(date: string, minutes: number, ended = true): Workout {
  const start = new Date(`${date}T08:00:00`);
  const end = new Date(start.getTime() + minutes * 60_000);
  return {
    id: id(),
    user_id: "u",
    performed_at: start.toISOString(),
    ended_at: ended ? end.toISOString() : null,
    exercises: [],
    created_at: start.toISOString(),
    updated_at: start.toISOString(),
    personal_records_set: [],
  };
}

/** A running session. Pass `avg_pace_sec_per_km: null` for a manual run. */
function run(
  date: string,
  opts: Partial<RunningSession> & { distance_meters: number; duration_seconds: number },
): RunningSession {
  return {
    id: id(),
    activity_type: "running",
    ingest_source: "garmin_api",
    source_activity_id: id(),
    name: null,
    start_time: new Date(`${date}T07:00:00`).toISOString(),
    raw_distance_meters: opts.distance_meters,
    environment: "outdoor",
    avg_pace_sec_per_km: null,
    best_pace_sec_per_km: null,
    avg_heart_rate_bpm: null,
    max_heart_rate_bpm: null,
    total_calories: null,
    elevation_gain_meters: null,
    elevation_loss_meters: null,
    elevation_high_meters: null,
    elevation_low_meters: null,
    created_at: new Date(`${date}T07:00:00`).toISOString(),
    ...opts,
  };
}

function step(date: string, steps: number): StepsEntry {
  return { id: id(), date, steps, created_at: date, updated_at: date };
}

function derive(args: Partial<Parameters<typeof deriveOverviewStats>[0]>): OverviewStats {
  return deriveOverviewStats({
    workouts: [],
    sessions: [],
    steps: [],
    days: 90,
    now: NOW,
    ...args,
  });
}

beforeEach(() => {
  seq = 0;
});

// --- headline + discipline split ------------------------------------------

describe("headline + discipline split", () => {
  it("sums completed lifting + running time and counts sessions", () => {
    const s = derive({
      workouts: [workout("2026-06-10", 60), workout("2026-06-12", 30, false)], // 2nd in-progress
      sessions: [run("2026-06-11", { distance_meters: 5000, duration_seconds: 1500 })],
    });
    // Only the completed workout (60m = 3600s) + the run (1500s) count.
    expect(s.headline.totalActiveSeconds).toBe(3600 + 1500);
    expect(s.headline.workoutCount).toBe(2);
    expect(s.headline.runCount).toBe(1);
    expect(s.headline.sessionCount).toBe(3);
    expect(s.headline.avgSessionSeconds).toBeCloseTo((3600 + 1500) / 3);
  });

  it("degrades to 100/0 for a single-modality (lifting-only) window", () => {
    const s = derive({ workouts: [workout("2026-06-10", 60)] });
    expect(s.disciplineSplit.liftPct).toBe(100);
    expect(s.disciplineSplit.runPct).toBe(0);
    expect(s.disciplineSplit.runSeconds).toBe(0);
  });

  it("degrades to 0/100 for a running-only window", () => {
    const s = derive({
      sessions: [run("2026-06-10", { distance_meters: 5000, duration_seconds: 1500 })],
    });
    expect(s.disciplineSplit.runPct).toBe(100);
    expect(s.disciplineSplit.liftPct).toBe(0);
  });

  it("is 0/0 (not NaN) for an empty window", () => {
    const s = derive({});
    expect(s.disciplineSplit.liftPct).toBe(0);
    expect(s.disciplineSplit.runPct).toBe(0);
    expect(s.headline.avgSessionSeconds).toBe(0);
  });
});

// --- avg / best pace -------------------------------------------------------

describe("avg run pace", () => {
  it("is distance-weighted over only pace-carrying runs", () => {
    const s = derive({
      sessions: [
        run("2026-06-10", {
          distance_meters: 1000,
          duration_seconds: 360,
          avg_pace_sec_per_km: 360,
        }),
        run("2026-06-11", {
          distance_meters: 1000,
          duration_seconds: 300,
          avg_pace_sec_per_km: 300,
        }),
        // Manual run — excluded from both numerator and denominator.
        run("2026-06-12", {
          distance_meters: 5000,
          duration_seconds: 1800,
          avg_pace_sec_per_km: null,
        }),
      ],
    });
    const expected = ((360 + 300) / 2000) * METERS_PER_MILE;
    expect(s.avgRunPaceSecPerMi).toBeCloseTo(expected, 5);
  });

  it("is null when every run in the window is manual (pace-less)", () => {
    const s = derive({
      sessions: [
        run("2026-06-10", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_pace_sec_per_km: null,
        }),
        run("2026-06-11", {
          distance_meters: 6000,
          duration_seconds: 1800,
          avg_pace_sec_per_km: null,
        }),
      ],
    });
    expect(s.avgRunPaceSecPerMi).toBeNull();
  });

  it("reports the fastest best pace, null when none carry it", () => {
    const withBest = derive({
      sessions: [
        run("2026-06-10", {
          distance_meters: 1000,
          duration_seconds: 360,
          best_pace_sec_per_km: 300,
        }),
        run("2026-06-11", {
          distance_meters: 1000,
          duration_seconds: 360,
          best_pace_sec_per_km: 280,
        }),
      ],
    });
    expect(withBest.bestPaceSecPerMi).toBeCloseTo(280 * (METERS_PER_MILE / 1000), 5);

    const noBest = derive({
      sessions: [run("2026-06-10", { distance_meters: 1000, duration_seconds: 360 })],
    });
    expect(noBest.bestPaceSecPerMi).toBeNull();
  });
});

// --- weekly mileage / pace -------------------------------------------------

describe("weekly mileage / pace buckets", () => {
  it("leaves weeks with no run as gaps (null), not zeros", () => {
    const s = derive({
      days: 30,
      sessions: [
        run("2026-06-08", {
          distance_meters: 8000,
          duration_seconds: 2400,
          avg_pace_sec_per_km: 300,
        }),
        run("2026-06-22", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_pace_sec_per_km: 300,
        }),
      ],
    });
    const withRun = s.weekly.filter((w) => w.mileageMeters !== null);
    const gaps = s.weekly.filter((w) => w.mileageMeters === null);
    expect(withRun.length).toBe(2);
    // A 30-day window spans ~5 Mondays; the rest weeks must be gaps, not 0.
    expect(gaps.length).toBeGreaterThan(0);
    expect(s.weekly.every((w) => w.mileageMeters === null || w.mileageMeters > 0)).toBe(true);
  });

  it("holds at n = 1 (a single run in the window)", () => {
    const s = derive({
      days: 7,
      sessions: [
        run("2026-06-22", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_pace_sec_per_km: 300,
        }),
      ],
    });
    const active = s.weekly.filter((w) => w.mileageMeters !== null);
    expect(active.length).toBe(1);
    expect(active[0]!.mileageMeters).toBe(5000);
    expect(active[0]!.paceSecPerMi).toBeCloseTo((1500 / 5000) * METERS_PER_MILE, 5);
  });

  it("leaves a week's pace null when its only runs are manual", () => {
    const s = derive({
      days: 7,
      sessions: [
        run("2026-06-22", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_pace_sec_per_km: null,
        }),
      ],
    });
    const active = s.weekly.filter((w) => w.mileageMeters !== null);
    expect(active.length).toBe(1);
    expect(active[0]!.mileageMeters).toBe(5000); // mileage still counts
    expect(active[0]!.paceSecPerMi).toBeNull(); // but pace is a gap
  });
});

// --- consistency -----------------------------------------------------------

describe("consistency", () => {
  it("counts distinct active days and streaks across a rest gap", () => {
    // 14-day window ending 2026-06-22 (windowStart = 2026-06-09).
    // Active: Jun 9,10,11,12 (longest run = 4), gap, then Jun 20,21,22
    // (current streak = 3, ending today).
    const s = derive({
      days: 14,
      steps: [
        step("2026-06-09", 8000),
        step("2026-06-10", 8000),
        step("2026-06-11", 8000),
        step("2026-06-12", 8000),
        step("2026-06-20", 8000),
        step("2026-06-21", 8000),
        step("2026-06-22", 8000),
      ],
    });
    expect(s.consistency.totalDays).toBe(14);
    expect(s.consistency.daysActive).toBe(7);
    expect(s.consistency.longestStreak).toBe(4);
    expect(s.consistency.currentStreak).toBe(3);
  });

  it("reports current streak 0 when today is a rest day", () => {
    const s = derive({
      days: 14,
      steps: [step("2026-06-18", 8000), step("2026-06-19", 8000)],
    });
    expect(s.consistency.currentStreak).toBe(0);
    expect(s.consistency.daysActive).toBe(2);
  });

  it("counts a day active from any modality (workout / run / step)", () => {
    const s = derive({
      days: 7,
      workouts: [workout("2026-06-20", 60)],
      sessions: [run("2026-06-21", { distance_meters: 5000, duration_seconds: 1500 })],
      steps: [step("2026-06-22", 9000)],
    });
    expect(s.consistency.daysActive).toBe(3);
    expect(s.consistency.currentStreak).toBe(3);
  });
});

// --- effort ----------------------------------------------------------------

describe("effort", () => {
  it("means HR and sums elevation over only reporting runs", () => {
    const s = derive({
      sessions: [
        run("2026-06-10", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_heart_rate_bpm: 150,
          max_heart_rate_bpm: 170,
          elevation_gain_meters: 100,
        }),
        run("2026-06-11", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_heart_rate_bpm: 160,
          max_heart_rate_bpm: 180,
          elevation_gain_meters: 50,
        }),
        // Manual run — contributes nothing to the effort aggregates.
        run("2026-06-12", { distance_meters: 5000, duration_seconds: 1500 }),
      ],
    });
    expect(s.effort.avgHrBpm).toBe(155);
    expect(s.effort.maxHrBpm).toBe(180);
    expect(s.effort.elevationGainMeters).toBe(150);
  });

  it("is null for every field when no run reports HR/elevation", () => {
    const s = derive({
      sessions: [run("2026-06-10", { distance_meters: 5000, duration_seconds: 1500 })],
    });
    expect(s.effort.avgHrBpm).toBeNull();
    expect(s.effort.maxHrBpm).toBeNull();
    expect(s.effort.elevationGainMeters).toBeNull();
  });
});

// --- steps trend -----------------------------------------------------------

describe("steps trend", () => {
  it("builds a continuous day axis with unlogged days as gaps (null)", () => {
    const s = derive({
      days: 7,
      steps: [step("2026-06-16", 8000), step("2026-06-18", 9000), step("2026-06-22", 10000)],
    });
    expect(s.stepsSeries.length).toBe(7); // Jun 16..22 inclusive
    const logged = s.stepsSeries.filter((p) => p.steps !== null);
    const gaps = s.stepsSeries.filter((p) => p.steps === null);
    expect(logged.length).toBe(3);
    expect(gaps.length).toBe(4);
    // June 17 is a gap (null), never a zero-step day.
    const jun17 = s.stepsSeries.find((p) => p.date.getDate() === 17);
    expect(jun17?.steps).toBeNull();
  });

  it("is empty when the window has no step entries (instrument hidden)", () => {
    const s = derive({ days: 7, steps: [] });
    expect(s.stepsSeries).toEqual([]);
  });
});

// --- formatters ------------------------------------------------------------

describe("formatters", () => {
  it("formatHm renders seconds as h/m", () => {
    expect(formatHm(46 * 3600 + 7 * 60)).toBe("46h 7m");
    expect(formatHm(59 * 60)).toBe("59m");
    expect(formatHm(2 * 3600)).toBe("2h");
    expect(formatHm(0)).toBe("0m");
  });
});

// --- "All" period (days: null) ---------------------------------------------

describe("All-period window (days: null)", () => {
  it("spans earliest entry → today for consistency", () => {
    // Earliest active day = 60 days before NOW (a step entry), latest = today.
    const start = new Date(NOW);
    start.setDate(start.getDate() - 60);
    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    const s = derive({
      days: null,
      steps: [step(ymd(start), 8000), step(ymd(NOW), 9000)],
    });
    expect(s.consistency.totalDays).toBe(61); // inclusive of both ends
    expect(s.consistency.daysActive).toBe(2);
    expect(s.consistency.currentStreak).toBe(1); // today is active
  });

  it("buckets weekly mileage across the full history and steps earliest→today", () => {
    const s = derive({
      days: null,
      sessions: [
        run("2026-04-01", {
          distance_meters: 8000,
          duration_seconds: 2400,
          avg_pace_sec_per_km: 300,
        }),
        run("2026-06-22", {
          distance_meters: 5000,
          duration_seconds: 1500,
          avg_pace_sec_per_km: 300,
        }),
      ],
      steps: [step("2026-05-01", 8000), step("2026-06-22", 9000)],
    });
    const active = s.weekly.filter((w) => w.mileageMeters !== null);
    expect(active.length).toBe(2);
    // Steps axis runs from the earliest entry (May 1) through today (Jun 22).
    expect(s.stepsSeries.length).toBeGreaterThan(50);
    expect(s.stepsSeries[0]!.steps).toBe(8000);
    expect(s.stepsSeries[s.stepsSeries.length - 1]!.steps).toBe(9000);
  });

  it("is empty-safe with no data at all", () => {
    const s = derive({ days: null });
    expect(s.consistency.totalDays).toBe(1); // just today
    expect(s.consistency.daysActive).toBe(0);
    expect(s.weekly.length).toBeGreaterThanOrEqual(1);
    expect(s.stepsSeries).toEqual([]);
  });
});
