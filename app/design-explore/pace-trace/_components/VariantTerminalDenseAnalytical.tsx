/**
 * IDIOM: terminal-dense-analytical (draws on Runalyze's gridded pace traces).
 *
 * Keeps the line but turns it into a serious analytical instrument: full
 * background gridlines, horizontal pace-zone bands, distance ticks along x,
 * monospace tabular numerals on BOTH axes, a tight spacing rhythm, minimal
 * chrome. Small type, maximal data-ink — every point has a readable value, with
 * no annotation. This is the "training tool" reading: what pace, exactly, where.
 *
 * In-system: accent stroke, faint/muted mono numerals (Geist_Mono), surface
 * tones for the zone bands (NO heat ramp). Diverges on DENSITY + a full grid.
 */

import type { Fixture } from "./fixtures";
import { fmtPace, plottable } from "./fixtures";

export function VariantTerminalDenseAnalytical({
  fixture,
  compact = false,
}: {
  fixture: Fixture;
  compact?: boolean;
}) {
  const pts = plottable(fixture.points);

  const frame =
    "rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--background)] p-3 font-mono";

  if (pts.length < 2) {
    return (
      <div
        className={`${frame} flex items-center justify-center`}
        style={{ minHeight: compact ? 110 : 200 }}
      >
        <span className="text-[11px] uppercase tracking-[0.15em] text-[var(--faint)]">
          [ no pace data ]
        </span>
      </div>
    );
  }

  const w = compact ? 360 : 860;
  const h = compact ? 150 : 260;
  const m = compact
    ? { top: 8, right: 10, bottom: 20, left: 40 }
    : { top: 12, right: 16, bottom: 26, left: 52 };

  const paces = pts.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces);
  const hi = Math.max(...paces);
  const dists = fixture.points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;
  const pad = (hi - lo || 30) * 0.08;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const px = (d: number) => m.left + ((d - minX) / spanX) * (w - m.left - m.right);
  const py = (p: number) => m.top + ((p - yLo) / (yHi - yLo)) * (h - m.top - m.bottom);

  // 5 horizontal pace bands across the domain, alternating subtle surface tints
  // (intensity, not heat). Numerals on the left edge.
  const bands = 5;
  const bandEdges = Array.from({ length: bands + 1 }, (_, i) => yLo + ((yHi - yLo) * i) / bands);

  // Distance ticks — every integer, plus half ticks when sparse.
  const xTicks: number[] = [];
  const step = maxX - minX > 12 ? 2 : 1;
  for (let d = Math.ceil(minX); d <= maxX; d += step) xTicks.push(d);

  // Line path, breaking at dropouts.
  let d = "";
  let pen = false;
  for (const p of fixture.points) {
    if (p.paceSecPerUnit == null) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${px(p.distanceUnit).toFixed(1)},${py(p.paceSecPerUnit).toFixed(1)} `;
    pen = true;
  }

  // dropout x-windows (start..end of each null run)
  const gaps: [number, number][] = [];
  let gapStart: number | null = null;
  for (let i = 0; i < fixture.points.length; i++) {
    const p = fixture.points[i];
    if (p.paceSecPerUnit == null && gapStart == null) gapStart = p.distanceUnit;
    if (p.paceSecPerUnit != null && gapStart != null) {
      gaps.push([gapStart, fixture.points[i - 1].distanceUnit]);
      gapStart = null;
    }
  }
  if (gapStart != null) gaps.push([gapStart, maxX]);

  return (
    <div className={frame}>
      {!compact && (
        <div className="mb-2 flex items-center justify-between border-b border-[var(--border)] pb-2 text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          <span>PACE/{fixture.unit} · sec-inverted</span>
          <span className="tabular-nums text-[var(--faint)]">
            min {fmtPace(lo)} · max {fmtPace(hi)} · n={pts.length}
            {fixture.hasDropout && " · drop=1"}
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        {/* zone bands */}
        {Array.from({ length: bands }).map((_, i) => (
          <rect
            key={i}
            x={m.left}
            y={py(bandEdges[i + 1])}
            width={w - m.left - m.right}
            height={py(bandEdges[i]) - py(bandEdges[i + 1])}
            className={i % 2 === 0 ? "fill-[var(--surface)]" : "fill-[var(--surface-2)]"}
            opacity={0.7}
          />
        ))}
        {/* horizontal grid + pace numerals */}
        {bandEdges.map((t, i) => (
          <g key={i}>
            <line
              x1={m.left}
              x2={w - m.right}
              y1={py(t)}
              y2={py(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={m.left - 6}
              y={py(t) + 3}
              textAnchor="end"
              className="fill-[var(--faint)] tabular-nums"
              fontSize={compact ? 8 : 10}
            >
              {fmtPace(t)}
            </text>
          </g>
        ))}
        {/* vertical grid + distance ticks */}
        {xTicks.map((t) => (
          <g key={t}>
            <line
              x1={px(t)}
              x2={px(t)}
              y1={m.top}
              y2={h - m.bottom}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={px(t)}
              y={h - m.bottom + (compact ? 12 : 16)}
              textAnchor="middle"
              className="fill-[var(--faint)] tabular-nums"
              fontSize={compact ? 8 : 10}
            >
              {t}
            </text>
          </g>
        ))}
        {/* dropout windows hatched */}
        {gaps.map(([a, b], i) => (
          <rect
            key={i}
            x={px(a)}
            y={m.top}
            width={Math.max(px(b) - px(a), 6)}
            height={h - m.top - m.bottom}
            fill="var(--surface-3)"
            opacity={0.85}
            stroke="var(--border-strong)"
            strokeDasharray="2 2"
          />
        ))}
        {/* the trace */}
        <path
          d={d.trim()}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={compact ? 1.2 : 1.5}
          vectorEffect="non-scaling-stroke"
        />
        {/* sample dots — the data-ink */}
        {pts.map((p, i) => (
          <circle
            key={i}
            cx={px(p.distanceUnit)}
            cy={py(p.paceSecPerUnit)}
            r={compact ? 0.9 : 1.4}
            fill="var(--accent)"
          />
        ))}
      </svg>
    </div>
  );
}
