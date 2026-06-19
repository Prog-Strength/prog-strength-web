/**
 * Demoted supporting strip beneath the splits ledger: a hand-rolled winsorized
 * pace sparkline. Pure and prop-driven over the derivation's `paceStrip`.
 * Faster pace sits HIGHER (the scale is inverted) so a rising line never reads
 * as slowing down. The path breaks at the dropout gap (null points start a fresh
 * `M`, so the line is not drawn across the missing sample). The user-facing
 * "dropout bridged" caption is the affordance that signals a winsorized/dropout
 * sample was handled — removed from the plotted line — and appears only when some
 * sample was affected. With fewer than two plottable points it shows a muted
 * placeholder.
 *
 * Tokens only (design-system v0.4): discipline-run dot for the stroke, faint
 * text for captions, surface card with hairline border.
 */

import type { PaceStripPoint } from "@/lib/running-splits";

const W = 720;
const H = 64;

export function PaceStrip({
  points,
  hasDropout,
}: {
  points: PaceStripPoint[];
  hasDropout: boolean;
}) {
  const plottable = points.filter(
    (p): p is { distanceUnit: number; paceSecPerUnit: number } => p.paceSecPerUnit != null,
  );

  const card =
    "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3";

  if (plottable.length < 2) {
    return (
      <div className={card}>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--faint)]">
          <span>Pace trace · faster ↑</span>
          {hasDropout && <span>dropout bridged</span>}
        </div>
        <p className="py-4 text-center text-xs text-[var(--muted)]">No pace data</p>
      </div>
    );
  }

  const paces = plottable.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces);
  const hi = Math.max(...paces);

  const dists = points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;

  const x = (distanceUnit: number) => ((distanceUnit - minX) / spanX) * W;
  // Invert: fastest (lo) → top (small y).
  const y = (pace: number) => ((pace - lo) / (hi - lo || 1)) * (H - 8) + 4;

  // Build the path, starting a fresh `M` after every gap (connectNulls=false).
  let d = "";
  let penDown = false;
  for (const p of points) {
    if (p.paceSecPerUnit == null) {
      penDown = false;
      continue;
    }
    const cmd = penDown ? "L" : "M";
    d += `${cmd}${x(p.distanceUnit).toFixed(1)},${y(p.paceSecPerUnit).toFixed(1)} `;
    penDown = true;
  }

  return (
    <div className={card}>
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--faint)]">
        <span>Pace trace · faster ↑</span>
        {hasDropout && <span>dropout bridged</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none">
        <path
          d={d.trim()}
          fill="none"
          stroke="var(--discipline-run-dot)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
