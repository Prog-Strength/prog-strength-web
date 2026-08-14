/**
 * HrvPanel — the deck's HRV row: the shipped tile's chart, at page scale.
 *
 * IT TAKES A PREPARED `HrvChart`, NOT A `RecoveryView`, and that is a decision
 * rather than a convenience. `prepareDeck` calls `prepareHrvChart` ONCE per
 * render and hands the object down, exactly as `hrv-tile.tsx` runs one guard for
 * its own chart: a second call here — one for this panel, one for the deck's
 * shared date list — would be two chances to disagree about the very axis
 * correction 1 exists to fix, and they would disagree silently, because both
 * calls return a perfectly valid chart. The deck owns the guard and renders
 * `HrvCalibrating` itself when there is none.
 *
 * WHY THE TILE'S COMPONENT WAS NOT EXTRACTED. Fixed Decision 2 carries the
 * tile's chart forward unredesigned, and there were two ways to honour it. The
 * rejected one is parameterising `hrv-tile.tsx`'s `HrvBalanceView` by height:
 * the tile's registers — the swipe between balance and trend, the gauge, the
 * 28px figure — are TILE FURNITURE, and this row wants a plot with a date axis
 * and a one-line verdict. A component serving both grows two layout modes and a
 * props matrix, and the shipped tile — a tile the owner likes, on the dashboard
 * — would take the regression risk of a refactor it gains nothing from.
 *
 * The chosen one is rendering from the shared machinery. `hrv-chart.ts` is
 * already pure, React-free and exhaustively tested, and its own header names
 * this page as its intended second consumer; `bandRuns`, `rollingRuns`,
 * `weekBand`, `scaler` and the colour helpers are imported, not restated. The
 * divergence risk that leaves is bounded to GEOMETRY — every figure still comes
 * from one object — and geometry is what the page is here to change. What it
 * adds over the tile is exactly two things: MORE ROOM, and A DATED X-AXIS.
 *
 * NOTHING RECOMPUTES A FIGURE `prepareHrvChart` ALREADY RETURNS. No re-averaging,
 * no re-classification, and no second `weekBand` call on `hrv.balancedLow/High`
 * — where the week band is needed as a scalar it is read off `chart.weekLow` /
 * `chart.weekHigh`. The only arithmetic here maps an already-computed
 * millisecond value onto a pixel, which is what a chart is.
 */
"use client";

