"use client";

/**
 * The Sets × Reps × Weight table — raw sets logged in the window, coalesced
 * Strong-style: matching (reps, weight, unit) inside the same
 * workout-exercise collapse into one row with a count. No exposure to
 * baseline labeling; lifted out of the prior page.tsx unchanged.
 */

import type { ExerciseBaseline, Workout } from "@/lib/api";
import { COLOR_DEFAULT, formatDate, formatNumber } from "./shared";
import { WorkoutLink } from "./WorkoutLink";

/**
 * One row in the Sets view: one workout-exercise's set group, collapsed by
 * (reps, weight, unit). A workout-exercise that did 3×8 @ 50 then 1×6 @ 50
 * produces two rows; doing 3×8 @ 50 + 3×8 @ 55 also produces two rows.
 */
export type SetsTableRow = {
  workout_id: string;
  exercise_id: string;
  exercise_name: string;
  performed_at: string;
  reps: number;
  weight: number;
  unit: "lb" | "kg";
  set_count: number;
};

export function buildSetsRows(
  workouts: Workout[],
  baselineByID: Map<string, ExerciseBaseline>,
): SetsTableRow[] {
  const rows: SetsTableRow[] = [];
  for (const w of workouts) {
    for (const we of w.exercises) {
      const baseline = baselineByID.get(we.exercise_id);
      // Skip exercises that don't contribute to this filter — baselineByID
      // is the authoritative scope for the active movement pattern.
      if (!baseline) continue;
      // Map preserves insertion order, so the first occurrence of a (reps,
      // weight) combo determines where its row sits within the
      // workout-exercise. The within-group secondary sort below overrides
      // that to weight-desc for stable presentation.
      const groups = new Map<
        string,
        { reps: number; weight: number; unit: "lb" | "kg"; count: number }
      >();
      for (const s of we.sets) {
        const key = `${s.reps}|${s.weight}|${s.unit}`;
        const existing = groups.get(key);
        if (existing) {
          existing.count++;
        } else {
          groups.set(key, {
            reps: s.reps,
            weight: s.weight,
            unit: s.unit,
            count: 1,
          });
        }
      }
      for (const g of groups.values()) {
        rows.push({
          workout_id: w.id,
          exercise_id: we.exercise_id,
          exercise_name: baseline.exercise_name,
          performed_at: w.performed_at,
          reps: g.reps,
          weight: g.weight,
          unit: g.unit,
          set_count: g.count,
        });
      }
    }
  }
  // Sort: most recent first (matches the chart + estimates view), then by
  // exercise name alphabetically so multiple exercises on the same day
  // group together, then by weight descending so the heaviest sets land at
  // the top of each (workout, exercise) cluster.
  rows.sort((a, b) => {
    const t = new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime();
    if (t !== 0) return t;
    if (a.exercise_id !== b.exercise_id) {
      return a.exercise_name.localeCompare(b.exercise_name);
    }
    return b.weight - a.weight;
  });
  return rows;
}

export function SetsTable({
  rows,
  exerciseColors,
}: {
  rows: SetsTableRow[];
  exerciseColors: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-xs text-[var(--muted)]">
        No sets logged for this exercise in the selected window.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-xs">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
            <th className="py-2 pr-3 text-left font-medium">Date</th>
            <th className="py-2 pr-3 text-left font-medium">Exercise</th>
            <th className="py-2 pr-3 text-right font-medium">Sets</th>
            <th className="py-2 pr-3 text-right font-medium">Reps</th>
            <th className="py-2 pr-3 text-right font-medium">Weight</th>
            <th className="py-2 text-right font-medium">Workout</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const color = exerciseColors.get(r.exercise_id) ?? COLOR_DEFAULT;
            return (
              <tr
                // (workout, exercise, reps, weight) is unique within the
                // coalesced row set — idx is the tiebreaker for the (rare)
                // case where two muscle-groups overlap and the same combo
                // appears twice in one workout-exercise.
                key={`${r.workout_id}:${r.exercise_id}:${r.reps}:${r.weight}:${idx}`}
                className="border-b border-[var(--border)]/60 last:border-b-0"
              >
                <td className="py-2 pr-3 whitespace-nowrap text-[var(--muted)]">
                  {formatDate(r.performed_at)}
                </td>
                <td className="py-2 pr-3">
                  <span className="inline-flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="truncate">{r.exercise_name}</span>
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.set_count}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.reps}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatNumber(r.weight)} {r.unit}
                </td>
                <td className="py-2 text-right whitespace-nowrap">
                  <WorkoutLink workoutID={r.workout_id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
