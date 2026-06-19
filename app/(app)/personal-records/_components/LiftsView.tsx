"use client";

/**
 * The Lifts view as a compact-dashboard tile grid: every headline lift
 * visible at once, each a mini-stat (PR figure, a readiness dot and est-1RM
 * delta that scale with the gap, recency, and an inline trend spark). The
 * never-PR'd lift gets a quiet dashed "untested" tile. A tile is a click
 * target that expands the lazy ProgressionChart inline with View workout →.
 * Conforms to design-system v0.4 — neutral by default, --warning only on the
 * scaling readiness signal, --success on the positive delta; the periwinkle
 * accent stays app-chrome and is never used here as selection.
 */

import { useState } from "react";
import Link from "next/link";
import type { PersonalRecord } from "@/lib/api";
import { ProgressionChart } from "./ProgressionChart";
import { Sparkline } from "./Sparkline";
import { deriveReadiness, READY_THRESHOLD_PCT } from "./readiness";
import { formatWeight, formatDate } from "./format";

const DOT_GAP_CAP = 30;
const DOT_MIN_OPACITY = 0.35;
const SKELETON_TILES = 8;

export function LiftsView({
  records,
  isPending,
  error,
}: {
  records: PersonalRecord[] | undefined;
  isPending: boolean;
  error: Error | null;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (error) {
    return (
      <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
        {error.message}
      </div>
    );
  }
  if (isPending || !records) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: SKELETON_TILES }).map((_, i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)]"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }
  if (records.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No headline lifts configured.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {records.map((r) => {
        const d = deriveReadiness(r);
        if (!d.hasPR) return <UntestedTile key={r.exercise_id} record={r} />;
        return (
          <Tile
            key={r.exercise_id}
            record={r}
            expanded={expandedId === r.exercise_id}
            onToggle={() => setExpandedId((cur) => (cur === r.exercise_id ? null : r.exercise_id))}
          />
        );
      })}
    </div>
  );
}

function Tile({
  record,
  expanded,
  onToggle,
}: {
  record: PersonalRecord;
  expanded: boolean;
  onToggle: () => void;
}) {
  const d = deriveReadiness(record);
  const fresh = d.gapPct !== null && d.gapPct < READY_THRESHOLD_PCT;
  const due = d.gapPct !== null && d.gapPct >= READY_THRESHOLD_PCT;
  const dotColor = fresh ? "var(--discipline-lift-dot)" : "var(--warning)";
  const dotOpacity = due
    ? Math.max(DOT_MIN_OPACITY, Math.min(d.gapPct as number, DOT_GAP_CAP) / DOT_GAP_CAP)
    : 1;
  const sparkColor = fresh ? "var(--discipline-lift-dot)" : "var(--warning)";

  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${record.exercise_name}, ${expanded ? "hide" : "show"} progression`}
        title={record.exercise_name}
        className="flex flex-col gap-1 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition hover:border-[var(--foreground)]/20"
      >
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium">{record.exercise_name}</span>
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor, opacity: dotOpacity }}
            aria-hidden="true"
          />
        </div>
        <p className="text-xl font-semibold tabular-nums tracking-tight">
          {formatWeight(record.weight, record.unit)}
          <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">
            {d.isDumbbell ? "ea " : ""}× {record.reps}
          </span>
        </p>
        <div className="flex items-center justify-between gap-1 text-[11px] tabular-nums">
          {due && d.gap !== null ? (
            <span className="text-[var(--success)]">
              +{Math.round(d.gap)}
              {record.current_estimated_1rm !== null && (
                <span className="ml-1 text-[var(--faint)]">
                  est {Math.round(record.current_estimated_1rm)}
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--faint)]">·</span>
          )}
          <Sparkline points={record.recent_estimated_1rm_points} color={sparkColor} />
        </div>
        <p className="text-[10px] text-[var(--muted)]">{formatDate(record.achieved_at)}</p>
      </button>
      {expanded && (
        <div className="col-span-full rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-3">
          <ProgressionChart kind="lifts" exerciseId={record.exercise_id} />
          {record.workout_id && (
            <Link
              href={`/workouts/${record.workout_id}`}
              className="mt-2 inline-block text-xs text-[var(--accent)] hover:underline"
            >
              View workout →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

function UntestedTile({ record }: { record: PersonalRecord }) {
  return (
    <div
      title={record.exercise_name}
      className="flex flex-col gap-1 rounded-[14px] border border-dashed border-[var(--border)] bg-transparent p-3"
    >
      <span className="truncate text-xs font-medium text-[var(--muted)]">
        {record.exercise_name}
      </span>
      <p className="text-xl font-semibold tabular-nums text-[var(--faint)]">—</p>
      <p className="text-[10px] text-[var(--faint)]">untested</p>
    </div>
  );
}
