/**
 * HrvBalanceView — the FIRST view of the HRV tile ("HRV Balance"), and the one
 * the tile opens on.
 *
 * Four hairline-separated registers, taken structurally from Garmin Connect's
 * HRV Status card and re-toned into the house tokens:
 *
 *   1. THE VERDICT — a status dot and the house word for last night, with the
 *      baseline-drift tag (`▲ +6 ms · 4w`) right-aligned against it. The status
 *      is read off `days[last]`, never off the scalar `hrv.status`. This is the
 *      one register on the card that is about a single morning, and it is
 *      allowed to differ from everything below it: a suppressed night inside a
 *      balanced week is an ordinary fact, not a contradiction.
 *   2. THE STABLE FIGURE — the 7-day average at 28px.
 *   3. THE GAUGE — a ±2-band-width bar with a tick where that average falls and
 *      the server's own bounds printed under the 25% and 75% boundaries. The
 *      tick carries the WEEK's color, which is the same figure and the same
 *      color the Recovery Trend view heroes one swipe away.
 *   4. THE CHART — the 7-DAY ROLLING AVERAGE, one mark per day joined by a
 *      hairline, over a band POLYGON that drifts, each day drawn from the band
 *      as it stood that morning. A null baseline breaks the polygon rather than
 *      closing across it, and a stretch with too few readings to average breaks
 *      the curve rather than drawing a chord over it.
 *
 * The whole card is therefore about the SAME figure at three scales: the big
 * number is the 7-day average, the gauge is where that average sits in the band,
 * and the chart is where it has been for the last three and a half weeks. Only
 * register 1 is about last night.
 *
 * Plotting the average rather than the raw night is the tile's one deliberate
 * disagreement with Garmin's HRV Status card, which this idiom is otherwise
 * taken from. A single night of RMSSD is noise: Garmin's own chart is a
 * scatter that has to be squinted at before a direction appears, and recovery is
 * a question about a week, never about a morning. The smoothed curve makes the
 * pattern the first thing read rather than something inferred. It also means the
 * chart, like the headline, survives 7am — a missing morning is one fewer sample
 * in a seven-night window, not a missing final mark.
 *
 * Each mark's colour is where THAT day's average sat in THAT day's band, and the
 * last one is `week`, the same value the gauge tick above it carries — the curve
 * ends where the gauge points. Marks are NOT painted by `nightColor` any more:
 * that function is about one night's verdict, which is the trend rail's subject
 * now, and a rolling mean asks a different question of the same band. The one
 * weight reduction left is `unknown` at 0.45, for a day whose band was not
 * established yet — the same "no verdict, so no colour" convention the rail keeps.
 *
 * Nothing here recomputes a server figure, and nothing here re-derives one the
 * chart object already carries — the rolling series included, which arrives
 * ready-made on `chart.rolling`. The only arithmetic is mapping an
 * already-computed millisecond value onto a pixel, which is what a chart is.
 */
"use client";

import type { RecoveryHrvStatus } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { bandRuns, gaugeTickPct, rollingRuns, scaler, type HrvChart } from "./hrv-chart";
import { driftColor, driftTag, hrvStatusColor, statusWord } from "./shared";

const CHART_H = 62;
const DOT_R = 2.6;
/** The largest radius drawn — today's mark. Both axes inset by it; see below. */
const R_MAX = DOT_R + 1;

/**
 * The weight one plotted average carries. Full strength for a day with a verdict
 * behind it, 0.45 for one whose band was not established yet — where the colour
 * is `--muted` standing in for "no verdict", exactly as it is on the rail.
 *
 * There is deliberately no reduced weight for an isolated low here, which the
 * rail's `nightOpacity` does apply. That reduction exists to stop ONE bad night
 * reading as a bad week; a suppressed seven-night mean already is a bad week, so
 * dimming it would understate the only thing this curve is drawn to show.
 */
function markOpacity(status: RecoveryHrvStatus): number {
  return status === "unknown" ? 0.45 : 1;
}

