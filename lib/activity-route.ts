import type { ActivityType, RunningSession } from "@/lib/api";

/**
 * The detail route for one logged endurance session.
 *
 * The unified activity model (api migration 015) gives every non-strength
 * session the same `RunningSession` shape, so a session's *type* — not its
 * shape — decides where it opens. Hiking has its own detail surface
 * (`/hiking/{id}`, retoned and elevation-led); everything else falls back to
 * the run detail page, which is what the walking/cycling types have rendered
 * on since before they had a home of their own.
 *
 * Centralized here (rather than inlined at each `router.push`) so a future
 * per-type surface — a walk page, a ride page — is one edit, not a hunt
 * through every calendar/list/link call site.
 */
export function activityDetailHref(session: Pick<RunningSession, "id" | "activity_type">): string {
  return session.activity_type === "hiking" ? `/hiking/${session.id}` : `/running/${session.id}`;
}

/**
 * The detail route for an activity of ANY type, including strength.
 *
 * `activityDetailHref` above deliberately covers only the endurance shapes —
 * its callers (the calendar, the run/hike lists) never hold a lift. The
 * canonical `/activities/{id}` permalink does: it resolves whatever type the
 * id turns out to be, so it needs the whole table, strength included.
 *
 * Endurance routing delegates to `activityDetailHref` rather than restating
 * it, so the two can never disagree about where a walk opens.
 */
export function activityDetailPath(type: ActivityType, id: string): string {
  if (type === "strength_training") return `/workouts/${id}`;
  return activityDetailHref({ id, activity_type: type });
}
