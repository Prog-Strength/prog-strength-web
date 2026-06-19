import type { RunningTrackpoint } from "@/lib/api";

const METERS_PER_MILE = 1609.344;

/**
 * A segment spec describes one stretch of running at a constant pace. The
 * synthesizer walks each spec at a fixed sample spacing (default ~25 m),
 * emitting trackpoints with monotonically increasing distance + elapsed time
 * and a per-sample pace token. This keeps the test fixtures declarative and
 * readable while still producing the dense, integer-timed streams the real
 * derivation will see.
 */
export type SegmentSpec = {
  /** Length of this segment in meters. */
  meters: number;
  /** Pace held across this segment, in sec per km (the stored unit). */
  paceSecPerKm: number;
  /** HR held across this segment; null leaves the column empty. */
  hr?: number | null;
  /** Elevation at the start of this segment; null leaves it empty. */
  elevation?: number | null;
  /** Sample spacing override (meters between trackpoints). */
  sampleMeters?: number;
};

/**
 * Synthesize a RunningTrackpoint[] from segment specs. The first emitted
 * point is the origin (distance 0, elapsed 0) carrying the first segment's
 * pace; each subsequent point advances distance by `sampleMeters` and
 * elapsed time by the integer seconds implied by the segment's pace.
 */
export function synthesize(specs: SegmentSpec[]): RunningTrackpoint[] {
  const points: RunningTrackpoint[] = [];
  let sequence = 0;
  let distance = 0;
  let elapsed = 0;

  const push = (paceSecPerKm: number, hr: number | null, elevation: number | null) => {
    points.push({
      sequence,
      elapsed_seconds: Math.round(elapsed),
      distance_meters: Math.round(distance * 100) / 100,
      heart_rate_bpm: hr,
      pace_sec_per_km: paceSecPerKm,
      elevation_meters: elevation,
    });
    sequence += 1;
  };

  // Origin point.
  const first = specs[0];
  push(first.paceSecPerKm, first.hr ?? null, first.elevation ?? null);

  for (const spec of specs) {
    const step = spec.sampleMeters ?? 25;
    const hr = spec.hr ?? null;
    let covered = 0;
    while (covered < spec.meters - 1e-6) {
      const next = Math.min(step, spec.meters - covered);
      covered += next;
      distance += next;
      elapsed += (next / 1000) * spec.paceSecPerKm;
      push(spec.paceSecPerKm, hr, spec.elevation ?? null);
    }
  }

  return points;
}

/**
 * The canonical 6×400 interval fixture: 1 mi warm-up + 6×(400 m fast /
 * 200 m recovery) + a half-mile cool-down → a detectable interval session.
 */
export function intervalTrackpoints(): RunningTrackpoint[] {
  const specs: SegmentSpec[] = [
    { meters: METERS_PER_MILE, paceSecPerKm: 360, hr: 130 }, // warm-up (slow)
  ];
  for (let i = 0; i < 6; i++) {
    specs.push({ meters: 400, paceSecPerKm: 240, hr: 175 }); // work (fast, ~6:30/mi)
    specs.push({ meters: 200, paceSecPerKm: 390, hr: 150 }); // recovery (slow, clean — below dropout)
  }
  specs.push({ meters: 0.5 * METERS_PER_MILE, paceSecPerKm: 360, hr: 130 }); // cool-down
  return synthesize(specs);
}
