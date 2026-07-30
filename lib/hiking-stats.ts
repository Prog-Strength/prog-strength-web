/**
 * Pure, React-free derivation for the Activities → Hiking tab's summary
 * tiles. Mirrors `lib/activities-overview-stats.ts`: the API exposes the raw
 * activity rows and the UI derives the rollups here so the view stays a thin
 * renderer.
 *
 * Nullability is load-bearing. `elevation_gain_meters`, `elevation_high_meters`,
 * and `elevation_low_meters` are null on rows that don't carry them (e.g. a
 * manually-logged hike or a TCX without a barometric/GPS altitude track). Every
 * elevation aggregate SKIPS the null rows and returns `null` (→ rendered "—")
 * when the window carries none — never coerced to 0. Average pace is
 * total-time-over-total-distance (distance-weighted), not a mean of per-hike
 * paces, so a short slow hike doesn't outweigh a long steady one.
 */

import type { RunningSession } from "./api";
import { METERS_PER_KM, METERS_PER_MILE } from "./distance-unit-context";

/**
 * The six Hiking summary tiles. `totalDistanceMeters`/`totalGainMeters` are
 * always numbers (a summed count of the rows that carry the field); the
 * derived tiles are `null` when the window can't support them so the view
 * renders an em-dash.
 */
export type HikingStats = {
  totalDistanceMeters: number;
  totalGainMeters: number;
  /** Highest `elevation_high_meters` in the window; null when none report it. */
  highPointMeters: number | null;
  /** Lowest `elevation_low_meters` in the window; null when none report it. */
  lowPointMeters: number | null;
  /** Distance-weighted avg pace (sec/km); null when total distance is 0. */
  avgPaceSecPerKm: number | null;
  /** Total gain per mile of distance; null when no distance or no gain. */
  gainPerMileMeters: number | null;
  /** Total gain per kilometer of distance; null when no distance or no gain. */
  gainPerKmMeters: number | null;
};

/**
 * Derive the Hiking tab's tile values from the fetched sessions.
 *
 * @param sessions hiking sessions in the window; `null`/`[]` treated as empty.
 */
export function deriveHikingStats(sessions: RunningSession[] | null): HikingStats {
  const ss = sessions ?? [];

  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let totalGainMeters = 0;
  let highPointMeters: number | null = null;
  let lowPointMeters: number | null = null;

  for (const s of ss) {
    totalDistanceMeters += s.distance_meters;
    totalDurationSeconds += s.duration_seconds;

    if (s.elevation_gain_meters != null) {
      totalGainMeters += s.elevation_gain_meters;
    }
    if (s.elevation_high_meters != null) {
      highPointMeters =
        highPointMeters == null
          ? s.elevation_high_meters
          : Math.max(highPointMeters, s.elevation_high_meters);
    }
    if (s.elevation_low_meters != null) {
      lowPointMeters =
        lowPointMeters == null
          ? s.elevation_low_meters
          : Math.min(lowPointMeters, s.elevation_low_meters);
    }
  }

  // Distance-weighted: total time over total distance, NOT a mean of paces.
  const avgPaceSecPerKm =
    totalDistanceMeters > 0 ? totalDurationSeconds / (totalDistanceMeters / 1000) : null;

  // Gain relative to distance; null when there's no distance or no gain to
  // report (a zero would read as "flat", which we can't assert).
  const gainPerMileMeters =
    totalDistanceMeters > 0 && totalGainMeters > 0
      ? totalGainMeters / (totalDistanceMeters / METERS_PER_MILE)
      : null;

  // Same gate as gainPerMileMeters, expressed per kilometer for the `km` unit.
  const gainPerKmMeters =
    totalDistanceMeters > 0 && totalGainMeters > 0
      ? totalGainMeters / (totalDistanceMeters / METERS_PER_KM)
      : null;

  return {
    totalDistanceMeters,
    totalGainMeters,
    highPointMeters,
    lowPointMeters,
    avgPaceSecPerKm,
    gainPerMileMeters,
    gainPerKmMeters,
  };
}
