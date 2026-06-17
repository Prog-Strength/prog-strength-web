import type { CalendarEvent } from "@/components/calendar/types";

/**
 * Discipline of an activity, used to pick its tonal hue (run vs lift today;
 * mobility/core are reserved, extensible slots not inferred from data yet).
 * Centralized so chips, streak dots, and any future surface agree.
 */
export type Discipline = "run" | "lift" | "mobility" | "core";

/** Whether a chip reads as completed ("done") or forward-looking ("planned"). */
export type ChipState = "done" | "planned";

/**
 * Map a calendar event to its discipline. A logged run — or a planned/
 * completed-planned session whose activity is a run — is `run`; the lift
 * equivalents are `lift`. Planned discipline comes from the plan's
 * `activity_kind`; completed-planned from the logged session it merged with.
 */
export function disciplineOf(event: CalendarEvent): Discipline {
  switch (event.kind) {
    case "run":
      return "run";
    case "workout":
      return "lift";
    case "completed-planned":
      // The logged session is always a real run or workout (lift).
      return event.logged.kind === "run" ? "run" : "lift";
    case "planned":
      // Exhaustive over ActivityKind so a future kind (e.g. mobility/core)
      // breaks the build here instead of silently mapping to "lift".
      switch (event.planned.activity_kind) {
        case "run":
          return "run";
        case "lift":
          return "lift";
      }
  }
}

/**
 * A planned (not-yet-done) session is `planned`; logged and completed-planned
 * sessions are `done` (a completed-planned session already merged — it
 * happened).
 */
export function chipStateOf(event: CalendarEvent): ChipState {
  return event.kind === "planned" ? "planned" : "done";
}

/** True when a day carries at least one done event — drives streak dots/counts. */
export function isTrainedDay(events: CalendarEvent[]): boolean {
  return events.some((e) => chipStateOf(e) === "done");
}

/**
 * Coaching greeting for the month. Greets by `name` when known (graceful
 * neutral fallback when null), and states the month's trained-day count
 * honestly — a zero-day month reads as a fresh start, not a scold.
 */
export function monthConsistencyCopy(name: string | null, trainedDays: number): string {
  const who = name?.trim() ? `, ${name.trim()}` : "";
  if (trainedDays === 0) return `Welcome back${who} — a fresh month to build on.`;
  const dayWord = trainedDays === 1 ? "day" : "days";
  return `Nice work${who} — you've trained ${trainedDays} ${dayWord} this month.`;
}
