/**
 * Pure, React-free derivation layer for the running activity detail page.
 * Turns a live `RunningTrackpoint[]` stream (plus the linked plan's
 * `run_type` and the user's active distance unit) into the data the
 * splits-ledger-spine renders: per-distance splits, a winsorized pace strip,
 * conservatively-detected intervals, and a tolerant target-pace parse.
 *
 * Everything here is deterministic and unit-aware. Stored values are metric
 * (distances/elevations in meters, pace in sec/km); conversion to the active
 * unit happens here so the presentation layer just formats. Device dropouts
 * (implausibly slow pace samples) are winsorized out of stats and rendered as
 * gaps in the strip rather than allowed to own the axis.
 *
 * Interval detection is conservative by design: when the trace is too sparse
 * or the structure doesn't look like alternating work/recovery bouts, it
 * returns `null` and the surface degrades to a miles-only view — it never
 * fabricates reps.
 */

import type { RunningTrackpoint, RunType } from "./api";

const METERS_PER_MILE = 1609.344;
const METERS_PER_KM = 1000;
const KM_PER_MILE = METERS_PER_MILE / METERS_PER_KM; // 1.609344

export type DistanceUnit = "mi" | "km";

/** Pace slower than this (sec/km) is treated as a device dropout and winsorized
 *  out of stats + plotted as a gap. 410 sec/km ≈ 11:00 /mi (the mockup's
 *  PACE_CLAMP_MAX of 660 sec/mi, expressed in the stored metric unit). */
export const PACE_DROPOUT_SEC_PER_KM = 410;

export type Split = {
  /** 0-based bucket index along the run. */
  index: number;
  /** True for the trailing bucket that is shorter than one full unit. */
  partial: boolean;
  /** Real bucket distance in meters (full ≈ one unit; partial < one unit). */
  distanceMeters: number;
  /** Real elapsed time across the bucket, seconds. */
  durationSec: number;
  /** Average pace in sec per ACTIVE UNIT, computed from clean samples only;
   *  null when the bucket has no clean distance. */
  avgPaceSecPerUnit: number | null;
  /** Average HR over samples with HR; null when none. */
  avgHr: number | null;
  /** Elevation change over the bucket in meters; null when no barometric data. */
  elevDeltaMeters: number | null;
  /** Marked among FULL splits only (≥2 full splits required to mark). */
  fastest: boolean;
  slowest: boolean;
};

export type PaceStripPoint = {
  /** Cumulative distance in the active unit. */
  distanceUnit: number;
  /** Winsorized pace in sec per active unit; null = dropout/gap → break the line. */
  paceSecPerUnit: number | null;
};

export type SegmentKind = "warmup" | "work" | "recovery" | "cooldown";

export type IntervalSegment = {
  kind: SegmentKind;
  /** 1-based index among work bouts (recoveries share the preceding rep's number). */
  rep: number | null;
  label: string; // "Warm-up" | "Rep 1" | "Recovery 1" | "Cool-down"
  distanceMeters: number;
  durationSec: number;
  avgPaceSecPerUnit: number | null;
  avgHr: number | null;
};

export type RunningDerivation = {
  splits: Split[];
  paceStrip: PaceStripPoint[];
  /** Present (non-null) only when intervals were confidently detected. */
  intervals: IntervalSegment[] | null;
  /** True if any sample was winsorized (powers the strip's "dropout bridged" note). */
  hasDropout: boolean;
  /** True if any trackpoint carried elevation data. */
  hasElevation: boolean;
  /** True if any trackpoint carried HR data. */
  hasHr: boolean;
};

/** A trackpoint's pace sample is clean iff it is present, positive, and not
 *  slower than the dropout threshold. */
function isCleanPace(paceSecPerKm: number | null): boolean {
  return paceSecPerKm != null && paceSecPerKm > 0 && paceSecPerKm <= PACE_DROPOUT_SEC_PER_KM;
}

