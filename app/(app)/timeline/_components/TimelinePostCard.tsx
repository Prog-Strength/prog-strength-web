"use client";

import { useState } from "react";
import Link from "next/link";
import type { Exercise, TimelinePost } from "@/lib/api";
import { ReactionBar } from "./ReactionBar";
import { CommentThread } from "./CommentThread";
import { WorkoutTimelineSummary } from "./WorkoutTimelineSummary";
import { RouteMap } from "./RouteMap";
import { StatRow } from "./StatRow";
import { Avatar } from "@/components/social/Avatar";
import { postMeta, formatOccurredAt } from "./reactions";
import { useProfile } from "@/lib/profile-context";

/**
 * Milestone source types get a celebratory banner across the top of the card;
 * session posts (the day-to-day feed) do not. The copy mirrors the meta in
 * ./reactions but is intentionally separate so the banner can carry its own
 * emphatic tone.
 */
const MILESTONE: Partial<Record<TimelinePost["source_type"], { emoji: string; label: string }>> = {
  pr: { emoji: "🏆", label: "Personal Record" },
  best_effort: { emoji: "⚡", label: "Best Effort" },
};

/**
 * One feed card — a confident athletic ActivityCard. The celebratory milestone
 * banner switches on `source_type` (PR / best effort); the two sport-specific
 * slots switch on `activity_type` — a route map for runs, the expandable
 * exercise/muscle breakdown (<WorkoutTimelineSummary>) for lifts. Every other
 * sport, including ones this build has never heard of, renders the shared body:
 * the API's denormalized `content` block (title/subtitle deep-linking to the
 * source via `content.href`, plus a big-value <StatRow> built from
 * `content.metrics`). That is what lets the API add an activity type without a
 * web deploy. A "You" badge marks the viewer's own posts. Hosts the kudos
 * <ReactionBar> and a comments affordance that toggles the lazy-loading
 * <CommentThread>.
 */
export function TimelinePostCard({
  post,
  // The shared exercise catalog, passed down from the feed so workout cards
  // can resolve exercise names and the muscle radar without a per-card fetch.
  exercises,
}: {
  post: TimelinePost;
  exercises: Exercise[];
}) {
  const { profile } = useProfile();
  const [showComments, setShowComments] = useState(false);
  // Local mirror of the count so the badge updates as the user adds/removes
  // comments in the thread without a feed refetch.
  const [commentCount, setCommentCount] = useState(post.comment_count);

  const meta = postMeta(post);
  const milestone = MILESTONE[post.source_type];
  const author = post.author;
  const authorHref = author.username ? `/u/${author.username}` : null;
  const isMine = !!profile && profile.id === author.user_id;

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
      {milestone && (
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1.5">
          <span aria-hidden="true">{milestone.emoji}</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
            {milestone.label}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Avatar url={author.avatar_url} name={author.display_name} size={40} />
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            {authorHref ? (
              <Link
                href={authorHref}
                className="truncate text-sm font-semibold text-[var(--foreground)] hover:underline"
              >
                {author.display_name}
              </Link>
            ) : (
              <span className="truncate text-sm font-semibold text-[var(--foreground)]">
                {author.display_name}
              </span>
            )}
            {isMine && (
              <span className="rounded-full border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">
                You
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span aria-hidden="true">{meta.emoji}</span>
            <span className="font-semibold uppercase tracking-wider">{meta.label}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatOccurredAt(post.occurred_at)}</span>
          </div>
        </div>
      </div>

      <Link href={post.content.href} className="group flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-[var(--foreground)] group-hover:underline">
          {post.content.title}
        </h2>
        {post.content.subtitle && (
          <p className="text-sm text-[var(--muted)]">{post.content.subtitle}</p>
        )}
      </Link>

      {post.activity_type === "running" && <RouteMap route={post.content.route} />}

      {post.activity_type === "strength_training" && (
        <WorkoutTimelineSummary sourceId={post.source_id} exercises={exercises} />
      )}

      <StatRow metrics={post.content.metrics} />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
        <ReactionBar postId={post.id} reactions={post.reactions} />
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
            showComments
              ? "border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--foreground)]"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <CommentIcon />
          <span className="tabular-nums">{commentCount}</span>
        </button>
      </div>

      {showComments && <CommentThread postId={post.id} onCountChange={setCommentCount} />}
    </article>
  );
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
