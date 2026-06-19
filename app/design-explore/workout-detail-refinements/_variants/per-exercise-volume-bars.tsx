"use client";

/**
 * IDIOM: per-exercise-volume-bars  ·  draws on Hevy / Strong session breakdowns.
 *
 * A compact horizontal bar per exercise, sized by that exercise's volume
 * (Σ reps×weight), largest first — "where the work went" this session
 * (Squat ≫ Calf Raise ≫ …). ZERO degeneracy: every exercise has a bar, so it
 * reads the same on a 4-lift or a 10-lift day and never looks empty or
 * lopsided. The honest, always-populated answer that doubles as a glance at
 * session balance.
 *
 * DIVERGENCE (within the v0.4 lift steel-blue + tokens):
 *   - type scale  : the NUMBER leads — a compact tabular volume figure (14.5k)
 *                   per row, exercise names demoted to a small label.
 *   - color logic : uniform steel-blue fill on every bar (volume = length, not
 *                   hue); the PR exercise alone is marked with a --warning label
 *                   + 🏆 so meaning, not decoration, carries the second color.
 *   - spacing     : dense, tight row rhythm — a stacked ledger of bars in the
 *                   strip's old block slot, the most compact of the five.
 */

import { RecapShell } from "../_shared";
import {
  exerciseName,
  exerciseVolume,
  fmtCompact,
  fmtVolume,
  isPrExercise,
  type WorkoutFixture,
} from "../_fixtures";

export function PerExerciseVolumeBars({ fixture }: { fixture: WorkoutFixture }) {
  return (
    <RecapShell
      fixture={fixture}
      graphicLabel="Where the work went"
      graphic={<VolumeBars fixture={fixture} />}
    />
  );
}

function VolumeBars({ fixture }: { fixture: WorkoutFixture }) {
  const { workout } = fixture;
  const rows = workout.exercises
    .map((ex) => ({
      id: ex.exercise_id,
      name: exerciseName(ex.exercise_id),
      volume: exerciseVolume(ex),
      isPr: isPrExercise(workout, ex.exercise_id),
    }))
    .sort((a, b) => b.volume - a.volume);

  const max = Math.max(...rows.map((r) => r.volume), 0);

  // Degrade: a pure-bodyweight session logs no load → no volume to rank.
  if (max === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--faint)]">
        No load logged this session — a bodyweight / mobility day.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r) => {
        const pct = (r.volume / max) * 100;
        return (
          <li key={r.id} className="flex items-center gap-3">
            <span
              className={`w-36 shrink-0 truncate text-xs ${
                r.isPr ? "text-[var(--warning)]" : "text-[var(--muted)]"
              }`}
              title={r.name}
            >
              {r.isPr && "🏆 "}
              {r.name}
            </span>
            <span className="relative h-5 flex-1 overflow-hidden rounded-[4px] bg-[var(--surface-2)]">
              <span
                className="absolute inset-y-0 left-0 rounded-[4px]"
                style={{
                  width: `${pct}%`,
                  backgroundColor: "var(--discipline-lift-dot)",
                  opacity: 0.85,
                }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-sm font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
              {fmtCompact(r.volume)}
            </span>
          </li>
        );
      })}
      <li className="mt-1 text-right text-[11px] tabular-nums text-[var(--faint)]">
        {fmtVolume(rows.reduce((s, r) => s + r.volume, 0))} total
      </li>
    </ul>
  );
}
