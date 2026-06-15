"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { listExercises, listUserTimeline, type Exercise, type TimelinePost } from "@/lib/api";
import { TimelinePostCard } from "@/app/(app)/timeline/_components/TimelinePostCard";

/**
 * The activities tab on a public profile: the viewer-scoped feed for
 * `username`, rendered with the same <TimelinePostCard> as the self-feed.
 *
 * Three terminal states beyond the list:
 *   - locked  → the API returned `locked: true` (the viewer isn't an accepted
 *               follower of a private user); render the gated message.
 *   - empty   → authorized but no posts yet; render "No activity yet".
 *   - error   → a non-401 failure; 401 clears the token and bounces to /login.
 *
 * Pagination mirrors <TimelineFeed>: append each page and drive "Load more"
 * off the `next_before` cursor. This is a separate component from TimelineFeed
 * (which fetches the self-feed via listTimeline) so neither feed's fetch shape
 * leaks into the other.
 */
export function ProfileActivityFeed({ username }: { username: string }) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [posts, setPosts] = useState<TimelinePost[]>([]);
  // The exercise catalog, fetched once and passed to every card so workout
  // posts can resolve exercise names and the muscle radar. Public catalog —
  // no token needed; failures degrade the cards to title + metric chips.
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!token) return;
    let cancelled = false;
    listUserTimeline(token, username)
      .then((page) => {
        if (cancelled) return;
        setLocked(Boolean(page.locked));
        setPosts(page.posts);
        setCursor(page.next_before);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Could not load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username, handleAuthError]);

  // Exercise catalog on mount, independent of the feed fetch.
  useEffect(() => {
    let cancelled = false;
    listExercises()
      .then((es) => {
        if (!cancelled) setExercises(es);
      })
      .catch(() => {
        // Non-fatal: cards fall back to title + metric chips.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    const token = getToken();
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listUserTimeline(token, username, cursor);
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.next_before);
    } catch (err: unknown) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : "Could not load more activity");
      }
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">Loading activity…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-6 text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--muted)]">
          This user&apos;s activity is visible to accepted followers.
        </p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--muted)]">No activity yet.</p>
      </div>
    );
  }

  return (
    <>
      {posts.map((post) => (
        <TimelinePostCard key={post.id} post={post} exercises={exercises} />
      ))}

      {cursor && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-2 self-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
    </>
  );
}
