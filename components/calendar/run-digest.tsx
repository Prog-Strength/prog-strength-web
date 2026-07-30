"use client";

import Link from "next/link";
import { disciplineOfActivity } from "@/components/calendar/derivations";
import { activityDetailHref } from "@/lib/activity-route";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatDuration } from "@/lib/format";
import type { RunningSession } from "@/lib/api";

/**
 * Compact, read-only stat list for a single logged endurance session, sized
 * to render inside a calendar day dropdown. No charts or splits — just the
 * headline metrics as label/value pairs, plus a link out to the full detail
 * page. All unit math goes through the DistanceUnitContext formatters.
 *
 * The link's target AND its noun come from the session's own type, so a hike
 * offers "View full hike details" pointing at `/hiking/{id}` rather than
 * inviting the user into the run surface.
 *
 * Note: there's no location/route field on RunningSession, so a "Location"
 * row is gracefully omitted (out of scope per the SOW).
 */
export function RunDigest({ run }: { run: RunningSession }) {
  const { unitLabel, formatDistance, formatPace, formatElevation } = useDistanceUnit();
  const noun = disciplineOfActivity(run) === "hike" ? "hike" : "run";

  return (
    <div className="flex flex-col gap-2 text-xs">
      <dl className="flex flex-col gap-1 tabular-nums">
        <Row label="Distance">
          {formatDistance(run.distance_meters)} {unitLabel}
        </Row>
        <Row label="Duration">{formatDuration(run.duration_seconds)}</Row>
        {run.avg_pace_sec_per_km != null && (
          <Row label="Avg pace">
            {formatPace(run.avg_pace_sec_per_km)} /{unitLabel}
          </Row>
        )}
        {run.avg_heart_rate_bpm != null && <Row label="Avg HR">{run.avg_heart_rate_bpm} bpm</Row>}
        {run.elevation_gain_meters != null && (
          <Row label="Elevation gain">{formatElevation(run.elevation_gain_meters)}</Row>
        )}
      </dl>
      <Link
        href={activityDetailHref(run)}
        className="w-fit text-[var(--accent)] transition hover:underline"
      >
        View full {noun} details →
      </Link>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-[var(--foreground)]">{children}</dd>
    </div>
  );
}