/** A consecutive-pair segment spanning `a → b`. */
type Segment = {
  /** Distance covered, meters (always > 0). */
  dDist: number;
  /** Elapsed time, seconds (negative clamped to 0). */
  dTime: number;
  /** True iff the endpoint `b` carries a clean pace sample. */
  clean: boolean;
  /** Bucket index of the segment's start point. */
  bucket: number;
  /** Endpoint HR (may be null). */
  hr: number | null;
  /** Endpoint elevation (may be null). */
  elevation: number | null;
};

/** Build consecutive-pair segments, skipping non-advancing pairs. */
function buildSegments(trackpoints: RunningTrackpoint[], bucketMeters: number): Segment[] {
  const segments: Segment[] = [];
  for (let i = 1; i < trackpoints.length; i++) {
    const a = trackpoints[i - 1];
    const b = trackpoints[i];
    const dDist = b.distance_meters - a.distance_meters;
    if (dDist <= 0) continue;
    const dTime = Math.max(0, b.elapsed_seconds - a.elapsed_seconds);
    segments.push({
      dDist,
      dTime,
      clean: isCleanPace(b.pace_sec_per_km),
      bucket: Math.floor(a.distance_meters / bucketMeters),
      hr: b.heart_rate_bpm,
      elevation: b.elevation_meters,
    });
  }
  return segments;
}

/** Top-level entry point the page calls in a useMemo. */
export function deriveRunningActivity(
  trackpoints: RunningTrackpoint[],
  runType: RunType | null,
  unit: DistanceUnit,
): RunningDerivation {
  const bucketMeters = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  const secPerMeterToUnit = (secPerMeter: number) => secPerMeter * bucketMeters;
  const secPerKmToUnit = (secPerKm: number) => (unit === "mi" ? secPerKm * KM_PER_MILE : secPerKm);

  const hasHr = trackpoints.some((t) => t.heart_rate_bpm != null);
  const hasElevation = trackpoints.some((t) => t.elevation_meters != null);
  const hasDropout = trackpoints.some(
    (t) => t.pace_sec_per_km != null && !isCleanPace(t.pace_sec_per_km),
  );

  const segments = buildSegments(trackpoints, bucketMeters);

  const splits = buildSplits(segments, bucketMeters, secPerMeterToUnit);
  const paceStrip = buildPaceStrip(trackpoints, bucketMeters, secPerKmToUnit);
  const intervals = runType === "intervals" ? detectIntervals(segments, secPerMeterToUnit) : null;

  return { splits, paceStrip, intervals, hasDropout, hasElevation, hasHr };
}

/** Per-bucket accumulator while folding segments into splits. */
type SplitAcc = {
  distanceMeters: number;
  durationSec: number;
  cleanDist: number;
  cleanTime: number;
  hrSum: number;
  hrCount: number;
  firstElev: number | null;
  lastElev: number | null;
};

