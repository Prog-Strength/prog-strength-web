/**
 * Throwaway fixtures for the pace-trace Design Exploration. These mirror the
 * real `PaceStripPoint[]` shape so each variant draws against data that looks
 * like a genuine run, without wiring to `lib/running-splits`. Four states the
 * ticket requires every variant to survive: primary (negative split + dropout),
 * dense (long run, hundreds of samples), sparse (a couple of points), empty.
 */

import type { PaceStripPoint } from "@/lib/running-splits";

export type { PaceStripPoint };

export type Fixture = {
  label: string;
  unit: "km" | "mi";
  points: PaceStripPoint[];
  hasDropout: boolean;
};

// The canonical ~5 km run from the ticket: easing in, a mid-run GPS dropout,
// and a closing surge (a negative split).
export const PRIMARY: Fixture = {
  label: "5.0 km · negative split · dropout",
  unit: "km",
  hasDropout: true,
  points: [
    { distanceUnit: 0.0, paceSecPerUnit: 348 }, // 5:48/km — easing in
    { distanceUnit: 0.5, paceSecPerUnit: 335 },
    { distanceUnit: 1.0, paceSecPerUnit: 330 },
    { distanceUnit: 1.5, paceSecPerUnit: 322 },
    { distanceUnit: 2.0, paceSecPerUnit: 318 },
    { distanceUnit: 2.5, paceSecPerUnit: null }, // dropout — line breaks here
    { distanceUnit: 3.0, paceSecPerUnit: null },
    { distanceUnit: 3.5, paceSecPerUnit: 312 },
    { distanceUnit: 4.0, paceSecPerUnit: 305 },
    { distanceUnit: 4.5, paceSecPerUnit: 298 }, // 4:58/km — closing surge
    { distanceUnit: 5.0, paceSecPerUnit: 291 },
  ],
};

// A long run rendered as hundreds of samples: a deterministic wander around a
// drifting baseline, with one dropout window. Deterministic (no RNG) so the
// mockup renders identically every build.
function buildDense(): PaceStripPoint[] {
  const pts: PaceStripPoint[] = [];
  const n = 180; // ~18 km at 100 m sampling
  for (let i = 0; i <= n; i++) {
    const distanceUnit = (i / n) * 18;
    // Baseline drifts faster over the run (negative split); layered ripples
    // stand in for stride/terrain jitter the winsorizer would leave behind.
    const baseline = 340 - distanceUnit * 2.4;
    const ripple = Math.sin(i * 0.55) * 6 + Math.sin(i * 0.17 + 1.3) * 9 + Math.sin(i * 1.9) * 3;
    let pace: number | null = Math.round(baseline + ripple);
    // A dropout window between ~7.5–8.3 km.
    if (distanceUnit > 7.5 && distanceUnit < 8.3) pace = null;
    pts.push({ distanceUnit: Number(distanceUnit.toFixed(2)), paceSecPerUnit: pace });
  }
  return pts;
}

export const DENSE: Fixture = {
  label: "18.0 km · long run · 180 samples",
  unit: "km",
  hasDropout: true,
  points: buildDense(),
};

// A short run with only a handful of points — the form must not look broken.
export const SPARSE: Fixture = {
  label: "1.8 km · short run · 4 points",
  unit: "km",
  hasDropout: false,
  points: [
    { distanceUnit: 0.0, paceSecPerUnit: 372 },
    { distanceUnit: 0.6, paceSecPerUnit: 360 },
    { distanceUnit: 1.2, paceSecPerUnit: 366 },
    { distanceUnit: 1.8, paceSecPerUnit: 351 },
  ],
};

// Fewer than two plottable points → the restyled "No pace data" placeholder.
export const EMPTY: Fixture = {
  label: "no usable pace samples",
  unit: "km",
  hasDropout: false,
  points: [{ distanceUnit: 0.0, paceSecPerUnit: null }],
};

export const ALL_STATES: Fixture[] = [DENSE, SPARSE, EMPTY];

/** Pace seconds → "m:ss" (e.g. 348 → "5:48"). Em-dash for non-finite. */
export function fmtPace(sec: number): string {
  if (!Number.isFinite(sec)) return "—";
  const total = Math.round(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Plottable (non-null) points only. */
export function plottable(points: PaceStripPoint[]) {
  return points.filter(
    (p): p is { distanceUnit: number; paceSecPerUnit: number } => p.paceSecPerUnit != null,
  );
}
