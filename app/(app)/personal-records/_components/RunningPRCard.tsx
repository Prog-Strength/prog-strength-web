"use client";

/**
 * One Running-view card. Mirrors the Lifts card layout for visual
 * consistency but drops the status badge (the "Time for a max?" hint is a
 * lift-side estimated-1RM concept with no running analogue):
 *
 *   - header:    distance display name ("5K", "Half Marathon")
 *   - headline:  best time via formatDuration(duration_seconds)
 *   - secondary: pace via formatPace(pace_sec_per_km) + "/${unitLabel}"
 *   - "Set on {date}" + "View activity →" → /running/{activity_id}
 *
 * When the user hasn't yet achieved a best effort at this distance the
 * card renders the empty-state variant (em-dash + "NO RECORD YET") with
 * the expand chevron suppressed — there's no history to chart.
 */

import { useState } from "react";
import Link from "next/link";
import type { RunningBestEffort } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatDuration } from "@/lib/format";
import { ExpandChevron } from "./ExpandChevron";
import { ProgressionChart } from "./ProgressionChart";
import { formatDate } from "./format";

export function RunningPRCard({
  distanceKey,
  distanceLabel,
  entry,
}: {
  distanceKey: string;
  distanceLabel: string;
  entry: RunningBestEffort | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const { formatPace, unitLabel } = useDistanceUnit();

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold tracking-tight">{distanceLabel}</h2>
      </div>

      {entry ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatDuration(entry.duration_seconds)}
            <span className="ml-2 text-base font-normal text-[var(--muted)]">
              {formatPace(entry.pace_sec_per_km)} /{unitLabel}
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Set on {formatDate(entry.activity_start_time)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight text-[var(--muted)]">—</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">No record yet</p>
        </div>
      )}

      {entry && (
        <Link
          href={`/running/${entry.activity_id}`}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          View activity →
        </Link>
      )}

      {expanded && entry && <ProgressionChart kind="running" distanceKey={distanceKey} />}

      {entry && <ExpandChevron expanded={expanded} onToggle={() => setExpanded((e) => !e)} />}
    </div>
  );
}
