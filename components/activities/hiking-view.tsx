"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { listHikingSessions, type RunningSession } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { deriveHikingStats } from "@/lib/hiking-stats";
import { useToast } from "@/components/toast";
import { StatTile } from "@/components/stat-tile";
import { HikeHistoryList } from "../../app/(app)/hiking/_components/HikeHistoryList";
import { UploadTCXModal } from "../../app/(app)/running/_components/UploadTCXModal";

/**
 * Hiking sub-view of the Activities page. A six-tile summary banner
 * (distance, vertical gain, high/low point, avg pace, gain-per-distance)
 * sits above a timeframe-filtered list of the user's imported hikes.
 *
 * Unlike Running, Hiking has no fixed-bucket metrics endpoint and no
 * analytics card — the tiles are derived from the same windowed session
 * list the history renders (one fetch), so everything respects the shell's
 * `days` window. The tiles come straight from `deriveHikingStats`, which
 * skips null-elevation rows so a missing altitude track reads as "—", not 0.
 *
 * The "Upload TCX" button lives on the shell toolbar; the shell toggles
 * `uploadModalOpen` and this view renders the modal (defaulting the sport
 * pill to Hike) so the upload handler keeps direct access to `refetch` +
 * the optimistic insert.
 */
export function HikingView({
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
  const { formatDistance, formatPace, formatElevation, unit, unitLabel } = useDistanceUnit();

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

  // Fetch the windowed hike list. Reused on mount, on `days` change, and
  // after an upload so the dashboard reflects the just-imported hike.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    // Timeframe-filtered fetching: derive a half-open [since, until)
    // window from `days`; omit both for "all".
    const since =
      days !== null ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString() : undefined;
    const until = days !== null ? new Date().toISOString() : undefined;
    listHikingSessions(token, { since, until })
      .then((page) => {
        setError(null);
        setSessions(page.activities);
      })
      .catch((err: unknown) => {
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Failed to load hikes");
      });
  }, [router, handleAuthError, days]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function handleUploaded(session: RunningSession) {
    toast.success("Hike imported.");
    refetch();
    // Avoid a flash of stale "from" data — drop in the new hike optimistically.
    setSessions((prev) =>
      prev ? [session, ...prev.filter((s) => s.id !== session.id)] : [session],
    );
  }

  const stats = deriveHikingStats(sessions);

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {sessions !== null && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile
            value={`${formatDistance(stats.totalDistanceMeters)} ${unitLabel}`}
            label="DISTANCE"
          />
          <StatTile value={formatElevation(stats.totalGainMeters)} label="VERTICAL GAIN" />
          <StatTile value={formatElevation(stats.highPointMeters)} label="HIGH POINT" />
          <StatTile value={formatElevation(stats.lowPointMeters)} label="LOW POINT" />
          <StatTile
            value={
              stats.avgPaceSecPerKm != null
                ? `${formatPace(stats.avgPaceSecPerKm)} /${unitLabel}`
                : "—"
            }
            label="AVG PACE"
          />
          <StatTile
            value={formatElevation(unit === "km" ? stats.gainPerKmMeters : stats.gainPerMileMeters)}
            label={unit === "km" ? "GAIN / KM" : "GAIN / MI"}
          />
        </div>
      )}

      {!error && sessions === null && <p className="text-sm text-[var(--muted)]">Loading hikes…</p>}

      {sessions && sessions.length === 0 && <EmptyState />}

      {sessions && sessions.length > 0 && <HikeHistoryList sessions={sessions} />}

      {uploadModalOpen && (
        <UploadTCXModal
          defaultSport="hiking"
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
      <p className="text-sm font-medium">No hikes yet</p>
      <p className="mx-auto mt-2 max-w-md text-xs text-[var(--muted)]">
        Open the activity in Garmin Connect → gear/settings menu → Export to TCX, then use the
        Upload TCX button above to upload the .tcx file.
      </p>
    </div>
  );
}
