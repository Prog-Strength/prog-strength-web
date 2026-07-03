"use client";

import Link from "next/link";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatDuration } from "@/lib/format";
import type { RunningSession } from "@/lib/api";
import { TreadmillBadge } from "./TreadmillBadge";

/**
 * One run in the dashboard list. Clickable across its whole surface
 * (wrapped in a Link to the detail route). Shows the run's name — or a
 * date-derived fallback when the import carried no name — over a row of
 * the headline metrics (distance, duration, pace, avg HR). All unit
 * math goes through the DistanceUnitContext formatters.
 */
export function RunListRow({ session }: { session: RunningSession }) {
  const { formatDistance, formatPace, unitLabel } = useDistanceUnit();
  const title = session.name?.trim() || runFallbackName(session.start_time);

  return (
    <li>
      <Link
        href={`/running/${session.id}`}
        className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:bg-[var(--surface-2)] sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{title}</span>
            {session.activity_type === "running" && session.environment === "indoor" && (
              <TreadmillBadge glyphOnly className="shrink-0" />
            )}
          </p>
          <p className="truncate text-xs text-[var(--muted)]">
            {formatStartDateTime(session.start_time)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-[var(--muted)]">
          <Metric label="Distance">
            {formatDistance(session.distance_meters)} {unitLabel}
          </Metric>
          <Metric label="Time">{formatDuration(session.duration_seconds)}</Metric>
          <Metric label="Pace">
            {formatPace(session.avg_pace_sec_per_km)} /{unitLabel}
          </Metric>
          <Metric label="Avg HR">
            {session.avg_heart_rate_bpm != null ? `${session.avg_heart_rate_bpm} bpm` : "—"}
          </Metric>
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

/**
 * Garmin-style time-of-day name ("Morning Run" / "Afternoon Run" /
 * "Evening Run" / "Night Run") used when an imported run has no name.
 */
export function runFallbackName(startTime: string): string {
  const hour = new Date(startTime).getHours();
  if (hour < 12) return "Morning Run";
  if (hour < 17) return "Afternoon Run";
  if (hour < 21) return "Evening Run";
  return "Night Run";
}

/** "Mon, May 17, 2026 · 6:42 AM" — full, unambiguous start timestamp. */
export function formatStartDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date} · ${time}`;
}
