import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";

/**
 * One thing the user did — or plans to do — on a given day. The
 * discriminant lets the calendar grid and the day digest route to the
 * right renderer without knowing the underlying shape. `startMs` drives
 * start-time ordering. The `planned` variant is forward-looking
 * (scheduled training intent) and renders visually distinct from the
 * logged `workout`/`run` events.
 */
export type CalendarEvent =
  | { kind: "workout"; startMs: number; workout: Workout }
  | { kind: "run"; startMs: number; run: RunningSession }
  | { kind: "planned"; startMs: number; planned: PlannedWorkout };
