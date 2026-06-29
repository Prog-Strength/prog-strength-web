/**
 * IDIOM: editorial-area-recap (draws on Strava's run-recap area chart).
 *
 * Promotes the trace to a HERO area chart: pace as a filled region under the
 * curve, a real y-axis labelled in mm:ss/unit, a distance x-axis, and the run's
 * story annotated inline (fastest split, the closing surge, the dropout). Large
 * editorial type, generous margins, a single accent fill at low opacity over
 * charcoal. The axes + annotations are what stop the line from floating.
 *
 * In-system: accent (#9aa6d6) fill/stroke, --foreground/--muted/--faint type,
 * Manrope. Diverges on PROMINENCE (tallest, hero) + a labelled axis frame.
 */

import type { Fixture } from "./fixtures";
import { fmtPace, plottable } from "./fixtures";

const W = 860;
const H = 300;
const M = { top: 28, right: 24, bottom: 40, left: 56 };

export function VariantEditorialAreaRecap({
  fixture,
  compact = false,
}: {
  fixture: Fixture;
  compact?: boolean;
}) {
  const pts = plottable(fixture.points);

  if (pts.length < 2) {
    return <EmptyEditorial unit={fixture.unit} compact={compact} />;
  }

  const w = compact ? 360 : W;
  const h = compact ? 150 : H;
  const m = compact ? { top: 14, right: 12, bottom: 24, left: 44 } : M;

  const paces = pts.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces); // fastest
  const hi = Math.max(...paces); // slowest
  const dists = fixture.points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;
  // Pad the pace domain so the line never kisses the frame edges.
  const pad = (hi - lo || 30) * 0.18;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const px = (d: number) => m.left + ((d - minX) / spanX) * (w - m.left - m.right);
  // Inverted: fastest (lo) sits HIGH (small y).
  const py = (p: number) => m.top + ((p - yLo) / (yHi - yLo)) * (h - m.top - m.bottom);
  const baseY = h - m.bottom;

  // Build line + area segments, breaking at every dropout.
  const segments: { d: string; area: string }[] = [];
  let line = "";
  let area = "";
  let penDown = false;
  let segStartX = 0;
  let lastX = 0;
  const flush = () => {
    if (penDown) {
      segments.push({
        d: line.trim(),
        area: `${area} L${lastX},${baseY} L${segStartX},${baseY} Z`,
      });
    }
    line = "";
    area = "";
    penDown = false;
  };
  for (const p of fixture.points) {
    if (p.paceSecPerUnit == null) {
      flush();
      continue;
    }
    const X = px(p.distanceUnit);
    const Y = py(p.paceSecPerUnit);
    if (!penDown) {
      line = `M${X.toFixed(1)},${Y.toFixed(1)} `;
      area = `M${X.toFixed(1)},${Y.toFixed(1)} `;
      segStartX = X;
      penDown = true;
    } else {
      line += `L${X.toFixed(1)},${Y.toFixed(1)} `;
      area += `L${X.toFixed(1)},${Y.toFixed(1)} `;
    }
    lastX = X;
  }
  flush();

  // y-axis ticks: 4 evenly spaced pace values.
  const yTicks = [0, 1, 2, 3].map((i) => yLo + ((yHi - yLo) * i) / 3);
  // x-axis ticks: integer distances.
  const xTicks: number[] = [];
  for (let d = Math.ceil(minX); d <= maxX; d++) xTicks.push(d);

  // Annotations: the fastest sample and the dropout window.
  const fastest = pts.reduce((a, b) => (b.paceSecPerUnit < a.paceSecPerUnit ? b : a));
  const gapStart = fixture.points.find((p) => p.paceSecPerUnit == null);
  const gid = `area-grad-${compact ? "c" : "h"}`;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
      {!compact && (
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h3 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
              Pace recap
            </h3>
            <p className="mt-2 text-[13px] text-[var(--muted)]">
              Fastest {fmtPace(lo)} · slowest {fmtPace(hi)} /{fixture.unit}
              {fixture.hasDropout && " · one GPS dropout bridged"}
            </p>
          </div>
          <span className="rounded-[var(--radius-pill)] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent)]">
            Faster is higher
          </span>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" role="img">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal guides at each y tick */}
        {yTicks.map((t, i) => (
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
              x={m.left - 8}
              y={py(t) + 4}
              textAnchor="end"
              className="fill-[var(--faint)]"
              fontSize={compact ? 9 : 12}
            >
              {fmtPace(t)}
            </text>
          </g>
        ))}

        {/* x ticks */}
        {xTicks.map((d) => (
          <text
            key={d}
            x={px(d)}
            y={h - m.bottom + (compact ? 14 : 20)}
            textAnchor="middle"
            className="fill-[var(--faint)]"
            fontSize={compact ? 9 : 12}
          >
            {d}
            {!compact && d === xTicks[xTicks.length - 1] ? ` ${fixture.unit}` : ""}
          </text>
        ))}

        {/* dropout band */}
        {gapStart && (
          <rect
            x={px(gapStart.distanceUnit) - 18}
            y={m.top}
            width={36}
            height={h - m.top - m.bottom}
            className="fill-[var(--surface-3)]"
            opacity={0.6}
          />
        )}

        {segments.map((s, i) => (
          <g key={i}>
            <path d={s.area} fill={`url(#${gid})`} stroke="none" />
            <path
              d={s.d}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={compact ? 1.8 : 2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* fastest annotation */}
        {!compact && (
          <g>
            <circle
              cx={px(fastest.distanceUnit)}
              cy={py(fastest.paceSecPerUnit)}
              r={4}
              fill="var(--accent)"
            />
            <text
              x={px(fastest.distanceUnit)}
              y={py(fastest.paceSecPerUnit) - 12}
              textAnchor="middle"
              className="fill-[var(--foreground)]"
              fontSize={13}
              fontWeight={600}
            >
              Fastest {fmtPace(fastest.paceSecPerUnit)}
            </text>
          </g>
        )}
        {!compact && gapStart && (
          <text
            x={px(gapStart.distanceUnit)}
            y={m.top + 14}
            textAnchor="middle"
            className="fill-[var(--muted)]"
            fontSize={11}
          >
            dropout
          </text>
        )}
      </svg>
    </div>
  );
}

function EmptyEditorial({ unit, compact }: { unit: string; compact: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 text-center"
      style={{ minHeight: compact ? 120 : 220 }}
    >
      <p className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--muted)]">
        No pace data
      </p>
      <p className="mt-2 text-[13px] text-[var(--faint)]">
        This run has fewer than two usable samples per {unit}.
      </p>
    </div>
  );
}
