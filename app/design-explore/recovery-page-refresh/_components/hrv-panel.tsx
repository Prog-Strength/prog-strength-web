/**
 * The HRV panel, at page scale — THE ONE ELEMENT HELD CONSTANT ACROSS THE SPREAD.
 *
 * Fixed Decision 2: the banded ribbon, the 7-day rolling curve, the
 * shape-changing out-of-band marks and the gauge are decided and liked, and no
 * variant redesigns them. So this is the shipped tile's chart — the same
 * `prepareHrvChart` object, the same `weekBand` ribbon, the same
 * circle/triangle/diamond grammar, the same `hrvStatusColor` — with exactly two
 * things a page can offer that a 3-column tile cannot: MORE ROOM and a DATE
 * AXIS. Variants diverge on how much of both they give it and what sits around
 * it; they do not diverge on what it looks like.
 *
 * Everything it draws is read off the chart object. Nothing here recomputes a
 * server figure, and nothing re-derives one `prepareHrvChart` already returns —
 * the rolling series and the narrowed week band included.
 *
 * Throwaway: a real implementation would promote the tile's own component
 * rather than restate its geometry at a second size, which is exactly the kind
 * of decision the downstream SOW gets to make.
 */
"use client";

import type { RecoveryHrvStatus, RecoveryView } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import {
  bandRuns,
  gaugePct,
  prepareHrvChart,
  rollingRuns,
  scaler,
  weekBand,
  type HrvChart,
} from "@/app/(app)/dashboard/_components/recovery/hrv-chart";
import {
  driftColor,
  driftTag,
  hrvStatusColor,
  statusWord,
  MIN_BASELINE_DAYS,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { monthLabel, shortDate } from "../_shared";

const DOT_R = 3.4;
const TODAY_R = DOT_R + 1.2;
const R_MAX = TODAY_R;

/** One plotted mean. Colour AND shape carry the status — the tile's grammar,
 *  unchanged: in-band circle, below-band triangle, above-band diamond. */
function Mark({
  x,
  y,
  r,
  status,
  today,
}: {
  x: number;
  y: number;
  r: number;
  status: RecoveryHrvStatus;
  today: boolean;
}) {
  const paint = {
    fill: hrvStatusColor(status),
    fillOpacity: status === "unknown" ? 0.45 : 1,
    stroke: "var(--surface)",
    strokeWidth: 1,
  };
  const shape =
    status === "suppressed" ? (
      <polygon
        points={`${-r * 1.3},${-r * 0.78} ${r * 1.3},${-r * 0.78} 0,${r * 1.12}`}
        {...paint}
      />
    ) : status === "elevated" ? (
      <polygon points={`0,${-r * 1.25} ${r * 1.25},0 0,${r * 1.25} ${-r * 1.25},0`} {...paint} />
    ) : (
      <circle r={r} {...paint} />
    );
  return (
    <g
      data-testid="hrv-mark"
      data-status={status}
      data-today={today ? "true" : undefined}
      transform={`translate(${x} ${y})`}
    >
      {shape}
    </g>
  );
}

export type HrvPanelProps = {
  /** A view already narrowed to the window this panel should draw. */
  view: RecoveryView;
  /** Plot height in pixels. The tile gets 62; a page can afford three times it. */
  height?: number;
  /** Register 1 — last night's verdict and the baseline-drift tag. */
  verdict?: boolean;
  /** Register 2 — the 7-day average at 28px. */
  figure?: boolean;
  /** Register 3 — the gauge and its printed week bounds. */
  gauge?: boolean;
  /** A dated x-axis under the plot: month ticks, plus the window's ends. */
  axis?: boolean;
  /** Shade and label the longest sustained below-band run in the window. */
  annotateRun?: boolean;
  /** Print the week band's bounds on the plot itself (Apple Health's habit). */
  boundsOnPlot?: boolean;
};

export function HrvPanel({
  view,
  height = 150,
  verdict = true,
  figure = false,
  gauge = false,
  axis = false,
  annotateRun = false,
  boundsOnPlot = false,
}: HrvPanelProps) {
  const chart = prepareHrvChart(view);
  if (!chart) return <HrvCalibrating nights={view.baseline?.hrvDays ?? 0} />;

  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      {verdict && <VerdictRegister chart={chart} />}
      {(figure || gauge) && <FigureRegister chart={chart} figure={figure} gauge={gauge} />}
      <HrvPlot
        chart={chart}
        height={height}
        axis={axis}
        annotateRun={annotateRun}
        boundsOnPlot={boundsOnPlot}
      />
    </div>
  );
}

