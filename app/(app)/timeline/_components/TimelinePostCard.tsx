"use client";

import { useState } from "react";
import Link from "next/link";
import type { Exercise, TimelinePost } from "@/lib/api";
import { ReactionBar } from "./ReactionBar";
import { CommentThread } from "./CommentThread";
import { WorkoutTimelineSummary } from "./WorkoutTimelineSummary";
import { Avatar } from "@/components/social/Avatar";
import { SOURCE_META, formatOccurredAt } from "./reactions";

/**
 * One feed card. Presentation switches on `source_type` for the header
 * glyph/label; the body renders the API's denormalized `content` block
 * (title, subtitle, metric chips) and deep-links to the source detail page
 * via `content.href`. Workout posts additionally render a concise, expandable
 * exercise breakdown (<WorkoutTimelineSummary>). Hosts the <ReactionBar> and a
 * comments affordance that toggles the lazy-loading <CommentThread>.
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
  const [showComments, setShowComments] = useState(false);
  // Local mirror of the count so the badge updates as the user adds/removes
  // comments in the thread without a feed refetch.
  const [commentCount, setCommentCount] = useState(post.comment_count);

  const meta = SOURCE_META[post.source_type];
  const author = post.author;
  const authorHref = author.username ? `/u/${author.username}` : null;

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center gap-2">
        <Avatar url={author.avatar_url} name={author.display_name} size={32} />
        <div className="flex min-w-0 flex-col">
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
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span aria-hidden="true">{meta.emoji}</span>
            <span className="font-semibold uppercase tracking-wider">{meta.label}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatOccurredAt(post.occurred_at)}</span>
          </div>
        </div>
      </div>

      <Link href={post.content.href} className="group flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-[var(--foreground)] group-hover:underline">
          {post.content.title}
        </h2>
        {post.content.subtitle && (
          <p className="text-xs text-[var(--muted)]">{post.content.subtitle}</p>
        )}
      </Link>

      {post.content.metrics.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {post.content.metrics.map((metric, i) => (
            <li
              key={i}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs tabular-nums text-[var(--foreground)]"
            >
              {metric}
            </li>
          ))}
        </ul>
      )}

      {post.source_type === "workout" && (
        <WorkoutTimelineSummary sourceId={post.source_id} exercises={exercises} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ReactionBar postId={post.id} reactions={post.reactions} />
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          aria-expanded={showComments}
          className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
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
