/**
 * DESIGN EXPLORATION — running-activity-detail (DO NOT MERGE, flag-gated).
 *
 * Static fixture + pure derivations shared by all five variants. This file
 * holds DATA and FORMATTING ONLY — no visual structure. Each variant composes
 * the run differently; nothing here prescribes how it looks.
 *
 * The fixture is the screenshot's run: a completed W7 D2 interval session —
 * 1 mi warm-up, 8 × 400m work bouts @ ~6:30 with 200m jog recoveries, a
 * 1.2 mi cool-down — with cardiac drift across the session, NO elevation, and
 * a single device dropout near mile 2 (pace 30:04, HR 120). The interval
 * pattern is genuinely present in the trace so the structure idioms have
 * something real to reconstruct.
 *
 * All paces are seconds-per-MILE here (the fixture renders in /mi). Distance
 * in miles. A production build would convert from the stored sec/km + the
 * user's unit; that conversion is out of scope for a throwaway mockup.
 */

export const SAMPLE_STEP_MI = 0.02;
/** Plot clamp: pace slower than this is treated as a dropout, line broken. */
export const PACE_CLAMP_MAX = 660; // 11:00 /mi — past this the watch glitched

export type TracePoint = {
  mi: number;
  /** Raw recorded pace incl. the glitch (sec/mi). null where the watch gapped. */
  paceRaw: number | null;
  /** Winsorized pace for plotting + derived stats (dropout removed). */
  paceClean: number | null;
  hr: number | null;
  isDropout: boolean;
};

export type SegmentKind = "warmup" | "work" | "recovery" | "cooldown";

export type Segment = {
  kind: SegmentKind;
  /** 1-based index among work bouts; undefined for warm-up / cool-down. */
  rep?: number;
  label: string;
  startMi: number;
  endMi: number;
  distanceMi: number;
  durationSec: number;
  avgPace: number; // sec/mi (clean)
  avgHr: number;
  /** Prescribed work pace, when this is a work bout. */
  targetPace?: number;
};

export type Split = {
  label: string;
  distanceMi: number;
  durationSec: number;
  avgPace: number; // sec/mi
  avgHr: number;
  elevDelta: number | null; // null — no barometric altimeter on this device
  fastest?: boolean;
  slowest?: boolean;
};

export const PLAN = {
  name: "W7 D2 — Interval Run",
  runType: "intervals" as const,
  status: "completed" as const,
  details: "Warm-up 1 mi · 8 × 400m @ 5K effort (~6:30/mi) · 200m jog recovery · cool-down 1 mi",
  targetWorkPace: 390, // 6:30 /mi
  targetReps: 8,
};

export const RUN = {
  name: "Afternoon Run",
  start: "Thu, Jun 18, 2026 · 12:10 PM",
  durationSec: 3184, // 53:04
  distanceMi: 5.2,
  avgPace: 611, // 10:11 /mi — dragged slow by recoveries + the dropout
  bestPace: 501, // 8:21 /mi
  avgHr: 169,
  maxHr: 191,
  calories: 806,
  elevationGainM: null as number | null, // → "No elevation data"
};

// ---- Segment plan (the structure latent in the trace) -----------------------

const WORK_MI = 0.2486; // 400m
const REC_MI = 0.1243; // 200m
// Per-rep work pace: strong through ~rep 6, then a visible fade on 7–8.
const WORK_PACES = [388, 386, 390, 389, 387, 393, 398, 412];
const WORK_HRS = [176, 179, 181, 183, 185, 187, 189, 191];
const REC_PACE = 565; // ~9:25 jog
const WARM_PACE = 568; // ~9:28
const COOL_PACE = 574; // ~9:34

function buildSegments(): Segment[] {
  const segs: Segment[] = [];
  let cursor = 0;

  const push = (
    kind: SegmentKind,
    distanceMi: number,
    avgPace: number,
    avgHr: number,
    label: string,
    rep?: number,
    targetPace?: number,
  ) => {
    const startMi = cursor;
    const endMi = Math.min(RUN.distanceMi, cursor + distanceMi);
    const dist = endMi - startMi;
    segs.push({
      kind,
      rep,
      label,
      startMi,
      endMi,
      distanceMi: dist,
      durationSec: Math.round(dist * avgPace),
      avgPace,
      avgHr,
      targetPace,
    });
    cursor = endMi;
  };

  push("warmup", 1.0, WARM_PACE, 156, "Warm-up");
  for (let i = 0; i < 8; i++) {
    push("work", WORK_MI, WORK_PACES[i], WORK_HRS[i], `Rep ${i + 1}`, i + 1, PLAN.targetWorkPace);
    if (i < 7) {
      const recHr = WORK_HRS[i] - 16 + i; // floor drifts up across the session
      push("recovery", REC_MI, REC_PACE, recHr, `Recovery ${i + 1}`, undefined);
    }
  }
  push("cooldown", RUN.distanceMi - cursor, COOL_PACE, 178, "Cool-down");
  return segs;
}

export const SEGMENTS: Segment[] = buildSegments();

// ---- Trace synthesis (deterministic; no Math.random for SSR stability) ------

/** Tiny deterministic jitter so a sampled trace looks organic but matches on
 *  server + client. Bounded to ±1. */
function jitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function segmentAt(mi: number): Segment {
  for (const s of SEGMENTS) {
    if (mi >= s.startMi && mi < s.endMi) return s;
  }
  return SEGMENTS[SEGMENTS.length - 1];
}