function VerdictRegister({ chart }: { chart: HrvChart }) {
  const { today, drift } = chart;
  return (
    <div className="flex items-center justify-between gap-2 pb-2.5">
      <div className="flex items-center gap-2">
        <span
          className="h-[7px] w-[7px] shrink-0 rounded-full"
          style={{ backgroundColor: hrvStatusColor(today.status) }}
        />
        <span className="text-[13px] font-medium text-[var(--foreground)]">
          {statusWord(today.status, today.hrv !== null)}
        </span>
      </div>
      <span
        className="font-mono text-[11px] tabular-nums"
        style={{ color: driftColor(drift.direction) }}
      >
        {driftTag(drift)}
      </span>
    </div>
  );
}

function FigureRegister({
  chart,
  figure,
  gauge,
}: {
  chart: HrvChart;
  figure: boolean;
  gauge: boolean;
}) {
  const { shortAvg, hrvAvg, balancedHigh, weekLow, weekHigh, week } = chart;
  const tickPct = gaugePct(shortAvg, hrvAvg, balancedHigh);
  const tickColor = week === "unknown" ? "var(--foreground)" : hrvStatusColor(week);
  const lowPct = gaugePct(weekLow, hrvAvg, balancedHigh) ?? 50;
  const highPct = gaugePct(weekHigh, hrvAvg, balancedHigh) ?? 50;
  const zones: { status: RecoveryHrvStatus; from: number; to: number }[] = [
    { status: "suppressed", from: 0, to: lowPct },
    { status: "balanced", from: lowPct, to: highPct },
    { status: "elevated", from: highPct, to: 100 },
  ];

  return (
    <div className="flex items-end justify-between gap-6 py-3">
      {figure && (
        <div className="shrink-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
              {shortAvg !== null ? Math.round(shortAvg) : "—"}
            </span>
            <span className="text-xs font-medium text-[var(--muted)]">ms</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            7d avg
          </div>
        </div>
      )}
      {gauge && (
        <div className="min-w-0 flex-1">
          <div className="relative">
            <div className="relative h-[8px] w-full overflow-hidden rounded-[2px]">
              {zones.map((zone) => (
                <span
                  key={zone.status}
                  className="absolute inset-y-0"
                  style={{
                    left: `${zone.from}%`,
                    width: `${zone.to - zone.from}%`,
                    backgroundColor: hrvStatusColor(zone.status),
                    opacity: zone.status === week ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
            {tickPct !== null && (
              <span
                className="absolute top-[-3px] h-[14px] w-[2px] rounded-full"
                style={{
                  left: `${tickPct}%`,
                  transform: "translateX(-1px)",
                  backgroundColor: tickColor,
                }}
              />
            )}
          </div>
          <div className="relative mt-1.5 h-[11px]">
            <span
              className="absolute font-mono text-[9px] tabular-nums text-[var(--faint)]"
              style={{ left: `${lowPct}%`, transform: "translateX(-50%)" }}
            >
              {Math.round(weekLow)}
            </span>
            <span
              className="absolute font-mono text-[9px] tabular-nums text-[var(--faint)]"
              style={{ left: `${highPct}%`, transform: "translateX(-50%)" }}
            >
              {Math.round(weekHigh)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** The longest run of consecutive sustained below-band nights in the drawn
 *  window, as indices into `series`. Read off `nights`, never re-classified. */
function longestRun(chart: HrvChart): { from: number; to: number } | null {
  const offset = chart.days.length - chart.series.length;
  const runs: { from: number; to: number }[] = [];
  let start = -1;
  for (let i = 0; i < chart.nights.length; i += 1) {
    const night = chart.nights[i];
    const inRun = night.status === "suppressed" && night.hasReading;
    if (inRun && start === -1) start = i;
    if (!inRun && start !== -1) {
      runs.push({ from: start, to: i - 1 });
      start = -1;
    }
  }
  if (start !== -1) runs.push({ from: start, to: chart.nights.length - 1 });

  let best: { from: number; to: number } | null = null;
  for (const run of runs) {
    if (best === null || run.to - run.from > best.to - best.from) best = run;
  }
  // Two nights is a couple of bad sleeps; three is the sustained dip the tile
  // already names, and the only thing worth annotating.
  if (best === null || best.to - best.from < 2) return null;
  return { from: best.from - offset, to: best.to - offset };
}

function HrvPlot({
  chart,
  height,
  axis,
  annotateRun,
  boundsOnPlot,
}: {
  chart: HrvChart;
  height: number;
  axis: boolean;
  annotateRun: boolean;
  boundsOnPlot: boolean;
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const { series, rolling, domain, weekLow, weekHigh } = chart;

  const x = (i: number) => R_MAX + (i / Math.max(1, series.length - 1)) * (width - R_MAX * 2);
  const y = scaler(domain, R_MAX, height - R_MAX * 2);
  const run = annotateRun ? longestRun(chart) : null;

  // Month ticks, from the drawn series itself — one per month boundary it spans.
  const ticks = series.flatMap((d, i) =>
    i > 0 && d.date.slice(8) === "01" ? [{ i, label: monthLabel(d.date) }] : [],
  );

  return (
    <div className="pt-3">
      <div ref={ref} style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block"
            role="img"
            aria-label={`${series.length} days of 7-day average HRV against a baseline band that drifts`}
          >
            {run && run.from >= 0 && (
              <rect
                x={x(run.from) - 3}
                y={0}
                width={Math.max(6, x(run.to) - x(run.from) + 6)}
                height={height}
                fill="var(--warning)"
                opacity={0.07}
              />
            )}
            {bandRuns(series).map((band) => {
              const pts = band.flatMap(({ i, d }) => {
                if (d.balancedHigh === null || d.balancedLow === null) return [];
                const [low, high] = weekBand(d.balancedLow, d.balancedHigh);
                return [{ px: x(i), top: y(high), bottom: y(low) }];
              });
              if (pts.length < 2) return null;
              const top = pts.map((p) => `${p.px},${p.top}`);
              const bottom = pts
                .slice()
                .reverse()
                .map((p) => `${p.px},${p.bottom}`);
              return (
                <polygon
                  key={band[0].d.date}
                  points={[...top, ...bottom].join(" ")}
                  fill="var(--surface-3)"
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              );
            })}
            {rollingRuns(rolling).map((line) =>
              line.length < 2 ? null : (
                <polyline
                  key={series[line[0].i].date}
                  points={line.map(({ i, p }) => `${x(i)},${y(p.avg)}`).join(" ")}
                  fill="none"
                  stroke="var(--muted)"
                  strokeOpacity={0.6}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            )}
            {rolling.map((p, i) =>
              p === null ? null : (
                <Mark
                  key={series[i].date}
                  x={x(i)}
                  y={y(p.avg)}
                  r={i === rolling.length - 1 ? TODAY_R : DOT_R}
                  status={p.status}
                  today={i === rolling.length - 1}
                />
              ),
            )}
            {boundsOnPlot && (
              <>
                <text
                  x={width - 4}
                  y={y(weekHigh) - 4}
                  textAnchor="end"
                  className="fill-[var(--faint)] font-mono text-[9px] tabular-nums"
                >
                  {Math.round(weekHigh)} ms
                </text>
                <text
                  x={width - 4}
                  y={y(weekLow) + 11}
                  textAnchor="end"
                  className="fill-[var(--faint)] font-mono text-[9px] tabular-nums"
                >
                  {Math.round(weekLow)} ms
                </text>
              </>
            )}
            {run && run.from >= 0 && (
              <text
                x={x(run.from)}
                y={11}
                className="fill-[var(--warning)] text-[9px] uppercase tracking-[0.08em]"
              >
                {run.to - run.from + 1} nights below band
              </text>
            )}
          </svg>
        )}
      </div>
      {axis && series.length > 0 && (
        <div className="relative mt-1 h-[12px] text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">
          <span className="absolute left-0">{shortDate(series[0].date)}</span>
          {ticks.map((t) => (
            <span
              key={t.i}
              className="absolute"
              style={{ left: `${(t.i / Math.max(1, series.length - 1)) * 100}%` }}
            >
              {t.label}
            </span>
          ))}
          <span className="absolute right-0 text-[var(--muted)]">
            {shortDate(series[series.length - 1].date)}
          </span>
        </div>
      )}
    </div>
  );
}

/** No band to draw yet — the tile's own honest progress state, at page width. */
export function HrvCalibrating({ nights }: { nights: number }) {
  return (
    <div className="flex flex-col gap-2 py-2">
      <span className="text-sm font-medium text-[var(--muted)]">Calibrating your band</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (nights / MIN_BASELINE_DAYS) * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--faint)]">
        <span className="font-mono tabular-nums text-[var(--muted)]">
          {nights} of {MIN_BASELINE_DAYS}
        </span>{" "}
        nights · your normal range appears once Whoop knows your spread
      </p>
    </div>
  );
}
