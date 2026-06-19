/**
 * Static fixtures for the personal-records-lifts Design Exploration.
 *
 * Mirrors the DX ticket's representative fixture (8 backend-curated headline
 * lifts, one never tested, unit lb) plus two extra datasets so every variant
 * can be exercised across the real range the ticket calls out: ~3 lifts,
 * ~12 lifts, a kg unit, a freshly-tested near-max (≈0 gap), high-rep vs
 * low-rep PRs, long truncating names, and the never-PR'd empty state.
 *
 * These are mockups: deliberately NOT wired to lib/api's live PR service.
 * The shape matches `PersonalRecord` so variants read like product code.
 */

import type { PersonalRecord } from "@/lib/api";

// "Today" is pinned so time-since-PR math is deterministic in the mockup
// (the ticket's reference date). Real code would use new Date().
export const TODAY = new Date("2026-06-19T12:00:00Z");

/** The canonical 8 — exactly the ticket's table, in API order. */
export const CANONICAL: PersonalRecord[] = [
  {
    exercise_id: "bench",
    exercise_name: "Barbell Bench Press",
    workout_id: "w-bench",
    weight: 305,
    reps: 2,
    unit: "lb",
    achieved_at: "2026-05-11T00:00:00Z",
    current_estimated_1rm: 326.9,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "squat",
    exercise_name: "Barbell High Bar Back Squat",
    workout_id: "w-squat",
    weight: 315,
    reps: 4,
    unit: "lb",
    achieved_at: "2026-05-04T00:00:00Z",
    current_estimated_1rm: 363.3,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "row",
    exercise_name: "Barbell Bent Over Row",
    workout_id: "w-row",
    weight: 205,
    reps: 3,
    unit: "lb",
    achieved_at: "2026-05-11T00:00:00Z",
    current_estimated_1rm: 233.7,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "db-bench",
    exercise_name: "Dumbbell Bench Press",
    workout_id: "w-dbbench",
    weight: 105,
    reps: 8,
    unit: "lb",
    achieved_at: "2026-04-28T00:00:00Z",
    current_estimated_1rm: 136.8,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "incline-db",
    exercise_name: "Incline Dumbbell Bench Press",
    workout_id: "w-incline",
    weight: 95,
    reps: 8,
    unit: "lb",
    achieved_at: "2026-06-16T00:00:00Z",
    current_estimated_1rm: 116.0,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "deadlift",
    exercise_name: "Barbell Deadlift",
    workout_id: null,
    weight: null,
    reps: null,
    unit: null,
    achieved_at: null,
    current_estimated_1rm: null,
    estimated_1rm_unit: null,
  },
  {
    exercise_id: "leg-press",
    exercise_name: "Leg Press",
    workout_id: "w-legpress",
    weight: 365,
    reps: 10,
    unit: "lb",
    achieved_at: "2026-04-22T00:00:00Z",
    current_estimated_1rm: 486.7,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "military",
    exercise_name: "Barbell Military Press",
    workout_id: "w-military",
    weight: 155,
    reps: 5,
    unit: "lb",
    achieved_at: "2026-06-13T00:00:00Z",
    current_estimated_1rm: 175.2,
    estimated_1rm_unit: "lb",
  },
];

/** Three lifts — the low end of the user-controlled count, incl. the empty. */
export const FEW: PersonalRecord[] = [CANONICAL[0], CANONICAL[1], CANONICAL[5]];

/**
 * Twelve lifts — the high end, and the home for the edge states the
 * canonical table doesn't carry: a freshly-tested near-max (≈0 gap), a kg
 * lift, and another never-PR'd entry so the empty group reads as a group.
 */
