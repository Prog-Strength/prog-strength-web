"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { listExercises, listTimeline, type Exercise, type TimelinePost } from "@/lib/api";
import { TimelinePostCard } from "./TimelinePostCard";

const PAGE_SIZE = 20;

/**
 * The feed body: fetches page 1 on mount, renders the list of
 * <TimelinePostCard>, and exposes a "Load more" affordance driven by the
 * cursor (`next_before`). Each subsequent page is appended to the list;
 * the button hides once the cursor comes back null.
 *
 * Owns its loading / empty / error states. A 401 from any fetch clears the
 * token and bounces to /login, matching the auth posture of the other
 * authed pages.
 */
export function TimelineFeed() {
  const router = useRouter();
  // Keep `router` in a ref so the mount effect can depend on a stable
  // callback (useRouter() returns a fresh object each render; depending on
  // it directly would re-run the page-1 fetch on every render). Synced in
  // an effect, not during render, per the rules of hooks — mirrors
  // lib/profile-context.tsx.
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
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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

  // Page 1 on mount.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    // `loading` starts true; the page only mounts the feed once, so we
    // don't re-set it here (which would be a synchronous setState in an
    // effect). The .finally below clears it when the fetch settles.
    listTimeline(token, { limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setPosts(page.posts);
        setCursor(page.next_before);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Could not load your timeline");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handleAuthError]);

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

  // Manual refresh: re-fetch page 1 and replace the list + cursor with the
  // fresh first page. Guarded so it can't double-fire while in flight. Not
  // polling — a one-shot user action, per the SOW Non-Goals.
  const refresh = async () => {
    const token = getToken();
    if (!token || refreshing) return;
    setRefreshing(true);
    try {
      const page = await listTimeline(token, { limit: PAGE_SIZE });
      setPosts(page.posts);
      setCursor(page.next_before);
      setError(null);
    } catch (err: unknown) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : "Could not refresh your timeline");
      }
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    const token = getToken();
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listTimeline(token, { limit: PAGE_SIZE, before: cursor });
      setPosts((prev) => [...prev, ...page.posts]);
      setCursor(page.next_before);
    } catch (err: unknown) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : "Could not load more posts");
      }
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">Loading your timeline…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-6 text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  const refreshButton = (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      aria-label="Refresh timeline"
      className="self-end rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );

  if (posts.length === 0) {
    return (
      <>
        <div className="flex items-center justify-end">{refreshButton}</div>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm text-[var(--muted)]">
            No activity yet — complete a workout or import a run to see it here.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-end">{refreshButton}</div>

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
