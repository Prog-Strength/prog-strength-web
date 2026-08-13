"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getRecoveryHistory, getWhoopConnection, type WhoopConnection } from "@/lib/api";
import { adaptRecovery, type RecoveryView } from "@/lib/dashboard";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { useIsMobile } from "@/lib/use-is-mobile";
import { Deck, PLOT_HEIGHTS, PLOT_HEIGHTS_MOBILE } from "./_components/deck";
import { Ledger } from "./_components/ledger";
import { WindowStrip } from "./_components/window-strip";
import { ledgerRows, tail, WINDOWS, type WindowKey } from "./_components/shared";

/**
 * Recovery — HISTORY AND DEPTH, and nothing else.
 *
 * The dashboard's five recovery tiles already answer *how am I this morning?*
 * above the fold, without a click: the score ring, the morning vitals, the HRV
 * balance chart, the log and the resting-HR tile between them leave this page
 * with no reason to print today's number bigger. So it does not. What a tile
 * cannot hold — long windows, the full ledger, three metrics compared across
 * weeks — is the whole of this page's job, and every register below serves it:
 * a window strip that describes a stretch of time rather than a morning, one
 * bordered deck binding HRV, recovery score and resting HR to ONE time axis and
 * one crosshair, and a ledger paginated over all stored history so a user can
 * reach March.
 *
 * ONE FETCH FEEDS EVERYTHING. `GET /recovery/history` with no `since` asks for
 * all stored history, `GET /me/whoop/connection` drives the render gates, and
 * the two go out together in a single `Promise.all` on mount. The payload is
 * mapped by `adaptRecovery` — the dashboard's own adapter, exported rather than
 * re-written, because a second adapter is a second place for the band fields to
 * be mis-mapped.
 *
 * THE THREE WINDOWS ARE SLICES OF THAT ONE PAYLOAD, NOT THREE REQUESTS.
 * `30d · 90d · 1y` re-slices `view.days` in memory; `refetch` deliberately does
 * NOT depend on `windowKey`, so switching windows issues no request at all.
 * `page.test.tsx` pins it — one call per load, zero per window change — because
 * the cheapest way to lose it is a well-meaning `[windowKey]` added to the
 * callback's deps.
 *
 * The crosshair's morning is owned HERE, as an ISO date, because two registers
 * read it: the deck draws the rule and the ledger highlights the row. The
 * ledger's page number is owned here too, and only ever moves when the user
 * moves it — selecting a morning that lives on page 11 surfaces a jump link and
 * waits, rather than re-paging the ledger underneath the user's hands.
 */
export default function RecoveryPage() {
  const router = useRouter();
  const [windowKey, setWindowKey] = useState<WindowKey>("90d");
  /** The crosshair's morning, shared by the deck and the ledger. */
  const [selected, setSelected] = useState<string | null>(null);
  /** The ledger's page. 1-indexed, and correction 3: it opens on page 1. */
  const [page, setPage] = useState(1);
  const [conn, setConn] = useState<WhoopConnection | null>(null);
  const [view, setView] = useState<RecoveryView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleAuthError = useCallback(
    (err: unknown): boolean => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("401")) {
        clearToken();
        router.replace("/login");
        return true;
      }
      return false;
    },
    [router],
  );

  /**
   * The page's only request, and it runs once.
   *
   * `windowKey` is NOT a dependency and must not become one — see the header.
   * The two requests go in parallel because neither needs the other: the
   * connection drives the gates, the history fills them, and waiting for the
   * first before starting the second would add a round-trip to every load for
   * no information.
   *
   * Nothing is set synchronously here. `loading` starts true and the resets
   * belong to the retry handler, so the mount effect below calls a function
   * that only ever touches state from a promise callback.
   */
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    Promise.all([getWhoopConnection(token), getRecoveryHistory(token, { timezone })])
      .then(([connection, recovery]) => {
        setConn(connection);
        setView(recovery === null ? null : adaptRecovery(recovery));
        setLoading(false);
      })
      .catch((err: unknown) => {
        // A 401 has already cleared the token and left for /login; painting a
        // banner on a page being navigated away from would flash for a frame.
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load recovery");
        setLoading(false);
      });
  }, [router, handleAuthError]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function retry() {
    setError(null);
    setLoading(true);
    refetch();
  }

  const spec = WINDOWS.find((w) => w.key === windowKey) ?? WINDOWS[1];
  const days = useMemo(() => view?.days ?? [], [view]);
  /**
   * Mornings Whoop actually recorded — the count of REAL rows, which is the
   * same figure the ledger's own header prints and is deliberately not
   * `days.length`. The endpoint materializes a date-aligned window, so a user
   * with three months of strap data receives a year of slots; counting those
   * would tell them they have a year of mornings, and would disagree with the
   * ledger two registers down on the same screen.
   */
  const recorded = useMemo(() => ledgerRows(days).length, [days]);
  const windowDays = useMemo(() => tail(days, spec.days), [days, spec.days]);

  // Connected, and at least one morning actually landed. `view === null` is the
  // payload-less case (a connected account the endpoint has nothing for yet);
  // `recorded === 0` is the materialized-slots case. Both are the first night.
  const ready = conn !== null && conn.status === "connected" && view !== null && recorded > 0;
  const showWindows = loading || ready;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-4 px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Recovery
          </h1>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            History and depth — three metrics on one time axis
            {ready && (
              <>
                {" · "}
                <span className="font-mono tabular-nums">{recorded}</span> mornings stored
              </>
            )}
          </p>
        </div>
        {showWindows && (
          <div className="shrink-0">
            <SegmentedToggle
              value={windowKey}
              options={WINDOWS.map((w) => ({ value: w.key, label: w.label }))}
              onChange={setWindowKey}
              // Nothing to re-slice yet. The control renders anyway so the
              // header does not reflow when the payload lands.
              disabled={loading}
            />
          </div>
        )}
      </header>

      {/* The banner is the current page's, kept word for word — a failed load
          reads the same on every surface in this app. What it gains is a way
          out: `Try again` re-issues the same one-shot fetch rather than asking
          the user to reload the route. */}
      {error && (
        <div className="flex flex-col items-start gap-2">
          <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
            {error}
          </div>
          <button
            type="button"
            onClick={retry}
            className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Try again
          </button>
        </div>
      )}

      {loading && !error && <DeckSkeleton />}

      {!loading &&
        !error &&
        conn !== null &&
        (conn.status === "absent" || conn.status === "revoked" ? (
          <ConnectState variant="connect" />
        ) : conn.status === "error" ? (
          <ConnectState variant="reconnect" />
        ) : view === null || recorded === 0 ? (
          <FirstNightState />
        ) : (
          <>
            <WindowStrip caption={spec.caption} days={windowDays} />
            <Deck
              view={view}
              windowLength={spec.days}
              caption={spec.caption}
              selected={selected}
              onSelect={setSelected}
            />
            {/* ALL stored history, never the window: the deck answers "how has
                this stretch been", the ledger answers "what was the number on
                the 6th of March". */}
            <Ledger days={days} selectedDate={selected} page={page} onPage={setPage} />
            <div className="flex justify-end pb-2">
              <Link
                href="/settings?tab=integrations"
                className="text-[11px] text-[var(--accent)] transition hover:opacity-80"
              >
                Manage Whoop connection →
              </Link>
            </div>
          </>
        ))}
    </div>
  );
}

