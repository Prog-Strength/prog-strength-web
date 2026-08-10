/**
 * IDIOM: z-lane — "how unusual was each night, on one scale?"
 *
 * Heroes the DEVIATION and abandons the millisecond axis. Each night is plotted
 * as its own z-score against a FIXED ±1 SD corridor with a zero line through
 * the centre, so the corridor never moves and the marks do all the moving.
 *
 * The argument: once the baseline drifts, two dots at the same height in ms
 * mean different things, and only the detrended view makes a Tuesday in July
 * directly comparable to a Tuesday in August. The baseline's own movement is
 * then shown separately and honestly — a 16px strip beneath the lane carrying
 * the baseline on its own scale, so the thing the ms axis was doing implicitly
 * is stated explicitly instead of being lost.
 *
 *   Type scale   one ~18px word, 10px labels, no numeral above 13px.
 *   Colour logic an INTENSITY RAMP on the marks — muted near zero, deepening
 *                to warning as |z| grows below and to accent above — with the
 *                corridor nearly invisible. The status word is the only other
 *                coloured thing.
 *   Spacing      one dominant lane over one thin subordinate strip; strict
 *                horizontal registers, no columns.
 *
 * Draws on Whoop's deviation-from-your-own-normal framing.
 *
 * THE DELIBERATE OUTLIER in this spread. It is in the exploration because the
 * detrended view is the analytically honest one, and it is the most at risk
 * against the brief's own words — clearly establish and show the user baseline.
 * The open question the selection gate is meant to answer: does the drift strip
 * keep the baseline concrete, or does a card with no milliseconds on it stop
 * feeling like it is about me?
 *
 * Throwaway mockup — static fixtures, no live data, never promoted.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard, CalibratingBody } from "../_shell";
import { prepare, scaler, statusColor, statusWord, useMeasuredWidth } from "../_util";

const LANE_H = 146;
const STRIP_H = 16;
const DOT_R = 3.3;
const Z_DOMAIN: [number, number] = [-3, 3]; // fixed — the corridor never moves

/**
 * The intensity ramp. Muted at the baseline, deepening outward: warning below
 * (a suppressed night is information), accent above (unusual, never "extra
 * good"). Mixed from the system tokens rather than hard-coding intermediate
 * hex, so the ramp follows the palette if the palette is ever re-toned.
 */
function rampColor(z: number): string {
  const pct = Math.round(Math.min(1, Math.abs(z) / 2) * 100);
  const target = z >= 0 ? "var(--accent)" : "var(--warning)";
  return `color-mix(in srgb, ${target} ${pct}%, var(--muted))`;
}

export function ZLane({ view }: { view: RecoveryView }) {
  const p = prepare(view);
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  if (!p) {
    return (
      <MockCard>
        <CalibratingBody nights={view.baseline?.hrvDays ?? 0} />
      </MockCard>
    );
  }

  const { days, drift, today, baseline } = p;
  const y = scaler(Z_DOMAIN, DOT_R, LANE_H - DOT_R * 2);
  const plotW = Math.max(1, width - (DOT_R + 2) * 2);
  const x = (i: number) => DOT_R + 2 + (i / Math.max(1, days.length - 1)) * plotW;

  // The subordinate strip: the baseline on ITS OWN scale, so a 6 ms climb fills
  // the full 16px rather than vanishing into the millisecond range.
  const bases = days.map((d) => d.baselineAvg).filter((v): v is number => v !== null);
  const bLo = Math.min(...bases);
  const bHi = Math.max(...bases);
  const bY = scaler([bLo - 0.5, bHi + 0.5], 2, STRIP_H - 4);

  const stripRuns: string[] = [];
  let run: string[] = [];
  days.forEach((d, i) => {
    if (d.baselineAvg === null) {
      if (run.length > 1) stripRuns.push(run.join(" "));
      run = [];
    } else {
      run.push(`${x(i)},${bY(d.baselineAvg)}`);
    }
  });
  if (run.length > 1) stripRuns.push(run.join(" "));

  return (
    <MockCard>
      <div ref={ref}>
        {/* The only large type on the card. */}
        <div
          className="text-[18px] font-semibold leading-tight tracking-[-0.02em]"
          style={{ color: statusColor(today.status) }}
        >
          {statusWord(today.status, today.hrv !== null)}
        </div>

        {width > 0 && (
          <>
            <svg
              width={width}
              height={LANE_H}
              viewBox={`0 0 ${width} ${LANE_H}`}
              className="mt-1.5 block"
              role="img"
              aria-label="Each night's deviation from your own baseline, in standard deviations"
            >
              {/* The corridor — nearly invisible, and it never moves. */}
              <rect
                x={0}
                y={y(1)}
                width={width}
                height={y(-1) - y(1)}
                fill="rgba(255,255,255,0.025)"
              />
              <line
                x1={0}
                x2={width}
                y1={y(1)}
                y2={y(1)}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                x2={width}
                y1={y(-1)}
                y2={y(-1)}
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <line
                x1={0}
                x2={width}
                y1={y(0)}
                y2={y(0)}
                stroke="rgba(255,255,255,0.11)"
                strokeWidth={1}
              />
              {days.map((d, i) => {
                if (d.zScore === null) return null; // no reading, or no band yet
                const z = Math.max(Z_DOMAIN[0], Math.min(Z_DOMAIN[1], d.zScore));
                const isToday = i === days.length - 1;
                return (
                  <circle
                    key={d.date}
                    cx={x(i)}
                    cy={y(z)}
                    r={isToday ? DOT_R + 1.2 : DOT_R}
                    fill={rampColor(z)}
                    stroke="var(--surface)"
                    strokeWidth={1.25}
                  />
                );
              })}

              {/* Corridor labels last, so the furniture never disappears under a
                  mark, and haloed against the surface so it stays legible where
                  it does overlap. Anchored LEFT on purpose: today's mark always
                  sits at the right edge and is the one mark that must never be
                  covered. */}
              {[
                { z: 1, label: "+1 SD", dy: -4 },
                { z: -1, label: "−1 SD", dy: 11 },
              ].map(({ z, label, dy }) => (
                <text
                  key={label}
                  x={1}
                  y={y(z) + dy}
                  textAnchor="start"
                  className="font-mono"
                  fontSize={10}
                  fill="var(--faint)"
                  stroke="var(--surface)"
                  strokeWidth={3}
                  paintOrder="stroke"
                >
                  {label}
                </text>
              ))}
            </svg>

            {/* The subordinate strip — the baseline, kept concrete. */}
            <svg
              width={width}
              height={STRIP_H}
              viewBox={`0 0 ${width} ${STRIP_H}`}
              className="mt-2 block"
              aria-hidden="true"
            >
              <rect x={0} y={0} width={width} height={STRIP_H} fill="var(--surface-2)" rx={2} />
              {stripRuns.map((pts, k) => (
                <polyline
                  key={k}
                  points={pts}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={0.5}
                  strokeWidth={1.25}
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </>
        )}

        <div className="mt-1 flex items-baseline justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Baseline
          </span>
          <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">
            {drift.fromAvg !== null && baseline.hrvAvg !== null
              ? `${Math.round(drift.fromAvg)} → ${Math.round(baseline.hrvAvg)} ms`
              : "range not yet established"}
          </span>
        </div>
      </div>
    </MockCard>
  );
}
