"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  acceptFollow,
  cancelOrUnfollow,
  listFollowRequests,
  rejectFollow,
  type FollowRequest,
} from "@/lib/api";
import { useToast } from "@/components/toast";
import { ProfileRow } from "@/components/social/ProfileRow";

type Direction = "incoming" | "outgoing";

/**
 * The follow-requests inbox with two tabs:
 *   - Incoming: others asking to follow the viewer — Accept / Reject per row.
 *   - Outgoing: the viewer's own still-pending requests — Cancel per row.
 *
 * Both actions are OPTIMISTIC: the row is removed from the list immediately,
 * then the API call fires; on failure the row is restored and a toast shown
 * (mirrors the <ReactionBar> rollback pattern). A 401 from any call clears the
 * token and bounces to /login. Switching tabs re-fetches that direction's page.
 */
export function RequestsInbox() {
  const router = useRouter();
  const toast = useToast();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [direction, setDirection] = useState<Direction>("incoming");
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Set<string>>(new Set());

  const handleAuthError = useCallback((err: unknown): boolean => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("401")) {
      clearToken();
      routerRef.current.replace("/login");
      return true;
    }
    return false;
  }, []);

  // (Re)load the current direction's first page whenever the tab changes. The
  // fetch (and its setState writes, including the `setLoading(true)` reset) run
  // in a microtask rather than synchronously in the effect body, so flipping
  // tabs doesn't trigger a cascading synchronous render.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setLoading(true);
      listFollowRequests(token, direction)
        .then((page) => {
          if (cancelled) return;
          setRequests(page.requests);
          setCursor(page.next_cursor);
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          if (handleAuthError(err)) return;
          setError(err instanceof Error ? err.message : "Could not load requests");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => {
      cancelled = true;
    };
  }, [direction, handleAuthError]);

  const loadMore = async () => {
    const token = getToken();
    if (!token || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listFollowRequests(token, direction, cursor);
      setRequests((prev) => [...prev, ...page.requests]);
      setCursor(page.next_cursor);
    } catch (err: unknown) {
      if (!handleAuthError(err)) {
        setError(err instanceof Error ? err.message : "Could not load more requests");
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // Optimistically drop the row, fire `op`, restore on failure.
  const act = async (
    req: FollowRequest,
    handle: string,
    op: (token: string) => Promise<unknown>,
    failMsg: string,
  ) => {
    if (acting.has(req.user_id)) return;
    const token = getToken();
    if (!token) return;
    setActing((s) => new Set(s).add(req.user_id));
    const snapshot = requests;
    setRequests((prev) => prev.filter((r) => r.user_id !== req.user_id));
    try {
      await op(token);
    } catch (err: unknown) {
      setRequests(snapshot);
      if (!handleAuthError(err)) {
        toast.error(err instanceof Error ? err.message : failMsg);
      }
    } finally {
      setActing((s) => {
        const next = new Set(s);
        next.delete(req.user_id);
        return next;
      });
    }
  };

  const rowAction = (req: FollowRequest) => {
    // Requests are addressed by the other party's handle. A handle-less party
    // can't be acted on by username; render a muted note instead.
    const handle = req.username;
    const busy = acting.has(req.user_id);
    if (!handle) {
      return <span className="text-xs text-[var(--muted)]">—</span>;
    }
    if (direction === "incoming") {
      return (
        <span className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(req, handle, (t) => acceptFollow(t, handle), "Could not accept")}
            className="rounded-full border border-[var(--accent)] bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act(req, handle, (t) => rejectFollow(t, handle), "Could not reject")}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => act(req, handle, (t) => cancelOrUnfollow(t, handle), "Could not cancel")}
        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Cancel
      </button>
    );
  };

  const emptyMessage = direction === "incoming" ? "No pending requests." : "No outgoing requests.";

  return (
    <div className="flex flex-col gap-4">
      <div
        role="tablist"
        aria-label="Request direction"
        className="flex gap-2 border-b border-[var(--border)]"
      >
        {(["incoming", "outgoing"] as const).map((d) => (
          <button
            key={d}
            role="tab"
            type="button"
            aria-selected={direction === d}
            onClick={() => setDirection(d)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              direction === d
                ? "border-[var(--accent)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {d === "incoming" ? "Incoming" : "Outgoing"}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">Loading requests…</p>
      ) : error ? (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--danger)]">{error}</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
          <p className="text-sm text-[var(--muted)]">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {requests.map((req) => (
            <ProfileRow key={req.user_id} user={req} action={rowAction(req)} />
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
