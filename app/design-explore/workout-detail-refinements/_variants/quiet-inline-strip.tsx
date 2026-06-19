"use client";

/**
 * IDIOM: quiet-inline-strip  ·  draws on the shipped session-recap's own restraint.
 *
 * The lightest touch, honoring the calm reading page: a small inline intensity
 * strip — the categories as a single thin segmented bar (each segment a
 * category, width = its share of sets, steel-blue graded by intensity) with the
 * counts as a caption — that stays WITHIN the editorial column rather than
 * becoming a chart block. A graphic that barely raises the page's volume.
 *
 * DIVERGENCE (within the v0.4 lift steel-blue + tokens):
 *   - type scale  : the smallest of the five — only a thin caption of counts;
 *                   the strip itself carries no labels.
 *   - color logic : one steel-blue hue GRADED by share — the dominant category
 *                   reads full strength, lesser ones step down in opacity within
 *                   the single segmented bar (no separate fills, no second hue).
 *   - spacing     : inline and minimal — a single hairline-height bar that sits
 *                   in the column's flow, never a framed block.
 */

import { RecapShell } from "../_shared";
import { populatedMuscles, totalMuscleSets, type WorkoutFixture } from "../_fixtures";

export function QuietInlineStrip({ fixture }: { fixture: WorkoutFixture }) {
  return (
    <RecapShell
      fixture={fixture}
      graphicLabel="What it trained"
      graphic={<InlineStrip fixture={fixture} />}
    />
  );
}

function InlineStrip({ fixture }: { fixture: WorkoutFixture }) {
  const cats = populatedMuscles(fixture.muscle);
  const total = totalMuscleSets(fixture.muscle);

  // Degrade: nothing mapped → the quietest possible fallback, a single line.
  if (cats.length === 0 || total === 0) {
    return <p className="text-sm text-[var(--faint)]">No muscle groups logged.</p>;
  }

  return (
    <div className="space-y-2">
      <span className="flex h-2 w-full overflow-hidden rounded-full">
        {cats.map((c, i) => (
          <span
            key={c.category}
            title={`${c.category} ${c.sets}`}
            style={{
              width: `${(c.sets / total) * 100}%`,
              backgroundColor: "var(--discipline-lift-dot)",
              // graded by rank: the dominant segment full strength, lesser ones
              // stepped down within the single hue.
              opacity: 1 - i * 0.22,
            }}
          />
        ))}
      </span>
      <p className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
        {cats.map((c, i) => (
          <span key={c.category}>
            <span className="text-[var(--foreground)]">{c.category}</span>{" "}
            <span className="tabular-nums text-[var(--faint)]">{c.sets}</span>
            {i < cats.length - 1 && <span className="pl-2 text-[var(--faint)]">·</span>}
          </span>
        ))}
      </p>
    </div>
  );
}
