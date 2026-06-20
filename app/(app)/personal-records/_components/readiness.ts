/**
 * Pure readiness derivation for the Personal Records Lifts view. The
 * single home for the PR-vs-estimate gap math (formerly inlined in
 * LiftPRCard) — tiles and the chrome summary both consume it so "due" is
 * defined once. React-free; `now` is injectable so the staleness math is
 * deterministic in tests (production passes a real `new Date()`).
 */
import type { PersonalRecord, RunningBestEffort } from "@/lib/api";

/** Gap (%) at or above which a lift is "due" for a new max attempt. This
 * is the shipped 5% rule — kept as the summary's "due" definition; tile
 * magnitude (dot/spark intensity) carries the finer signal. */
export const READY_THRESHOLD_PCT = 5;

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DUMBBELL_RE = /dumbbell/i;

export type Readiness = {
  hasPR: boolean;
  isDumbbell: boolean;
  gap: number | null;
  gapPct: number | null;
  ready: boolean;
  daysSince: number | null;
};

export function deriveReadiness(record: PersonalRecord, now: Date = new Date()): Readiness {
  const hasPR = record.weight !== null && record.workout_id !== null;
  const isDumbbell = DUMBBELL_RE.test(record.exercise_name);

  let gap: number | null = null;
  let gapPct: number | null = null;
  if (
    hasPR &&
    record.weight !== null &&
    record.weight > 0 &&
    record.current_estimated_1rm !== null
  ) {
    gap = record.current_estimated_1rm - record.weight;
    gapPct = (gap / record.weight) * 100;
  }

  const ready = gapPct !== null && gapPct >= READY_THRESHOLD_PCT;

  let daysSince: number | null = null;
  if (record.achieved_at) {
    const then = new Date(record.achieved_at).getTime();
    if (Number.isFinite(then)) {
      daysSince = Math.floor((now.getTime() - then) / MS_PER_DAY);
    }
  }

  return { hasPR, isDumbbell, gap, gapPct, ready, daysSince };
}

/** Counts for the `N due · N/total tested` chrome summary. */
export function summarizeReadiness(
  records: PersonalRecord[],
  now: Date = new Date(),
): { due: number; tested: number; total: number } {
  let due = 0;
  let tested = 0;
  for (const r of records) {
    const d = deriveReadiness(r, now);
    if (d.hasPR) tested += 1;
    if (d.ready) due += 1;
  }
  return { due, tested, total: records.length };
}

/** The fixed v1 running distance set, shortest first — matches the API's
 * `distance_key`/`distance_label`. Owned here (moved off the retired
 * RunningView) so the ledger, detail, and default-selection logic share one
 * source. The same list also lives in progress/running's `distances.ts` for
 * a different route — that copy is intentionally separate. */
export const STANDARD_DISTANCES: { key: string; label: string }[] = [
  { key: "1mi", label: "1 Mile" },
  { key: "2mi", label: "2 Mile" },
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half_marathon", label: "Half Marathon" },
  { key: "marathon", label: "Marathon" },
];

/**
 * Lifts ranked "most due first": tested lifts by descending est-vs-PR gap,
 * then untested lifts (no PR) last in their original (stable) order. Returns
 * a new array; the input is not mutated.
 */
export function liftsByReadiness(
  records: PersonalRecord[],
  now: Date = new Date(),
): PersonalRecord[] {
  return records
    .map((record, index) => ({ record, index, d: deriveReadiness(record, now) }))
    .sort((a, b) => {
      if (a.d.hasPR !== b.d.hasPR) return a.d.hasPR ? -1 : 1;
      if (a.d.hasPR) {
        const gapA = a.d.gap ?? 0;
        const gapB = b.d.gap ?? 0;
        if (gapA !== gapB) return gapB - gapA;
      }
      return a.index - b.index;
    })
    .map((x) => x.record);
}

/** One running-ledger row: a standard distance plus the user's best effort at
 * it (null when never covered). */
export type RunningLedgerItem = {
  key: string;
  label: string;
  best: RunningBestEffort | null;
};

/**
 * Running rows ranked: `5k` (the default, always-projected distance) first,
 * then covered distances, then uncovered — stable within each rank. Returns a
 * new array; the input is not mutated.
 */
export function runningByReadiness(items: RunningLedgerItem[]): RunningLedgerItem[] {
  const rank = (it: RunningLedgerItem): number => {
    if (it.key === "5k") return 0;
    if (it.best !== null) return 1;
    return 2;
  };
  return items
    .map((it, index) => ({ it, index }))
    .sort((a, b) => rank(a.it) - rank(b.it) || a.index - b.index)
    .map((x) => x.it);
}
