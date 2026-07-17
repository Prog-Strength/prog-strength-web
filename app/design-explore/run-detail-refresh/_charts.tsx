"use client";

/**
 * Shared, DISPOSABLE render primitives for the run-detail-refresh DX.
 *
 * These are deliberately low-level and mechanical: an SVG area-trace generator
 * (with the shipped page's two load-bearing conventions — FASTER IS HIGHER via
 * an inverted y-axis, and DROPOUTS ARE NEVER BRIDGED), a stylized route-map
 * mock (real MapLibre needs tiles + network; a hand-drawn Frisco-ish loop keeps
 * the comparison route backend-free), plus the two widgets the ticket says to
 * keep recognizable across every variant (splits ledger, ranked HR-zone bars).
 *
 * The DIVERGENCE between idioms lives in each variant's composition, type scale
 * and spacing — NOT here. Everything is tokens-only (design-system v0.4.2): the
 * near-black ramp, periwinkle --accent for chrome, --discipline-run-* for the
 * run hue, the --zone-1..5 scale for HR zones. No raw hex, no new tokens.
 */

import { useId } from "react";
import type { Split, TracePoint, Zone } from "./_fixtures";
import { fmtClock, fmtDuration, fmtElevDelta } from "./_fixtures";

// --- Area trace -----------------------------------------------------------

export type TraceKind = "pace" | "hr" | "elev";

type SeriesPoint = { x: number; y: number | null };

const SERIES_META: Record<
  TraceKind,
  { color: string; invert: boolean; unit: string; fmt: (v: number) => string }
> = {
  // Pace: run-discipline hue, inverted (faster == higher). m:ss labels.
  pace: { color: "var(--discipline-run-dot)", invert: true, unit: "/mi", fmt: fmtClock },
  // HR: warm end of the zone scale — reads as "hot" without aliasing danger.
  hr: { color: "var(--zone-5)", invert: false, unit: "bpm", fmt: (v) => `${Math.round(v)}` },
  // Elevation: muted teal from the run ramp — quiet, terrain not effort.
  elev: {
    color: "var(--discipline-run-fg)",
    invert: false,
    unit: "m",
    fmt: (v) => `${Math.round(v)}`,
  },
};

