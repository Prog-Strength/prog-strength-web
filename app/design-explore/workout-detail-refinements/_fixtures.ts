/**
 * Static fixtures for the workout-detail-REFINEMENTS Design Exploration.
 *
 * This DX does NOT re-explore the whole Workout Detail page — the shipped
 * session-recap layout reads well and is held constant. It explores the ONE
 * open question: which graphic should replace the "What it trained" text strip
 * (`Legs 27 · Core 5`). So every fixture below carries the data three things
 * draw on, all client-side and already in the real payload:
 *
 *   - the 6-axis per-category set tally          (radar · per-muscle bars · quiet strip)
 *   - a finer per-region tally                   (the anatomical body-map)
 *   - per-exercise Σ reps×weight volume          (the per-exercise volume bars)
 *
 * Three fixtures exercise the range the ticket calls out:
 *   - `leg-day`   — the CRUX: a focused, sparse session (Legs + Core only, four
 *                   of six axes at zero). The graphic must read as intentional
 *                   emphasis here, never as a broken/empty chart.
 *   - `chest-back`— the FULL case: 4–5 categories, several PRs, a superset, a
 *                   per-dumbbell lift — the graphic's balanced day.
 *   - `mobility`  — the DEGRADE case: an uncategorizable session (no mappable
 *                   muscle groups, bodyweight work) → the graphic must drop to a
 *                   calm empty state, never an empty frame.
 *
 * These are mockups: deliberately NOT wired to lib/api's live workout service
 * or setsByCategory. The shapes match `@/lib/api` so variants read like product
 * code; the muscle distribution is pre-tallied here.
 */

import type {
  Exercise,
  PersonalRecordEvent,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from "@/lib/api";
import { CATEGORIES, type MuscleCategory } from "@/lib/muscle-categories";

// --- exercise catalog -----------------------------------------------------

const CATALOG_LIST: Exercise[] = [
  // leg-day catalog
  {
    id: "hb-squat",
    name: "Barbell High Bar Back Squat",
    muscle_groups: ["quads", "glutes", "hamstrings", "core"],
    equipment: ["barbell"],
  },
  {
    id: "leg-curl",
    name: "Machine Lying Leg Curl",
    muscle_groups: ["hamstrings"],
    equipment: ["machine"],
  },
  {
    id: "calf-raise",
    name: "Barbell Calf Raise",
    muscle_groups: ["calves"],
    equipment: ["barbell"],
  },
  { id: "leg-ext", name: "Leg Extension", muscle_groups: ["quads"], equipment: ["machine"] },
  // chest-back catalog
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
    description: "Press the dumbbells — weight is per dumbbell.",
    muscle_groups: ["chest", "shoulders"],
    equipment: ["dumbbell"],
  },
  { id: "pulldown", name: "Lat Pulldown", muscle_groups: ["back"], equipment: ["cable"] },
  {
    id: "ohp",
    name: "Seated Dumbbell Shoulder Press",
    muscle_groups: ["shoulders"],
    equipment: ["dumbbell"],
  },
  {
    id: "facepull",
    name: "Cable Face Pull",
    muscle_groups: ["shoulders", "back"],
    equipment: ["cable"],
  },
  // mobility / uncategorizable catalog — no mappable muscle groups
  { id: "foam", name: "Foam Rolling", muscle_groups: [], equipment: ["foam roller"] },
  { id: "couch", name: "Couch Stretch", muscle_groups: [], equipment: ["bodyweight"] },
  { id: "catcow", name: "Cat-Cow", muscle_groups: [], equipment: ["bodyweight"] },
  { id: "deadhang", name: "Dead Hang", muscle_groups: [], equipment: ["bodyweight"] },
];

export const CATALOG: Map<string, Exercise> = new Map(CATALOG_LIST.map((e) => [e.id, e]));

export function exerciseName(id: string): string {
  return CATALOG.get(id)?.name ?? id;
}

/** Dumbbell lifts whose catalog copy carries the per-dumbbell convention. */
export function isPerDumbbell(id: string): boolean {
  const ex = CATALOG.get(id);
  if (!ex) return false;
  return (
    ex.equipment.includes("dumbbell") &&
    (ex.description ?? "").toLowerCase().includes("per dumbbell")
  );
}

// --- set / volume helpers -------------------------------------------------

const set = (reps: number, weight: number, unit: WorkoutSet["unit"] = "lb"): WorkoutSet => ({
  reps,
  weight,
  unit,
});

