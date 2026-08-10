/**
 * IDIOM: dual-window — "how did this fortnight compare to the last?"
 *
 * Heroes the STEP between two windows. The body splits into two side-by-side
 * panels, PREV 2W and LAST 2W, each drawing 14 marks over its OWN band segment
 * at its OWN level. It spends the last 28 of the series' 31 days; the three
 * oldest are dropped rather than making the panels uneven.
 *
 * The two panels share ONE y-scale — that is the whole trick. Because the bands
 * sit at different heights on a common axis, the drift is a literal visible
 * offset between the panels rather than a slope you have to estimate. Give each
 * panel its own scale and the idiom collapses into two identical pictures.
 *
 *   Type scale   one ~22px delta figure and two 10px uppercase panel labels.
 *                No big millisecond figure anywhere.
 *   Colour logic the BANDS carry the story — the later panel's fill tinted
 *                toward success when rising, warning when falling — and the
 *                marks stay near-mono so they do not compete. Only today's mark
 *                takes a status colour.
 *   Spacing      two symmetric columns with a hairline gutter, equal weight;
 *                nothing is full-width but the delta.
 *
 * Draws on Garmin Connect's 4-week chart, which already reads as two banded
 * panels, and Robinhood's `from → to` delta framing.
 *
 * KNOWN TENSION, surfaced for the selection gate: the ticket budgets ~18px dot
 * pitch for 14 marks, but that assumes a full-width chart. Halved into a panel
 * at a one-third grid cell the pitch lands near ~9px — the same as the 30-mark
 * variants — so this composition does NOT actually buy Garmin-scale dots at
 * tile width. The structural argument stands; the dot-size argument does not.
 *
 * Throwaway mockup — static fixtures, no live data, never promoted.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MockCard, CalibratingBody } from "../_shell";
import {
  driftColor,
  driftGlyph,
  prepare,
  scaler,
  signed,
  statusColor,
  useMeasuredWidth,
} from "../_util";

const PANEL_H = 126;
const GUTTER = 13; // 6px + hairline + 6px
const DOT_R = 3.2;

/** The level a window's band sits at — the mean of the server bounds it carries. */
function level(window: RecoveryDayPoint[]): { low: number; high: number } | null {
  const lows = window.map((d) => d.balancedLow).filter((v): v is number => v !== null);
  const highs = window.map((d) => d.balancedHigh).filter((v): v is number => v !== null);
  if (!lows.length || !highs.length) return null;
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return { low: mean(lows), high: mean(highs) };
}

export function DualWindow({ view }: { view: RecoveryView }) {
  const p = prepare(view);
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  if (!p) {
    return (
      <MockCard>
        <CalibratingBody nights={view.baseline?.hrvDays ?? 0} />
      </MockCard>
    );
  }

  const { days, baseline, drift } = p;
  const spent = days.slice(-28);
  const prev = spent.slice(0, 14);
  const last = spent.slice(14);

  // ONE domain across both panels, so the offset between the bands is real.
  const marks = spent.map((d) => d.hrv).filter((v): v is number => v !== null);
  const bounds = spent
    .flatMap((d) => [d.balancedLow, d.balancedHigh])
    .filter((v): v is number => v !== null);
  const domain: [number, number] = [
    Math.min(...marks, ...bounds) - 4,
    Math.max(...marks, ...bounds) + 4,
  ];
  const y = scaler(domain, DOT_R, PANEL_H - DOT_R * 2);

  const panelW = Math.max(1, (width - GUTTER) / 2);
  const pitch = panelW / 14;
  const tint =
    drift.direction === "rising"
      ? "var(--success)"
      : drift.direction === "falling"
        ? "var(--warning)"
        : null;

  const panel = (window: RecoveryDayPoint[], fill: string | null, isLast: boolean) => {
    const lv = level(window);
    return (
      <svg
        width={panelW}
        height={PANEL_H}
        viewBox={`0 0 ${panelW} ${PANEL_H}`}
        className="block"
        aria-hidden="true"
      >
        {lv && (
          <rect
            x={0}
            y={y(lv.high)}
            width={panelW}
            height={Math.max(1, y(lv.low) - y(lv.high))}
            fill={fill ?? "var(--surface-3)"}
            fillOpacity={fill ? 0.2 : 1}
            stroke={fill ?? "rgba(255,255,255,0.06)"}
            strokeOpacity={fill ? 0.35 : 1}
            strokeWidth={1}
          />
        )}
        {window.map((d, i) => {
          if (d.hrv === null) return null;
          const isToday = isLast && i === window.length - 1;
          return (
            <circle
              key={d.date}
              cx={(i + 0.5) * pitch}
              cy={y(d.hrv)}
              r={isToday ? DOT_R + 1 : DOT_R}
              fill={isToday ? statusColor(d.status) : "var(--muted)"}
              stroke="var(--surface)"
              strokeWidth={1.25}
            />
          );
        })}
      </svg>
    );
  };

  const from = drift.fromAvg;
  const to = baseline.hrvAvg as number;

  return (
    <MockCard>
      <div>
        <div ref={ref} className="flex items-stretch">
          <div style={{ width: panelW }}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
              Prev 2w
            </div>
            {width > 0 && panel(prev, null, false)}
          </div>
          <div className="mx-[6px] w-px shrink-0 bg-[var(--border)]" />
          <div style={{ width: panelW }}>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
              Last 2w
            </div>
            {width > 0 && panel(last, tint, true)}
          </div>
        </div>

        {/* The only full-width element: the step between the two windows. */}
        <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
          {from !== null && drift.deltaMs !== null ? (
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
                {Math.round(from)}
                <span className="mx-1.5 text-[var(--faint)]">→</span>
                {Math.round(to)}
              </span>
              <span className="text-[11px] font-medium text-[var(--muted)]">ms</span>
              <span
                className="font-mono text-[13px] tabular-nums"
                style={{ color: driftColor(drift.direction) }}
              >
                {driftGlyph(drift.direction)} {signed(drift.deltaMs)}
              </span>
            </div>
          ) : (
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
                {Math.round(to)}
              </span>
              <span className="text-[11px] font-medium text-[var(--muted)]">ms</span>
              <span className="text-[11px] text-[var(--faint)]">· 4-week change not yet known</span>
            </div>
          )}
        </div>
      </div>
    </MockCard>
  );
}
