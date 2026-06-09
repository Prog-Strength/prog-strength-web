import type { RunningSession, Workout } from "@/lib/api";

/**
 * One thing the user did on a given day. The discriminant lets the
 * calendar grid and the day digest route to the right renderer without
 * knowing the underlying shape. `startMs` drives start-time ordering.
 */
export type CalendarEvent =
  | { kind: "workout"; startMs: number; workout: Workout }
  | { kind: "run"; startMs: number; run: RunningSession };
