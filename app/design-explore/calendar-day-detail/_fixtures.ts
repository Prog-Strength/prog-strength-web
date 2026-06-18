/**
 * Static fixtures for the calendar-day-detail design exploration.
 *
 * These are throwaway mockup data — NOT wired to any service. They model
 * the worked examples named in dx/calendar-day-detail.md so every variant
 * renders the same scenarios and can be compared idiom-to-idiom.
 *
 * Times are stored as UTC wall-clock and every formatter below pins
 * `timeZone: "UTC"`, so "12:00 PM" renders identically regardless of the
 * viewer's timezone (these are mockups; determinism beats locale accuracy).
 */

import type {
  CompletedSessionKind,
  Exercise,
  PlannedExercise,
  PlannedWorkout,
  RunningSession,
  Workout,
  WorkoutExercise,
} from "@/lib/api";
import type { CalendarEvent } from "@/components/calendar/types";

// --- time helpers -----------------------------------------------------------

/** ISO string for a June-2026 wall-clock time, treated as UTC for determinism. */
function iso(day: number, hour: number, min = 0): string {
  return new Date(Date.UTC(2026, 5, day, hour, min)).toISOString();
}
function ms(day: number, hour: number, min = 0): number {
  return Date.UTC(2026, 5, day, hour, min);
}

