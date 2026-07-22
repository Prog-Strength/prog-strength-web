/**
 * Render-only client mapping of already-served trackpoints into HR and
 * elevation chart coordinates over the response's distance axis — the SAME
 * family as buildPaceStrip (running-splits.ts): distanceUnit =
 * distance_meters / bucketMeters, bucketMeters being METERS_PER_MILE for "mi"
 * and METERS_PER_KM for "km". Like the pace strip, no derivation lives here —
 * values are passed through raw (bpm and meters, both unit-independent). Gaps
 * are honest: a null sample stays null so the chart walk flushes a gap at that
 * point, never interpolated across it.
 */

import type { RunningTrackpoint } from "./api";
import { METERS_PER_KM, METERS_PER_MILE, type DistanceUnit } from "./running-splits";

export type MetricStripPoint = {
  /** Cumulative distance in the active unit (same axis family as buildPaceStrip). */
  distanceUnit: number;
  /** The metric value, or null when the sample lacks it → break the line. */
  value: number | null;
};

/** Map served trackpoints onto the distance axis, selecting a raw metric per
 *  point. The selector's null passes straight through — no smoothing,
 *  interpolation, or filtering — so gaps stay gaps. */
function buildMetricStrip(
  trackpoints: RunningTrackpoint[],
  unit: DistanceUnit,
  select: (t: RunningTrackpoint) => number | null,
): MetricStripPoint[] {
  const bucketMeters = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  return trackpoints.map((t) => ({
    distanceUnit: t.distance_meters / bucketMeters,
    value: select(t),
  }));
}

/** Heart rate in raw bpm (unit-independent) over the distance axis. */
export function buildHeartRateStrip(
  trackpoints: RunningTrackpoint[],
  unit: DistanceUnit,
): MetricStripPoint[] {
  return buildMetricStrip(trackpoints, unit, (t) => t.heart_rate_bpm);
}

/** Elevation in raw meters (unit-independent) over the distance axis. */
export function buildElevationStrip(
  trackpoints: RunningTrackpoint[],
  unit: DistanceUnit,
): MetricStripPoint[] {
  return buildMetricStrip(trackpoints, unit, (t) => t.elevation_meters);
}

/** True iff at least two points carry a value — the page's gate for rendering
 *  a recap at all (fewer plottable points means no empty chart frame). */
export function hasPlottableSeries(points: MetricStripPoint[]): boolean {
  let plottable = 0;
  for (const p of points) {
    if (p.value != null && ++plottable >= 2) return true;
  }
  return false;
}
