/**
 * IDIOM: linear-minimal-gradient-strip (draws on Whoop's single-accent-on-
 * charcoal effort bands).
 *
 * Stays a COMPACT strip, but becomes readable through colour, not gridlines: a
 * single horizontal pace band where accent intensity along its length encodes
 * relative effort (brighter = faster), with just a few anchor labels (start
 * pace, fastest, finish pace) and a slim distance baseline. Minimal type,
 * maximal restraint, the tightest vertical footprint of the five — the bet that
 * the demoted strip is the right call and only needs legibility, not promotion.
 *
 * In-system: one accent (#9aa6d6) at graded opacity on charcoal — exactly the
 * design-system's single-accent discipline. Manrope numerals. Diverges on FORM
 * (a colour-encoded band, no line) + the tightest, label-light rhythm.
 */

import type { Fixture, PaceStripPoint } from "./fixtures";
import { fmtPace, plottable } from "./fixtures";

export function VariantLinearMinimalGradientStrip({
  fixture,
  compact = false,
}: {
  fixture: Fixture;
  compact?: boolean;
}) {
  const all = plottable(fixture.points);

  const card =
    "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4";

  if (all.length < 2) {
    return (
      <div className={card}>
        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">
          Pace · brighter is faster
        </div>
        <div className="flex h-8 items-center justify-center rounded-[6px] bg-[var(--surface-2)] text-[11px] text-[var(--muted)]">
          No pace data
        </div>
      </div>
    );
  }

  const w = 1000; // viewBox units; strip scales to container width
  const stripH = compact ? 22 : 34;
  const paces = all.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces); // fastest
  const hi = Math.max(...paces); // slowest
  const span = hi - lo || 1;
  const dists = fixture.points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;
  const px = (d: number) => ((d - minX) / spanX) * w;
  // Faster (lo) → brightest; slowest → dim. 0.18..1.0 accent opacity.
  const intensity = (pace: number) => 0.18 + ((hi - pace) / span) * 0.82;

  // Split into contiguous runs and dropout windows.
  const runs: { pts: PaceStripPoint[] }[] = [];
  const gaps: [number, number][] = [];
  let cur: PaceStripPoint[] = [];
  let gapStart: number | null = null;
  fixture.points.forEach((p, i) => {
    if (p.paceSecPerUnit == null) {
      if (cur.length) {
        runs.push({ pts: cur });
        cur = [];
      }
      if (gapStart == null) gapStart = fixture.points[i - 1]?.distanceUnit ?? p.distanceUnit;
    } else {
      if (gapStart != null) {
        gaps.push([gapStart, p.distanceUnit]);
        gapStart = null;
      }
      cur.push(p);
    }
  });
  if (cur.length) runs.push({ pts: cur });

  const fastest = all.reduce((a, b) => (b.paceSecPerUnit < a.paceSecPerUnit ? b : a));
  const start = all[0];
  const finish = all[all.length - 1];

  return (
    <div className={card}>
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-[var(--faint)]">
        <span>Pace · brighter is faster · /{fixture.unit}</span>
        {fixture.hasDropout && <span>dropout bridged</span>}
      </div>

      <svg viewBox={`0 0 ${w} ${stripH}`} className="w-full" preserveAspectRatio="none" role="img">
        <defs>
          {runs.map((run, ri) => {
            const x0 = px(run.pts[0].distanceUnit);
            const x1 = px(run.pts[run.pts.length - 1].distanceUnit);
            const len = x1 - x0 || 1;
            return (
              <linearGradient
                key={ri}
                id={`strip-${compact ? "c" : "h"}-${ri}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                {run.pts.map((p, i) => (
                  <stop
                    key={i}
                    offset={`${(((px(p.distanceUnit) - x0) / len) * 100).toFixed(2)}%`}
                    stopColor="var(--accent)"
                    stopOpacity={intensity(p.paceSecPerUnit!).toFixed(3)}
                  />
                ))}
              </linearGradient>
            );
          })}
        </defs>

        {/* charcoal track */}
        <rect x={0} y={0} width={w} height={stripH} className="fill-[var(--surface-2)]" rx={4} />

        {/* effort segments */}
        {runs.map((run, ri) => {
          const x0 = px(run.pts[0].distanceUnit);
          const x1 = px(run.pts[run.pts.length - 1].distanceUnit);
          return (
            <rect
              key={ri}
              x={x0}
              y={0}
              width={Math.max(x1 - x0, 2)}
              height={stripH}
              fill={`url(#strip-${compact ? "c" : "h"}-${ri})`}
              rx={4}
            />
          );
        })}

        {/* dropout windows — charcoal hatch, reads as missing */}
        {gaps.map(([a, b], i) => (
          <rect
            key={i}
            x={px(a)}
            y={0}
            width={Math.max(px(b) - px(a), 4)}
            height={stripH}
            fill="var(--background)"
            opacity={0.85}
          />
        ))}
      </svg>

      {/* slim distance baseline */}
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-[var(--faint)]">
        <span>{minX.toFixed(0)}</span>
        <span>{((minX + maxX) / 2).toFixed(1)}</span>
        <span>
          {maxX.toFixed(1)} {fixture.unit}
        </span>
      </div>

      {/* anchor labels */}
      {!compact && (
        <div className="mt-2 flex justify-between text-[12px] tabular-nums">
          <span className="text-[var(--muted)]">
            start <span className="text-[var(--foreground)]">{fmtPace(start.paceSecPerUnit)}</span>
          </span>
          <span className="font-semibold text-[var(--accent)]">
            fastest {fmtPace(fastest.paceSecPerUnit)}
          </span>
          <span className="text-[var(--muted)]">
            finish{" "}
            <span className="text-[var(--foreground)]">{fmtPace(finish.paceSecPerUnit)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
