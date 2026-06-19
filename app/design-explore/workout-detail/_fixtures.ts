/**
 * Static fixtures for the workout-detail Design Exploration.
 *
 * Mirrors the DX ticket's representative fixture — a four-PR Chest & Back day
 * with a bench ramp to a top-set PR (185 → 305 × 2), the redundant/degenerate
 * muscle distribution (Back 13 · Chest 12 · Shoulders 4 · the rest 0), a real
 * lifter's note, and a superset — PLUS a degrade fixture (zero-PR, no-note,
 * no `ended_at`, flat set scheme, a superset) so every variant is exercised
 * away from the celebratory happy path.
 *
 * These are mockups: deliberately NOT wired to lib/api's live workout service
 * or to setsByCategory. The shapes match `@/lib/api` so the variants read like
 * product code; the muscle distribution is pre-tallied here.
 */

import type {
  Exercise,
  PersonalRecordEvent,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/api";
import { CATEGORIES, type MuscleCategory } from "@/lib/muscle-categories";

// "Now" is pinned so any time-of-day / duration math is deterministic in the
// mockup. Real code would use new Date().
export const NOW = new Date("2026-06-19T12:00:00Z");

// --- exercise catalog -----------------------------------------------------

const CATALOG_LIST: Exercise[] = [
  {
    id: "bench",
    name: "Barbell Bench Press",
    muscle_groups: ["chest", "triceps"],
    equipment: ["barbell"],
  },
  {
    id: "row",
    name: "Barbell Bent Over Row",
    muscle_groups: ["back", "biceps"],
    equipment: ["barbell"],
  },
  {
    id: "incline-db",
    name: "Incline Dumbbell Bench Press",
    muscle_groups: ["chest", "shoulders"],
    equipment: ["dumbbell"],
  },
  {
    id: "tripod-row",
    name: "Dumbbell Tripod Row",
    muscle_groups: ["back", "biceps"],
    equipment: ["dumbbell"],
  },
  {
    id: "ohp",
    name: "Seated Dumbbell Shoulder Press",
    muscle_groups: ["shoulders"],
    equipment: ["dumbbell"],
  },
  { id: "pulldown", name: "Lat Pulldown", muscle_groups: ["back"], equipment: ["cable"] },
  // degrade-fixture catalog
  {
    id: "squat",
    name: "Barbell Back Squat",
    muscle_groups: ["quads", "glutes"],
    equipment: ["barbell"],
  },
  { id: "leg-ext", name: "Leg Extension", muscle_groups: ["quads"], equipment: ["machine"] },
  { id: "leg-curl", name: "Lying Leg Curl", muscle_groups: ["hamstrings"], equipment: ["machine"] },
  { id: "calf", name: "Standing Calf Raise", muscle_groups: ["calves"], equipment: ["machine"] },
];

export const CATALOG: Map<string, Exercise> = new Map(CATALOG_LIST.map((e) => [e.id, e]));

export function exerciseName(id: string): string {
  return CATALOG.get(id)?.name ?? id;
}

/** Broad muscle-group label for the per-exercise pill. */
export function exerciseMuscle(id: string): string {
  const groups = CATALOG.get(id)?.muscle_groups ?? [];
  const cats = new Set<string>();
  for (const g of groups) {
    const c =
      g === "chest"
        ? "Chest"
        : g === "back"
          ? "Back"
          : g === "shoulders"
            ? "Shoulders"
            : g === "biceps" || g === "triceps" || g === "forearms"
              ? "Arms"
              : g === "quads" || g === "hamstrings" || g === "glutes" || g === "calves"
                ? "Legs"
                : g === "core"
                  ? "Core"
                  : g;
    cats.add(c);
  }
  return [...cats].join(" · ");
}

/** Dumbbell lifts log weight per hand — variants may make this explicit. */
export function isDumbbell(id: string): boolean {
  return CATALOG.get(id)?.equipment.includes("dumbbell") ?? false;
}

// --- set / volume helpers -------------------------------------------------

const set = (reps: number, weight: number, unit: WorkoutSet["unit"] = "lb"): WorkoutSet => ({
  reps,
  weight,
  unit,
});

export function setVolume(s: WorkoutSet): number {
  return s.reps * s.weight;
}

export function exerciseVolume(ex: WorkoutExercise): number {
  return ex.sets.reduce((sum, s) => sum + setVolume(s), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
}

export function setCount(w: Workout): number {
  return w.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
}

/**
 * The "top set" of an exercise: the set carrying the heaviest load (ties broken
 * by reps). This is how the warm-up ramp is distinguished from the working/top
 * set without a warm-up flag the data doesn't have. Returns the set's index.
 */
export function topSetIndex(ex: WorkoutExercise): number {
  let best = 0;
  for (let i = 1; i < ex.sets.length; i++) {
    const s = ex.sets[i];
    const b = ex.sets[best];
    if (s.weight > b.weight || (s.weight === b.weight && s.reps > b.reps)) best = i;
  }
  return best;
}

/**
 * True when the set sequence ramps (a clearly heaviest top set after lighter
 * work). A flat scheme (3×5) has no ramp and structure idioms must degrade.
 */
export function hasRamp(ex: WorkoutExercise): boolean {
  if (ex.sets.length < 2) return false;
  const weights = ex.sets.map((s) => s.weight);
  const max = Math.max(...weights);
  const min = Math.min(...weights);
  return max - min > max * 0.05; // >5% spread reads as a ramp, not flat work
}

// --- PR matching ----------------------------------------------------------

/**
 * Match a PR event back to the WorkoutSet that set it — the payload carries no
 * pointer, so we match client-side on (weight, reps). Returns the exercise +
 * set index, or null when no set matches (honest "couldn't link").
 */
export function matchPRSet(
  w: Workout,
  ev: PersonalRecordEvent,
): { exercise: WorkoutExercise; setIndex: number } | null {
  const ex = w.exercises.find((e) => e.exercise_id === ev.exercise_id);
  if (!ex) return null;
  const idx = ex.sets.findIndex((s) => s.weight === ev.weight && s.reps === ev.reps);
  return idx >= 0 ? { exercise: ex, setIndex: idx } : null;
}

/** Is this exact set the one that broke a PR? (for inline 🏆 marks) */
export function prForSet(w: Workout, exId: string, s: WorkoutSet): PersonalRecordEvent | undefined {
  return w.personal_records_set.find(
    (ev) => ev.exercise_id === exId && ev.weight === s.weight && ev.reps === s.reps,
  );
}

// --- formatting -----------------------------------------------------------

export function fmtWeight(value: number, unit: string | null = "lb"): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return unit ? `${text} ${unit}` : text;
}

export function fmtVolume(value: number): string {
  return `${value.toLocaleString("en-US")} lbs`;
}

export function fmtDuration(startISO: string, endISO: string | null | undefined): string | null {
  if (!endISO) return null;
  const ms = new Date(endISO).getTime() - new Date(startISO).getTime();
  if (ms < 0) return null;
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// --- muscle distribution --------------------------------------------------

export type MuscleDatum = { category: MuscleCategory; sets: number };

/** Tally with only the populated categories, largest first (drops the 0s). */
export function populatedMuscles(data: MuscleDatum[]): MuscleDatum[] {
  return data.filter((d) => d.sets > 0).sort((a, b) => b.sets - a.sets);
}

// --- the canonical four-PR fixture ----------------------------------------

const ex = (
  exercise_id: string,
  order: number,
  sets: WorkoutSet[],
  superset_group: number | null = null,
): WorkoutExercise => ({ exercise_id, order, superset_group, sets });

const CANONICAL_WORKOUT: Workout = {
  id: "wkt-canonical",
  user_id: "u-1",
  name: "Week 2 Workout 1 - Chest & Back",
  performed_at: "2026-05-11T17:30:00Z",
  ended_at: "2026-05-11T18:50:00Z", // 1h 20m
  notes:
    "I had to skip my usual abs superset because I was late for work. Maybe I can do some abs during lunch to make up for it. Other than that, it was a great workout! I hit 305 lbs. for 2 reps on bench press. Nice!!!",
  created_at: "2026-05-11T18:50:00Z",
  updated_at: "2026-05-11T18:50:00Z",
  exercises: [
    ex("bench", 1, [set(10, 185), set(10, 225), set(6, 275), set(2, 305)]),
    ex("row", 2, [set(10, 135), set(8, 175), set(5, 195), set(3, 205)]),
    ex("incline-db", 3, [set(10, 70), set(9, 80), set(7, 90), set(7, 90)]),
    ex("tripod-row", 4, [set(10, 65), set(8, 75), set(6, 80), set(6, 80)]),
    // a finishing superset (shoulders ↔ back) — one numbered block
    ex("ohp", 5, [set(12, 45), set(10, 55), set(8, 60), set(8, 60)], 1),
    ex("pulldown", 6, [set(12, 130), set(10, 150), set(10, 150), set(8, 170), set(8, 170)], 1),
  ],
  personal_records_set: [
    {
      id: "pr-bench",
      exercise_id: "bench",
      workout_id: "wkt-canonical",
      weight: 305,
      reps: 2,
      unit: "lb",
      previous_weight: 245,
      previous_reps: 3,
      previous_unit: "lb",
      achieved_at: "2026-05-11T17:45:00Z",
    },
    {
      id: "pr-row",
      exercise_id: "row",
      workout_id: "wkt-canonical",
      weight: 205,
      reps: 3,
      unit: "lb",
      previous_weight: 185,
      previous_reps: 4,
      previous_unit: "lb",
      achieved_at: "2026-05-11T18:05:00Z",
    },
    {
      id: "pr-incline",
      exercise_id: "incline-db",
      workout_id: "wkt-canonical",
      weight: 90,
      reps: 7,
      unit: "lb",
      previous_weight: 85,
      previous_reps: 6,
      previous_unit: "lb",
      achieved_at: "2026-05-11T18:20:00Z",
    },
    {
      id: "pr-tripod",
      exercise_id: "tripod-row",
      workout_id: "wkt-canonical",
      weight: 80,
      reps: 6,
      unit: "lb",
      previous_weight: null, // first-ever logged set — no "up from"
      previous_reps: null,
      previous_unit: null,
      achieved_at: "2026-05-11T18:38:00Z",
    },
  ],
};

// Pre-tallied to mirror the ticket's degenerate single-workout distribution:
// Back 13 · Chest 12 · Shoulders 4 · Arms/Legs/Core 0 (3 of 6 axes populated).
const CANONICAL_MUSCLE: MuscleDatum[] = [
  { category: "Chest", sets: 12 },
  { category: "Back", sets: 13 },
  { category: "Shoulders", sets: 4 },
  { category: "Arms", sets: 0 },
  { category: "Legs", sets: 0 },
  { category: "Core", sets: 0 },
];

// --- the degrade fixture: zero-PR, no note, no ended_at, flat, superset -----

const PLAIN_WORKOUT: Workout = {
  id: "wkt-plain",
  user_id: "u-1",
  name: "Workout - May 14", // auto-generated ⇒ a variant should fall back to the date
  performed_at: "2026-05-14T18:00:00Z",
  ended_at: null, // open / never-finalized ⇒ no duration tile, no time spine
  notes: "",
  created_at: "2026-05-14T18:40:00Z",
  updated_at: "2026-05-14T18:40:00Z",
  exercises: [
    ex("squat", 1, [set(5, 225), set(5, 225), set(5, 225)]), // flat 3×5, no ramp
    // a superset: leg extension alternated with leg curl (shared group)
    ex("leg-ext", 2, [set(12, 110), set(12, 110), set(12, 110)], 1),
    ex("leg-curl", 3, [set(12, 90), set(12, 90), set(12, 90)], 1),
    ex("calf", 4, [set(15, 180), set(15, 180), set(15, 180)]),
  ],
  personal_records_set: [],
};

const PLAIN_MUSCLE: MuscleDatum[] = [
  { category: "Chest", sets: 0 },
  { category: "Back", sets: 0 },
  { category: "Shoulders", sets: 0 },
  { category: "Arms", sets: 0 },
  { category: "Legs", sets: 12 },
  { category: "Core", sets: 0 },
];

// --- exported fixture set -------------------------------------------------

export type WorkoutFixture = {
  key: "canonical" | "plain";
  label: string;
  workout: Workout;
  muscle: MuscleDatum[];
};

export const FIXTURES: WorkoutFixture[] = [
  {
    key: "canonical",
    label: "4-PR Chest & Back",
    workout: CANONICAL_WORKOUT,
    muscle: CANONICAL_MUSCLE,
  },
  { key: "plain", label: "Zero-PR · no note · open", workout: PLAIN_WORKOUT, muscle: PLAIN_MUSCLE },
];

export type FixtureKey = WorkoutFixture["key"];

/** Display name for a workout, falling back to the date for auto names. */
export function workoutTitle(w: Workout): string {
  const auto = !w.name || /^workout\b/i.test(w.name.trim());
  return auto ? fmtDate(w.performed_at) : w.name!;
}

export { CATEGORIES };
export type { MuscleCategory };
