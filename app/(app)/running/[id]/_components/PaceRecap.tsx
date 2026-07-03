/**
 * Hero pace-recap area chart beneath the splits ledger. Pure and prop-driven
 * over the client-mapped chart points (`buildPaceStrip`) plus the SERVER's
 * `strip_summary` block, which owns the header numbers (fastest/slowest) and
 * the dropout count; the plotted extremes are only a fallback when the
 * summary is absent. Chart geometry (domains, ticks, paths) stays client-side
 * by design. Two load-bearing conventions, both visual:
 *
 *  1. FASTER IS HIGHER. The y-axis is inverted (min pace → small y → top), so a
 *     rising curve always reads as speeding up, never as slowing down. The axis
 *     labels and the "Faster is higher" pill make the inversion explicit.
 *  2. A DROPOUT IS NEVER BRIDGED. Walking `points`, every `null` flushes the
 *     current line/area segment and the next sample starts a fresh `M`, so the
 *     gap stays a gap (no diagonal drawn across missing GPS). Each `null` window
 *     also gets a muted band behind it.
 *
 * Pace labels go through `formatPaceClock` (bare seconds → "m:ss"), NOT the
 * unit-context formatters, which convert sec/km → unit and would double-convert
 * the already-per-unit `paceSecPerUnit`. `unit` is only an axis-label suffix.
 *
 * Tokens only (design-system v0.4): accent fill/stroke at low opacity, surface
 * card with hairline border, faint/muted axis + caption type.
 */

import type { RunningStripSummary } from "@/lib/api";
import type { PaceStripPoint } from "@/lib/running-splits";
import { formatPaceClock } from "@/lib/pace-format";

const W = 860;
const H = 300;
const M = { top: 28, right: 24, bottom: 40, left: 56 };

type PlottablePoint = { distanceUnit: number; paceSecPerUnit: number };

/**
 * Choose a "nice" tick step ({1,2,5}×10ⁿ) so the x-axis caps at ~6–8 labels
 * instead of one-per-integer (which collides on long/ultra runs). For short
 * runs the step can be fractional (e.g. 0.2 km); for long runs it grows (5, 10…).
 */
function niceStep(span: number, maxTicks = 7): number {
  const rough = span / maxTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  for (const mult of [1, 2, 5, 10]) {
    if (pow * mult >= rough) return pow * mult;
  }
  return pow * 10;
}

