"use client";

import { useState } from "react";
import { getToken } from "@/lib/auth";
import { acceptFollow, cancelOrUnfollow, requestFollow, type Relationship } from "@/lib/api";
import { useToast } from "@/components/toast";

/**
 * The follow primary-action button — the one reusable optimistic state machine
 * shared by the profile header, search rows, and follower/following list rows.
 *
 * It maps the viewer's `relationship` to a label + action and flips local state
 * OPTIMISTICALLY before the API call settles, rolling back + toasting on
 * failure (mirrors the Timeline <ReactionBar> pattern). The state machine:
 *
 *   - none      → "Follow"     → requestFollow → "following" or "requested"
 *                 (a public target follows immediately; a private one becomes
 *                 a pending request — the API returns the resulting edge, so we
 *                 reconcile to its `relationship` rather than guessing)
 *   - requested → "Requested"  → cancelOrUnfollow → "none"  (cancel)
 *   - following → "Following"  → cancelOrUnfollow → "none"  (unfollow)
 *   - pending_incoming → "Accept" → acceptFollow → "following"
 *   - self      → renders nothing (the caller shows an "Edit profile" link)
 *
 * `onChange` lets a parent (e.g. the profile header counts, or a list row that
 * wants to drop itself) react to a settled relationship transition.
 */
export function FollowButton({
  username,
  relationship,
  onChange,
  size = "md",
}: {
  username: string;
  relationship: Relationship;
  onChange?: (next: Relationship) => void;
  size?: "sm" | "md";
}) {
  const toast = useToast();
  const [rel, setRel] = useState<Relationship>(relationship);
  const [pending, setPending] = useState(false);

  // The button never renders for `self`; the profile header swaps in an
  // "Edit profile" link for that case.
  if (rel === "self") return null;

  const padding = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";

  // Each transition: optimistically set `next`, fire the API, reconcile to the
  // server's truth where it returns an edge, roll back to `prev` on error.
  const run = async (
    optimistic: Relationship,
    op: (token: string) => Promise<Relationship>,
    failMsg: string,
  ) => {
    if (pending) return;
    const token = getToken();
    if (!token) return;
    const prev = rel;
    setRel(optimistic);
    setPending(true);
    try {
      const settled = await op(token);
      setRel(settled);
      onChange?.(settled);
    } catch (err: unknown) {
      setRel(prev);
      toast.error(err instanceof Error ? err.message : failMsg);
    } finally {
      setPending(false);
    }
  };

  const follow = () =>
    // Optimistically show "Requested"; reconcile to the edge the API returns
    // (a public target comes back "following", a private one "requested").
    run(
      "requested",
      async (token) => (await requestFollow(token, username)).relationship,
      "Could not follow",
    );

  const cancelOrUnfollowAction = () =>
    run(
      "none",
      async (token) => {
        await cancelOrUnfollow(token, username);
        return "none";
      },
      "Could not update follow",
    );

  const accept = () =>
    run(
      "following",
      async (token) => (await acceptFollow(token, username)).relationship,
      "Could not accept request",
    );

  const base = `rounded-full border font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${padding}`;
  const solid = `${base} border-[var(--accent)] bg-[var(--accent)] text-white hover:opacity-80`;
  const outline = `${base} border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]`;

  if (rel === "none") {
    return (
      <button type="button" onClick={follow} disabled={pending} className={solid}>
        Follow
      </button>
    );
  }

  if (rel === "requested") {
    return (
      <button
        type="button"
        onClick={cancelOrUnfollowAction}
        disabled={pending}
        aria-label="Cancel follow request"
        className={`${outline} group`}
      >
        <span className="group-hover:hidden">Requested</span>
        <span className="hidden group-hover:inline">Cancel</span>
      </button>
    );
  }

  if (rel === "following") {
    return (
      <button
        type="button"
        onClick={cancelOrUnfollowAction}
        disabled={pending}
        aria-label="Unfollow"
        className={`${outline} group`}
      >
        <span className="group-hover:hidden">Following</span>
        <span className="hidden group-hover:inline">Unfollow</span>
      </button>
    );
  }

  // pending_incoming — they've asked to follow the viewer.
  return (
    <button type="button" onClick={accept} disabled={pending} className={solid}>
      Accept
    </button>
  );
}
