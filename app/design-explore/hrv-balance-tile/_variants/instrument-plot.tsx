/**
 * IDIOM: instrument-plot — "give me the real chart, small."
 *
 * Heroes the CHART FURNITURE. A real miniature chart rather than a sparkline: a
 * labelled y-axis in milliseconds, dated x-ticks at the week boundaries, faint
 * gridlines, the drifting band behind, and thirty hollow marks over it — the
 * Whoop web HRV chart shrunk to tile scale and re-toned.
 *
 * The argument for spending space on axes is that the shipped tile's chart is
 * unreadable precisely because it has no scale: with a labelled axis, 77 against
 * a 68–108 band is a fact you can CHECK, not a position you have to trust.
 *
 *   Type scale   the densest on the grid — 10px mono labels everywhere and no
 *                headline figure at all.
 *   Colour logic near-monochrome. Gridlines at ~0.06 alpha, band fill barely
 *                above the surface, marks hollow in muted ink, and only TODAY's
 *                mark filled in the status colour. One coloured pixel on the
 *                whole card.
 *   Spacing      honest chart margins — a ~26px left axis gutter and a 14px
 *                bottom tick row. The exact opposite of drift-field's bleed.
 *
 * Draws on the Whoop web HRV chart's labelled axes and hollow points, with
 * Bloomberg Terminal's conviction that furniture is information at small sizes.
 *
 * The open question for the selection gate: 10px axis labels on a one-third
 * cell are either the most useful card on the grid or unreadable, with no
 * middle outcome.
 *
 * Throwaway mockup — static fixtures, no live data, never promoted.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard, CalibratingBody } from "../_shell";
import {
  bandRuns,
  driftColor,
  driftTag,
  niceTicks,
  prepare,
  scaler,
  shortDate,
  statusColor,
  useMeasuredWidth,
} from "../_util";

const PLOT_H = 152;
const TICK_H = 14;
const AXIS_W = 26;
const DOT_R = 3;

export function InstrumentPlot({ view }: { view: RecoveryView }) {
  const p = prepare(view);
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  if (!p) {
    return (
      <MockCard>
        <CalibratingBody nights={view.baseline?.hrvDays ?? 0} />
      </MockCard>
    );
  }

  const { days, baseline, drift, domain } = p;
  const y = scaler(domain, DOT_R, PLOT_H - DOT_R * 2);
  const plotW = Math.max(1, width - AXIS_W - DOT_R - 1);
  const x = (i: number) => AXIS_W + (i / Math.max(1, days.length - 1)) * plotW;

  const yTicks = niceTicks(domain, 4);
  // Week boundaries, walking back from today.
  const xTicks = [9, 16, 23, 30].filter((i) => i < days.length);
  const todayIdx = days.length - 1;

  return (
    <MockCard>
      <div ref={ref}>
        {/* The annotation block — right-aligned, two lines, no headline figure. */}
        <div className="flex flex-col items-end gap-0.5">
          <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">
            baseline {baseline.hrvAvg !== null ? Math.round(baseline.hrvAvg) : "—"} ms
          </span>
          <span
            className="font-mono text-[10px] tabular-nums"
            style={{ color: driftColor(drift.direction) }}
          >
            {driftTag(drift, "")}
          </span>
        </div>

        {width > 0 && (
          <svg
            width={width}
            height={PLOT_H + TICK_H}
            viewBox={`0 0 ${width} ${PLOT_H + TICK_H}`}
            className="mt-1.5 block"
            role="img"
            aria-label="Thirty nights of HRV in milliseconds against a drifting baseline band"
          >
            {/* Furniture first — gridlines and the labelled millisecond axis. */}
            {yTicks.map((t) => (
              <g key={t}>
                <line
                  x1={AXIS_W}
                  x2={width}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={1}
                />
                <text
                  x={AXIS_W - 6}
                  y={y(t) + 3.5}
                  textAnchor="end"
                  className="font-mono"
                  fontSize={10}
                  fill="var(--faint)"
                >
                  {t}
                </text>
              </g>
            ))}

            {/* The band, barely above the surface, breaking where it is null. */}
            {bandRuns(days).map((run, k) => {
              const top = run.map(({ i, d }) => `${x(i)},${y(d.balancedHigh as number)}`);
              const bottom = run
                .slice()
                .reverse()
                .map(({ i, d }) => `${x(i)},${y(d.balancedLow as number)}`);
              return (
                <g key={k}>
                  <polygon
                    points={[...top, ...bottom].join(" ")}
                    fill="var(--surface-2)"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth={1}
                  />
                  <polyline
                    points={run
                      .map(({ i, d }) => `${x(i)},${y(d.baselineAvg as number)}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--faint)"
                    strokeOpacity={0.4}
                    strokeWidth={1}
                    strokeDasharray="2 3"
                  />
                </g>
              );
            })}

            {/* Baseline rule under the tick row. */}
            <line
              x1={AXIS_W}
              x2={width}
              y1={PLOT_H}
              y2={PLOT_H}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
            />
            {xTicks.map((i) => (
              <text
                key={i}
                x={x(i)}
                y={PLOT_H + 11}
                textAnchor={i === todayIdx ? "end" : "middle"}
                className="font-mono"
                fontSize={10}
                fill="var(--faint)"
              >
                {shortDate(days[i].date)}
              </text>
            ))}

            {/* Hollow marks — one per night. Only today is filled. */}
            {days.map((d, i) => {
              if (d.hrv === null) return null;
              const isToday = i === todayIdx;
              return (
                <circle
                  key={d.date}
                  cx={x(i)}
                  cy={y(d.hrv)}
                  r={DOT_R}
                  fill={isToday ? statusColor(d.status) : "var(--surface)"}
                  stroke={isToday ? statusColor(d.status) : "var(--muted)"}
                  strokeWidth={1.25}
                />
              );
            })}
          </svg>
        )}
      </div>
    </MockCard>
  );
}