function buildTrace(): TracePoint[] {
  const pts: TracePoint[] = [];
  const n = Math.round(RUN.distanceMi / SAMPLE_STEP_MI);
  // Identify the dropout sample: the one nearest mile 2.0.
  const dropoutIdx = Math.round(2.0 / SAMPLE_STEP_MI);

  for (let i = 0; i <= n; i++) {
    const mi = Math.min(RUN.distanceMi, +(i * SAMPLE_STEP_MI).toFixed(3));
    const seg = segmentAt(mi);
    const paceJit = seg.kind === "work" ? jitter(i) * 4 : jitter(i) * 7;
    const hrJit = jitter(i + 99) * 2;
    let paceClean = Math.round(seg.avgPace + paceJit);
    let hr: number | null = Math.round(seg.avgHr + hrJit);
    let paceRaw: number | null = paceClean;
    let isDropout = false;

    if (i === dropoutIdx) {
      // The mile-2 device glitch: garbage pace + plunging HR for one sample.
      paceRaw = 1804; // 30:04 /mi
      hr = 120;
      isDropout = true;
      // Clean series breaks the line here rather than charting the spike.
      paceClean = null as unknown as number;
    }

    pts.push({
      mi,
      paceRaw,
      paceClean: paceClean as number | null,
      hr: isDropout ? null : hr, // HR also breaks at the glitch
      isDropout,
    });
  }
  return pts;
}

export const TRACE: TracePoint[] = buildTrace();

// ---- Splits (per-mile, computed from the CLEAN trace) -----------------------

function buildSplits(): Split[] {
  const buckets = new Map<number, { time: number; dist: number; hrSum: number; hrN: number }>();
  for (let i = 1; i < TRACE.length; i++) {
    const a = TRACE[i - 1];
    const b = TRACE[i];
    const dDist = b.mi - a.mi;
    if (dDist <= 0) continue;
    const pace = b.paceClean ?? a.paceClean ?? RUN.avgPace; // bridge the dropout
    const mileIdx = Math.floor(a.mi);
    const cur = buckets.get(mileIdx) ?? { time: 0, dist: 0, hrSum: 0, hrN: 0 };
    cur.time += dDist * pace;
    cur.dist += dDist;
    if (b.hr != null) {
      cur.hrSum += b.hr;
      cur.hrN += 1;
    }
    buckets.set(mileIdx, cur);
  }

  const splits: Split[] = [];
  const keys = [...buckets.keys()].sort((x, y) => x - y);
  for (const k of keys) {
    const v = buckets.get(k)!;
    const isLast = k === keys[keys.length - 1];
    splits.push({
      label: isLast && v.dist < 0.95 ? `${k}–${RUN.distanceMi.toFixed(1)}` : `Mi ${k + 1}`,
      distanceMi: v.dist,
      durationSec: Math.round(v.time),
      avgPace: Math.round(v.time / v.dist),
      avgHr: v.hrN ? Math.round(v.hrSum / v.hrN) : RUN.avgHr,
      elevDelta: null,
    });
  }
  // Mark fastest / slowest full-ish miles by pace (lower = faster).
  let fast = 0;
  let slow = 0;
  splits.forEach((s, i) => {
    if (s.avgPace < splits[fast].avgPace) fast = i;
    if (s.avgPace > splits[slow].avgPace) slow = i;
  });
  splits[fast].fastest = true;
  splits[slow].slowest = true;
  return splits;
}

export const SPLITS: Split[] = buildSplits();

// ---- Adherence (prescribed vs actual, reconstructed from the trace) ---------

export const WORK_BOUTS: Segment[] = SEGMENTS.filter((s) => s.kind === "work");

export const ADHERENCE = (() => {
  const onPaceTol = 8; // within +8 sec/mi of target counts as "on pace"
  const onPace = WORK_BOUTS.filter((b) => b.avgPace <= PLAN.targetWorkPace + onPaceTol).length;
  const avgWork = Math.round(WORK_BOUTS.reduce((sum, b) => sum + b.avgPace, 0) / WORK_BOUTS.length);
  const fadeRep = WORK_BOUTS.findIndex((b) => b.avgPace > PLAN.targetWorkPace + onPaceTol);
  return {
    repsPlanned: PLAN.targetReps,
    repsRun: WORK_BOUTS.length,
    repsOnPace: onPace,
    avgWorkPace: avgWork, // sec/mi
    targetWorkPace: PLAN.targetWorkPace,
    paceDelta: avgWork - PLAN.targetWorkPace, // +slower / -faster
    fadeRep: fadeRep === -1 ? null : fadeRep + 1, // first rep that missed
    onPaceTol,
  };
})();

// ---- Formatting helpers -----------------------------------------------------

export function fmtPace(secPerMi: number | null): string {
  if (secPerMi == null || !Number.isFinite(secPerMi) || secPerMi <= 0) return "—";
  const t = Math.round(secPerMi);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

export function fmtClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

/** Signed pace delta, e.g. "+0:04" (slower) or "−0:06" (faster). */
export function fmtPaceDelta(deltaSec: number): string {
  const sign = deltaSec > 0 ? "+" : deltaSec < 0 ? "−" : "±";
  const a = Math.abs(Math.round(deltaSec));
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}

/** Run discipline hue tokens (in-system: green-teal, never the accent). */
export const RUN_HUE = {
  bg: "var(--discipline-run-bg)",
  fg: "var(--discipline-run-fg)",
  dot: "var(--discipline-run-dot)",
};