export function AreaTrace({
  points,
  kind,
  height = 150,
  showArea = true,
  grid = true,
  compact = false,
  crosshairX = null,
  markExtreme = false,
  xTickCount = 7,
  hideXAxis = false,
  color,
}: {
  points: SeriesPoint[];
  kind: TraceKind;
  height?: number;
  showArea?: boolean;
  grid?: boolean;
  compact?: boolean;
  crosshairX?: number | null;
  markExtreme?: boolean;
  xTickCount?: number;
  hideXAxis?: boolean;
  // Override the series hue while keeping the kind's axis math (invert, fmt).
  // Used by ledger-plus-voice to render every trace in the shipped Pace-recap
  // accent treatment — a color-logic choice, still tokens-only.
  color?: string;
}) {
  const base = SERIES_META[kind];
  const meta = color ? { ...base, color } : base;
  // Sanitize useId's colons so the id is safe inside SVG url(#…) references.
  const gradId = "g" + useId().replace(/:/g, "");
  const W = 820;
  const H = height;
  const M = compact
    ? { top: 12, right: 16, bottom: hideXAxis ? 6 : 22, left: 44 }
    : { top: 18, right: 20, bottom: hideXAxis ? 8 : 30, left: 52 };

  const withY = points.filter((p): p is { x: number; y: number } => p.y != null);
  if (withY.length < 2) return null;

  const ys = withY.map((p) => p.y);
  const xs = points.map((p) => p.x);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const spanX = xMax - xMin || 1;
  const pad = (yMax - yMin || 10) * 0.18;
  const yLo = yMin - pad;
  const yHi = yMax + pad;

  const px = (x: number) => M.left + ((x - xMin) / spanX) * (W - M.left - M.right);
  const py = (y: number) => {
    const t = (y - yLo) / (yHi - yLo);
    const tt = meta.invert ? t : 1 - t; // invert: small value -> top
    return M.top + tt * (H - M.top - M.bottom);
  };
  const baseY = H - M.bottom;

  // Segments broken at every dropout (null flush).
  const segs: { line: string; area: string }[] = [];
  let line = "";
  let area = "";
  let pen = false;
  let startX = 0;
  let lastX = 0;
  const flush = () => {
    if (pen)
      segs.push({ line: line.trim(), area: `${area}L${lastX},${baseY} L${startX},${baseY} Z` });
    line = "";
    area = "";
    pen = false;
  };
  for (const p of points) {
    if (p.y == null) {
      flush();
      continue;
    }
    const x = +px(p.x).toFixed(1);
    const y = +py(p.y).toFixed(1);
    if (!pen) {
      line = `M${x},${y} `;
      area = `M${x},${y} `;
      startX = x;
      pen = true;
    } else {
      line += `L${x},${y} `;
      area += `L${x},${y} `;
    }
    lastX = x;
  }
  flush();

  const yTicks = [0, 1, 2, 3].map((i) => yLo + ((yHi - yLo) * i) / 3);
  const xStep = spanX / (xTickCount - 1);
  const xTicks = Array.from({ length: xTickCount }, (_, i) => xMin + i * xStep);

  // dropout bands
  const gaps: number[] = [];
  let inGap = false;
  let prevX: number | null = null;
  for (const p of points) {
    if (p.y == null) {
      if (!inGap) {
        inGap = true;
        gaps.push(prevX != null ? px(prevX) : M.left);
      }
    } else {
      inGap = false;
      prevX = p.x;
    }
  }

  const extreme = markExtreme
    ? withY.reduce((a, b) => (meta.invert ? (b.y < a.y ? b : a) : b.y > a.y ? b : a))
    : null;

  const fs = compact ? 10 : 11;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={meta.color} stopOpacity="0.26" />
          <stop offset="100%" stopColor={meta.color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {grid &&
        yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={M.left}
              x2={W - M.right}
              y1={py(t)}
              y2={py(t)}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={M.left - 7}
              y={py(t) + 3}
              textAnchor="end"
              fontSize={fs}
              className="fill-[var(--faint)]"
            >
              {meta.fmt(t)}
            </text>
          </g>
        ))}

      {!hideXAxis &&
        xTicks.map((d, i) => (
          <text
            key={i}
            x={px(d)}
            y={H - M.bottom + (compact ? 14 : 18)}
            textAnchor="middle"
            fontSize={fs}
            className="fill-[var(--faint)]"
          >
            {d.toFixed(d < 10 ? 1 : 0)}
            {i === xTicks.length - 1 ? " mi" : ""}
          </text>
        ))}

      {gaps.map((gx, i) => (
        <rect
          key={i}
          x={gx - 14}
          y={M.top}
          width={28}
          height={H - M.top - M.bottom}
          className="fill-[var(--surface-3)]"
          opacity={0.55}
        />
      ))}

      {crosshairX != null && crosshairX >= xMin && crosshairX <= xMax && (
        <line
          x1={px(crosshairX)}
          x2={px(crosshairX)}
          y1={M.top}
          y2={baseY}
          stroke="var(--accent-line)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
      )}

      {segs.map((s, i) => (
        <g key={i}>
          {showArea && <path d={s.area} fill={`url(#${gradId})`} stroke="none" />}
          <path
            d={s.line}
            fill="none"
            stroke={meta.color}
            strokeWidth={compact ? 1.8 : 2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      ))}

      {extreme && (
        <g>
          <circle cx={px(extreme.x)} cy={py(extreme.y)} r={3.5} fill={meta.color} />
          <text
            x={px(extreme.x)}
            y={py(extreme.y) - 9}
            textAnchor="middle"
            fontSize={fs}
            fontWeight={600}
            className="fill-[var(--foreground)]"
          >
            {meta.fmt(extreme.y)}
            {kind === "pace" ? " /mi" : kind === "hr" ? " bpm" : " m"}
          </text>
        </g>
      )}
    </svg>
  );
}

/** Pull a single-series {x,y} array off the trackpoint fixture. */
export function series(trace: TracePoint[], kind: TraceKind): SeriesPoint[] {
  return trace.map((p) => ({
    x: p.mi,
    y: kind === "pace" ? p.paceSecPerMi : kind === "hr" ? p.hr : p.elevM,
  }));
}

export function traceHasData(trace: TracePoint[], kind: TraceKind): boolean {
  return series(trace, kind).filter((p) => p.y != null).length >= 2;
}

// --- Route map mock -------------------------------------------------------

// A stylized closed loop (a Frisco-ish trail figure) drawn on a faint grid.
// Not a real basemap — the DX is backend-free.
const LOOP =
  "M120,180 C150,120 210,90 280,110 C360,134 380,70 470,86 C560,102 600,150 640,200 " +
  "C688,258 640,320 560,320 C470,320 430,270 360,280 C280,292 250,250 200,260 " +
  "C140,272 96,240 120,180 Z";

