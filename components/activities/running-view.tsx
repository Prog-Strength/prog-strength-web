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
import { StatTile } from "@/components/stat-tile";
import { RunningAnalytics } from "@/components/running-analytics";
import { RunHistoryList } from "../../app/(app)/running/_components/RunHistoryList";
import { UploadTCXModal } from "../../app/(app)/running/_components/UploadTCXModal";

/**
 * Running sub-view of the Activities page. A fixed-bucket metrics banner
 * (week/month/recent pace/all-time) sits above a new analytics card and
 * a timeframe-filtered list of the user's imported runs.
 *
 * The 4-tile metrics banner answers "where am I right now?" and is
 * window-independent — it always uses the API's fixed buckets. The
 * analytics card and the run list below respect the shell's `days`
 * window.
 *
 * The "Upload TCX" button lives on the shell toolbar; the shell toggles
 * `uploadModalOpen` and this view renders the modal so the upload
 * handler keeps direct access to `refetch` + the optimistic insert.
 */
export function RunningView({
  days,
  uploadModalOpen,
  onCloseUploadModal,
}: {
  days: number | null;
  uploadModalOpen: boolean;
  onCloseUploadModal: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const { formatDistance, formatPace, unitLabel } = useDistanceUnit();

  const [metrics, setMetrics] = useState<RunningMetrics | null>(null);
  const [sessions, setSessions] = useState<RunningSession[] | null>(null);
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

  // Fetch metrics + the windowed session list together. Reused on mount,
  // on `days` change, and after an upload so the dashboard reflects the
  // just-imported run. The metrics call is window-independent (fixed
  // buckets); the session list is scoped to the selected timeframe.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Timeframe-filtered fetching: derive a half-open [since, until)
    // window from `days`; omit both for "all".
    const since =
      days !== null ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
    const until = days !== null ? new Date().toISOString() : undefined;
    // /activities forbids mixing since/until with limit/before; the
    // range form is uncapped server-side, so the window itself bounds
    // the result and we don't pass a limit here.
    Promise.all([getRunningMetrics(token, tz), listRunningSessions(token, { since, until })])
      .then(([m, page]) => {
        setError(null);
        setMetrics(m);
        setSessions(page.activities);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load runs");
      });
  }, [router, handleAuthError, days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

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
    <div className="flex flex-col gap-6">
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

      {!error && sessions === null && <p className="text-sm text-[var(--muted)]">Loading runs…</p>}

      {/* Analytics card sits above the list. Rendered whenever sessions
          have resolved; each chart owns its own empty state. */}
      {sessions !== null && (
        <RunningAnalytics
          sessions={sessions}
          days={days}
          truncated={false}
          fetchLimit={0}
          distanceUnit={unitLabel}
        />
      )}

      {sessions && sessions.length === 0 && <EmptyState />}

      {sessions && sessions.length > 0 && <RunHistoryList sessions={sessions} />}

      {uploadModalOpen && (
        <UploadTCXModal
          defaultSport="running"
          onClose={onCloseUploadModal}
          onUploaded={handleUploaded}
        />
      )}
    </div>
  );
}

// Upload affordance lives on the shell toolbar (the "Upload TCX"
// button), so the empty state here is copy-only — it points the user at
// the toolbar button rather than duplicating it.
function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">No runs yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[var(--muted)]">
        Open the activity in Garmin Connect → gear/settings menu → Export to TCX, then use the
        Upload TCX button above to upload the .tcx file.
      </p>
    </div>
  );
}