export function HrvBalanceView({ chart }: { chart: HrvChart }) {
  // Measured on every render: this view is mounted even while the tile is
  // showing the other one (hidden, but laid out), so the box has a width to
  // report and the chart is already drawn when the user swipes to it.
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  const {
    series,
    rolling,
    hrvAvg,
    balancedLow,
    balancedHigh,
    shortAvg,
    week,
    drift,
    today,
    domain,
  } = chart;
  const tickPct = gaugeTickPct(shortAvg, hrvAvg, balancedHigh);
  // A tick with no verdict behind it is a position marker, not a status.
  const tickColor = week === "unknown" ? "var(--foreground)" : hrvStatusColor(week);

  // Both axes are inset by the largest radius drawn, which is today's mark. The
  // mockup — and the shipped tile — put the first and last mark's centre on the
  // box edge, so today's dot is drawn half outside the SVG and reads clipped.
  // The x-axis spans `series`, the days the curve actually reaches, NOT the full
  // 31-day window: the first six mornings have no seven-night mean behind them,
  // and leaving their fifth of the box permanently empty reads as a data outage.
  const x = (i: number) => R_MAX + (i / Math.max(1, series.length - 1)) * (width - R_MAX * 2);
  const y = scaler(domain, R_MAX, CHART_H - R_MAX * 2);

  return (
    <div className="flex flex-col divide-y divide-[var(--border)]">
      {/* 1 — the verdict, and the only register here about ONE morning. Its
          status is the server's own for `days[last]`, never a re-comparison. */}
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

      {/* 2 — the stable figure. Em-dash only below min_trend_days. */}
      <div className="py-2.5">
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

      {/* 3 — the gauge. A suppressed week is warning, never danger red; an
          elevated one is accent, never a bigger green. */}
      <div className="py-2.5">
        <div className="relative">
          {/* The widths total 100% and the two 2px gaps overflow by 4px, so
              flex shrinks the children by 1/2/1px — which centres each gap on
              the true 25% and 75% marks, where the labels and the tick sit.
              Removing the gaps, or "fixing" the overflow, moves the segment
              edges off the boundaries they are supposed to mark. */}
          <div className="flex h-[8px] w-full gap-[2px] overflow-hidden">
            <div
              className="h-full w-1/4 rounded-l-[2px]"
              style={{ backgroundColor: "var(--warning)", opacity: 0.28 }}
            />
            <div
              className="h-full w-1/2"
              style={{ backgroundColor: "var(--success)", opacity: 0.28 }}
            />
            <div
              className="h-full w-1/4 rounded-r-[2px]"
              style={{ backgroundColor: "var(--accent)", opacity: 0.28 }}
            />
          </div>
          {tickPct !== null && (
            <span
              data-testid="gauge-tick"
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
            style={{ left: "25%", transform: "translateX(-50%)" }}
          >
            {Math.round(balancedLow)}
          </span>
          <span
            className="absolute font-mono text-[9px] tabular-nums text-[var(--faint)]"
            style={{ left: "75%", transform: "translateX(-50%)" }}
          >
            {Math.round(balancedHigh)}
          </span>
        </div>
      </div>

      {/* 4 — the chart. The height is reserved UNCONDITIONALLY: the SVG only
          renders once measured, so without it the card would grow 62px on
          hydration — a layout shift on every load, on the tallest tile here.
          72px is CHART_H (62) + the 10px of `pt-2.5`: preflight makes this
          box `border-box`, so the padding comes OUT of the declared height
          and a bare `h-[62px]` would leave the SVG a 52px content box to
          overflow. A Tailwind arbitrary value cannot interpolate a constant,
          so the two are hand-synced — move CHART_H and move this with it. */}
      <div ref={ref} className="h-[72px] pt-2.5">
        {width > 0 && (
          <svg
            width={width}
            height={CHART_H}
            viewBox={`0 0 ${width} ${CHART_H}`}
            className="block"
            role="img"
            aria-label={`${series.length} days of 7-day average HRV against a baseline band that drifts`}
          >
            {/* One polygon per run of banded days — top edge left→right over
                balancedHigh, bottom edge back over balancedLow. A ONE-DAY run
                yields a two-point polygon, which is a line rather than a band,
                so it is skipped; a wholly unbanded series draws none at all,
                which is the honest rendering of "no range established yet". */}
            {bandRuns(series).map((run) => {
              // `bandRuns` already guarantees both bounds; the inner flatMap
              // is here to NARROW them, which is what avoids an `as number`.
              const pts = run.flatMap(({ i, d }) =>
                d.balancedHigh === null || d.balancedLow === null
                  ? []
                  : [{ px: x(i), top: y(d.balancedHigh), bottom: y(d.balancedLow) }],
              );
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
            {/* The curve, under the marks so a dot is never half-covered by its
                own connector. One polyline per unbroken run: a stretch with too
                few readings to average is a hole in the series, and joining
                across it would draw a week of trend the athlete has no data
                for. A one-point run has nothing to connect and is skipped —
                its dot still renders below. */}
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
            {rolling.map((p, i) =>
              p === null ? null : (
                <circle
                  key={series[i].date}
                  cx={x(i)}
                  cy={y(p.avg)}
                  r={i === rolling.length - 1 ? DOT_R + 1 : DOT_R}
                  fill={hrvStatusColor(p.status)}
                  fillOpacity={markOpacity(p.status)}
                  stroke="var(--surface)"
                  strokeWidth={1}
                />
              ),
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