export function RouteMapMock({
  height = 220,
  stroke = "var(--discipline-run-dot)",
  showStart = true,
  children,
}: {
  height?: number;
  stroke?: string;
  showStart?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]"
      style={{ height, background: "linear-gradient(160deg,#101318,#0d0f13)" }}
    >
      <svg
        viewBox="0 0 760 400"
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-label="Route map (mock)"
      >
        <defs>
          <pattern id="map-grid" width="38" height="38" patternUnits="userSpaceOnUse">
            <path d="M38 0H0V38" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="760" height="400" fill="url(#map-grid)" />
        <path
          d={LOOP}
          fill="none"
          stroke={stroke}
          strokeOpacity={0.16}
          strokeWidth={9}
          strokeLinejoin="round"
        />
        <path
          d={LOOP}
          fill="none"
          stroke={stroke}
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {showStart && (
          <>
            <circle
              cx={120}
              cy={180}
              r={5.5}
              fill="var(--background)"
              stroke={stroke}
              strokeWidth={2.4}
            />
            <circle cx={560} cy={320} r={4} fill={stroke} />
          </>
        )}
      </svg>
      {children}
    </div>
  );
}

// --- Splits ledger (kept recognizable) ------------------------------------

export function SplitsTable({
  splits,
  showHr,
  showElev,
  paceTint = true,
  compact = false,
}: {
  splits: Split[];
  showHr: boolean;
  showElev: boolean;
  paceTint?: boolean;
  compact?: boolean;
}) {
  const cols = ["Mi", "Pace", ...(showHr ? ["Avg HR"] : []), ...(showElev ? ["Elev Δ"] : [])];
  const cell = compact ? "px-3 py-1.5" : "px-3 py-2";
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
      <table className="w-full text-right text-[13px] tabular-nums tracking-[-0.03em]">
        <thead>
          <tr className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wider text-[var(--faint)]">
            {cols.map((c, i) => (
              <th
                key={c}
                className={`${cell} font-semibold ${i === 0 ? "text-left" : "text-right"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {splits.map((s) => (
            <tr
              key={s.index}
              className="border-t border-[var(--border)] odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40"
            >
              <td className={`${cell} text-left text-[var(--muted)]`}>Mi {s.index + 1}</td>
              <td
                className={`${cell} font-semibold ${paceTint ? "text-[var(--discipline-run-fg)]" : "text-[var(--foreground)]"}`}
              >
                {fmtClock(s.paceSecPerMi)}
                {s.fastest && <Tag tone="success">fastest</Tag>}
                {s.slowest && <Tag tone="danger">slowest</Tag>}
              </td>
              {showHr && <td className={`${cell} text-[var(--muted)]`}>{s.hr ?? "—"}</td>}
              {showElev && (
                <td className={`${cell} text-[var(--faint)]`}>{fmtElevDelta(s.elevDeltaM)}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Tag({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  const color = tone === "success" ? "var(--success)" : "var(--danger)";
  return (
    <span
      className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

// --- HR zones (kept recognizable: ranked cool->warm bars) -----------------

export function ZoneBars({ zones, compact = false }: { zones: Zone[]; compact?: boolean }) {
  const totalSec = 4248;
  const ranked = [...zones].sort((a, b) => b.zone - a.zone);
  return (
    <ul className={`flex flex-col ${compact ? "gap-2" : "gap-2.5"}`}>
      {ranked.map((z) => (
        <li key={z.zone} className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2 text-xs">
            <span className="font-medium text-[var(--foreground)]">{z.name}</span>
            <span className="text-[var(--muted)]">
              {z.minBpm > 0 ? `${z.minBpm}–` : "<"}
              {z.maxBpm} bpm
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <div
                className="h-full rounded-full"
                style={{ width: `${z.pct * 100}%`, backgroundColor: `var(--zone-${z.zone})` }}
              />
            </div>
            <div className="flex w-20 shrink-0 items-baseline justify-end gap-1.5 text-xs">
              <span className="tabular-nums text-[var(--muted)]">
                {fmtDuration(z.pct * totalSec)}
              </span>
              <span className="w-9 text-right font-medium tabular-nums text-[var(--foreground)]">
                {Math.round(z.pct * 100)}%
              </span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