import type { RecoveryHrvStatus } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import {
  bandRuns,
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
import { monthLabel, shortDate, xAt } from "./shared";

/**
 * The mark radii, taken from the tile unchanged — the grammar is the same
 * grammar at a bigger height, not a bigger grammar. `R_MAX` is the largest
 * radius drawn, and the VERTICAL axis is inset by it so the topmost and
 * bottommost marks sit fully inside the box rather than half-clipped by its
 * edges.
 *
 * The HORIZONTAL inset is not stated here at all: it arrives with `xAt`, the
 * page's one x-mapping, whose `PLOT_INSET` IS this radius — that shared constant
 * is documented as "the HRV chart's own `R_MAX`". Taking the mapping whole is
 * what keeps the score columns and the resting-HR bars centred ON these marks
 * rather than merely agreeing with them by two literals that match today.
 * `hrv-panel.test.tsx` pins the two numbers together across the two files.
 */
const DOT_R = 3.4;
const TODAY_R = DOT_R + 1.2;
const R_MAX = TODAY_R;

/**
 * The weight one plotted mean carries: full strength for a day with a verdict
 * behind it, 0.45 for one whose band was not established yet — where the colour
 * is `--muted` standing in for "no verdict". The tile's convention, unchanged.
 */
function markOpacity(status: RecoveryHrvStatus): number {
  return status === "unknown" ? 0.45 : 1;
}

/**
 * One plotted mean. Colour AND shape carry the status, never colour alone — an
 * in-band week is a CIRCLE, a week below the band a TRIANGLE pointing down, one
 * above it a DIAMOND. A hue change is the weakest possible way to say "this week
 * left the band": invisible to a red-green deficiency, to a greyscale
 * screenshot and to a glance, and here it would be competing with two other
 * muted tokens on a plot three times the tile's height.
 *
 * The multipliers equalise apparent AREA rather than radius, and everything is
 * drawn about the origin and moved with a transform, so the shapes share one
 * centre-point convention. Identical to the tile's `Mark`, deliberately.
 */
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
    fillOpacity: markOpacity(status),
    stroke: "var(--surface)",
    strokeWidth: 1,
  };
  const shape =
    status === "suppressed" ? (
      // Apex down, and the centroid sits on the value — not the apex, which
      // would draw the whole mark a radius below the number it reports.
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

export function HrvPanel({ chart, height }: { chart: HrvChart; height: number }) {
  return (
    <div className="flex flex-col">
      <VerdictRegister chart={chart} />
      <HrvPlot chart={chart} height={height} />
    </div>
  );
}

/**
 * INVARIANT 2 — THE VERDICT REGISTER DESCRIBES LAST NIGHT, NOT THE WINDOW.
 *
 * `today.status` is the server's own verdict for the most recent stored morning,
 * and `drift` describes the last four weeks of the baseline. Neither is a
 * summary of the drawn stretch, and with the 1y window selected the difference
 * is a year wide. So the register is LABELLED `last night` — the label is the
 * invariant made visible, and removing it would leave a one-night verdict
 * sitting at the top of a chart of fourteen months, reading as its conclusion.
 *
 * This is the one register on the panel about a single morning, and it is
 * allowed to differ from the curve below it: a suppressed night inside a
 * balanced week is an ordinary fact, not a contradiction.
 */
function VerdictRegister({ chart }: { chart: HrvChart }) {
  const { today, drift } = chart;
  return (
    <div className="flex items-center justify-between gap-2 pb-2">
      <div className="flex items-baseline gap-2">
        <span
          className="h-[7px] w-[7px] shrink-0 self-center rounded-full"
          style={{ backgroundColor: hrvStatusColor(today.status) }}
        />
        <span className="text-[13px] font-medium text-[var(--foreground)]">
          {statusWord(today.status, today.hrv !== null)}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          last night
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

/** The plot's text alternative — the curve itself carries no labels. */
function plotLabel(chart: HrvChart): string {
  const { series } = chart;
  if (series.length === 0) return "No HRV averages to draw yet.";
  return (
    `${series.length} mornings of 7-day average HRV, ` +
    `${shortDate(series[0].date)} to ${shortDate(series[series.length - 1].date)}, ` +
    `against a baseline band that drifts. Marks below the band are triangles, above it diamonds.`
  );
}

/**
 * The chart itself: the drifting ribbon, the rolling curve, and one mark per
 * plotted mean — the tile's four-register card reduced to the one register a
 * deck row wants, at whatever height the row can afford.
 *
 * INVARIANT 1 — THE WINDOW MUST END ON THE LAST STORED MORNING.
 *
 * `prepareHrvChart` overwrites `rolling`'s final entry with the server's
 * `hrv.shortAvg`, which is the 7-day mean AS OF TODAY. That is what makes the
 * curve's endpoint the server's own figure rather than a client re-derivation
 * that merely ought to equal it — but it also means the last mark is only in the
 * right place if the last drawn morning IS today. A window ending earlier would
 * terminate the curve on a figure describing a different day, silently, with
 * every other point still correct.
 *
 * All three of the page's windows are tails ending on the last stored morning,
 * so this holds today. A FUTURE "BRUSH A PAST STRETCH" FEATURE WOULD BREAK IT
 * QUIETLY: nothing throws, the curve simply ends on the wrong number. Whoever
 * builds that has to give `prepareHrvChart` a view whose `hrv.shortAvg` belongs
 * to the end of the brushed stretch, or stop trusting the final point.
 */
function HrvPlot({ chart, height }: { chart: HrvChart; height: number }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const { series, rolling, domain } = chart;

  // The x-axis spans `series` — the mornings the curve actually reaches — and is
  // `xAt` itself, not a second copy of it: the score columns, the resting-HR
  // bars and the crosshair all invert that one function, so a private mapping
  // here that merely agreed with it would be free to stop agreeing. Both ends
  // are inset by `PLOT_INSET` (= `R_MAX`), so today's mark is not half outside
  // the box, and a one-morning series takes the centre of the drawable box in
  // every row at once rather than the left edge in this one alone.
  const x = (i: number) => xAt(i, series.length, width);
  const y = scaler(domain, R_MAX, height - R_MAX * 2);

  // Month ticks, read off the DRAWN series rather than generated from a date
  // range: a tick can only appear where there is a morning to hang it on, so a
  // sparse window gets fewer ticks rather than ticks pointing at nothing. `i > 0`
  // drops a boundary that lands on the first morning, where the window's own
  // start date is already printed.
  const ticks = series.flatMap((d, i) =>
    i > 0 && d.date.slice(8) === "01" ? [{ i, label: monthLabel(d.date) }] : [],
  );

  return (
    <div>
      {/* The height is reserved on the WRAPPER, unconditionally: the SVG renders
          only once measured, so without it the deck's tallest row would grow by
          `height` on hydration and shift the two rows under it. */}
      <div ref={ref} style={{ height }}>
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block"
            role="img"
            aria-label={plotLabel(chart)}
          >
            {/* One polygon per run of banded days, each morning drawn from ITS
                OWN band narrowed for a mean — the same `weekBand` the marks are
                classified against, so a mark outside the ribbon and a triangle
                are one fact rather than two that usually coincide. A one-day run
                is a line rather than a band and is skipped; a null baseline
                breaks the ribbon rather than closing across it. */}
            {bandRuns(series).map((run) => {
              // `bandRuns` already guarantees both bounds; the inner flatMap is
              // here to NARROW them, which is what avoids an `as number`.
              const pts = run.flatMap(({ i, d }) => {
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
                  key={run[0].d.date}
                  points={[...top, ...bottom].join(" ")}
                  fill="var(--surface-3)"
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              );
            })}

            {/* The curve, under the marks so a mark is never half-covered by its
                own connector. One polyline per unbroken run: a stretch too sparse
                to average is a hole in the series, and joining across it would
                draw weeks of trend the athlete has no readings for. */}
            {rollingRuns(rolling).map((run) =>
              run.length < 2 ? null : (
                <polyline
                  key={series[run[0].i].date}
                  points={run.map(({ i, p }) => `${x(i)},${y(p.avg)}`).join(" ")}
                  fill="none"
                  stroke="var(--muted)"
                  strokeOpacity={0.6}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ),
            )}

            {/* One mark per plotted mean, in that mean's own status. The LAST one
                is `chart.shortAvg` carrying `chart.week` — see invariant 1. */}
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
          </svg>
        )}
      </div>

      {/* The dated axis — one of the exactly two things this page adds over the
          tile. Its height is reserved with the strip itself so the row's total
          height is the same before and after the first measurement. Ticks are
          placed at the same pixel `x(i)` the marks are, not at a percentage of
          the full width: the plot is inset by a radius at both ends, and an axis
          that ignored that inset would drift by 4.6px against the curve it
          labels. */}
      <div className="relative mt-1 h-[12px] text-[9px] uppercase tracking-[0.08em] text-[var(--faint)]">
        {width > 0 && series.length > 0 && (
          <>
            <span className="absolute left-0">{shortDate(series[0].date)}</span>
            {ticks.map((t) => (
              <span
                key={t.i}
                data-testid="hrv-month-tick"
                className="absolute"
                style={{ left: x(t.i), transform: "translateX(-50%)" }}
              >
                {t.label}
              </span>
            ))}
            <span className="absolute right-0 text-[var(--muted)]">
              {shortDate(series[series.length - 1].date)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * No band to draw yet — the tile's own honest progress state, at page width.
 *
 * The deck renders this when `prepareDeck` hands it a null chart, which folds
 * two cases into one: a history too short to establish a baseline, and a series
 * so sparse no rolling mean ever forms. Both are "there is nothing to plot yet",
 * and neither is an error.
 *
 * `MIN_BASELINE_DAYS` is imported rather than typed as 14 — it is the API's
 * `min_baseline_days`, an operator-tunable default rather than a law, and a
 * second copy is how two surfaces start disagreeing about what calibrating means.
 */
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
