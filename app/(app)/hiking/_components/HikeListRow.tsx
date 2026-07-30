"use client";

import Link from "next/link";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatDuration } from "@/lib/format";
import { activityColors } from "@/lib/activity-colors";
import type { RunningSession } from "@/lib/api";
import { formatStartDateTime } from "../../running/_components/RunListRow";

/**
 * One hike in the dashboard list. Mirrors the run list row (clickable
 * across its whole surface, linking to the detail route) but shows
 * hike-relevant headline metrics — distance, vertical gain, duration —
 * and carries a hike-discipline dot where a run row would read as neutral.
 * All unit math goes through the DistanceUnitContext formatters; vertical
 * gain renders an em-dash when the import carried no elevation track.
 */
export function HikeListRow({ session }: { session: RunningSession }) {
  const { formatDistance, formatElevation, unitLabel } = useDistanceUnit();
  const title = session.name?.trim() || hikeFallbackName(session.start_time);
  const hike = activityColors("hike");

  return (
    <li>
      <Link
        href={`/hiking/${session.id}`}
        className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: hike.dot }}
              aria-hidden="true"
            />
            <span className="truncate">{title}</span>
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {formatStartDateTime(session.start_time)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-[var(--muted)]">
          <Metric label="Distance">
            {formatDistance(session.distance_meters)} {unitLabel}
          </Metric>
          <Metric label="Gain">{formatElevation(session.elevation_gain_meters)}</Metric>
          <Metric label="Time">{formatDuration(session.duration_seconds)}</Metric>
        </div>
      </Link>
    </li>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <span className="text-sm text-[var(--foreground)]">{children}</span>
    </span>
  );
}

/** Time-of-day fallback name for an imported hike with no name. */
export function hikeFallbackName(startTime: string): string {
  const hour = new Date(startTime).getHours();
  if (hour < 12) return "Morning Hike";
  if (hour < 17) return "Afternoon Hike";
  if (hour < 21) return "Evening Hike";
  return "Night Hike";
}
