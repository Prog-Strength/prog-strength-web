/**
 * IDIOM: warm-organic-rolling-band (draws on the calm end of Strava + Apple
 * Fitness).
 *
 * Smooths the jaggedness instead of fighting it: a rolling-average pace curve as
 * the hero line, with the raw winsorized samples behind it as a faint shaded
 * envelope/band showing variability. Soft, rounded curve; a warmer, lower-
 * contrast palette; relaxed spacing; a few gentle labels at start / mid / finish
 * rather than a full axis. The dropout reads as a break in BOTH the band and the
 * curve. The most direct answer to "the noise makes it unreadable" — it
 * separates signal from jitter visually.
 *
 * In-system: uses the design-system's RUN discipline hue (the existing
 * activity-owns-colour token the live PaceStrip already strokes with) rather
 * than the cool periwinkle accent, for the warmer, calmer reading — no NEW hue
 * is introduced. Manrope, soft surfaces. Diverges on FORM (signal+envelope) and
 * a relaxed, label-light rhythm.
 */

import type { Fixture, PaceStripPoint } from "./fixtures";
import { fmtPace, plottable } from "./fixtures";

type Cell = {
  d: number;
  avg: number; // rolling mean (the signal)
  lo: number; // rolling min (band top — faster)
  hi: number; // rolling max (band bottom — slower)
} | null; // null = dropout column

// Rolling window over the series; nulls become null cells (band/curve break).
function roll(points: PaceStripPoint[], win = 2): Cell[] {
  return points.map((p, i) => {
    if (p.paceSecPerUnit == null) return null;
    const lo = Math.max(0, i - win);
    const hi = Math.min(points.length - 1, i + win);
    const vals: number[] = [];
    for (let j = lo; j <= hi; j++) {
      const v = points[j].paceSecPerUnit;
      if (v != null) vals.push(v);
    }
    return {
      d: p.distanceUnit,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      lo: Math.min(...vals),
      hi: Math.max(...vals),
    };
  });
}

// Catmull-Rom → cubic bezier for a soft curve through the given points.
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} `;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} `;
  }
  return d.trim();
}

export function VariantWarmOrganicRollingBand({
  fixture,
  compact = false,
}: {
  fixture: Fixture;
  compact?: boolean;
}) {
  const all = plottable(fixture.points);

  const card =
    "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5";

  if (all.length < 2) {
    return (
      <div
        className={`${card} flex flex-col items-center justify-center`}
        style={{ minHeight: compact ? 120 : 200 }}
      >
        <p className="text-[15px] text-[var(--muted)]">Not enough to smooth</p>
        <p className="mt-1 text-[12px] text-[var(--faint)]">No pace data for this run.</p>
      </div>
    );
  }

  const w = compact ? 360 : 860;
  const h = compact ? 150 : 240;
  const m = compact
    ? { top: 16, right: 16, bottom: 18, left: 16 }
    : { top: 28, right: 28, bottom: 28, left: 28 };

  const cells = roll(fixture.points);
  const paces = all.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces);
  const hi = Math.max(...paces);
  const dists = fixture.points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;
  const pad = (hi - lo || 30) * 0.25;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const px = (d: number) => m.left + ((d - minX) / spanX) * (w - m.left - m.right);
  const py = (p: number) => m.top + ((p - yLo) / (yHi - yLo)) * (h - m.top - m.bottom);

  // Split cells into contiguous runs (break at dropout) for band + curve.
  const runs: NonNullable<Cell>[][] = [];
  let cur: NonNullable<Cell>[] = [];
  for (const c of cells) {
    if (c == null) {
      if (cur.length) runs.push(cur);
      cur = [];
    } else cur.push(c);
  }
  if (cur.length) runs.push(cur);

  const fastest = all.reduce((a, b) => (b.paceSecPerUnit < a.paceSecPerUnit ? b : a));
  const start = all[0];
  const finish = all[all.length - 1];

  return (
    <div className={card}>
      {!compact && (
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-[19px] font-semibold tracking-[-0.01em] text-[var(--discipline-run-fg)]">
            Rolling pace
          </h3>
          <span className="text-[12px] text-[var(--muted)]">
            smoothed signal · raw band {fixture.hasDropout && "· dropout bridged"}
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        {runs.map((run, ri) => {
          const top = run.map((c) => ({ x: px(c.d), y: py(c.lo) }));
          const bottom = run.map((c) => ({ x: px(c.d), y: py(c.hi) }));
          const center = run.map((c) => ({ x: px(c.d), y: py(c.avg) }));
          // Band polygon: top curve forward, bottom curve back.
          const bandTop = smooth(top);
          const bandBackPts = [...bottom].reverse();
          const bandBack = smooth(bandBackPts).replace(/^M[^C]*/, "L");
          const band = bandTop ? `${bandTop} ${bandBack} Z` : "";
          return (
            <g key={ri}>
              {band && (
                <path d={band} fill="var(--discipline-run-dot)" opacity={0.16} stroke="none" />
              )}
              <path
                d={smooth(center)}
                fill="none"
                stroke="var(--discipline-run-fg)"
                strokeWidth={compact ? 2.4 : 3.4}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          );
        })}

        {/* gentle anchor labels: start / fastest / finish */}
        {!compact && (
          <g className="tabular-nums">
            <AnchorDot
              x={px(start.distanceUnit)}
              y={py(start.paceSecPerUnit)}
              label={`start ${fmtPace(start.paceSecPerUnit)}`}
              align="start"
            />
            <AnchorDot
              x={px(fastest.distanceUnit)}
              y={py(fastest.paceSecPerUnit)}
              label={`fastest ${fmtPace(fastest.paceSecPerUnit)}`}
              align="middle"
              emphasis
            />
            <AnchorDot
              x={px(finish.distanceUnit)}
              y={py(finish.paceSecPerUnit)}
              label={`finish ${fmtPace(finish.paceSecPerUnit)}`}
              align="end"
            />
          </g>
        )}
      </svg>
    </div>
  );
}

function AnchorDot({
  x,
  y,
  label,
  align,
  emphasis = false,
}: {
  x: number;
  y: number;
  label: string;
  align: "start" | "middle" | "end";
  emphasis?: boolean;
}) {
  const dx = align === "start" ? 8 : align === "end" ? -8 : 0;
  return (
    <g>
      <circle cx={x} cy={y} r={emphasis ? 5 : 3.5} fill="var(--discipline-run-fg)" />
      <text
        x={x + dx}
        y={y - 12}
        textAnchor={align}
        fontSize={emphasis ? 13 : 11}
        fontWeight={emphasis ? 600 : 400}
        className={emphasis ? "fill-[var(--foreground)]" : "fill-[var(--muted)]"}
      >
        {label}
      </text>
    </g>
  );
}