/** "12:00 PM" — fixed UTC so the mock reads the same everywhere. */
export function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
/** "12:00 – 1:00 PM" compact window. */
export function fmtWindow(startIso: string, endIso: string): string {
  return `${fmtTime(startIso)} – ${fmtTime(endIso)}`;
}
/** Whole-minute duration between two ISO strings, e.g. "60 min" / "1h 30m". */
export function fmtSpan(startIso: string, endIso: string): string {
  const mins = Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60000);
  return fmtMinutes(mins);
}
export function fmtMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
/** "52:18" m:ss / "1:04:30" h:mm:ss from seconds. */
export function fmtClock(seconds: number): string {
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
/** Pace seconds-per-km → "5:12 /km". */
export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}
/** Meters → "8.0 km". */
export function fmtKm(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

// --- exercise catalog -------------------------------------------------------

const EX: Record<string, Exercise> = {
  "machine-fly": {
    id: "machine-fly",
    name: "Machine Fly",
    muscle_groups: ["Chest"],
    equipment: ["Machine"],
  },
  "pull-up": {
    id: "pull-up",
    name: "Pull Up",
    muscle_groups: ["Back", "Lats"],
    equipment: ["Bodyweight"],
  },
  "bench-press": {
    id: "bench-press",
    name: "Barbell Bench Press",
    muscle_groups: ["Chest", "Triceps"],
    equipment: ["Barbell"],
  },
  "bent-row": {
    id: "bent-row",
    name: "Bent-Over Row",
    muscle_groups: ["Back"],
    equipment: ["Barbell"],
  },
  "incline-db-press": {
    id: "incline-db-press",
    name: "Incline Dumbbell Press",
    muscle_groups: ["Chest", "Shoulders"],
    equipment: ["Dumbbell"],
  },
  "lat-pulldown": {
    id: "lat-pulldown",
    name: "Lat Pulldown",
    muscle_groups: ["Back", "Lats"],
    equipment: ["Cable"],
  },
  "back-squat": {
    id: "back-squat",
    name: "Back Squat",
    muscle_groups: ["Quads", "Glutes"],
    equipment: ["Barbell"],
  },
  rdl: {
    id: "rdl",
    name: "Romanian Deadlift",
    muscle_groups: ["Hamstrings", "Glutes"],
    equipment: ["Barbell"],
  },
  "leg-press": {
    id: "leg-press",
    name: "Leg Press",
    muscle_groups: ["Quads"],
    equipment: ["Machine"],
  },
};

/** The exercise lookup every variant passes to its agenda renderers. */
export const exerciseMap: Map<string, Exercise> = new Map(Object.entries(EX));

// --- planned agenda builders ------------------------------------------------

let pid = 0;
function pset(
  reps: number | null,
  weight: number | null,
  amrap = false,
): PlannedExercise["sets"][number] {
  return {
    id: `ps-${pid++}`,
    order_index: 0,
    target_reps: reps,
    target_weight: weight,
    unit: weight != null ? "lb" : null,
    target_rpe: null,
    amrap,
  };
}
function pex(
  exercise_id: string,
  sets: PlannedExercise["sets"],
  order: number,
  superset_group: number | null = null,
): PlannedExercise {
  return { id: `pe-${pid++}`, exercise_id, order_index: order, notes: null, superset_group, sets };
}

const CHEST_BACK_AGENDA: PlannedExercise[] = [
  pex("bench-press", [pset(8, 135), pset(8, 135), pset(6, 145)], 0),
  pex("bent-row", [pset(10, 95), pset(10, 95), pset(10, 95)], 1),
  // Machine Fly + Pull Up superset (shared group)
  pex("machine-fly", [pset(12, 40), pset(12, 40), pset(12, 40)], 2, 1),
  pex("pull-up", [pset(null, null, true), pset(null, null, true), pset(null, null, true)], 3, 1),
  pex("incline-db-press", [pset(10, 50), pset(10, 50)], 4),
  pex("lat-pulldown", [pset(12, 110), pset(12, 110), pset(12, 110)], 5),
];

// --- planned-workout builder ------------------------------------------------

function planned(opts: {
  id: string;
  name: string;
  kind: "lift" | "run";
  day: number;
  startH: number;
  startMin?: number;
  endH: number;
  endMin?: number;
  status?: PlannedWorkout["status"];
  runType?: PlannedWorkout["run_type"];
  runDetails?: string | null;
  exercises?: PlannedExercise[];
  sync?: PlannedWorkout["google_sync_status"];
}): PlannedWorkout {
  const start = iso(opts.day, opts.startH, opts.startMin ?? 0);
  const end = iso(opts.day, opts.endH, opts.endMin ?? 0);
  return {
    id: opts.id,
    name: opts.name,
    activity_kind: opts.kind,
    scheduled_start: start,
    scheduled_end: end,
    timezone: "UTC",
    status: opts.status ?? "planned",
    notes: null,
    completed_session_id: null,
    completed_session_kind: null,
    calendar_detail: "full_agenda",
    google_event_id: opts.sync ? "g-evt" : null,
    google_sync_status: opts.sync ?? null,
    last_sync_error: opts.sync === "failed" ? "Google returned 403" : null,
    run_type: opts.runType ?? null,
    run_details: opts.runDetails ?? null,
    exercises: opts.exercises ?? [],
    created_at: start,
    updated_at: start,
  };
}

// --- logged-session builders ------------------------------------------------

function wset(reps: number, weight: number): WorkoutExercise["sets"][number] {
  return { reps, weight, unit: "lb" };
}
function loggedChestBack(): Workout {
  const exercises: WorkoutExercise[] = [
    { exercise_id: "bench-press", order: 0, sets: [wset(8, 135), wset(8, 135), wset(6, 145)] },
    { exercise_id: "bent-row", order: 1, sets: [wset(10, 95), wset(10, 95), wset(9, 95)] },
    {
      exercise_id: "machine-fly",
      order: 2,
      superset_group: 1,
      sets: [wset(12, 40), wset(12, 40), wset(11, 40)],
    },
    {
      exercise_id: "pull-up",
      order: 3,
      superset_group: 1,
      sets: [wset(9, 0), wset(8, 0), wset(7, 0)],
    },
    { exercise_id: "incline-db-press", order: 4, sets: [wset(10, 50), wset(9, 50)] },
    { exercise_id: "lat-pulldown", order: 5, sets: [wset(12, 110), wset(12, 110), wset(12, 110)] },
  ];
  return {
    id: "w-chest-back",
    user_id: "u1",
    name: "Chest & Back",
    performed_at: iso(15, 17, 4),
    ended_at: iso(15, 18, 31),
    exercises,
    created_at: iso(15, 17, 4),
    updated_at: iso(15, 18, 31),
    personal_records_set: [
      {
        id: "pr-1",
        exercise_id: "bench-press",
        workout_id: "w-chest-back",
        weight: 145,
        reps: 6,
        unit: "lb",
        previous_weight: 140,
        previous_reps: 6,
        previous_unit: "lb",
        achieved_at: iso(15, 17, 30),
      },
    ],
  };
}
function loggedEasyRun(): RunningSession {
  return {
    id: "r-easy",
    activity_type: "running",
    ingest_source: "garmin_api",
    source_activity_id: "s-1",
    name: "Morning Easy Run",
    start_time: iso(15, 7, 12),
    distance_meters: 8040,
    duration_seconds: 2538, // 42:18
    avg_pace_sec_per_km: 316,
    best_pace_sec_per_km: 288,
    avg_heart_rate_bpm: 148,
    max_heart_rate_bpm: 162,
    total_calories: 612,
    elevation_gain_meters: 84,
    created_at: iso(15, 7, 12),
  };
}

// --- the named worked-example events ----------------------------------------

const intervalRun: CalendarEvent = {
  kind: "planned",
  startMs: ms(18, 12),
  planned: planned({
    id: "p-interval",
    name: "W7 D2 – Interval Run",
    kind: "run",
    day: 18,
    startH: 12,
    endH: 13,
    runType: "intervals",
    runDetails: "6 × 800m @ 5K pace, 90s float recovery. 1.5km warm-up + cool-down.",
    sync: "synced",
  }),
};
const legsLift: CalendarEvent = {
  kind: "planned",
  startMs: ms(18, 18),
  planned: planned({
    id: "p-legs",
    name: "W5 D2 – Legs",
    kind: "lift",
    day: 18,
    startH: 18,
    endH: 19,
    sync: "failed",
  }),
};

const completedChestBack: CalendarEvent = {
  kind: "completed-planned",
  startMs: ms(15, 17, 4),
  planned: planned({
    id: "p-chest-back",
    name: "W5 D1 – Chest & Back",
    kind: "lift",
    day: 15,
    startH: 17,
    endH: 18,
    endMin: 30,
    status: "completed",
    exercises: CHEST_BACK_AGENDA,
    sync: "synced",
  }),
  logged: { kind: "workout", workout: loggedChestBack() },
};

const completedRun: CalendarEvent = {
  kind: "run",
  startMs: ms(15, 7, 12),
  run: loggedEasyRun(),
};

const skippedMobility: CalendarEvent = {
  kind: "planned",
  startMs: ms(17, 7),
  planned: planned({
    id: "p-skipped",
    name: "W6 D4 – Recovery Run",
    kind: "run",
    day: 17,
    startH: 7,
    endH: 7,
    endMin: 40,
    status: "skipped",
    runType: "easy",
    runDetails: "Easy 5km shakeout.",
    sync: "synced",
  }),
};
const skippedDayLift: CalendarEvent = {
  kind: "planned",
  startMs: ms(17, 18),
  planned: planned({
    id: "p-skip-lift",
    name: "W6 D4 – Upper",
    kind: "lift",
    day: 17,
    startH: 18,
    endH: 19,
    sync: "synced",
  }),
};

// Jun 16 dense day — four stacked planned sessions.
const denseDay: CalendarEvent[] = [
  {
    kind: "planned",
    startMs: ms(16, 6, 30),
    planned: planned({
      id: "d-run",
      name: "W7 D1 – Tempo Run",
      kind: "run",
      day: 16,
      startH: 6,
      startMin: 30,
      endH: 7,
      endMin: 15,
      runType: "threshold",
      runDetails: "3 × 8 min @ threshold, 2 min jog between.",
      sync: "synced",
    }),
  },
  {
    kind: "planned",
    startMs: ms(16, 12),
    planned: planned({
      id: "d-push",
      name: "W7 D1 – Push",
      kind: "lift",
      day: 16,
      startH: 12,
      endH: 13,
      exercises: CHEST_BACK_AGENDA.slice(0, 4),
      sync: "synced",
    }),
  },
  {
    kind: "planned",
    startMs: ms(16, 17),
    planned: planned({
      id: "d-legs",
      name: "W7 D1 – Legs",
      kind: "lift",
      day: 16,
      startH: 17,
      endH: 18,
      endMin: 15,
      exercises: [
        pex("back-squat", [pset(5, 225), pset(5, 225), pset(5, 235)], 0),
        pex("rdl", [pset(8, 185), pset(8, 185)], 1),
        pex("leg-press", [pset(12, 360), pset(12, 360)], 2),
      ],
      sync: "pending",
    }),
  },
  {
    kind: "planned",
    startMs: ms(16, 20),
    planned: planned({
      id: "d-core",
      name: "W7 D1 – Core & Mobility",
      kind: "lift",
      day: 16,
      startH: 20,
      endH: 20,
      endMin: 30,
      sync: "failed",
    }),
  },
];

// --- scenarios --------------------------------------------------------------

export type Scenario = {
  key: string;
  label: string;
  blurb: string;
  date: Date;
  events: CalendarEvent[];
  steps?: number | null;
};

export const SCENARIOS: Scenario[] = [
  {
    key: "thursday",
    label: "Thu Jun 18 · two planned",
    blurb:
      "The worked example: a planned interval run + a planned lift. The single-vs-multi case from the screenshot that prompted this DX.",
    date: new Date(Date.UTC(2026, 5, 18)),
    events: [intervalRun, legsLift],
    steps: 5120,
  },
  {
    key: "single",
    label: "Single event",
    blurb:
      "The common, worst-looking-today case: one event. The pane and a one-row list must both read as intentional, not sparse.",
    date: new Date(Date.UTC(2026, 5, 18)),
    events: [intervalRun],
  },
  {
    key: "dense",
    label: "Dense day (4)",
    blurb:
      "Jun 16 carries four stacked planned sessions. The list stays scannable; the pane still shows exactly one selected event.",
    date: new Date(Date.UTC(2026, 5, 16)),
    events: denseDay,
  },
  {
    key: "completed",
    label: "Completed + logged",
    blurb:
      "W5 D1 Chest & Back: a planned lift merged with the session that fulfilled it (rich agenda + actuals), beside a logged easy run.",
    date: new Date(Date.UTC(2026, 5, 15)),
    events: [completedRun, completedChestBack],
    steps: 9240,
  },
  {
    key: "skipped",
    label: "Skipped",
    blurb:
      "The rarest lifecycle state. A skipped recovery run beside a skipped lift — both must read clearly as skipped, by shape + badge not color.",
    date: new Date(Date.UTC(2026, 5, 17)),
    events: [skippedMobility, skippedDayLift],
  },
  {
    key: "rest",
    label: "Rest day",
    blurb:
      "No events, no steps: one deliberate rest-day state spanning the panel, with the Plan-a-workout affordance.",
    date: new Date(Date.UTC(2026, 5, 19)),
    events: [],
  },
];

// --- shared event accessors (composition-neutral) ---------------------------

/** Stable id for an event, for selection keys. */
export function eventId(e: CalendarEvent): string {
  switch (e.kind) {
    case "planned":
      return `p-${e.planned.id}`;
    case "completed-planned":
      return `cp-${e.planned.id}`;
    case "workout":
      return `w-${e.workout.id}`;
    case "run":
      return `r-${e.run.id}`;
  }
}

/** Display title for any event. */
export function eventTitle(e: CalendarEvent): string {
  switch (e.kind) {
    case "planned":
      return e.planned.name ?? "Planned session";
    case "completed-planned":
      return e.planned.name ?? "Completed session";
    case "workout":
      return e.workout.name ?? "Workout";
    case "run":
      return e.run.name ?? "Run";
  }
}

export type Lifecycle = "planned" | "completed" | "skipped" | "logged";

/** Lifecycle status, used for the status badge/shape (never color). */
export function lifecycleOf(e: CalendarEvent): Lifecycle {
  switch (e.kind) {
    case "planned":
      return e.planned.status === "skipped" ? "skipped" : "planned";
    case "completed-planned":
      return "completed";
    case "workout":
    case "run":
      return "logged";
  }
}

/** The event's time window as [startIso, endIso] — logged uses duration. */
export function windowOf(e: CalendarEvent): { startIso: string; endIso: string } {
  switch (e.kind) {
    case "planned":
      return { startIso: e.planned.scheduled_start, endIso: e.planned.scheduled_end };
    case "completed-planned":
      return { startIso: e.planned.scheduled_start, endIso: e.planned.scheduled_end };
    case "workout": {
      const start = e.workout.performed_at;
      const end = e.workout.ended_at ?? new Date(Date.parse(start) + 60 * 60000).toISOString();
      return { startIso: start, endIso: end };
    }
    case "run": {
      const start = e.run.start_time;
      const end = new Date(Date.parse(start) + e.run.duration_seconds * 1000).toISOString();
      return { startIso: start, endIso: end };
    }
  }
}

export type { CompletedSessionKind };
