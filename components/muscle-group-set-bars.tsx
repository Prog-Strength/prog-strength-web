"use client";

import { useMemo } from "react";
import type { Exercise, Workout } from "@/lib/api";
import { setsByCategory } from "@/lib/muscle-set-distribution";

/**
 * The exact-count complement to the muscle-group radar: a sorted set of
 * horizontal bars showing how many sets in the workout touched each body-
 * part category. Where the radar conveys overall shape/balance, these bars
 * give the precise per-category count, biggest first.
 *
 * Purely presentational — shares its aggregation with the radar via
 * `setsByCategory` so the two views can never disagree about the numbers.
 * Bar widths are scaled to the largest category so the tallest bar always
 * fills the track.
 */
export function MuscleGroupSetBars({
  workout,
  exercises,
}: {
  workout: Workout;
  exercises: Exercise[];
}) {
  const { rows, hasData, max } = useMemo(() => {
    const { data, hasData } = setsByCategory([workout], exercises);
    const rows = [...data].sort((a, b) => b.value - a.value);
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
    return { rows, hasData, max };
  }, [workout, exercises]);

  if (!hasData) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-center text-xs text-[var(--muted)]">
        No categorizable muscle groups in this workout.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => (
        <li key={row.category} className="flex items-center gap-3">
          <span className="w-16 shrink-0 text-xs text-[var(--muted)]">{row.category}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-[#3b82f6]"
              style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs tabular-nums text-[var(--foreground)]">
            {row.value}
          </span>
        </li>
      ))}
    </ul>
  );
}
