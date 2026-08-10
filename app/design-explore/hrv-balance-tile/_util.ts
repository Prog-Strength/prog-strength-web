/**
 * Shared throwaway helpers for the hrv-balance-tile DX variants.
 *
 * Measurement, formatting, and status→token mapping only. Nothing here
 * recomputes a server figure: baselines, band bounds and z-scores are read
 * straight off the fixture. The only arithmetic is mapping an already-computed
 * millisecond value onto a pixel, which is what a chart is.
 *
 * `useMeasuredWidth` exists because of a real constraint in the ticket: the
 * shipped tile stretches a 260×92 viewBox with `preserveAspectRatio="none"`,
 * which turns every `<circle>` into an ellipse. `vectorEffect` rescues a stroke
 * but nothing rescues a scaled circle — invisible with one 3.5px dot, glaring
 * with thirty. Measuring the container and drawing in real pixel units (viewBox
 * === rendered size) removes the problem at the root, and has the side benefit
 * that the dot pitch a reviewer sees is the true pitch, which is itself one of
 * the axes being judged.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { RefCallback } from "react";
import type {
  RecoveryBaselineTrendView,
  RecoveryBaselineView,
  RecoveryDayPoint,
  RecoveryHrvStatus,
  RecoveryHrvView,
  RecoveryTrendDirection,
  RecoveryView,
} from "@/lib/dashboard";

/** Measure an element's content width, live. Returns 0 until first measure. */
export function useMeasuredWidth<T extends HTMLElement>(): [RefCallback<T>, number] {
  const [width, setWidth] = useState(0);
  const observed = useRef<T | null>(null);

  const ref = useCallback<RefCallback<T>>((node) => {
    observed.current = node;
    if (node) setWidth(node.getBoundingClientRect().width);
  }, []);

  useLayoutEffect(() => {
    const node = observed.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry?.contentRect.width ?? 0;
      setWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

/**
 * A recovery view with the three optional blocks proven present AND a band
 * that exists somewhere. Guard once at the top of a variant and render the
 * calibrating state otherwise — never `!`-assert.
 */
export type Prepared = {
  days: RecoveryDayPoint[];
  baseline: RecoveryBaselineView;
  hrv: RecoveryHrvView;
  drift: RecoveryBaselineTrendView;
  /** The last charted day. Its `hrv` is null before the morning webhook lands. */
  today: RecoveryDayPoint;
  /** Days whose own trailing window was long enough to have a band. */
  banded: RecoveryDayPoint[];
  /** Millisecond domain spanning every mark and every band bound, with headroom. */
  domain: [number, number];
};

export function prepare(view: RecoveryView): Prepared | null {
  const { days, baseline, hrv, baselineTrend } = view;
  if (!days || !baseline || !hrv || !baselineTrend) return null;
  // No band anywhere == calibrating, whatever else the payload carries.
  if (baseline.hrvAvg === null || baseline.hrvStdDev === null) return null;

  const banded = days.filter((d) => d.balancedLow !== null && d.balancedHigh !== null);
  if (banded.length === 0) return null;

  const marks = days.map((d) => d.hrv).filter((v): v is number => v !== null);
  const lows = banded.map((d) => d.balancedLow as number);
  const highs = banded.map((d) => d.balancedHigh as number);

  return {
    days,
    baseline,
    hrv,
    drift: baselineTrend,
    today: days[days.length - 1],
    banded,
    domain: [Math.min(...lows, ...marks) - 5, Math.max(...highs, ...marks) + 5],
  };
}

/**
 * Map an HRV balance status to its colour role. The house contract, unchanged
 * from the shipped tile: `suppressed` reads WARNING (a low-HRV morning is
 * information, never danger red), `elevated` reads ACCENT (unusual, not "extra
 * good"), `balanced` reads SUCCESS (ordinary), `unknown` reads MUTED. Garmin's
 * saturated traffic light is deliberately not imported.
 */
export function statusColor(status: RecoveryHrvStatus): string {
  switch (status) {
    case "suppressed":
      return "var(--warning)";
    case "elevated":
      return "var(--accent)";
    case "balanced":
      return "var(--success)";
    default:
      return "var(--muted)";
  }
}

/** The house word for a status. `unknown` splits on WHY it is unknown. */
export function statusWord(status: RecoveryHrvStatus, hasReading: boolean): string {
  switch (status) {
    case "suppressed":
      return "Suppressed";
    case "elevated":
      return "Elevated";
    case "balanced":
      return "Balanced";
    default:
      return hasReading ? "Calibrating" : "No reading yet";
  }
}

/** Signed integer delta with a unicode minus, e.g. +6 / −8 / ±0. */
export function signed(n: number): string {
  const r = Math.round(n);
  if (r === 0) return "±0";
  return r > 0 ? `+${r}` : `−${Math.abs(r)}`;
}

/** The glyph for a baseline-drift direction. */
export function driftGlyph(direction: RecoveryTrendDirection): string {
  switch (direction) {
    case "rising":
      return "▲";
    case "falling":
      return "▼";
    case "steady":
      return "▬";
    default:
      return "·";
  }
}

/**
 * The colour a DRIFT direction carries. Distinct from `statusColor`: this is
 * about the range moving, not about last night. Steady and unknown stay muted
 * so the balanced fixture reads calm.
 */
export function driftColor(direction: RecoveryTrendDirection): string {
  switch (direction) {
    case "rising":
      return "var(--success)";
    case "falling":
      return "var(--warning)";
    default:
      return "var(--muted)";
  }
}

/** `▲ +6 ms · 4w`, or a shrug when the history is too short to say. */
export function driftTag(drift: RecoveryBaselineTrendView, unit = " ms"): string {
  if (drift.deltaMs === null || drift.direction === "unknown") return "drift not yet known";
  const weeks = Math.round(drift.overDays / 7);
  return `${driftGlyph(drift.direction)} ${signed(drift.deltaMs)}${unit} · ${weeks}w`;
}

/** "2026-08-01" → "Aug 1". Parsed as local date parts, no timezone drift. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** A linear ms→pixel mapper for a top-down SVG box. */
export function scaler(domain: [number, number], top: number, height: number) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  return (v: number) => top + (1 - (v - lo) / span) * height;
}

/**
 * "Nice" axis ticks across a domain — the 1/2/5×10ⁿ ladder, so an axis reads
 * 60 / 80 / 100 / 120 rather than 63.4 / 81.9 / …. Used by `instrument-plot`,
 * which is the only variant that spends space on axes.
 */
export function niceTicks([lo, hi]: [number, number], target = 4): number[] {
  const span = hi - lo;
  if (span <= 0) return [lo];
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  // Round to the NEAREST rung, not up to the next one. Rounding up turns a
  // norm of 2.1 into a step of 5× the magnitude, which on an 85 ms span leaves
  // a single label on the axis — and an axis with one tick on it is worse than
  // no axis, which is the whole argument instrument-plot is making.
  const step = (norm >= 7 ? 10 : norm >= 3 ? 5 : norm >= 1.5 ? 2 : 1) * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Math.round(t));
  return out;
}

/**
 * Split a day series into runs of consecutive days that HAVE a band, so a band
 * polygon can break where the baseline is null instead of closing across it.
 * The partial-band fixture is exactly this case: the band has to start a sixth
 * of the way across and read as intentional.
 */
export function bandRuns(days: RecoveryDayPoint[]): { i: number; d: RecoveryDayPoint }[][] {
  const runs: { i: number; d: RecoveryDayPoint }[][] = [];
  let run: { i: number; d: RecoveryDayPoint }[] = [];
  days.forEach((d, i) => {
    if (d.balancedLow === null || d.balancedHigh === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push({ i, d });
    }
  });
  if (run.length) runs.push(run);
  return runs;
}
