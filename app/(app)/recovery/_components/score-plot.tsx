/**
 * ScorePlot — the deck's top row: fourteen months, ninety days or thirty of
 * recovery score as banded columns.
 *
 * COLUMNS, NOT A LINE, and the choice is the whole reading. A recovery score is
 * a verdict handed down once a morning — a number Whoop computes overnight and
 * never revises — not a quantity that flows between mornings, so there is
 * nothing in the space between two columns for a line to be true about. Joining
 * Sunday's 29 to Monday's 71 draws a slope no measurement was taken on, and it
 * invites the eye to read the slope rather than the two verdicts. A column has
 * a foot, a top and a colour, and a RUN of red columns — the rough February
 * week, the five bad mornings before a deload — is the most legible thing this
 * page can show. That run is what the athlete came to see, and it survives a
 * glance, a phone and a greyscale screenshot in a way a polyline does not.
 *
 * A NULL SCORE DRAWS NOTHING. No zero-height stub at the foot of the box, no
 * baseline tick, no ghost. This is the one place on the page where a column
 * chart can quietly lie: a 1px mark at the bottom of the axis is visually a
 * catastrophic morning, and the difference between "Whoop scored you at 3" and
 * "the strap was on the charger" is a difference in kind, not in degree. The
 * slot stays on the axis — it is date-aligned with the two rows below and with
 * the crosshair — and simply has no column in it. A gap is a gap.
 *
 * Nothing here recomputes a server figure. The arithmetic is a score mapped
 * onto a pixel height, which is what a bar chart is, and the band the colour
 * comes from is `recoveryBand`'s — Whoop's thirds are defined once in this
 * codebase and this file does not restate them.
 */
"use client";

import type { RecoveryDayPoint } from "@/lib/dashboard";
import { recoveryBand, recoveryBandColor } from "@/app/(app)/dashboard/_components/recovery/shared";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { columnWidth, xAt } from "./shared";

/**
 * The two zone hairlines, as scores on the plot's own domain.
 *
 * These are Whoop's published cut points — the same two numbers `recoveryBand`
 * sorts against — and they are here as POSITIONS to draw at, never as a second
 * copy of the thresholds: no comparison in this file uses them, and a column's
 * colour is decided entirely by `recoveryBand`. If Whoop ever moved a cut point,
 * `recoveryBand` would move with it and these lines would have to follow; they
 * are named once, here, so that is one edit rather than a hunt through inline
 * literals.
 */
const ZONE_LINES = [33, 67];

/**
 * A score's top edge on a FIXED 0–100 domain.
 *
 * Fixed because the bands are fixed. The obvious "improvement" — rescaling to
 * the observed range so a flat month uses the full height — would leave the two
 * hairlines drawn somewhere other than 33 and 67 of the visible box, or worse,
 * move them off the scores they name; and the zones are the only reason this
 * plot has horizontal rules at all. It is also right on its own terms: the
 * recovery score is a percentage with meaningful absolute values, so a 29 should
 * look short outright and not merely short relative to a bad month.
 *
 * The clamp is a guard, not a policy — the wire is a 0–100 float, and a value
 * outside it should be pinned to the box rather than drawn beyond it.
 */
function scoreY(score: number, height: number): number {
  return height - (Math.min(100, Math.max(0, score)) / 100) * height;
}

/** The plot's text alternative — the columns themselves carry no labels. */
function plotLabel(days: RecoveryDayPoint[]): string {
  const scored = days.filter((d) => d.recoveryScore !== null).length;
  return `${days.length} mornings of recovery score, ${scored} with a reading, coloured by Whoop's canonical bands: red at 33 and below, green from 67.`;
}

export function ScorePlot({ days, height }: { days: RecoveryDayPoint[]; height: number }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = days.length;

  // Both halves of the shared mapping, imported rather than restated: `xAt`
  // puts a column's centre under the HRV chart's mark for the same morning
  // rather than under the centre of its own slot, and `columnWidth` gives it
  // the same width the resting-HR bar below it takes.
  const colW = columnWidth(n, width);

  return (
    // The height is reserved on the WRAPPER, so the box occupies its final space
    // before the first measurement lands and hydration does not shift the deck's
    // three rows under the reader.
    <div ref={ref} style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          role="img"
          aria-label={plotLabel(days)}
        >
          {/* Drawn first, so a column paints over its own zone rule rather than
              being cut by it. Full width — the zones are a property of the
              scale, not of the plotted stretch. */}
          {ZONE_LINES.map((score) => (
            <line
              key={score}
              x1={0}
              x2={width}
              y1={scoreY(score, height)}
              y2={scoreY(score, height)}
              stroke="var(--border-strong)"
              strokeDasharray="2 3"
              strokeWidth={1}
            />
          ))}

          {days.map((d, i) => {
            // The absence, rendered honestly: no element at all.
            if (d.recoveryScore === null) return null;
            const top = scoreY(d.recoveryScore, height);
            return (
              <rect
                key={d.date}
                x={xAt(i, n, width) - colW / 2}
                // The floor is a pixel of HEIGHT and a pixel of BOX: a score of
                // 0 puts `top` on the foot of the plot, and a 1px column drawn
                // from there falls outside the viewBox and is clipped away
                // entirely — the one morning the floor exists for rendering as
                // nothing at all, which is the reading reserved for an absence.
                y={Math.min(top, height - 1)}
                width={colW}
                // The 1px floor is for a genuine near-zero morning, which still
                // deserves a mark. It cannot be confused with a missing one,
                // because a missing one is not drawn.
                height={Math.max(1, height - top)}
                fill={recoveryBandColor(recoveryBand(d.recoveryScore))}
                opacity={0.85}
              />
            );
          })}

          {/* Labelled at the right edge, where the columns end and the eye
              leaves: 9px tabular numerals so 33 and 67 sit in the same two
              character cells. */}
          {ZONE_LINES.map((score) => (
            <text
              key={score}
              x={width - 2}
              y={scoreY(score, height) - 3}
              textAnchor="end"
              className="fill-[var(--faint)] font-mono text-[9px] tabular-nums"
            >
              {score}
            </text>
          ))}
        </svg>
      )}
    </div>
  );
}
