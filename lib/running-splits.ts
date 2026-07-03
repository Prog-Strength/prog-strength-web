/**
 * Thin presentation mapping for the running detail page. The heavy derivation
 * (splits, strip summary, interval detection, best pace) moved SERVER-SIDE
 * (prog-strength-api internal/activity/derivation.go) so every rendered
 * number comes from one computation behind an invariant gate — see
 * sows/running-detail-metric-alignment.md. What remains here is pure
 * unit-mapping of the already-served trackpoints into chart coordinates
 * (the strip is deliberately not duplicated on the wire) and the tolerant
 * target-pace parser for plan prescriptions.
 */

import type { RunningTrackpoint } from "./api";

const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;
const KM_PER_MILE = METERS_PER_MILE / METERS_PER_KM; // 1.609344

export type DistanceUnit = "mi" | "km";

export type PaceStripPoint = {
  /** Cumulative distance in the active unit. */
  distanceUnit: number;
  /** Pace in sec per active unit; null = dropout/gap → break the line. */
  paceSecPerUnit: number | null;
};

/** Map served trackpoints to chart points. Plottability is the server's
 *  clean_pace flag — the client no longer owns a dropout threshold. */
export function buildPaceStrip(
  trackpoints: RunningTrackpoint[],
  unit: DistanceUnit,
): PaceStripPoint[] {
  const bucketMeters = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  return trackpoints.map((t) => ({
    distanceUnit: t.distance_meters / bucketMeters,
    paceSecPerUnit:
      t.clean_pace && t.pace_sec_per_km != null
        ? unit === "mi"
          ? t.pace_sec_per_km * KM_PER_MILE
          : t.pace_sec_per_km
        : null,
  }));
}

/** Tolerant parser: extract a target work pace from free-text run_details.
 *  Returns sec per ACTIVE UNIT, or null when nothing is confidently found. */
export function parseTargetPace(runDetails: string | null, unit: DistanceUnit): number | null {
  if (!runDetails) return null;

  // m:ss optionally prefixed by ~ / paren, qualified by /mi, /km, "per mile",
  // "per km", or "per kilometer". Requires a unit — bare numbers don't parse.
  const re = /(\d{1,2}):([0-5]\d)\s*(?:\/\s*(mi|km)|per\s+(mile|mi|km|kilometer|kilometre))\b/i;
  const match = runDetails.match(re);
  if (!match) return null;

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  const total = minutes * 60 + seconds;

  const tokenUnitRaw = (match[3] ?? match[4]).toLowerCase();
  const tokenIsMile = tokenUnitRaw.startsWith("mi") || tokenUnitRaw === "mile";

  let perUnit: number;
  if (tokenIsMile) {
    // Token is sec/mi.
    perUnit = unit === "mi" ? total : total / KM_PER_MILE;
  } else {
    // Token is sec/km.
    perUnit = unit === "km" ? total : total * KM_PER_MILE;
  }
  return Math.round(perUnit);
}
