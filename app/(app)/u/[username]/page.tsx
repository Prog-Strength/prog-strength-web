"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getProfile, type PublicProfile, type Relationship } from "@/lib/api";
import { Avatar } from "@/components/social/Avatar";
import { FollowButton } from "@/components/social/FollowButton";
import { ProfileActivityFeed } from "./_components/ProfileActivityFeed";
import { ProfileStats } from "./_components/ProfileStats";

/**
 * Public profile — `/u/{username}`. Header carries the avatar, display name,
 * @handle, follower/following counts (linking to the list views), and a
 * context-sensitive primary action driven by `relationship` (Edit profile when
 * self, otherwise a <FollowButton>). Below it, the activities tab renders the
 * viewer-scoped feed (or a locked/empty state) via <ProfileActivityFeed>.
 *
 * Shell mirrors timeline/page.tsx: an outer Suspense wrapper (useParams reads
 * the dynamic segment) over an inner client component with a token guard.
 */
export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfilePageInner />
    </Suspense>
  );
}

function ProfilePageInner() {
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = params.username;

  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleAuthError = useCallback((err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("401")) {
      clearToken();
      routerRef.current.replace("/login");
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    getProfile(token, username)
      .then((p) => {
        if (cancelled) return;
        setProfile(p);
        setError(null);
        setNotFound(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (handleAuthError(err)) return;
        const msg = err instanceof Error ? err.message : "Could not load profile";
        if (msg.toLowerCase().includes("not found")) {
          setNotFound(true);
          return;
        }
        setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, [username, router, handleAuthError]);

  // Reconcile the header's follower count when the viewer follows/unfollows so
  // the count stays consistent with the button without a refetch.
  const onRelationshipChange = useCallback((next: Relationship) => {
    setProfile((p) => {
      if (!p) return p;
      const wasFollowing = p.relationship === "following";
      const nowFollowing = next === "following";
      const delta = (nowFollowing ? 1 : 0) - (wasFollowing ? 1 : 0);
      return { ...p, relationship: next, follower_count: Math.max(0, p.follower_count + delta) };
    });
  }, []);

  if (notFound) {
    return (
      <CenteredMessage>
        <p className="text-sm font-medium">Profile not found</p>
        <Link href="/search" className="mt-2 text-xs text-[var(--accent)] hover:underline">
          ← Search people
        </Link>
      </CenteredMessage>
    );
  }

  if (error) {
    return (
      <CenteredMessage>
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      </CenteredMessage>
    );
  }

  if (!profile) {
    return (
      <CenteredMessage>
        <p className="text-sm text-[var(--muted)]">Loading profile…</p>
      </CenteredMessage>
    );
  }

  const handle = profile.username ?? username;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <header className="flex flex-col gap-4 border-b border-[var(--border)] pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar url={profile.avatar_url} name={profile.display_name} size={64} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h1 className="truncate text-xl font-semibold tracking-tight">
                    {profile.display_name}
                  </h1>
                  {profile.username && (
                    <p className="truncate text-sm text-[var(--muted)]">@{profile.username}</p>
                  )}
                  {profile.bio && (
                    <p className="whitespace-pre-wrap text-sm text-[var(--foreground)]">
                      {profile.bio}
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                {profile.relationship === "self" ? (
                  <Link
                    href="/settings"
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
                  >
                    Edit profile
                  </Link>
                ) : (
                  <FollowButton
                    username={handle}
                    relationship={profile.relationship}
                    onChange={onRelationshipChange}
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <Link
                href={`/u/${handle}/followers`}
                className="flex items-baseline gap-1.5 transition hover:opacity-80"
              >
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {profile.follower_count}
                </span>
                <span className="text-[var(--muted)]">Followers</span>
              </Link>
              <Link
                href={`/u/${handle}/following`}
                className="flex items-baseline gap-1.5 transition hover:opacity-80"
              >
                <span className="font-semibold tabular-nums text-[var(--foreground)]">
                  {profile.following_count}
                </span>
                <span className="text-[var(--muted)]">Following</span>
              </Link>
            </div>
          </header>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Stats
            </h2>
            <ProfileStats username={handle} />
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
              Activity
            </h2>
            <ProfileActivityFeed username={handle} />
          </section>
        </div>
      </div>
    </main>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-10 text-center">
      {children}
    </main>
  );
}
