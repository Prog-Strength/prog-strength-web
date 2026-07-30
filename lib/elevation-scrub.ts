/**
 * The arithmetic behind the linked elevation profile: what to report at the
 * scrub cursor, and where that cursor sits on the route.
 *
 * Pure and index-based. Every function here takes the served trackpoint array
 * and an index into it, because that index is the ONE piece of state shared
 * between the elevation chart and the map — `buildElevationStrip` is a straight
 * `.map` over the same array, so strip index i is trackpoint i is route
 * position i. (sows/outdoor-hiking-maps.md § The shared index.)
 */

import type { RunningTrackpoint } from "@/lib/api";

export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000;

export type DistanceUnit = "km" | "mi";

export type ScrubReadout = {
  elevationMeters: number | null;
  gradePercent: number | null;
  /** Metres of ascent still to come from this point to the end. */
  remainingClimbMeters: number | null;
  /** Metres still to travel from this point to the end. */
  remainingDistanceMeters: number | null;
};

/**
 * Suffix sums of remaining ascent: `climb[i]` is the total positive elevation
 * change from i to the end of the track.
 *
 * Computed once per trackpoint array and passed back into `readoutAt`, because
 * the cursor moves at pointer-move rates and recomputing an O(n) sum per frame
 * is the kind of thing that makes a scrubber feel sticky.
 *
 * A pair contributes only when BOTH endpoints carry elevation — a gap in the
 * stream neither invents climb nor swallows it, matching how the recap charts
 * refuse to bridge a null and how the server refuses to derive a grade across
 * one.
 */
export function remainingClimb(tps: RunningTrackpoint[]): number[] {
  const climb = new Array<number>(tps.length).fill(0);
  for (let i = tps.length - 2; i >= 0; i--) {
    const here = tps[i].elevation_meters;
    const next = tps[i + 1].elevation_meters;
    const rise = here != null && next != null ? Math.max(0, next - here) : 0;
    climb[i] = climb[i + 1] + rise;
  }
  return climb;
}

/** Total distance of the track — the last sample's cumulative distance. */
export function totalDistanceMeters(tps: RunningTrackpoint[]): number {
  return tps.length === 0 ? 0 : tps[tps.length - 1].distance_meters;
}

/**
 * What the caption strip shows at the cursor. Out-of-range indices return an
 * all-null readout rather than throwing, so a stale index from a previous
 * activity can never crash the page mid-render.
 */
export function readoutAt(
  tps: RunningTrackpoint[],
  climb: number[],
  index: number | null,
): ScrubReadout {
  const empty: ScrubReadout = {
    elevationMeters: null,
    gradePercent: null,
    remainingClimbMeters: null,
    remainingDistanceMeters: null,
  };
  if (index == null || index < 0 || index >= tps.length) return empty;

  const tp = tps[index];
  return {
    elevationMeters: tp.elevation_meters,
    gradePercent: tp.grade_percent,
    remainingClimbMeters: climb[index] ?? null,
    remainingDistanceMeters: Math.max(0, totalDistanceMeters(tps) - tp.distance_meters),
  };
}

export type Coord = [number, number];

/** The sample's position, or null when it carried none. GeoJSON order. */
export function coordAt(tps: RunningTrackpoint[], index: number | null): Coord | null {
  if (index == null || index < 0 || index >= tps.length) return null;
  const { latitude, longitude } = tps[index];
  return latitude != null && longitude != null ? [longitude, latitude] : null;
}

/**
 * The travelled portion of the route, as line segments from the start up to
 * and including `index`.
 *
 * Built from trackpoint coordinates rather than by splitting `route_geojson`,
 * which is RDP-simplified and so has no index correspondence to split ON. Runs
 * of samples without position break the line rather than bridging it, for the
 * same reason the route geometry gap-splits: a straight line across a GPS
 * dropout is a claim about where the hiker went, and it is usually wrong.
 */
export function travelledSegments(tps: RunningTrackpoint[], index: number | null): Coord[][] {
  if (index == null || index < 0) return [];
  const upTo = Math.min(index, tps.length - 1);

  const segments: Coord[][] = [];
  let current: Coord[] = [];
  for (let i = 0; i <= upTo; i++) {
    const c = coordAt(tps, i);
    if (c == null) {
      if (current.length > 1) segments.push(current);
      current = [];
      continue;
    }
    current.push(c);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

export type MileMarker = { coord: Coord; label: string };

/**
 * One marker at each whole unit boundary in the user's active unit.
 *
 * Computed client-side: the trackpoints already carry cumulative distance and
 * (now) position, so this needs no new data and re-derives for free when the
 * user toggles mi/km. The marker lands on the first sample at or past each
 * boundary, which on a ~300-point downsample is within a few metres — close
 * enough for a map dot, and honest about not interpolating a position the
 * device never reported.
 *
 * The final boundary is skipped when it coincides with the end of the track,
 * where it would collide with the finish marker.
 */
export function mileMarkers(tps: RunningTrackpoint[], unit: DistanceUnit): MileMarker[] {
  const bucket = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  const total = totalDistanceMeters(tps);
  const markers: MileMarker[] = [];

  let next = bucket;
  for (let i = 0; i < tps.length && next < total; i++) {
    if (tps[i].distance_meters < next) continue;
    const coord = coordAt(tps, i);
    if (coord) markers.push({ coord, label: String(Math.round(next / bucket)) });
    // Advance past every boundary this sample cleared, so a long gap between
    // samples doesn't emit a run of markers stacked on one point.
    while (next <= tps[i].distance_meters) next += bucket;
  }
  return markers;
}

/**
 * The trackpoint nearest a map position — the map → profile half of the
 * binding.
 *
 * Squared planar distance on raw degrees. At the scale of one hike this ranks
 * candidates identically to a haversine while costing a fraction as much, and
 * only the ranking matters: the result is an index, never a reported distance.
 * Longitude is scaled by cos(latitude) so the comparison stays sane away from
 * the equator, where a degree of longitude is much shorter than one of
 * latitude.
 */
export function nearestTrackpointIndex(
  tps: RunningTrackpoint[],
  lng: number,
  lat: number,
): number | null {
  const lonScale = Math.cos((lat * Math.PI) / 180);
  let best: number | null = null;
  let bestD = Infinity;

  for (let i = 0; i < tps.length; i++) {
    const { latitude, longitude } = tps[i];
    if (latitude == null || longitude == null) continue;
    const dx = (longitude - lng) * lonScale;
    const dy = latitude - lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
