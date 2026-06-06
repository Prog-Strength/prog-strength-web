"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  getRunningMetrics,
  listRunningSessions,
  type RunningMetrics,
  type RunningSession,
} from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { useToast } from "@/components/toast";
import { StatTile } from "./_components/StatTile";
import { RunListRow } from "./_components/RunListRow";
import { UploadTCXModal } from "./_components/UploadTCXModal";

const PAGE_SIZE = 20;

/**
 * Running dashboard. A stats banner (week/month/recent pace/all-time)
 * sits above a cursor-paginated list of the user's imported runs. The
 * "Upload TCX" button opens a modal that imports a Garmin .tcx; a
 * successful import re-fetches both the metrics and the first page so
 * the new run shows up at the top.
 */
export default function RunningPage() {
  const router = useRouter();
  const toast = useToast();
  const { formatDistance, formatPace, unitLabel } = useDistanceUnit();

  const [metrics, setMetrics] = useState<RunningMetrics | null>(null);
  const [sessions, setSessions] = useState<RunningSession[] | null>(null);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

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

  // Fetch metrics + first page together. Reused on mount and after an
  // upload so the dashboard reflects the just-imported run.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    Promise.all([getRunningMetrics(token, tz), listRunningSessions(token, { limit: PAGE_SIZE })])
      .then(([m, page]) => {
        setError(null);
        setMetrics(m);
        setSessions(page.sessions);
        setNextBefore(page.next_before);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load runs");
      });
  }, [router, handleAuthError]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function loadMore() {
    const token = getToken();
    if (!token || !nextBefore) return;
    setLoadingMore(true);
    listRunningSessions(token, { limit: PAGE_SIZE, before: nextBefore })
      .then((page) => {
        setSessions((prev) => [...(prev ?? []), ...page.sessions]);
        setNextBefore(page.next_before);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load more runs");
      })
      .finally(() => setLoadingMore(false));
  }

  function handleUploaded(session: RunningSession) {
    toast.success("Run imported.");
    refetch();
    // Avoid a flash of stale "from" data — drop in the new run optimistically.
    setSessions((prev) =>
      prev ? [session, ...prev.filter((s) => s.id !== session.id)] : [session],
    );
  }

  const weekDelta = metrics?.current_week.delta_pct_vs_prior_week ?? null;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Running</h1>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90"
        >
          Upload TCX
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {metrics && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile
                value={`${formatDistance(metrics.current_week.distance_meters)} ${unitLabel}`}
                label="This week"
                sub={
                  weekDelta != null
                    ? `${weekDelta >= 0 ? "+" : ""}${weekDelta.toFixed(0)}% vs last week`
                    : undefined
                }
                tone={weekDelta == null ? "neutral" : weekDelta >= 0 ? "positive" : "negative"}
              />
              <StatTile
                value={`${formatDistance(metrics.current_month.distance_meters)} ${unitLabel}`}
                label={`This month · ${metrics.current_month.run_count} runs`}
              />
              <StatTile
                value={
                  metrics.recent_avg_pace_sec_per_km != null
                    ? `${formatPace(metrics.recent_avg_pace_sec_per_km)} /${unitLabel}`
                    : "—"
                }
                label="Avg pace (30d)"
              />
              <StatTile
                value={`${formatDistance(metrics.all_time.distance_meters)} ${unitLabel}`}
                label={`All time · ${metrics.all_time.run_count} runs`}
              />
            </div>
          )}

          {!error && sessions === null && (
            <p className="text-sm text-[var(--muted)]">Loading runs…</p>
          )}

          {sessions && sessions.length === 0 && <EmptyState onUpload={() => setUploadOpen(true)} />}

          {sessions && sessions.length > 0 && (
            <>
              <ul className="flex flex-col gap-2">
                {sessions.map((s) => (
                  <RunListRow key={s.id} session={s} />
                ))}
              </ul>

              {nextBefore && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-1.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {uploadOpen && (
        <UploadTCXModal onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />
      )}
    </main>
  );
}

function EmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">No runs yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[var(--muted)]">
        Open the activity in Garmin Connect → gear/settings menu → Export to TCX, then upload the
        .tcx file here.
      </p>
      <button
        type="button"
        onClick={onUpload}
        className="mt-4 rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90"
      >
        Upload TCX
      </button>
    </div>
  );
}
