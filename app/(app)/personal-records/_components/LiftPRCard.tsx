"use client";

/**
 * One Lifts-view PR card. The body is the original flat-page `PRCard`
 * verbatim — title, weight × reps, "Set on", current estimated 1RM with
 * the gap, "Time for a max?" badge, "View workout →" — re-homed here and
 * wrapped in a shell that adds the expand chevron + inline progression
 * chart. The chevron is suppressed for headline lifts the user has never
 * PR'd (`!hasPR`): there's nothing to chart.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PersonalRecord } from "@/lib/api";
import { ExpandChevron } from "./ExpandChevron";
import { ProgressionChart } from "./ProgressionChart";
import { formatDate, formatWeight } from "./format";

export function LiftPRCard({ record }: { record: PersonalRecord }) {
  const [expanded, setExpanded] = useState(false);
  const hasPR = record.weight !== null && record.workout_id !== null;

  // Gap between estimated 1RM and PR weight — when meaningfully
  // positive, surface a "ready for a new max?" hint. Threshold
  // chosen empirically: 5% gap is noticeable to a lifter; smaller
  // gaps fall inside session-to-session noise.
  const gap = useMemo(() => {
    if (!hasPR || record.current_estimated_1rm === null) return null;
    if (record.weight === null) return null;
    return record.current_estimated_1rm - record.weight;
  }, [hasPR, record.current_estimated_1rm, record.weight]);
  const gapPct =
    gap !== null && record.weight !== null && record.weight > 0
      ? (gap / record.weight) * 100
      : null;
  const readyForAttempt = gapPct !== null && gapPct >= 5;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold tracking-tight">{record.exercise_name}</h2>
        {readyForAttempt && (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
            Time for a max?
          </span>
        )}
      </div>

      {hasPR ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatWeight(record.weight, record.unit)}
            <span className="ml-1.5 text-base font-normal text-[var(--muted)]">
              × {record.reps}
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Set on {formatDate(record.achieved_at)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight text-[var(--muted)]">—</p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">No record yet</p>
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Current estimated 1RM
        </p>
        <p className="mt-0.5 text-sm font-medium tabular-nums">
          {record.current_estimated_1rm === null
            ? "—"
            : formatWeight(record.current_estimated_1rm, record.estimated_1rm_unit)}
          {gap !== null && Math.abs(gap) >= 1 && (
            <span
              className={`ml-2 text-xs ${gap > 0 ? "text-emerald-300" : "text-[var(--muted)]"}`}
            >
              {gap > 0 ? "+" : ""}
              {gap.toFixed(1)} vs PR
            </span>
          )}
        </p>
      </div>

      {hasPR && record.workout_id && (
        <Link
          href={`/workouts/${record.workout_id}`}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          View workout →
        </Link>
      )}

      {expanded && <ProgressionChart kind="lifts" exerciseId={record.exercise_id} />}

      {hasPR && <ExpandChevron expanded={expanded} onToggle={() => setExpanded((e) => !e)} />}
    </div>
  );
}
