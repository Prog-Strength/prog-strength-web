/**
 * Shared editorial recap area chart — the extracted SVG language behind the
 * three sibling run-detail recaps (Pace, Heart rate, Elevation). Pure and
 * presentational: it owns ALL chart geometry (nice x-ticks, padded y-domain,
 * the gap-flushing segment/area path builder that NEVER bridges a `null`
 * window, the area-under-curve + line render, axis guides + tick labels, and a
 * single extreme-dot annotation). Callers normalize their metric into
 * `{ distanceUnit, value }` and configure the series color, y-inversion, value
 * formatter, unit suffix, the annotated extreme, and (pace only) the dropout
 * bands. Tokens only — the passed `color` drives stroke + gradient + extreme
 * dot; axes and captions stay faint/muted.
 *
 * Two load-bearing conventions carried over from PaceRecap, both visual:
 *  1. Y-MAP DIRECTION is caller-chosen. `invertY: true` (pace) puts the SMALLER
 *     value at the top ("faster is higher"); `invertY: false` (HR/elev) puts the
 *     LARGER value at the top.
 *  2. A GAP IS NEVER BRIDGED. Every `null` flushes the current line/area and the
 *     next sample starts a fresh `M`, so missing samples stay gaps.
 */

import { useRef } from "react";

const W = 860;
const H = 300;
const M = { top: 28, right: 24, bottom: 40, left: 56 };

export type RecapPoint = {
  distanceUnit: number;
  value: number | null;
};

type PlottablePoint = { distanceUnit: number; value: number };

/** Whether a pointer can hover — i.e. whether a bare move should scrub. */
function isHoverPointer(pointerType: string): boolean {
  return pointerType !== "touch" && pointerType !== "pen";
}

/**
 * Choose a "nice" tick step ({1,2,5}×10ⁿ) so the x-axis caps at ~6–8 labels
 * instead of one-per-integer (which collides on long/ultra runs). For short
 * runs the step can be fractional (e.g. 0.2 km); for long runs it grows (5, 10…).
 */
export function niceStep(span: number, maxTicks = 7): number {
  const rough = span / maxTicks;
  const pow = Math.pow(10, Math.floor(Math.log10(rough || 1)));
  for (const mult of [1, 2, 5, 10]) {
    if (pow * mult >= rough) return pow * mult;
  }
  return pow * 10;
}

