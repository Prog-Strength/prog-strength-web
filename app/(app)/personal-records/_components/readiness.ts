/**
 * Pure readiness derivation for the Personal Records Lifts view. The
 * single home for the PR-vs-estimate gap math (formerly inlined in
 * LiftPRCard) — tiles and the chrome summary both consume it so "due" is
 * defined once. React-free; `now` is injectable so the staleness math is
 * deterministic in tests (production passes a real `new Date()`).
 */
import type { PersonalRecord } from "@/lib/api";

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
