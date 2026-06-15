"use client";

import { Suspense, useCallback, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { listFollowers } from "@/lib/api";
import { ProfileListView } from "@/components/social/ProfileListView";

/**
 * `/u/{username}/followers` — the paginated list of users who follow
 * `username`, reached from the profile header's follower count. Each row links
 * back to the user's profile and carries its own follow action. Shell mirrors
 * timeline/page.tsx (Suspense over useParams + a token guard).
 */
export default function FollowersPage() {
  return (
    <Suspense fallback={null}>
      <FollowersPageInner />
    </Suspense>
  );
}

function FollowersPageInner() {
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
      return listFollowers(token, username, cursor);
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
        <h1 className="text-lg font-semibold tracking-tight">Followers</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <ProfileListView fetchPage={fetchPage} emptyMessage="No followers yet." />
        </div>
      </div>
    </main>
  );
}
