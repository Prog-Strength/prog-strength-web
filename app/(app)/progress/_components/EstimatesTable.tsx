"use client";

/**
 * The per-workout 1RM estimates table — one row per (workout, exercise)
 * contribution, the same points that feed the chart. The "% of current
 * capability" column is exactly `normalized_max`, i.e. the chart's Y-value,
 * so the table and chart visibly speak the same language (the column was
 * renamed from "% Baseline" to make that connection explicit).
 */

import type { MuscleGroupProgressionPoint } from "@/lib/api";
import { COLOR_DEFAULT, formatDate, formatNumber, formatPercent } from "./shared";
import { WorkoutLink } from "./WorkoutLink";

export function EstimatesTable({
  rows,
  exerciseColors,
}: {
  rows: MuscleGroupProgressionPoint[];
  exerciseColors: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--muted)]">
        No estimates for this exercise in the selected window.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th className="py-2 pr-3 text-left font-medium">Date</th>
            <th className="py-2 pr-3 text-left font-medium">Exercise</th>
            <th className="py-2 pr-3 text-right font-medium">Avg 1RM</th>
            <th className="py-2 pr-3 text-right font-medium">Min</th>
            <th className="py-2 pr-3 text-right font-medium">Max</th>
            <th className="py-2 pr-3 text-right font-medium">Sets</th>
            <th className="py-2 pr-3 text-right font-medium">% of current capability</th>
            <th className="py-2 text-right font-medium">Workout</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const color = exerciseColors.get(p.exercise_id) ?? COLOR_DEFAULT;
            return (
              <tr
                key={`${p.workout_id}:${p.exercise_id}`}
                className="border-b border-[var(--border)]/60 last:border-b-0"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                  {formatDate(p.performed_at)}
                </td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{p.exercise_name}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(p.avg_estimated_1rm)} {p.unit}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {formatNumber(p.min_estimated_1rm)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {formatNumber(p.max_estimated_1rm)}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--muted)]">
                  {p.set_count}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatPercent(p.normalized_max)}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <WorkoutLink workoutID={p.workout_id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
