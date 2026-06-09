"use client";

/**
 * Shared daily-AI-usage state for the authenticated app.
 *
 * Both the settings "Usage" bar and the chat page's capped affordances
 * read off one snapshot so the two surfaces never race to fetch
 * `GET /me/usage` independently. The provider is mounted once in
 * `app/(app)/layout.tsx` (the authed subtree — usage requires a token),
 * wrapping the sidebar + route content.
 *
 * Refresh triggers, per the per-user-daily-usage-cap SOW:
 *   - on mount
 *   - on window `focus` (the user came back to the tab)
 *   - on a 60s interval
 *   - imperatively via `refresh()` (e.g. a chat 429 forces convergence)
 *
 * Concurrent `refresh()` calls coalesce onto a single in-flight fetch so
 * a chat 429 landing at the same moment as the interval tick doesn't
 * double-hit the API. The `tz` query param is the browser's IANA zone so
 * the API anchors the rollover window on the user's local midnight.
 */

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyUsage } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

export type UsageSnapshot = {
  percentUsed: number;
  capped: boolean;
  // Next local midnight (UTC instant). The countdown UIs render
  // `resetsAt - Date.now()`. Epoch (new Date(0)) while still loading /
  // on error, so callers should gate the countdown on `loading`/`error`.
  resetsAt: Date;
  loading: boolean;
  error: string | null;
};

type UsageContextValue = UsageSnapshot & { refresh: () => Promise<void> };

const UsageContext = createContext<UsageContextValue | null>(null);

const REFRESH_INTERVAL_MS = 60_000;

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  // Keep `router` in a ref so `refresh` can stay referentially stable
  // (useRouter() returns a fresh object each render; depending on it
  // directly would re-run the mount effect and double-fetch). The ref is
  // synced in an effect, not during render, per the rules of hooks.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const [snapshot, setSnapshot] = useState<UsageSnapshot>({
    percentUsed: 0,
    capped: false,
    resetsAt: new Date(0),
    loading: true,
    error: null,
  });

  // Holds the in-flight fetch so concurrent refresh() calls share one
  // network round trip rather than stampeding the API.
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return inFlightRef.current;

    const token = getToken();
    if (!token) {
      // No token → stay idle. Drop the loading flag so a signed-out
      // render doesn't spin forever; the (app) layout's auth gate is
      // what actually keeps unauthed users out.
      setSnapshot((prev) => ({ ...prev, loading: false }));
      return;
    }

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const run = (async () => {
      try {
        const data = await getMyUsage(token, tz);
        setSnapshot({
          percentUsed: data.percent_used,
          capped: data.capped,
          resetsAt: new Date(data.resets_at),
          loading: false,
          error: null,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          routerRef.current.replace("/login");
          return;
        }
        // Other failures: surface as `error` so the bar renders
        // "unavailable" — don't crash the authed shell.
        setSnapshot((prev) => ({ ...prev, loading: false, error: msg }));
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;
    return run;
  }, []);

  // Fetch on mount, on window focus, and on a 60s interval.
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const interval = setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, [refresh]);

  const value: UsageContextValue = { ...snapshot, refresh };

  return <UsageContext.Provider value={value}>{children}</UsageContext.Provider>;
}

/**
 * Returns the shared usage snapshot + `refresh`. Throws if used outside a
 * `<UsageProvider>` so a missing provider fails loudly rather than
 * silently rendering an empty bar.
 */
export function useUsage(): UsageContextValue {
  const ctx = useContext(UsageContext);
  if (!ctx) {
    throw new Error("useUsage must be used within a UsageProvider");
  }
  return ctx;
}
