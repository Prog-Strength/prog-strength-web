import type { RunningSession } from "@/lib/api";
import type { CalendarEvent } from "@/components/calendar/types";

/**
 * Discipline of an activity, used to pick its tonal hue (run vs lift today;
 * mobility/core are reserved, extensible slots not inferred from data yet).
 * Centralized so chips, streak dots, and any future surface agree.
 */
export type Discipline = "run" | "lift" | "hike" | "mobility" | "core";

/** Whether a chip reads as completed ("done") or forward-looking ("planned"). */
export type ChipState = "done" | "planned";

/**
 * The discipline of one logged endurance session. THE single place that
 * decides "an endurance session typed `hiking` is a hike, anything else
 * reads as a run" — every surface that tones or labels a bare
 * `RunningSession` (calendar pills, digest banners, dropdown links) routes
 * through here so none of them can drift back to assuming run.
 */
export function disciplineOfActivity(
  session: Pick<RunningSession, "activity_type">,
): Extract<Discipline, "run" | "hike"> {
  return session.activity_type === "hiking" ? "hike" : "run";
}

/**
 * Map a calendar event to its discipline. A logged run — or a planned/
 * completed-planned session whose activity is a run — is `run`; the lift
 * equivalents are `lift`. A logged endurance activity whose
 * `activity_type` is `hiking` reads as `hike` (its own clay hue). Planned
 * discipline comes from the plan's `activity_kind`; completed-planned from
 * the logged session it merged with.
 */
export function disciplineOf(event: CalendarEvent): Discipline {
  switch (event.kind) {
    case "run":
      return disciplineOfActivity(event.run);
    case "workout":
      return "lift";
    case "completed-planned":
      // The logged session is always a real endurance activity or workout
      // (lift); an endurance activity is a hike or a run by its type.
      return event.logged.kind === "run" ? disciplineOfActivity(event.logged.run) : "lift";
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
 * How many of each thing a day holds. A `completed-planned` event counts
 * toward its LOGGED discipline (it's one finished activity, so a day reads
 * "1 hike", never "1 planned · 1 hike"); `plans` counts only plans still
 * standing on their own.
 *
 * Shared by the grid cell's aria label and the digest's summary line so the
 * two can't disagree about what a day contained — and so a hike is counted
 * as a hike on both, rather than folded into the run tally.
 */
export type EventCounts = { lifts: number; runs: number; hikes: number; plans: number };

export function countEvents(events: CalendarEvent[]): EventCounts {
  const counts: EventCounts = { lifts: 0, runs: 0, hikes: 0, plans: 0 };
  for (const e of events) {
    if (e.kind === "planned") {
      counts.plans += 1;
      continue;
    }
    switch (disciplineOf(e)) {
      case "hike":
        counts.hikes += 1;
        break;
      case "run":
        counts.runs += 1;
        break;
      default:
        counts.lifts += 1;
    }
  }
  return counts;
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
