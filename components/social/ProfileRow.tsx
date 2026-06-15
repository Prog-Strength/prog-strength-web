"use client";

import Link from "next/link";
import type { ProfileSummary, Relationship } from "@/lib/api";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";

/**
 * One profile row shared by search results, follower/following lists, and the
 * requests inbox (where `action` is overridden with Accept/Reject controls).
 *
 * The avatar + name link to the user's profile when they have a `username`
 * handle (a handle-less user — `username` null — renders un-linked, since the
 * profile route is addressed by handle). By default the row's trailing slot is
 * a <FollowButton> carrying the row's own `relationship`; `self` renders a
 * muted "You" instead, and callers can pass `action` to swap in their own
 * controls.
 */
export function ProfileRow({
  user,
  onRelationshipChange,
  action,
}: {
  user: ProfileSummary;
  onRelationshipChange?: (next: Relationship) => void;
  action?: React.ReactNode;
}) {
  const href = user.username ? `/u/${user.username}` : null;

  const identity = (
    <span className="flex min-w-0 items-center gap-3">
      <Avatar url={user.avatar_url} name={user.display_name} size={40} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-[var(--foreground)]">
          {user.display_name}
        </span>
        {user.username && (
          <span className="truncate text-xs text-[var(--muted)]">@{user.username}</span>
        )}
      </span>
    </span>
  );

  // Trailing control: caller-provided `action` wins; otherwise the relationship
  // action — "You" for self, a FollowButton (needs a handle) otherwise.
  let trailing: React.ReactNode;
  if (action !== undefined) {
    trailing = action;
  } else if (user.relationship === "self") {
    trailing = <span className="text-xs text-[var(--muted)]">You</span>;
  } else if (user.username) {
    trailing = (
      <FollowButton
        username={user.username}
        relationship={user.relationship}
        onChange={onRelationshipChange}
        size="sm"
      />
    );
  } else {
    trailing = null;
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      {href ? (
        <Link href={href} className="flex min-w-0 flex-1 items-center transition hover:opacity-80">
          {identity}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center">{identity}</span>
      )}
      {trailing && <span className="shrink-0">{trailing}</span>}
    </div>
  );
}
