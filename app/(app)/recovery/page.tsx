"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  getWhoopConnection,
  listWhoopRecovery,
  type WhoopConnection,
  type WhoopRecoveryDay,
} from "@/lib/api";
import { isoDate, rangeSinceIso } from "@/lib/steps-stats";
import { latestForToday } from "@/lib/recovery";
import { SegmentedToggle } from "@/components/segmented-toggle";
import { RecoveryHero } from "./_components/recovery-hero";
import { RecoveryTrends } from "./_components/recovery-trends";
import { RecoveryLog } from "./_components/recovery-log";

type RangeKey = "7" | "30" | "90";
const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7", label: "7d" },
  { value: "30", label: "30d" },
  { value: "90", label: "90d" },
];

/**
 * Recovery — Whoop's daily readiness given a first-class home. Web-only,
 * read-only: the data is Whoop-owned and arrives each morning. One fetch per
 * range selection feeds the hero (today's score ring), the trend charts, and
 * the day log; a render gate ahead of them handles the no/broken-connection and
 * first-night states. All data flows through the existing GET /whoop/recovery
 * endpoint using the house timezone + local-date convention.
 */
export default function RecoveryPage() {
  const router = useRouter();
  const [range, setRange] = useState<RangeKey>("30");
  const [conn, setConn] = useState<WhoopConnection | null>(null);
  const [rows, setRows] = useState<WhoopRecoveryDay[] | null>(null);
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

  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const days = Number(range);
    const since = rangeSinceIso(days);
    const until = isoDate(new Date());
    setRows(null);
    setError(null);
    Promise.all([getWhoopConnection(token), listWhoopRecovery(token, { timezone, since, until })])
      .then(([c, r]) => {
        setConn(c);
        setRows(r);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load recovery");
      });
  }, [router, handleAuthError, range]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const todayIso = isoDate(new Date());
  const today = useMemo(() => (rows ? latestForToday(rows, todayIso) : null), [rows, todayIso]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Recovery</h1>
        <p className="text-sm text-[var(--muted)]">
          Your daily readiness from Whoop — recovery score, resting heart rate, and HRV.
        </p>
      </header>

      {error && (
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {conn === null && rows === null && !error && (
        <p className="text-sm text-[var(--muted)]">Loading recovery…</p>
      )}

      {conn !== null &&
        (conn.status === "absent" || conn.status === "revoked" ? (
          <ConnectState variant="connect" />
        ) : conn.status === "error" ? (
          <ConnectState variant="reconnect" />
        ) : rows !== null && rows.length === 0 ? (
          <FirstNightState />
        ) : rows !== null ? (
          <>
            <RecoveryHero today={today} />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">Trends</h2>
              <SegmentedToggle value={range} options={RANGE_OPTIONS} onChange={setRange} />
            </div>
            <RecoveryTrends rows={rows} />
            <RecoveryLog rows={rows} />
          </>
        ) : null)}
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
