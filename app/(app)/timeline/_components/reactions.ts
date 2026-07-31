import type { ReactionType, TimelinePost } from "@/lib/api";

/**
 * The four reaction types in display order, with their emoji + label.
 * Shared by <ReactionBar> (the buttons) and any future surface that needs
 * to render a reaction by type. Ordered most-to-least common so the bar
 * reads left-to-right the way users scan it.
 */
export const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "strong", emoji: "💪", label: "Strong" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
];

/** The glyph + short label rendered on a post card's header. */
export type PostMeta = { emoji: string; label: string };

/** Per-sport meta for `activity` posts, keyed by the post's activity_type. */
const ACTIVITY_META: Record<string, PostMeta> = {
  strength_training: { emoji: "🏋️", label: "Workout" },
  running: { emoji: "🏃", label: "Run" },
  hiking: { emoji: "🥾", label: "Hike" },
  walking: { emoji: "🚶", label: "Walk" },
  cycling: { emoji: "🚴", label: "Ride" },
  other: { emoji: "🤸", label: "Activity" },
};

/**
 * The generic session meta. Deliberately a real, presentable fallback rather
 * than a placeholder: the API registers new activity types without a web
 * deploy (see `TimelinePost.activity_type`), so an unrecognized sport has to
 * render as a plain "Activity" card, not a broken one. Adding a row to
 * ACTIVITY_META upgrades it from generic to specific — it is never the
 * difference between rendering and crashing.
 */
const GENERIC_ACTIVITY_META: PostMeta = { emoji: "🤸", label: "Activity" };

/** Per-domain meta for the two non-session post types. */
const SOURCE_META: Record<string, PostMeta> = {
  pr: { emoji: "🏆", label: "Personal Record" },
  best_effort: { emoji: "⚡", label: "Best Effort" },
};

/**
 * The glyph + label for a post's header: the sport for a session post, the
 * milestone kind for a PR/best-effort post.
 */
export function postMeta(post: Pick<TimelinePost, "source_type" | "activity_type">): PostMeta {
  if (post.source_type !== "activity") {
    return SOURCE_META[post.source_type] ?? GENERIC_ACTIVITY_META;
  }
  return (post.activity_type && ACTIVITY_META[post.activity_type]) || GENERIC_ACTIVITY_META;
}

/** "May 17, 2026 · 6:42 AM" — full, unambiguous post timestamp. */
export function formatOccurredAt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}
