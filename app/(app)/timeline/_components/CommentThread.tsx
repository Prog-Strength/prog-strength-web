"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  addTimelineComment,
  deleteTimelineComment,
  getTimelinePost,
  type TimelineComment,
} from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import { useToast } from "@/components/toast";
import { formatOccurredAt } from "./reactions";

const MAX_COMMENT_LEN = 2000;

/**
 * The comment thread for one post: a flat, oldest-first list plus a
 * composer. Comments lazy-load on mount via `getTimelinePost` (the card
 * only mounts this when the user expands it), so the feed page stays cheap.
 *
 * Author identity drives the delete affordance — we only show the delete
 * button on the viewer's own comments, comparing `comment.user_id` against
 * the current user's id from the shared profile context (the same `GET /me`
 * the sidebar reads, so no extra fetch). The API also 404s a non-owned
 * delete, but showing the control only on own comments is the correct UX.
 *
 * `onCountChange` lets the parent card keep its comment-count badge in sync
 * as comments are added/removed.
 */
export function CommentThread({
  postId,
  onCountChange,
}: {
  postId: string;
  onCountChange?: (count: number) => void;
}) {
  const { profile } = useProfile();
  const toast = useToast();
  const currentUserId = profile?.id ?? null;

  const [comments, setComments] = useState<TimelineComment[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Lazy-load the thread once on mount. The post detail endpoint returns
  // comments oldest-first, which is the order we render.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getTimelinePost(token, postId)
      .then((post) => {
        if (cancelled) return;
        setComments(post.comments);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Could not load comments");
      });
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const trimmed = draft.trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= MAX_COMMENT_LEN && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const created = await addTimelineComment(token, postId, trimmed);
      setComments((prev) => {
        const next = [...(prev ?? []), created];
        onCountChange?.(next.length);
        return next;
      });
      setDraft("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (commentId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteTimelineComment(token, postId, commentId);
      setComments((prev) => {
        const next = (prev ?? []).filter((c) => c.id !== commentId);
        onCountChange?.(next.length);
        return next;
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete comment");
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-[var(--border)] pt-3">
      {loadError && <p className="text-xs text-[var(--danger)]">{loadError}</p>}

      {comments === null && !loadError && (
        <p className="text-xs text-[var(--muted)]">Loading comments…</p>
      )}

      {comments !== null && comments.length === 0 && (
        <p className="text-xs text-[var(--muted)]">No comments yet.</p>
      )}

      {comments !== null && comments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className="flex items-start justify-between gap-3 rounded-md bg-[var(--surface-2)] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="whitespace-pre-wrap break-words text-sm text-[var(--foreground)]">
                  {c.body}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  {formatOccurredAt(c.created_at)}
                </p>
              </div>
              {currentUserId && c.user_id === currentUserId && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label="Delete comment"
                  title="Delete comment"
                  className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:text-[var(--danger)]"
                >
                  <TrashIcon />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={MAX_COMMENT_LEN}
          placeholder="Add a comment…"
          aria-label="Add a comment"
          className="w-full resize-y rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
        />
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Posting…" : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