function buildSplits(
  segments: Segment[],
  bucketMeters: number,
  secPerMeterToUnit: (s: number) => number,
): Split[] {
  const byBucket = new Map<number, SplitAcc>();

  for (const seg of segments) {
    let acc = byBucket.get(seg.bucket);
    if (!acc) {
      acc = {
        distanceMeters: 0,
        durationSec: 0,
        cleanDist: 0,
        cleanTime: 0,
        hrSum: 0,
        hrCount: 0,
        firstElev: null,
        lastElev: null,
      };
      byBucket.set(seg.bucket, acc);
    }
    acc.distanceMeters += seg.dDist;
    acc.durationSec += seg.dTime;
    if (seg.clean) {
      acc.cleanDist += seg.dDist;
      acc.cleanTime += seg.dTime;
    }
    if (seg.hr != null) {
      acc.hrSum += seg.hr;
      acc.hrCount += 1;
    }
    if (seg.elevation != null) {
      if (acc.firstElev == null) acc.firstElev = seg.elevation;
      acc.lastElev = seg.elevation;
    }
  }

  const indices = [...byBucket.keys()].sort((a, b) => a - b);
  const splits: Split[] = indices.map((bucketIndex, i) => {
    const acc = byBucket.get(bucketIndex)!;
    const isLast = i === indices.length - 1;
    return {
      index: i,
      partial: isLast && acc.distanceMeters < bucketMeters * 0.95,
      distanceMeters: acc.distanceMeters,
      durationSec: acc.durationSec,
      avgPaceSecPerUnit:
        acc.cleanDist > 0 ? secPerMeterToUnit(acc.cleanTime / acc.cleanDist) : null,
      avgHr: acc.hrCount > 0 ? acc.hrSum / acc.hrCount : null,
      elevDeltaMeters:
        acc.firstElev != null && acc.lastElev != null ? acc.lastElev - acc.firstElev : null,
      fastest: false,
      slowest: false,
    };
  });

  // Fastest/slowest among FULL splits with a pace — only when ≥2 such exist.
  const fullWithPace = splits.filter((s) => !s.partial && s.avgPaceSecPerUnit != null);
  if (fullWithPace.length >= 2) {
    let fastest = fullWithPace[0];
    let slowest = fullWithPace[0];
    for (const s of fullWithPace) {
      if (s.avgPaceSecPerUnit! < fastest.avgPaceSecPerUnit!) fastest = s;
      if (s.avgPaceSecPerUnit! > slowest.avgPaceSecPerUnit!) slowest = s;
    }
    fastest.fastest = true;
    slowest.slowest = true;
  }

  return splits;
}

function buildPaceStrip(
  trackpoints: RunningTrackpoint[],
  bucketMeters: number,
  secPerKmToUnit: (s: number) => number,
): PaceStripPoint[] {
  return trackpoints.map((t) => ({
    distanceUnit: t.distance_meters / bucketMeters,
    paceSecPerUnit: isCleanPace(t.pace_sec_per_km) ? secPerKmToUnit(t.pace_sec_per_km!) : null,
  }));
}

/** A class label for a clean segment relative to the run's average pace. */
type PaceClass = "fast" | "slow" | "neutral";

/** A coalesced run of same-class segments. */
type Bout = {
  cls: Exclude<PaceClass, "neutral">;
  dDist: number;
  dTime: number;
  hrSum: number;
  hrCount: number;
};

function detectIntervals(
  segments: Segment[],
  secPerMeterToUnit: (s: number) => number,
): IntervalSegment[] | null {
  const clean = segments.filter((s) => s.clean && s.dDist > 0);
  if (clean.length < 8) return null;

  const totalDist = clean.reduce((sum, s) => sum + s.dDist, 0);
  const totalTime = clean.reduce((sum, s) => sum + s.dTime, 0);
  if (totalDist <= 0) return null;
  const avgPace = secPerMeterToUnit(totalTime / totalDist);
  if (avgPace <= 0) return null;

  // Classify each clean segment, forward-filling neutral (default slow).
  const classes: Exclude<PaceClass, "neutral">[] = [];
  let prev: Exclude<PaceClass, "neutral"> = "slow";
  for (const s of clean) {
    const pace = secPerMeterToUnit(s.dTime / s.dDist);
    const rel = pace / avgPace;
    let cls: PaceClass;
    if (rel <= 0.9) cls = "fast";
    else if (rel >= 1.05) cls = "slow";
    else cls = "neutral";
    const resolved: Exclude<PaceClass, "neutral"> = cls === "neutral" ? prev : cls;
    classes.push(resolved);
    prev = resolved;
  }

  let bouts = coalesce(clean, classes);
  bouts = denoise(bouts);

  // Plausibility: ≥3 work bouts, each adjacent work pair separated by a
  // non-work bout (alternation).
  const workIdx = bouts.map((b, i) => (b.cls === "fast" ? i : -1)).filter((i) => i >= 0);
  if (workIdx.length < 3) return null;
  for (let i = 1; i < workIdx.length; i++) {
    if (workIdx[i] === workIdx[i - 1] + 1) return null; // adjacent work bouts → not intervals
  }

  return labelBouts(bouts, secPerMeterToUnit);
}