export function RecapChart({
  points,
  color,
  gradientId,
  invertY,
  formatValue,
  unit,
  extreme,
  showGapBands = false,
  ariaLabel,
  scrubIndex = null,
  onScrub,
}: {
  points: RecapPoint[];
  color: string;
  gradientId: string;
  invertY: boolean;
  formatValue: (v: number) => string;
  unit: "km" | "mi";
  extreme?: { kind: "min" | "max"; label: (plottedValue: number) => string };
  showGapBands?: boolean;
  ariaLabel: string;
  /**
   * Index INTO `points` of the cursor, or null for none. Callers keep this in
   * their own state so a sibling surface (the route map) can share it.
   */
  scrubIndex?: number | null;
  /**
   * Opt in to scrubbing. When omitted the chart is byte-for-byte what it was
   * before — no overlay, no pointer handlers, no crosshair — which is why the
   * pace and heart-rate recaps are untouched by this feature.
   */
  onScrub?: (index: number | null) => void;
}) {
  // Hooks before the early return: `plottable.length < 2` bails out, and a
  // conditionally-called hook is a render-order bug waiting to happen.
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const plottable = points.filter((p): p is PlottablePoint => p.value != null);
  if (plottable.length < 2) return null;

  // lo/hi drive the y-domain math (chart geometry only).
  const values = plottable.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);

  const dists = points.map((p) => p.distanceUnit);
  const minX = Math.min(...dists);
  const maxX = Math.max(...dists);
  const spanX = maxX - minX || 1;
  // Pad the value domain so the curve never kisses the frame edges.
  const pad = (hi - lo || 30) * 0.18;
  const yLo = lo - pad;
  const yHi = hi + pad;

  const px = (d: number) => M.left + ((d - minX) / spanX) * (W - M.left - M.right);
  // invertY: smaller value sits HIGH (small y). Uninverted: larger value sits HIGH.
  const py = (v: number) =>
    invertY
      ? M.top + ((v - yLo) / (yHi - yLo)) * (H - M.top - M.bottom)
      : M.top + ((yHi - v) / (yHi - yLo)) * (H - M.top - M.bottom);
  const baseY = H - M.bottom;

  // Build line + area segments, breaking (flushing) at every gap.
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
    if (p.value == null) {
      flush();
      continue;
    }
    const x = px(p.distanceUnit);
    const y = py(p.value);
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

  // y-axis ticks: 4 evenly spaced values across the padded domain.
  const yTicks = [0, 1, 2, 3].map((i) => yLo + ((yHi - yLo) * i) / 3);

  // x-axis ticks: a "nice" integer step, capped at ~6–8 labels.
  const step = niceStep(spanX);
  const xTicks: number[] = [];
  for (let d = Math.ceil(minX / step) * step; d <= maxX + 1e-9; d += step) {
    xTicks.push(Number(d.toFixed(6)));
  }

  // Singular annotation: the single global-min or global-max sample.
  const extremePoint = extreme
    ? plottable.reduce((a, b) =>
        extreme.kind === "min" ? (b.value < a.value ? b : a) : b.value > a.value ? b : a,
      )
    : null;

  // Each contiguous run of nulls is one gap window; band it at the x of the
  // last good sample before the gap (its leading edge).
  const gaps: { x: number }[] = [];
  if (showGapBands) {
    let inGap = false;
    let prevX: number | null = null;
    for (const p of points) {
      if (p.value == null) {
        if (!inGap) {
          inGap = true;
          gaps.push({ x: prevX != null ? px(prevX) : M.left });
        }
      } else {
        inGap = false;
        prevX = p.distanceUnit;
      }
    }
  }

  // --- scrubbing ---------------------------------------------------------
  // Indices INTO `points` that can carry a cursor. The cursor is expressed in
  // `points` space, not `plottable` space, because that index is shared with
  // the route map and only the unfiltered array is index-aligned with the
  // trackpoints the map draws from.
  const plottableIndices: number[] = [];
  points.forEach((p, i) => {
    if (p.value != null) plottableIndices.push(i);
  });

  const indexFromClientX = (clientX: number): number | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    // The SVG scales to its container, so map client px back through the
    // viewBox before inverting the x scale.
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const d = minX + ((svgX - M.left) / (W - M.left - M.right)) * spanX;

    let best: number | null = null;
    let bestDelta = Infinity;
    for (const i of plottableIndices) {
      const delta = Math.abs(points[i].distanceUnit - d);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    return best;
  };

  const scrubPoint =
    scrubIndex != null && scrubIndex >= 0 && scrubIndex < points.length ? points[scrubIndex] : null;
  const scrubValue = scrubPoint?.value ?? null;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={ariaLabel}
    >
      <title>{ariaLabel}</title>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* horizontal guides + value labels at each y tick */}
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
            {formatValue(t)}
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

      {/* muted band behind each gap window (pace only) */}
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
          <path d={s.area} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={s.line}
            fill="none"
            stroke={color}
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      ))}

      {/* singular extreme annotation */}
      {extremePoint && extreme && (
        <g aria-hidden="true">
          <circle
            cx={px(extremePoint.distanceUnit)}
            cy={py(extremePoint.value)}
            r={4}
            fill={color}
          />
          <text
            x={px(extremePoint.distanceUnit)}
            y={py(extremePoint.value) - 12}
            textAnchor="middle"
            className="fill-[var(--foreground)]"
            fontSize={13}
            fontWeight={600}
          >
            {extreme.label(extremePoint.value)}
          </text>
        </g>
      )}

      {/* scrub crosshair — drawn above the series, below nothing */}
      {onScrub && scrubPoint && scrubValue != null && (
        <g aria-hidden="true">
          <line
            x1={px(scrubPoint.distanceUnit)}
            x2={px(scrubPoint.distanceUnit)}
            y1={M.top}
            y2={baseY}
            stroke={color}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          />
          <circle
            cx={px(scrubPoint.distanceUnit)}
            cy={py(scrubValue)}
            r={5}
            fill={color}
            stroke="var(--background)"
            strokeWidth={2}
          />
        </g>
      )}

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

      {/* Pointer surface. MUST be the last child: SVG hit-testing favours
          later siblings, so anything painted after this would swallow the
          events. `touch-action: pan-y` is what lets a vertical swipe scroll
          the page normally while a horizontal drag scrubs — cheaper and more
          reliable than preventDefault heuristics. */}
      {onScrub && (
        <rect
          x={M.left}
          y={M.top}
          width={W - M.left - M.right}
          height={baseY - M.top}
          fill="transparent"
          style={{ touchAction: "pan-y", cursor: "crosshair" }}
          data-testid="recap-scrub-surface"
          onPointerDown={(e) => {
            draggingRef.current = true;
            // Capture is a nicety — it keeps a drag alive past the chart edge.
            // Not all environments implement it, and it throws on an unknown
            // pointer id, which must never cost us the scrub itself.
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              /* capture unavailable; dragging still tracked by the ref */
            }
            onScrub(indexFromClientX(e.clientX));
          }}
          onPointerMove={(e) => {
            // Hover scrubs on a hover-capable device; touch and pen require an
            // active drag, since there is no such thing as hovering a finger.
            // Tested for NOT-touch rather than for "mouse": pointerType is ""
            // on some environments, and defaulting those to hover is right —
            // a real touch always identifies itself.
            if (isHoverPointer(e.pointerType) || draggingRef.current) {
              onScrub(indexFromClientX(e.clientX));
            }
          }}
          onPointerUp={(e) => {
            draggingRef.current = false;
            try {
              e.currentTarget.releasePointerCapture?.(e.pointerId);
            } catch {
              /* nothing was captured */
            }
            // A touch drag ends with the finger lifted and nothing hovering,
            // so clear rather than stranding a cursor the user can't move.
            if (!isHoverPointer(e.pointerType)) onScrub(null);
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
            onScrub(null);
          }}
          onPointerLeave={() => {
            if (!draggingRef.current) onScrub(null);
          }}
        />
      )}
    </svg>
  );
}