export function setVolume(s: WorkoutSet): number {
  return s.weight > 0 ? s.reps * s.weight : 0;
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
 * The "top set": the heaviest load (ties broken by reps). This is how the
 * warm-up ramp is told from the working/top set without a warm-up flag the
 * payload doesn't carry. Returns the set's index.
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

// --- PR matching ----------------------------------------------------------

/**
 * Match a PR event back to the WorkoutSet that set it — the payload carries no
 * pointer, so we match client-side on (weight, reps). The expanded list marks
 * the matched set; an unmatched event degrades honestly (no 🏆, no crash).
 */
export function prForSet(w: Workout, exId: string, s: WorkoutSet): PersonalRecordEvent | undefined {
  return w.personal_records_set.find(
    (ev) => ev.exercise_id === exId && ev.weight === s.weight && ev.reps === s.reps,
  );
}

export function isPrExercise(w: Workout, exId: string): boolean {
  return w.personal_records_set.some((ev) => ev.exercise_id === exId);
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

export function fmtCompact(value: number): string {
  if (value >= 1000) {
    const k = value / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return String(value);
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

/** Display name for a workout, falling back to the date for auto names. */
export function workoutTitle(w: Workout): string {
  const auto = !w.name || /^workout\b/i.test(w.name.trim());
  return auto ? fmtDate(w.performed_at) : (w.name as string);
}

// --- muscle distribution --------------------------------------------------

export type MuscleDatum = { category: MuscleCategory; sets: number };

/** Only the populated categories, largest first (drops the zeros). */
export function populatedMuscles(data: MuscleDatum[]): MuscleDatum[] {
  return data.filter((d) => d.sets > 0).sort((a, b) => b.sets - a.sets);
}

export function totalMuscleSets(data: MuscleDatum[]): number {
  return data.reduce((sum, d) => sum + d.sets, 0);
}

/**
 * Finer per-region tally for the anatomical body-map — the same set counts as
 * the 6-axis tally, but split to the body regions the silhouette can shade.
 * `front`/`back` records the SVG region key → set volume.
 */
export type RegionMap = Partial<Record<BodyRegion, number>>;
export type BodyRegion =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "abs"
  | "obliques"
  | "quads"
  | "calves"
  | "traps"
  | "lats"
  | "lower-back"
  | "glutes"
  | "hamstrings";

// --- the canonical leg-day fixture (the sparse crux) ----------------------

const ex = (
  exercise_id: string,
  order: number,
  sets: WorkoutSet[],
  superset_group: number | null = null,
): WorkoutExercise => ({ exercise_id, order, superset_group, sets });

const LEG_DAY: Workout = {
  id: "wkt-leg",
  user_id: "u-1",
  name: "W5 D2 - Legs",
  performed_at: "2026-06-19T16:00:00Z",
  ended_at: "2026-06-19T16:55:00Z", // 55m
  notes:
    "Felt strong off the floor today. The 335 came up clean — left a rep in the tank. Calves were smoked by the end, had to drop the weight on the last set of extensions to keep form.",
  created_at: "2026-06-19T16:55:00Z",
  updated_at: "2026-06-19T16:55:00Z",
  exercises: [
    ex("hb-squat", 1, [set(8, 135), set(5, 225), set(5, 295), set(4, 315), set(4, 335)]),
    ex("leg-curl", 2, [set(12, 100), set(10, 120), set(8, 135), set(6, 145)]),
    ex("calf-raise", 3, [set(15, 245), set(15, 265), set(12, 275), set(12, 295)]),
    ex("leg-ext", 4, [set(15, 115), set(12, 135), set(10, 155), set(8, 165)]),
  ],
  personal_records_set: [
    {
      id: "pr-squat",
      exercise_id: "hb-squat",
      workout_id: "wkt-leg",
      weight: 335,
      reps: 4,
      unit: "lb",
      previous_weight: 325,
      previous_reps: 3,
      previous_unit: "lb",
      achieved_at: "2026-06-19T16:20:00Z",
    },
  ],
};

// Pre-tallied to mirror the ticket's sparse case: Legs 27 · Core 5 (two of six
// axes; the four others at zero — the chart that read as "broken" and got cut).
const LEG_DAY_MUSCLE: MuscleDatum[] = [
  { category: "Chest", sets: 0 },
  { category: "Back", sets: 0 },
  { category: "Shoulders", sets: 0 },
  { category: "Arms", sets: 0 },
  { category: "Legs", sets: 27 },
  { category: "Core", sets: 5 },
];

const LEG_DAY_REGIONS: RegionMap = {
  quads: 9, // squat + leg ext
  hamstrings: 9, // squat + leg curl
  glutes: 5, // squat
  calves: 4, // calf raise
  abs: 5, // squat bracing
};

// --- the chest-back fixture (the full, multi-category day) -----------------

const CHEST_BACK: Workout = {
  id: "wkt-cb",
  user_id: "u-1",
  name: "W5 D3 - Push / Pull",
  performed_at: "2026-06-17T17:30:00Z",
  ended_at: "2026-06-17T18:58:00Z", // 1h 28m
  notes:
    "Big upper day. Bench finally moved past the sticking point — 305 for a double felt strong. Supersetting the press and face pulls at the end kept the shoulders healthy.",
  created_at: "2026-06-17T18:58:00Z",
  updated_at: "2026-06-17T18:58:00Z",
  exercises: [
    ex("bench", 1, [set(10, 185), set(8, 225), set(5, 275), set(2, 305)]),
    ex("row", 2, [set(10, 135), set(8, 175), set(5, 195), set(3, 205)]),
    ex("incline-db", 3, [set(10, 70), set(9, 80), set(7, 90), set(7, 90)]),
    ex("pulldown", 4, [set(12, 130), set(10, 150), set(10, 150), set(8, 170)]),
    // a finishing superset (shoulders ↔ shoulders/back) — one numbered block
    ex("ohp", 5, [set(12, 45), set(10, 55), set(8, 60)], 1),
    ex("facepull", 6, [set(15, 40), set(15, 50), set(12, 55)], 1),
  ],
  personal_records_set: [
    {
      id: "pr-bench",
      exercise_id: "bench",
      workout_id: "wkt-cb",
      weight: 305,
      reps: 2,
      unit: "lb",
      previous_weight: 295,
      previous_reps: 2,
      previous_unit: "lb",
      achieved_at: "2026-06-17T17:50:00Z",
    },
    {
      id: "pr-row",
      exercise_id: "row",
      workout_id: "wkt-cb",
      weight: 205,
      reps: 3,
      unit: "lb",
      previous_weight: 195,
      previous_reps: 4,
      previous_unit: "lb",
      achieved_at: "2026-06-17T18:08:00Z",
    },
    {
      id: "pr-incline",
      exercise_id: "incline-db",
      workout_id: "wkt-cb",
      weight: 90,
      reps: 7,
      unit: "lb",
      previous_weight: 85,
      previous_reps: 6,
      previous_unit: "lb",
      achieved_at: "2026-06-17T18:22:00Z",
    },
  ],
};

// Chest 12 · Back 13 · Shoulders 9 · Arms 7 — four populated axes, the "full"
// case proven alongside the sparse one.
const CHEST_BACK_MUSCLE: MuscleDatum[] = [
  { category: "Chest", sets: 12 },
  { category: "Back", sets: 13 },
  { category: "Shoulders", sets: 9 },
  { category: "Arms", sets: 7 },
  { category: "Legs", sets: 0 },
  { category: "Core", sets: 0 },
];

const CHEST_BACK_REGIONS: RegionMap = {
  chest: 12,
  lats: 8,
  "lower-back": 5,
  traps: 5,
  shoulders: 9,
  biceps: 4,
  triceps: 7,
};

// --- the mobility fixture (uncategorizable degrade case) -------------------

const MOBILITY: Workout = {
  id: "wkt-mob",
  user_id: "u-1",
  name: "Mobility - June 18",
  performed_at: "2026-06-18T07:00:00Z",
  ended_at: "2026-06-18T07:25:00Z", // 25m
  notes: "Easy reset day. Hips finally opening up.",
  created_at: "2026-06-18T07:25:00Z",
  updated_at: "2026-06-18T07:25:00Z",
  exercises: [
    // bodyweight / time work — non-positive weight reads reps, not a load
    ex("foam", 1, [set(1, 0), set(1, 0)]),
    ex("catcow", 2, [set(10, 0), set(10, 0)]),
    ex("couch", 3, [set(1, 0), set(1, 0)]),
    ex("deadhang", 4, [set(1, 0), set(1, 0)]),
  ],
  personal_records_set: [],
};

// Every axis at zero — no mappable muscle groups. The graphic must DROP here
// (calm empty line), exactly as today's text strip does.
const MOBILITY_MUSCLE: MuscleDatum[] = CATEGORIES.map((category) => ({ category, sets: 0 }));
const MOBILITY_REGIONS: RegionMap = {};

// --- exported fixture set -------------------------------------------------

export type WorkoutFixture = {
  key: "leg-day" | "chest-back" | "mobility";
  label: string;
  blurb: string;
  workout: Workout;
  muscle: MuscleDatum[];
  regions: RegionMap;
};

export const FIXTURES: WorkoutFixture[] = [
  {
    key: "leg-day",
    label: "Leg day · sparse",
    blurb: "Legs + Core only — the crux the radar failed",
    workout: LEG_DAY,
    muscle: LEG_DAY_MUSCLE,
    regions: LEG_DAY_REGIONS,
  },
  {
    key: "chest-back",
    label: "Push / Pull · full",
    blurb: "4 categories, 3 PRs, a superset",
    workout: CHEST_BACK,
    muscle: CHEST_BACK_MUSCLE,
    regions: CHEST_BACK_REGIONS,
  },
  {
    key: "mobility",
    label: "Mobility · degrade",
    blurb: "No mappable muscles — the graphic drops",
    workout: MOBILITY,
    muscle: MOBILITY_MUSCLE,
    regions: MOBILITY_REGIONS,
  },
];

export type FixtureKey = WorkoutFixture["key"];

export { CATEGORIES };
export type { MuscleCategory };
