/**
 * Static fixtures + pure (non-visual) helpers shared by every
 * personal-records DX variant. Values mirror the realistic account in the
 * DX ticket (prog-strength-docs/dx/personal-records.md). This module holds
 * ONLY data and math — no JSX, no styling, no layout. Each variant owns its
 * own visual composition (that divergence is the whole point of the DX);
 * what they legitimately share is the same numbers and the same arithmetic
 * for the est-vs-PR gap, so the spread is read on layout, not on data drift.
 *
 * Disposable mockup code — not wired to lib/api.ts on purpose.
 */

export type LiftRecord = {
  exercise_name: string;
  weight: number | null;
  reps: number | null;
  unit: "lb" | "kg" | null;
  achieved_at: string | null;
  current_estimated_1rm: number | null;
  recent_estimated_1rm_points: number[] | null;
};

export type RunningBestEffort = {
  distance_key: string;
  distance_label: string;
  duration_seconds: number | null;
  pace_sec_per_km: number | null;
  activity_start_time: string | null;
};

export type MaxEffortHistoryPoint = {
  as_of: string;
  seconds: number;
  lower_seconds: number;
  upper_seconds: number;
};

export type MaxEffortAttempt = {
  achieved_at: string;
  duration_seconds: number;
  source: string;
};

export type MaxEffortEstimate = {
  distance_label: string;
  seconds: number;
  lower_seconds: number;
  upper_seconds: number;
  basis: string;
  confidence: string;
  actual_best_seconds: number;
  estimate_history: MaxEffortHistoryPoint[];
  attempts: MaxEffortAttempt[];
};

// ── Lifts ──────────────────────────────────────────────────────────────
export const LIFTS: LiftRecord[] = [
  {
    exercise_name: "Barbell Bench Press",
    weight: 305,
    reps: 2,
    unit: "lb",
    achieved_at: "2026-05-11",
    current_estimated_1rm: 327,
    recent_estimated_1rm_points: [305, 308, 311, 316, 322, 327],
  },
  {
    exercise_name: "Barbell High Bar Back Squat",
    weight: 335,
    reps: 4,
    unit: "lb",
    achieved_at: "2026-06-19",
    current_estimated_1rm: 369,
    recent_estimated_1rm_points: [330, 341, 350, 358, 366, 369],
  },
  {
    exercise_name: "Barbell Bent Over Row",
    weight: 205,
    reps: 3,
    unit: "lb",
    achieved_at: "2026-05-11",
    current_estimated_1rm: 234,
    recent_estimated_1rm_points: [210, 218, 225, 231, 236, 234],
  },
  {
    exercise_name: "Dumbbell Bench Press",
    weight: 105,
    reps: 8,
    unit: "lb",
    achieved_at: "2026-04-28",
    current_estimated_1rm: 137,
    recent_estimated_1rm_points: [118, 123, 128, 132, 135, 137],
  },
  {
    exercise_name: "Incline Dumbbell Bench Press",
    weight: 95,
    reps: 8,
    unit: "lb",
    achieved_at: "2026-06-16",
    current_estimated_1rm: 116,
    recent_estimated_1rm_points: [100, 104, 109, 112, 115, 116],
  },
  {
    exercise_name: "Barbell Deadlift",
    weight: null,
    reps: null,
    unit: null,
    achieved_at: null,
    current_estimated_1rm: null,
    recent_estimated_1rm_points: null,
  },
  {
    exercise_name: "Leg Press",
    weight: 365,
    reps: 10,
    unit: "lb",
    achieved_at: "2026-04-22",
    current_estimated_1rm: 487,
    recent_estimated_1rm_points: [430, 448, 462, 475, 483, 487],
  },
  {
    exercise_name: "Barbell Military Press",
    weight: 155,
    reps: 5,
    unit: "lb",
    achieved_at: "2026-06-13",
    current_estimated_1rm: 175,
    recent_estimated_1rm_points: [158, 163, 167, 170, 173, 175],
  },
];

// ── Running ────────────────────────────────────────────────────────────
export const RUNNING: RunningBestEffort[] = [
  {
    distance_key: "1mi",
    distance_label: "1 Mile",
    duration_seconds: 370,
    pace_sec_per_km: 230,
    activity_start_time: "2026-04-06",
  },
  {
    distance_key: "2mi",
    distance_label: "2 Mile",
    duration_seconds: 752,
    pace_sec_per_km: 233,
    activity_start_time: "2026-04-06",
  },
  {
    distance_key: "5k",
    distance_label: "5K",
    duration_seconds: 1181,
    pace_sec_per_km: 236,
    activity_start_time: "2026-04-06",
  },
  {
    distance_key: "10k",
    distance_label: "10K",
    duration_seconds: 2495,
    pace_sec_per_km: 249,
    activity_start_time: "2026-04-11",
  },
  {
    distance_key: "half_marathon",
    distance_label: "Half Marathon",
    duration_seconds: null,
    pace_sec_per_km: null,
    activity_start_time: null,
  },
  {
    distance_key: "marathon",
    distance_label: "Marathon",
    duration_seconds: null,
    pace_sec_per_km: null,
    activity_start_time: null,
  },
];

