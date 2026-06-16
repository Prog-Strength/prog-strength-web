"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { getProfileStats, type ProfileStats as ProfileStatsData } from "@/lib/api";
import { formatHours, formatYTick } from "@/lib/chart-format";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { WeeklySeriesChart } from "@/components/profile-stats-chart";

/**
 * The weekly graphs on a public profile: lift-session minutes and running
 * distance over the trailing 12 weeks, from GET /users/{username}/stats.
 *
 * States mirror <ProfileActivityFeed> for consistency:
 *   - locked → the API returned `locked: true` (the viewer isn't an accepted
 *              follower of a private user); render the same gated message, no
 *              charts.
 *   - empty  → authorized but every week of both series is zero; render the
 *              same "No activity yet." message rather than two flat lines.
 *   - error  → a non-401 failure; a 401 clears the token and bounces to /login.
 *
 * The two charts are dumb <WeeklySeriesChart>s; this component owns the fetch,
 * the empty/locked decision, and the per-series value formatting (minutes via
 * formatHours; meters converted to the viewer's distance unit).
 */
export function ProfileStats({ username }: { username: string }) {
  const router = useRouter();
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  const { unit, formatDistance } = useDistanceUnit();

  const [stats, setStats] = useState<ProfileStatsData | null>(null);
  const [loading, setLoading] = useState(true);
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
    getProfileStats(token, username)
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (handleAuthError(err)) return;
        setError(err instanceof Error ? err.message : "Could not load stats");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username, handleAuthError]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-[var(--muted)]">Loading stats…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--danger)] bg-[var(--surface)] px-4 py-6 text-center">
        <p className="text-sm text-[var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!stats || stats.locked) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--muted)]">
          This user&apos;s activity is visible to accepted followers.
        </p>
      </div>
    );
  }

  // No activity → render the empty state rather than two flat-line charts.
  // Both series are dense and zero-filled, so "every point is zero" is the
  // no-activity signal.
  const hasActivity =
    stats.lift_session_minutes.some((p) => p.value > 0) ||
    stats.running_distance_meters.some((p) => p.value > 0);

  if (!hasActivity) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center">
        <p className="text-sm text-[var(--muted)]">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-[var(--muted)]">Weekly lifting time</h3>
        <WeeklySeriesChart
          points={stats.lift_session_minutes}
          label="Total"
          valueFormatter={formatHours}
          yTickFormatter={formatYTick}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-medium text-[var(--muted)]">Weekly running distance</h3>
        <WeeklySeriesChart
          points={stats.running_distance_meters}
          label="Distance"
          unitLabel={unit}
          valueFormatter={(meters) => `${formatDistance(meters)} ${unit}`}
        />
      </div>
    </div>
  );
}
