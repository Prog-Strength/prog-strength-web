"use client";

import { useState } from "react";
import type { RunningSession } from "@/lib/api";
import { RunningMileageChart } from "@/components/running-mileage-chart";
import { RunningTimeChart } from "@/components/running-time-chart";
import { ViewButton } from "@/components/view-button";
import { formatHours } from "@/lib/chart-format";
import { formatDistanceValue } from "@/lib/distance-unit-context";

/**
 * Owns the top-of-Running-view analytics card: the card border + padding,
 * a shared summary header (Total distance / Total time / Runs computed
 * once from the same sessions array), and a two-view icon switcher
 * (Mileage is the default). The actual chart drawing is delegated to the
 * two sibling charts — mileage and time — each of which is deliberately
 * chrome-less so they slot under this one set of totals.
 *
 * Mirrors WorkoutsAnalytics. Purely presentational: the sessions array,
 * the timeframe's `days`, the display unit, and the truncation flags are
 * passed in by the view so a single fetch hydrates both this card and the
 * run list below.
 */

type View = "mileage" | "time";

export function RunningAnalytics({
  sessions,
  days,
  truncated,
  fetchLimit,
  distanceUnit,
}: {
  // `null` while the parent is still loading. Empty array = no runs in
  // the window (each chart renders its own empty state).
  sessions: RunningSession[] | null;
  // Days back from now this window covers, or null for "all".
  days: number | null;
  // True when the parent's fetch hit `fetchLimit` and may have more.
  truncated: boolean;
  fetchLimit: number;
  // The active display unit; forwarded to the mileage chart for scaling.
  distanceUnit: "mi" | "km";
}) {
  const [view, setView] = useState<View>("mileage");

  // Summary header totals — computed over every session in the window.
  let totalMeters = 0;
  let totalSeconds = 0;
  for (const s of sessions ?? []) {
    totalMeters += s.distance_meters;
    totalSeconds += s.duration_seconds;
  }
  const runCount = sessions?.length ?? 0;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="flex items-baseline gap-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Total Distance
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
            {formatDistanceValue(totalMeters, distanceUnit)} {distanceUnit}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Total Time
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
            {formatHours(totalSeconds / 60)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Runs
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{runCount}</p>
        </div>
      </header>

      <div className="mt-4 flex gap-2">
        <ViewButton label="Mileage" active={view === "mileage"} onClick={() => setView("mileage")}>
          <RouteIcon />
        </ViewButton>
        <ViewButton label="Time" active={view === "time"} onClick={() => setView("time")}>
          <ClockIcon />
        </ViewButton>
      </div>

      {view === "mileage" && (
        <RunningMileageChart
          sessions={sessions}
          days={days}
          truncated={truncated}
          fetchLimit={fetchLimit}
          distanceUnit={distanceUnit}
        />
      )}
      {view === "time" && (
        <RunningTimeChart
          sessions={sessions}
          days={days}
          truncated={truncated}
          fetchLimit={fetchLimit}
          distanceUnit={distanceUnit}
        />
      )}
    </section>
  );
}

// --- icons --------------------------------------------------------
// Hand-rolled inline SVGs in the same idiom as WorkoutsAnalytics's
// glyphs (viewBox 0 0 24 24, currentColor stroke). No icon library.

function RouteIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="6" cy="19" r="2" />
      <circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
