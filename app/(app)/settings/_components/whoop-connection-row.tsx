"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/toast";
import { getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { disconnectWhoop, getWhoopConnection, type WhoopConnection } from "@/lib/api";
import { missingAnyScope, underScopedLine } from "@/lib/whoop";

/** The row's two button treatments — the action to take, and the one beside it. */
const ACCENT_BUTTON =
  "rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50";
const QUIET_BUTTON =
  "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50";

/**
 * Whoop connection row. Mirrors GoogleCalendarConnectionRow: reads the
 * connection state on mount, then offers connect / disconnect / reconnect as
 * immediate, out-of-band actions (never governed by the profile draft/SaveBar).
 *
 * States:
 *   - connected but under-scoped → what is missing, in product terms, with
 *     Reconnect ALONGSIDE Disconnect (see below).
 *   - connected → "Connected." (+ connected-since date when present) + Disconnect.
 *   - error → an "attention" line + Reconnect (same OAuth navigation as Connect).
 *   - absent / revoked → recovery-sync copy + Connect Whoop.
 *
 * Connect/Reconnect navigate the browser to the API's OAuth connect endpoint
 * with a return_to that lands back on the Integrations tab, so the OAuth
 * round-trip returns the user to where they started.
 */
export function WhoopConnectionRow() {
  const toast = useToast();
  const [conn, setConn] = useState<WhoopConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // `isCancelled` lets the mount effect drop late updates after unmount
  // (mirrors GoogleCalendarConnectionRow's idiom); `disconnect()` calls it
  // without a guard, so it defaults to never-cancelled.
  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    const token = getToken();
    if (!token) {
      if (isCancelled()) return;
      setLoading(false);
      return;
    }
    try {
      const next = await getWhoopConnection(token);
      if (isCancelled()) return;
      setConn(next);
    } catch {
      // Treat a read failure as "not connected" — the Connect button is a
      // safe default and re-running the OAuth flow is idempotent.
      if (isCancelled()) return;
      setConn({ status: "absent" });
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  // Same OAuth navigation for both Connect and Reconnect: return to the
  // Integrations tab so the ?tab= round-trips through the flow.
  function connect() {
    const returnTo = `${window.location.origin}/settings?tab=integrations`;
    window.location.href = `${config.apiUrl}/auth/whoop/connect?return_to=${encodeURIComponent(
      returnTo,
    )}`;
  }

  async function disconnect() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      await disconnectWhoop(token);
      await load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect Whoop");
    } finally {
      setBusy(false);
    }
  }

  const status = conn?.status;
  const connected = status === "connected";
  const errored = status === "error";
  /**
   * Connected, valid, and still syncing recovery — but missing a scope the
   * user never consented to, so the paths needing it are skipped forever until
   * they re-consent (a Whoop grant is fixed at consent; a token refresh
   * re-sends the scope string but cannot WIDEN the grant).
   *
   * This is a REFINEMENT of `connected`, not a sibling status — the API
   * deliberately keeps capability off the lifecycle enum, so the copy below
   * must test it BEFORE `connected` or the ordinary connected copy wins and the
   * affordance the user needs never appears. `underScopedLine` then picks the
   * words: the sleep sentence when sleep is what is missing, a truthful generic
   * one otherwise — a wrong specific sentence is worse than a vague true one.
   */
  const underScoped = missingAnyScope(conn);

  const statusCopy = loading
    ? "Checking connection…"
    : underScoped
      ? underScopedLine(conn)
      : connected
        ? connectedCopy(conn?.connected_at)
        : errored
          ? "Your Whoop connection needs attention — reconnect to resume syncing."
          : "Connect Whoop to sync your daily recovery and strain.";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">Recovery sync</p>
        <p className="text-xs text-[var(--muted)]">{statusCopy}</p>
      </div>
      {/* An under-scoped connection gets Reconnect IN ADDITION to Disconnect,
          never instead of it: it is a working connection that is still syncing
          recovery, so revoking it has to stay possible. (The `error` state's
          lone Reconnect is not a precedent — that connection is broken.) */}
      <div className="flex shrink-0 items-center gap-2">
        {underScoped && (
          <button type="button" onClick={connect} disabled={loading} className={ACCENT_BUTTON}>
            Reconnect
          </button>
        )}
        {connected ? (
          <button type="button" onClick={disconnect} disabled={busy} className={QUIET_BUTTON}>
            {busy ? "Working…" : "Disconnect"}
          </button>
        ) : (
          <button type="button" onClick={connect} disabled={loading} className={ACCENT_BUTTON}>
            {errored ? "Reconnect" : "Connect Whoop"}
          </button>
        )}
      </div>
    </div>
  );
}

/** "Connected." plus a friendly since-date when the API reports one. */
function connectedCopy(connectedAt: string | undefined): string {
  if (!connectedAt) return "Connected. Your daily recovery and strain sync automatically.";
  const d = new Date(connectedAt);
  if (Number.isNaN(d.getTime()))
    return "Connected. Your daily recovery and strain sync automatically.";
  const since = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `Connected since ${since}. Your daily recovery and strain sync automatically.`;
}
