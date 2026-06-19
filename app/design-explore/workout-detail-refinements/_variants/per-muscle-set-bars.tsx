"use client";

/**
 * IDIOM: per-muscle-set-bars  ·  draws on TrainingPeaks' per-segment bars.
 *
 * Horizontal bars per muscle category (Legs 27 · Core 5 as sized bars, largest
 * first) — the literal visual upgrade of today's text strip. Honest and calm;
 * it degrades by simply SHOWING FEWER BARS (a focused day shows two, which looks
 * fine — not broken). The smallest leap from the current strip: same data, now
 * seen.
 *
 * DIVERGENCE (within the v0.4 lift steel-blue + tokens):
 *   - type scale  : balanced — the category label and its set count read as a
 *                   peer pair (label left, count right), neither shouting.
 *   - color logic : uniform steel-blue fill, every bar the same hue (rank = bar
 *                   length + order, not color); the count sits at the bar's end.
 *   - spacing     : a calm medium rhythm — a short stack of full-width bars in
 *                   the strip's block slot; only the populated categories appear.
 */

import { RecapShell } from "../_shared";
import { populatedMuscles, type WorkoutFixture } from "../_fixtures";

export function PerMuscleSetBars({ fixture }: { fixture: WorkoutFixture }) {
  return (
    <RecapShell
      fixture={fixture}
      graphicLabel="What it trained"
      graphic={<MuscleBars fixture={fixture} />}
    />
  );
}

function MuscleBars({ fixture }: { fixture: WorkoutFixture }) {
  const bars = populatedMuscles(fixture.muscle);
  const max = Math.max(...bars.map((b) => b.sets), 0);

  // Degrade: no populated categories → drop, like the strip does today.
  if (bars.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--faint)]">
        This session didn&apos;t map to muscle groups.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {bars.map((b) => {
        const pct = (b.sets / max) * 100;
        return (
          <li key={b.category} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-[var(--foreground)]">{b.category}</span>
              <span className="text-xs tabular-nums text-[var(--muted)]">{b.sets} sets</span>
            </div>
            <span className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${pct}%`, backgroundColor: "var(--discipline-lift-dot)" }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