// The featured running estimate, keyed to 5K (the distance with the richest
// max-effort data). The "actual best" sits just above the projection — the
// running mirror of the est-1RM-over-PR "go attempt a new best" signal.
export const MAX_EFFORT_5K: MaxEffortEstimate = {
  distance_label: "5K",
  seconds: 1175,
  lower_seconds: 1150,
  upper_seconds: 1206,
  basis: "fitted_curve",
  confidence: "medium",
  actual_best_seconds: 1181,
  estimate_history: [
    { as_of: "2026-02-01", seconds: 1240, lower_seconds: 1180, upper_seconds: 1320 },
    { as_of: "2026-03-01", seconds: 1212, lower_seconds: 1170, upper_seconds: 1270 },
    { as_of: "2026-04-06", seconds: 1188, lower_seconds: 1160, upper_seconds: 1222 },
    { as_of: "2026-05-10", seconds: 1175, lower_seconds: 1150, upper_seconds: 1206 },
  ],
  attempts: [
    { achieved_at: "2026-04-06", duration_seconds: 1181, source: "race_like" },
    { achieved_at: "2026-03-22", duration_seconds: 1205, source: "long_run_window" },
  ],
};

// ── Pure derivations (no React, no styling) ─────────────────────────────
const DUMBBELL_RE = /dumbbell/i;
/** Gap (%) at or above which a lift is "due" for a new max attempt. */
export const READY_THRESHOLD_PCT = 5;

export type LiftDerived = {
  hasPR: boolean;
  isDumbbell: boolean;
  gap: number | null; // est-1RM − logged PR weight
  gapPct: number | null;
  due: boolean;
};

export function deriveLift(r: LiftRecord): LiftDerived {
  const hasPR = r.weight !== null;
  const isDumbbell = DUMBBELL_RE.test(r.exercise_name);
  let gap: number | null = null;
  let gapPct: number | null = null;
  if (hasPR && r.weight && r.weight > 0 && r.current_estimated_1rm !== null) {
    gap = r.current_estimated_1rm - r.weight;
    gapPct = (gap / r.weight) * 100;
  }
  const due = gapPct !== null && gapPct >= READY_THRESHOLD_PCT;
  return { hasPR, isDumbbell, gap, gapPct, due };
}

/** Lifts ranked most-"due" first — the "what should I attempt next" order. */
export function liftsByReadiness(records: LiftRecord[]): LiftRecord[] {
  return [...records].sort((a, b) => {
    const ga = deriveLift(a).gapPct ?? -Infinity;
    const gb = deriveLift(b).gapPct ?? -Infinity;
    return gb - ga;
  });
}

// ── Formatters ──────────────────────────────────────────────────────────
export function formatWeight(value: number | null, unit: string | null): string {
  if (value === null || unit === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${unit}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Signed clock delta, e.g. "−0:06" — faster is negative. */
export function formatSignedDuration(deltaSeconds: number): string {
  if (!Number.isFinite(deltaSeconds)) return "—";
  const sign = deltaSeconds < 0 ? "−" : deltaSeconds > 0 ? "+" : "";
  const total = Math.round(Math.abs(deltaSeconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

/** sec/km → "m:ss /km". */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm)) return "—";
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

export function humanizeConfidence(c: string): string {
  if (!c) return "—";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/** Map a series of numbers to [x,y] points inside a w×h box, with padding. */
export function scaleSeries(
  values: number[],
  w: number,
  h: number,
  pad = 2,
  domain?: { min: number; max: number },
): { x: number; y: number }[] {
  const min = domain ? domain.min : Math.min(...values);
  const max = domain ? domain.max : Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? w / (values.length - 1) : 0;
  return values.map((v, i) => ({
    x: i * stepX,
    y: pad + (1 - (v - min) / span) * (h - 2 * pad),
  }));
}

/** y-coordinate for a single value on the same scale as scaleSeries. */
export function scaleY(value: number, min: number, max: number, h: number, pad = 2): number {
  const span = max - min || 1;
  return pad + (1 - (value - min) / span) * (h - 2 * pad);
}
