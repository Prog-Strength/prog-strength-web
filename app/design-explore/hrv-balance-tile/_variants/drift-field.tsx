/**
 * IDIOM: drift-field — "show me the shape, don't narrate it."
 *
 * Heroes the CHART and prints almost no type at all. No headline figure, no
 * status word, no caption row: the body is one edge-to-edge chart from padding
 * to padding, thirty marks at ~9px pitch over a band drawn as a genuine
 * drifting polygon — an upper and a lower path, never a rectangle — with the
 * baseline as a faint spline through its middle.
 *
 *   Type scale   the most extreme suppression in the spread: exactly two 11px
 *                mono tags, both anchored into the plot, plus the card title.
 *                The drift is described nowhere — you read it off the slope.
 *   Colour logic the BAND is neutral; the MARKS carry everything. Muted inside,
 *                status-coloured outside, today filled solid with a
 *                surface-coloured ring so it separates from its neighbours.
 *   Spacing      full-bleed, zero internal gutters, no registers. The chart IS
 *                the card.
 *
 * Draws on Oura's "your normal range" zone as territory rather than two numbers
 * to compare mentally, Whoop's full-width chart, and the annotation discipline
 * of a good print figure — a tag sits ON the thing it labels.
 *
 * Throwaway mockup — static fixtures, no live data, never promoted.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard, CalibratingBody } from "../_shell";
import {
  bandRuns,
  driftColor,
  driftTag,
  prepare,
  scaler,
  statusColor,
  useMeasuredWidth,
} from "../_util";

const CHART_H = 208;
const DOT_R = 3.4;
const INSET = DOT_R + 2; // so the first and last marks aren't clipped by the edge

export function DriftField({ view }: { view: RecoveryView }) {
  const p = prepare(view);
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  if (!p) {
    return (
      <MockCard>
        <CalibratingBody nights={view.baseline?.hrvDays ?? 0} />
      </MockCard>
    );
  }

  const { days, drift, today, banded, domain } = p;
  const y = scaler(domain, DOT_R + 1, CHART_H - (DOT_R + 1) * 2);
  const plotW = Math.max(1, width - INSET * 2);
  const x = (i: number) => INSET + (i / Math.max(1, days.length - 1)) * plotW;

  const todayIdx = days.length - 1;
  const lastBanded = banded[banded.length - 1];
  const baselineRuns = bandRuns(days);

  return (
    <MockCard>
      <div ref={ref} className="relative">
        {width > 0 && (
          <>
            <svg
              width={width}
              height={CHART_H}
              viewBox={`0 0 ${width} ${CHART_H}`}
              className="block"
              role="img"
              aria-label="Thirty nights of HRV over a baseline band that drifts across the month"
            >
              {baselineRuns.map((run, k) => {
                const top = run.map(({ i, d }) => `${x(i)},${y(d.balancedHigh as number)}`);
                const bottom = run
                  .slice()
                  .reverse()
                  .map(({ i, d }) => `${x(i)},${y(d.balancedLow as number)}`);
                return (
                  <g key={k}>
                    {/* The band as territory — a real polygon, so it can slope. */}
                    <polygon points={[...top, ...bottom].join(" ")} fill="var(--surface-3)" />
                    <polyline
                      points={top.join(" ")}
                      fill="none"
                      stroke="rgba(255,255,255,0.09)"
                      strokeWidth={1}
                    />
                    <polyline
                      points={run
                        .map(({ i, d }) => `${x(i)},${y(d.balancedLow as number)}`)
                        .join(" ")}
                      fill="none"
                      stroke="rgba(255,255,255,0.09)"
                      strokeWidth={1}
                    />
                    {/* The baseline itself, faint, through the middle. */}
                    <polyline
                      points={run
                        .map(({ i, d }) => `${x(i)},${y(d.baselineAvg as number)}`)
                        .join(" ")}
                      fill="none"
                      stroke="var(--faint)"
                      strokeOpacity={0.55}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {days.map((d, i) => {
                if (d.hrv === null) return null; // a missing night is an absent dot
                const isToday = i === todayIdx;
                const inBand = d.status === "balanced";
                return (
                  <circle
                    key={d.date}
                    cx={x(i)}
                    cy={y(d.hrv)}
                    r={isToday ? DOT_R + 1.2 : DOT_R}
                    fill={
                      d.status === "unknown"
                        ? "var(--faint)"
                        : inBand && !isToday
                          ? "var(--muted)"
                          : statusColor(d.status)
                    }
                    fillOpacity={d.status === "unknown" ? 0.5 : 1}
                    stroke="var(--surface)"
                    strokeWidth={1.25}
                  />
                );
              })}
            </svg>

            {/* Tag one — today's reading, sitting beside today's mark. */}
            {today.hrv !== null ? (
              <span
                className="pointer-events-none absolute rounded-[3px] bg-[var(--surface)] px-1 font-mono text-[11px] tabular-nums text-[var(--foreground)]"
                style={{
                  right: `${width - x(todayIdx) + DOT_R + 5}px`,
                  top: `${y(today.hrv)}px`,
                  transform: "translateY(-50%)",
                }}
              >
                {Math.round(today.hrv)} ms
              </span>
            ) : (
              <span
                // Sits BELOW the band rather than on it. An opaque tag across
                // the band's right edge punches a hole in the exact shape this
                // variant exists to show, and reads as a clipping bug.
                className="pointer-events-none absolute rounded-[3px] px-1 font-mono text-[11px] text-[var(--muted)]"
                style={{
                  right: `${INSET}px`,
                  top: `${y(lastBanded.balancedLow as number) + 6}px`,
                }}
              >
                no reading yet
              </span>
            )}

            {/* Tag two — the drift, at the band's right edge. */}
            <span
              className="pointer-events-none absolute rounded-[3px] bg-[var(--surface)] px-1 font-mono text-[11px] tabular-nums"
              style={{
                right: `${INSET}px`,
                top: `${y(lastBanded.balancedHigh as number) - 15}px`,
                color: driftColor(drift.direction),
              }}
            >
              {driftTag(drift)}
            </span>
          </>
        )}
      </div>
    </MockCard>
  );
}