/** Fold same-class neighbours into bouts. */
function coalesce(clean: Segment[], classes: Exclude<PaceClass, "neutral">[]): Bout[] {
  const bouts: Bout[] = [];
  for (let i = 0; i < clean.length; i++) {
    const s = clean[i];
    const cls = classes[i];
    let current = bouts[bouts.length - 1];
    if (!current || current.cls !== cls) {
      current = { cls, dDist: 0, dTime: 0, hrSum: 0, hrCount: 0 };
      bouts.push(current);
    }
    current.dDist += s.dDist;
    current.dTime += s.dTime;
    if (s.hr != null) {
      current.hrSum += s.hr;
      current.hrCount += 1;
    }
  }
  return bouts;
}

/** Merge any sub-60 m bout into the previous bout (relabel to previous class)
 *  and re-coalesce — denoises pace jitter. */
function denoise(bouts: Bout[]): Bout[] {
  if (bouts.length === 0) return bouts;
  const merged: Bout[] = [];
  for (const b of bouts) {
    const prev = merged[merged.length - 1];
    if (prev && b.dDist < 60) {
      // Fold into previous bout, keeping the previous class.
      prev.dDist += b.dDist;
      prev.dTime += b.dTime;
      prev.hrSum += b.hrSum;
      prev.hrCount += b.hrCount;
      continue;
    }
    if (prev && prev.cls === b.cls) {
      prev.dDist += b.dDist;
      prev.dTime += b.dTime;
      prev.hrSum += b.hrSum;
      prev.hrCount += b.hrCount;
      continue;
    }
    merged.push({ ...b });
  }
  return merged;
}

function labelBouts(bouts: Bout[], secPerMeterToUnit: (s: number) => number): IntervalSegment[] {
  const firstWork = bouts.findIndex((b) => b.cls === "fast");
  const lastWork = bouts.map((b) => b.cls).lastIndexOf("fast");

  const result: IntervalSegment[] = [];
  let rep = 0;

  // Collapse all leading slow bouts into one warm-up.
  const leading = bouts.slice(0, firstWork).filter((b) => b.cls === "slow");
  if (leading.length > 0) {
    result.push(makeSegment("warmup", null, "Warm-up", mergeBouts(leading), secPerMeterToUnit));
  }

  for (let i = firstWork; i <= lastWork; i++) {
    const b = bouts[i];
    if (b.cls === "fast") {
      rep += 1;
      result.push(makeSegment("work", rep, `Rep ${rep}`, b, secPerMeterToUnit));
    } else {
      // Slow bout between works → recovery, sharing the preceding rep's number.
      result.push(makeSegment("recovery", rep, `Recovery ${rep}`, b, secPerMeterToUnit));
    }
  }

  // Collapse all trailing slow bouts into one cool-down.
  const trailing = bouts.slice(lastWork + 1).filter((b) => b.cls === "slow");
  if (trailing.length > 0) {
    result.push(
      makeSegment("cooldown", null, "Cool-down", mergeBouts(trailing), secPerMeterToUnit),
    );
  }

  return result;
}

function mergeBouts(bouts: Bout[]): Bout {
  return bouts.reduce<Bout>(
    (acc, b) => ({
      cls: b.cls,
      dDist: acc.dDist + b.dDist,
      dTime: acc.dTime + b.dTime,
      hrSum: acc.hrSum + b.hrSum,
      hrCount: acc.hrCount + b.hrCount,
    }),
    { cls: bouts[0].cls, dDist: 0, dTime: 0, hrSum: 0, hrCount: 0 },
  );
}

function makeSegment(
  kind: SegmentKind,
  rep: number | null,
  label: string,
  bout: Bout,
  secPerMeterToUnit: (s: number) => number,
): IntervalSegment {
  return {
    kind,
    rep,
    label,
    distanceMeters: bout.dDist,
    durationSec: bout.dTime,
    avgPaceSecPerUnit: bout.dDist > 0 ? secPerMeterToUnit(bout.dTime / bout.dDist) : null,
    avgHr: bout.hrCount > 0 ? bout.hrSum / bout.hrCount : null,
  };
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
