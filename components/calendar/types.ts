import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";

/**
 * One thing the user did — or plans to do — on a given day. The
 * discriminant lets the calendar grid and the day digest route to the
 * right renderer without knowing the underlying shape. `startMs` drives
 * start-time ordering. The `planned` variant is forward-looking
 * (scheduled training intent) and renders visually distinct from the
 * logged `workout`/`run` events.
 *
 * `completed-planned` is the collapsed form: when a planned session is
 * marked completed and linked to the logged session that fulfilled it
 * (and both fall on the same local day), the two are merged into one
 * event so the calendar shows a single "done" entry rather than a
 * planned pill stacked on top of its identical logged pill. It carries
 * both identities — `logged` drives the up-front stats and detail, while
 * `planned` backs the "View plan" affordance. `startMs` uses the logged
 * session's start time (the moment it actually happened).
 */
export type CalendarEvent =
  | { kind: "workout"; startMs: number; workout: Workout }
  | { kind: "run"; startMs: number; run: RunningSession }
  | { kind: "planned"; startMs: number; planned: PlannedWorkout }
  | {
      kind: "completed-planned";
      startMs: number;
      planned: PlannedWorkout;
      logged: { kind: "workout"; workout: Workout } | { kind: "run"; run: RunningSession };
    };
