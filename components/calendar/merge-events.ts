import type { CompletedSessionKind, PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import type { CalendarEvent } from "@/components/calendar/types";

/**
 * Local-date key in `YYYY-M-D` form (zero-padding not required since we
 * only compare equality, not lex-sort). Using local time deliberately —
 * the user's mental model of "what day was that workout" is local-tz, even
 * if the API timestamps came across in UTC.
 *
 * Lives here (rather than in the calendar page) so the page and the pure
 * event-bucketing logic share one definition without a circular import.
 */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Bucket every workout, run, and planned workout by local-date key, with
 * one transform: a completed planned session and the logged session that
 * fulfilled it collapse into a single `completed-planned` event when both
 * fall on the same local day. That keeps a planned-ahead workout from
 * showing as two near-identical entries (a planned pill stacked on its
 * own logged pill) once it's done.
 *
 * Merge rules:
 *  - Only `status === "completed"` plans with a `completed_session_id`
 *    merge. Planned and skipped plans pass through unchanged.
 *  - The linked logged session must be present in the supplied data AND
 *    share the plan's local day. If it's missing (e.g. logged in another
 *    month outside the fetch window) or lands on a different day, nothing
 *    collapses — the plan stays a standalone `planned` event (carrying its
 *    own "View logged" link) and the logged session stays standalone too.
 *  - A merged event sorts by the LOGGED session's start time (when it
 *    actually happened), not the planned slot.
 *
 * Pure and deterministic — no Date.now()/timezone surprises beyond the
 * local-date bucketing the rest of the calendar already relies on.
 */
export function buildEventsByDate(
  workouts: Workout[],
  runs: RunningSession[],
  planned: PlannedWorkout[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  const push = (key: string, ev: CalendarEvent) => {
    const list = map.get(key);
    if (list) list.push(ev);
    else map.set(key, [ev]);
  };

  const workoutsById = new Map(workouts.map((w) => [w.id, w]));
  const runsById = new Map(runs.map((r) => [r.id, r]));

  // Logged-session ids folded into a merged event, so the standalone
  // passes below skip them. Planned ids that merged, so they aren't also
  // emitted as their own planned event.
  const consumedWorkoutIds = new Set<string>();
  const consumedRunIds = new Set<string>();
  const mergedPlannedIds = new Set<string>();

  // First pass: find same-day linked pairs and emit the merged event.
  // The linked session's KIND is derived by resolving its id against the
  // supplied data (a workout id resolves in workoutsById, an endurance
  // session in runsById) — the API no longer sends completed_session_kind
  // (dropped in unified-cleanup). An id resolving in neither map behaves
  // exactly like the old missing-session guard: nothing collapses and the
  // plan stays a standalone `planned` event.
  for (const p of planned) {
    if (p.status !== "completed" || !p.completed_session_id) {
      continue;
    }
    const plannedKey = localDateKey(new Date(p.scheduled_start));

    const w = workoutsById.get(p.completed_session_id);
    if (w) {
      const start = new Date(w.performed_at);
      if (localDateKey(start) !== plannedKey) continue; // cross-day: don't collapse
      consumedWorkoutIds.add(w.id);
      mergedPlannedIds.add(p.id);
      push(localDateKey(start), {
        kind: "completed-planned",
        startMs: start.getTime(),
        planned: p,
        logged: { kind: "workout", workout: w },
      });
      continue;
    }
    const r = runsById.get(p.completed_session_id);
    if (r) {
      const start = new Date(r.start_time);
      if (localDateKey(start) !== plannedKey) continue; // cross-day: don't collapse
      consumedRunIds.add(r.id);
      mergedPlannedIds.add(p.id);
      push(localDateKey(start), {
        kind: "completed-planned",
        startMs: start.getTime(),
        planned: p,
        logged: { kind: "run", run: r },
      });
    }
  }

  // Standalone passes: everything not folded into a merged event.
  for (const w of workouts) {
    if (consumedWorkoutIds.has(w.id)) continue;
    const start = new Date(w.performed_at);
    push(localDateKey(start), { kind: "workout", startMs: start.getTime(), workout: w });
  }
  for (const r of runs) {
    if (consumedRunIds.has(r.id)) continue;
    const start = new Date(r.start_time);
    push(localDateKey(start), { kind: "run", startMs: start.getTime(), run: r });
  }
  for (const p of planned) {
    if (mergedPlannedIds.has(p.id)) continue;
    const start = new Date(p.scheduled_start);
    // A completed-but-not-collapsed plan (cross-day within the window)
    // still gets its logged session's kind derived by id resolution, so
    // the digest's "View logged run/workout →" link keeps working. An
    // out-of-window session leaves it undefined (link hidden).
    let completedSessionKind: CompletedSessionKind | undefined;
    if (p.status === "completed" && p.completed_session_id) {
      if (workoutsById.has(p.completed_session_id)) completedSessionKind = "workout";
      else if (runsById.has(p.completed_session_id)) completedSessionKind = "activity";
    }
    push(localDateKey(start), {
      kind: "planned",
      startMs: start.getTime(),
      planned: p,
      completedSessionKind,
    });
  }

  // Within each day, sort by start time so morning shows above evening.
  for (const list of map.values()) {
    list.sort((a, b) => a.startMs - b.startMs);
  }
  return map;
}