/**
 * The loading state, and it is the deck's own geometry rather than a spinner.
 *
 * A centred spinner tells the user nothing about what is coming and then throws
 * the whole page down the screen when it arrives. These blocks are the strip and
 * the three deck rows at the exact heights `deck.tsx` draws — IMPORTED from it,
 * not copied, because "the exact heights" is a promise a second set of literals
 * would be free to stop keeping the first time a row is retuned — including the
 * mobile heights, read from the same `useIsMobile()` the deck reads so the two
 * switch on the same pixel. The payload lands into a page the same shape.
 *
 * `role="status"` with a name, because a shimmer is invisible to a screen reader
 * and "nothing has happened yet" is exactly what such a user needs told.
 */
function DeckSkeleton() {
  const isMobile = useIsMobile();
  const heights = isMobile ? PLOT_HEIGHTS_MOBILE : PLOT_HEIGHTS;
  const rows = [heights.hrv, heights.score, heights.rhr];

  return (
    <div role="status" aria-label="Loading recovery history" className="flex flex-col gap-4">
      <div className="border-y border-[var(--border)] py-4" aria-hidden="true">
        <div className="mb-3 h-[10px] w-40 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex animate-pulse flex-col gap-1">
              <div className="h-[24px] w-16 rounded bg-[var(--surface-2)]" />
              <div className="h-[11px] w-12 rounded bg-[var(--surface-2)]" />
              <div className="h-[10px] w-24 rounded bg-[var(--surface-2)]" />
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]"
        aria-hidden="true"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2">
          <div className="h-[10px] w-36 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-[11px] w-20 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
        <div className="divide-y divide-[var(--border)]">
          {rows.map((height, i) => (
            <div key={i} className="grid grid-cols-1 py-3 sm:grid-cols-[132px_minmax(0,1fr)]">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 sm:flex-col sm:items-start sm:gap-1.5 sm:pr-3 sm:pl-4">
                <div className="h-[10px] w-16 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-[16px] w-10 animate-pulse rounded bg-[var(--surface-2)]" />
                <div className="h-[9px] w-14 animate-pulse rounded bg-[var(--surface-2)]" />
              </div>
              <div className="mt-2 px-4 sm:mt-0 sm:px-0 sm:pr-4">
                <div
                  className="w-full animate-pulse rounded bg-[var(--surface-2)]"
                  style={{ height }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Empty state for a missing/revoked (connect) or errored (reconnect) link. */
function ConnectState({ variant }: { variant: "connect" | "reconnect" }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-base font-semibold">Connect Whoop to see your recovery</p>
      <p className="max-w-md text-sm text-[var(--muted)]">
        {variant === "reconnect"
          ? "Whoop connection needs attention — reconnect to resume your daily recovery score, resting heart rate, and HRV."
          : "Whoop sends your recovery score, resting heart rate, and HRV each morning. Connect your account to track them here."}
      </p>
      <Link
        href="/settings?tab=integrations"
        className="inline-flex items-center rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)] hover:opacity-80"
      >
        {variant === "reconnect" ? "Reconnect in Settings" : "Connect Whoop"}
      </Link>
    </div>
  );
}

/** Connected, but no rows have landed yet. */
function FirstNightState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-base font-semibold">No recovery data yet</p>
      <p className="max-w-md text-sm text-[var(--muted)]">
        Your first recovery lands after tonight&apos;s sleep.
      </p>
    </div>
  );
}
