"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import type { ProfilePage, ProfileSummary } from "@/lib/api";
import { ProfileRow } from "./ProfileRow";

/**
 * A paginated, cursored list of profile rows — the shared body behind the
 * followers and following list views (and reusable anywhere a `ProfilePage`
 * feed needs rendering). The caller supplies a `fetchPage(cursor?)` thunk;
 * this owns loading / empty / error states, "Load more" via `next_cursor`,
 * and the 401-clears-token posture.
 */
export function ProfileListView({
  fetchPage,
  emptyMessage,
}: {
  fetchPage: (cursor?: string) => Promise<ProfilePage>;
  emptyMessage: string;
}) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  // fetchPage is typically a fresh closure each render; pin it so the mount
  // effect doesn't re-run (and double-fetch) on every parent re-render.
  const fetchPageRef = useRef(fetchPage);
  useEffect(() => {
    fetchPageRef.current = fetchPage;
  }, [fetchPage]);

  const [users, setUsers] = useState<ProfileSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
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
    fetchPageRef
      .current()
      .then((page) => {
        if (cancelled) return;
        setUsers(page.users);
        setCursor(page.next_cursor);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Could not load list");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [handleAuthError]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPageRef.current(cursor);
      setUsers((prev) => [...prev, ...page.users]);
      setCursor(page.next_cursor);
    } catch (err: unknown) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : "Could not load more");
      }
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">Loading…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-6 text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {users.map((u) => (
        <ProfileRow key={u.user_id} user={u} />
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