export const MANY: PersonalRecord[] = [
  ...CANONICAL,
  {
    exercise_id: "front-squat",
    exercise_name: "Barbell Front Squat",
    workout_id: "w-front",
    weight: 245,
    reps: 3,
    unit: "lb",
    // Tested two days ago; estimate sits right on the PR — "nothing to chase".
    achieved_at: "2026-06-17T00:00:00Z",
    current_estimated_1rm: 246.5,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "ohp-kg",
    exercise_name: "Standing Overhead Press",
    workout_id: "w-ohp",
    weight: 70,
    reps: 3,
    unit: "kg",
    achieved_at: "2026-05-20T00:00:00Z",
    current_estimated_1rm: 78.2,
    estimated_1rm_unit: "kg",
  },
  {
    exercise_id: "weighted-pullup",
    exercise_name: "Weighted Pull-Up",
    workout_id: "w-pullup",
    weight: 90,
    reps: 5,
    achieved_at: "2026-06-01T00:00:00Z",
    unit: "lb",
    current_estimated_1rm: 105.0,
    estimated_1rm_unit: "lb",
  },
  {
    exercise_id: "hip-thrust",
    exercise_name: "Barbell Hip Thrust",
    workout_id: null,
    weight: null,
    reps: null,
    unit: null,
    achieved_at: null,
    current_estimated_1rm: null,
    estimated_1rm_unit: null,
  },
];

export type Dataset = "canonical" | "few" | "many";
export const DATASETS: { key: Dataset; label: string; records: PersonalRecord[] }[] = [
  { key: "canonical", label: "Canonical · 8", records: CANONICAL },
  { key: "few", label: "Few · 3", records: FEW },
  { key: "many", label: "Many · 12", records: MANY },
];

export type RenderMode = "data" | "loading" | "error";

/** Per-lift readiness, derived client-side exactly as the ticket specifies. */
export type Readiness = {
  record: PersonalRecord;
  hasPR: boolean;
  isDumbbell: boolean;
  gap: number | null; // est − PR, lb/kg
  gapPct: number | null; // gap as % of PR
  ready: boolean; // shipped binary: gapPct ≥ 5
  daysSince: number | null; // staleness, in days
};

export function deriveReadiness(record: PersonalRecord): Readiness {
  const hasPR = record.weight !== null && record.workout_id !== null;
  const isDumbbell = /dumbbell/i.test(record.exercise_name);
  const gap =
    hasPR && record.current_estimated_1rm !== null && record.weight !== null
      ? record.current_estimated_1rm - record.weight
      : null;
  const gapPct =
    gap !== null && record.weight !== null && record.weight > 0
      ? (gap / record.weight) * 100
      : null;
  const ready = gapPct !== null && gapPct >= 5;
  const daysSince =
    record.achieved_at !== null
      ? Math.round((TODAY.getTime() - new Date(record.achieved_at).getTime()) / 86_400_000)
      : null;
  return { record, hasPR, isDumbbell, gap, gapPct, ready, daysSince };
}

/** Weight + unit, one optional decimal, em-dash when null. */
export function fmtWeight(value: number | null, unit: string | null): string {
  if (value === null || unit === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${unit}`;
}

/** Bare number, one optional decimal (for stat lines that label the unit once). */
export function fmtNum(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** "Mon D, YYYY" for an RFC3339 string; em-dash for null/empty. */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Coarse "time since" phrasing for momentum/recency framing. */
export function fmtAgo(days: number | null): string {
  if (days === null) return "—";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/**
 * A deterministic, plausible progression series for a lift's estimated 1RM,
 * for the inline sparklines (momentum-timeline / compact-dashboard). Seeded
 * off the exercise id so it's stable across renders without Math.random.
 * Ends at the current estimate; trends upward with mild wobble.
 */
export function sparkSeries(r: Readiness, points = 10): number[] {
  const end = r.record.current_estimated_1rm ?? r.record.weight ?? 100;
  const seed = r.record.exercise_id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const span = end * 0.18; // ~18% climb across the window
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const wobble = Math.sin(seed + i * 1.7) * (span * 0.12);
    out.push(end - span * (1 - t) + wobble);
  }
  out[points - 1] = end;
  return out;
}
