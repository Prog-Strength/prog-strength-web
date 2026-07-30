import type { RunningSession } from "@/lib/api";

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
