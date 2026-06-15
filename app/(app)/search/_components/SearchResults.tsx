"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { searchProfiles, type ProfileSummary } from "@/lib/api";
import { ProfileRow } from "@/components/social/ProfileRow";

const DEBOUNCE_MS = 300;

/**
 * People search: a debounced query input over `searchProfiles`, rendering the
 * server-ranked result rows (each an inline-follow <ProfileRow>) with a
 * cursored "Load more". An empty query clears results rather than searching.
 *
 * Owns its loading / empty / error states and the 401-clears-token posture.
 * Each in-flight search is tagged with a monotonic id so a slow earlier
 * response can't overwrite a newer query's results.
 */
export function SearchResults() {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  // Monotonic search token: only the latest search may commit its results.
  const searchSeq = useRef(0);

  const handleAuthError = useCallback((err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("401")) {
      clearToken();
      routerRef.current.replace("/login");
      return true;
    }
    return false;
  }, []);

  // Debounce the query → run a fresh first-page search. A blank query resets.
  // All state writes live inside the debounced callback (asynchronous), not
  // the effect body, so a fast typist doesn't trigger a cascade of synchronous
  // renders per keystroke. `seq` (bumped on the leading edge) tags the run so a
  // stale earlier response can't commit over a newer query.
  useEffect(() => {
    const q = query.trim();
    const seq = ++searchSeq.current;
    if (!q) {
      // Reset asynchronously so the effect body itself does no setState.
      const reset = setTimeout(() => {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setCursor(null);
        setError(null);
        setSearched(false);
        setLoading(false);
      }, 0);
      return () => clearTimeout(reset);
    }
    const handle = setTimeout(() => {
      const token = getToken();
      if (!token) return;
      setLoading(true);
      searchProfiles(token, q)
        .then((page) => {
          if (seq !== searchSeq.current) return;
          setResults(page.users);
          setCursor(page.next_cursor);
          setError(null);
          setSearched(true);
        })
        .catch((err: unknown) => {
          if (seq !== searchSeq.current) return;
          if (handleAuthError(err)) return;
          setError(err instanceof Error ? err.message : "Search failed");
        })
        .finally(() => {
          if (seq === searchSeq.current) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, handleAuthError]);

  const loadMore = async () => {
    const token = getToken();
    const q = query.trim();
    if (!token || !q || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await searchProfiles(token, q, cursor);
      setResults((prev) => [...prev, ...page.users]);
      setCursor(page.next_cursor);
    } catch (err: unknown) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : "Could not load more results");
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people by name or @handle"
        aria-label="Search people"
        autoFocus
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />

      {error && (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      )}

      {!error && loading && (
        <p className="py-8 text-center text-sm text-[var(--muted)]">Searching…</p>
      )}

      {!error && !loading && searched && results.length === 0 && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm text-[var(--muted)]">No people found.</p>
        </div>
      )}

      {!error && results.length > 0 && (
        <div className="flex flex-col gap-3">
          {results.map((u) => (
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
        </div>
      )}
    </div>
  );
}
