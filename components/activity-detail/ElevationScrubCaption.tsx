"use client";

import type { ScrubReadout } from "@/lib/elevation-scrub";

/**
 * The readout under the elevation profile.
 *
 * With a cursor it answers "what is it like HERE" — elevation, grade, and how
 * much climbing and distance is still ahead. With no cursor it falls back to
 * the whole-hike aggregates, so the strip is never an empty frame and the
 * numbers a hiker wants at a glance are the resting state.
 *
 * Deliberately a quiet definition list in the metric-strip register of the
 * session-recap grammar (tight numeric values over small faint uppercase
 * labels), not a row of tiles — it supports the chart, it doesn't compete
 * with it.
 */
export function ElevationScrubCaption({
  readout,
  scrubbing,
  totals,
  formatElevation,
  formatDistance,
  unitLabel,
}: {
  readout: ScrubReadout;
  scrubbing: boolean;
  totals: {
    ascentMeters: number | null;
    descentMeters: number | null;
    highMeters: number | null;
    lowMeters: number | null;
    distanceMeters: number;
  };
  formatElevation: (meters: number | null) => string;
  formatDistance: (meters: number) => string;
  unitLabel: string;
}) {
  const entries: { label: string; value: string }[] = scrubbing
    ? [
        { label: "Elevation", value: formatElevation(readout.elevationMeters) },
        {
          label: "Grade",
          // 0% is a measurement (flat trail); null is "not measurable". The
          // em-dash distinction is the whole reason the server sends null
          // rather than coercing to zero.
          value: readout.gradePercent != null ? `${readout.gradePercent.toFixed(1)}%` : "—",
        },
        { label: "Climb left", value: formatElevation(readout.remainingClimbMeters) },
        {
          label: "Distance left",
          value:
            readout.remainingDistanceMeters != null
              ? `${formatDistance(readout.remainingDistanceMeters)} ${unitLabel}`
              : "—",
        },
      ]
    : [
        { label: "Ascent", value: formatElevation(totals.ascentMeters) },
        { label: "Descent", value: formatElevation(totals.descentMeters) },
        { label: "High", value: formatElevation(totals.highMeters) },
        { label: "Low", value: formatElevation(totals.lowMeters) },
        {
          label: "Distance",
          value: `${formatDistance(totals.distanceMeters)} ${unitLabel}`,
        },
      ];

  return (
    <dl
      className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-[var(--border)] pt-4 sm:grid-cols-4 lg:grid-cols-5"
      // The values swap under the user's finger; announcing every frame would
      // flood a screen reader, so the strip is polite and the chart keeps its
      // own static label.
      aria-live="polite"
    >
      {entries.map((e) => (
        <div key={e.label} className="flex flex-col gap-1">
          <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">{e.label}</dt>
          <dd className="text-[15px] tabular-nums tracking-[-0.01em] text-[var(--foreground)]">
            {e.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
