import type { ReactionType, TimelineSourceType } from "@/lib/api";

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

/** Per-source-type glyph + short label rendered on a post card's header. */
export const SOURCE_META: Record<TimelineSourceType, { emoji: string; label: string }> = {
  workout: { emoji: "🏋️", label: "Workout" },
  run: { emoji: "🏃", label: "Run" },
  pr: { emoji: "🏆", label: "Personal Record" },
  best_effort: { emoji: "⚡", label: "Best Effort" },
};

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
