"use client";

import { Suspense, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { listFollowing } from "@/lib/api";
import { ProfileListView } from "@/components/social/ProfileListView";

/**
 * `/u/{username}/following` — the paginated list of users `username` follows,
 * reached from the profile header's following count. Mirrors the followers
 * page (Suspense over useParams + a token guard); rows link back to profiles
 * and carry their own follow action.
 */
export default function FollowingPage() {
  return (
    <Suspense fallback={null}>
      <FollowingPageInner />
    </Suspense>
  );
}

function FollowingPageInner() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = params.username;

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  const fetchPage = useCallback(
    (cursor?: string) => {
      const token = getToken();
      if (!token) return Promise.resolve({ users: [], next_cursor: null });
      return listFollowing(token, username, cursor);
    },
    [username],
  );

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-6 py-4">
        <Link
          href={`/u/${username}`}
          className="w-fit text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
        >
          ← @{username}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Following</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <ProfileListView fetchPage={fetchPage} emptyMessage="Not following anyone yet." />
        </div>
      </div>
    </main>
  );
}