export function PaceRecap({
  points,
  stripSummary,
  unit,
}: {
  points: PaceStripPoint[];
  stripSummary: RunningStripSummary | null;
  unit: "km" | "mi";
}) {
  const hasDropout = (stripSummary?.dropout_count ?? 0) > 0;
  const plottable = points.filter((p): p is PlottablePoint => p.paceSecPerUnit != null);

  if (plottable.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 text-center"
        style={{ minHeight: 220 }}
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

  // lo/hi stay client-side for the y-domain math (chart geometry); the
  // HEADER numbers come from the server summary, falling back to the plotted
  // extremes only when the summary is absent.
  const paces = plottable.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces); // fastest (plotted)
  const hi = Math.max(...paces); // slowest (plotted)
  const headerLo = stripSummary?.fastest_sec_per_unit ?? lo;
  const headerHi = stripSummary?.slowest_sec_per_unit ?? hi;

  const dists = points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;
  // Pad the pace domain so the curve never kisses the frame edges.
  const pad = (hi - lo || 30) * 0.18;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const px = (d: number) => M.left + ((d - minX) / spanX) * (W - M.left - M.right);
  // Inverted: fastest (lo) sits HIGH (small y).
  const py = (p: number) => M.top + ((p - yLo) / (yHi - yLo)) * (H - M.top - M.bottom);
  const baseY = H - M.bottom;

  // Build line + area segments, breaking (flushing) at every dropout.
  const segments: { line: string; area: string }[] = [];
  let line = "";
  let area = "";
  let penDown = false;
  let segStartX = 0;
  let lastX = 0;
  const flush = () => {
    if (penDown) {
      segments.push({
        line: line.trim(),
        area: `${area}L${lastX.toFixed(1)},${baseY} L${segStartX.toFixed(1)},${baseY} Z`,
      });
    }
    line = "";
    area = "";
    penDown = false;
  };
  for (const p of points) {
    if (p.paceSecPerUnit == null) {
      flush();
      continue;
    }
    const x = px(p.distanceUnit);
    const y = py(p.paceSecPerUnit);
    if (!penDown) {
      line = `M${x.toFixed(1)},${y.toFixed(1)} `;
      area = `M${x.toFixed(1)},${y.toFixed(1)} `;
      segStartX = x;
      penDown = true;
    } else {
      line += `L${x.toFixed(1)},${y.toFixed(1)} `;
      area += `L${x.toFixed(1)},${y.toFixed(1)} `;
    }
    lastX = x;
  }
  flush();

  // y-axis ticks: 4 evenly spaced pace values across the padded domain.
  const yTicks = [0, 1, 2, 3].map((i) => yLo + ((yHi - yLo) * i) / 3);

  // x-axis ticks: a "nice" integer step, capped at ~6–8 labels.
  const step = niceStep(spanX);
  const xTicks: number[] = [];
  for (let d = Math.ceil(minX / step) * step; d <= maxX + 1e-9; d += step) {
    xTicks.push(Number(d.toFixed(6)));
  }

  // Singular annotation: the single global-min ("fastest") sample.
  const fastest = plottable.reduce((a, b) => (b.paceSecPerUnit < a.paceSecPerUnit ? b : a));

  // Each contiguous run of nulls is one dropout window; band it at the x of the
  // last good sample before the gap (its leading edge).
  const gaps: { x: number }[] = [];
  let inGap = false;
  let prevX: number | null = null;
  for (const p of points) {
    if (p.paceSecPerUnit == null) {
      if (!inGap) {
        inGap = true;
        gaps.push({ x: prevX != null ? px(prevX) : M.left });
      }
    } else {
      inGap = false;
      prevX = p.distanceUnit;
    }
  }

  // Band one window per gap as drawn, but the caption states the SERVER's
  // sample count (falling back to the drawn windows when the summary is absent).
  const dropoutCount = stripSummary?.dropout_count ?? gaps.length;
  const dropoutPhrase = dropoutCount === 1 ? "one GPS dropout" : `${dropoutCount} GPS dropouts`;

  const ariaLabel =
    `Pace recap: fastest ${formatPaceClock(headerLo)}, slowest ${formatPaceClock(headerHi)} per ${unit}` +
    (hasDropout ? `; ${dropoutPhrase}.` : ".");

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
            Pace recap
          </h3>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            Fastest {formatPaceClock(headerLo)} · slowest {formatPaceClock(headerHi)} /{unit}
            {hasDropout && ` · ${dropoutPhrase} bridged`}
          </p>
        </div>
        <span className="shrink-0 rounded-[var(--radius-pill)] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent)]">
          Faster is higher
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
        <title>{ariaLabel}</title>
        <defs>
          <linearGradient id="pace-recap-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.30" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* horizontal guides + m:ss labels at each y tick */}
        {yTicks.map((t, i) => (
          <g key={i} aria-hidden="true">
            <line
              x1={M.left}
              x2={W - M.right}
              y1={py(t)}
              y2={py(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={M.left - 8}
              y={py(t) + 4}
              textAnchor="end"
              className="fill-[var(--faint)]"
              fontSize={12}
            >
              {formatPaceClock(t)}
            </text>
          </g>
        ))}

        {/* x ticks (distance), unit suffix on the last */}
        {xTicks.map((d, i) => (
          <text
            key={d}
            x={px(d)}
            y={H - M.bottom + 20}
            textAnchor="middle"
            className="fill-[var(--faint)]"
            fontSize={12}
            aria-hidden="true"
          >
            {d}
            {i === xTicks.length - 1 ? ` ${unit}` : ""}
          </text>
        ))}

        {/* muted dropout band behind each gap window */}
        {gaps.map((g, i) => (
          <rect
            key={i}
            x={g.x - 18}
            y={M.top}
            width={36}
            height={H - M.top - M.bottom}
            className="fill-[var(--surface-3)]"
            opacity={0.6}
            aria-hidden="true"
          />
        ))}

        {segments.map((s, i) => (
          <g key={i} aria-hidden="true">
            <path d={s.area} fill="url(#pace-recap-grad)" stroke="none" />
            <path
              d={s.line}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2.4}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        ))}

        {/* singular "fastest" annotation */}
        <g aria-hidden="true">
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
            Fastest {formatPaceClock(headerLo)}
          </text>
        </g>

        {/* one dropout caption, near the first gap */}
        {gaps.length > 0 && (
          <text
            x={gaps[0].x}
            y={M.top + 14}
            textAnchor="middle"
            className="fill-[var(--muted)]"
            fontSize={11}
            aria-hidden="true"
          >
            dropout
          </text>
        )}
      </svg>
    </div>
  );
}
