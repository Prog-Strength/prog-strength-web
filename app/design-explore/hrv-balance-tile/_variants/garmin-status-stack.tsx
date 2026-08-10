/**
 * IDIOM: garmin-status-stack — "give me Garmin's card, in our language."
 *
 * Heroes the VERDICT, in four hairline-separated registers, translating Garmin
 * Connect's HRV Status card structurally register for register: status word →
 * big stable figure → distribution gauge → compact chart.
 *
 *   Type scale   one ~28px figure over three registers that never exceed 13px.
 *   Colour logic the DOTS and the GAUGE carry status; the band stays neutral.
 *                Garmin's saturated red/orange/green is re-toned to the
 *                system's desaturated statuses — importing their traffic light
 *                is the obvious trap here and is deliberately not taken.
 *   Spacing      four hairline-separated horizontal registers, tight and even.
 *
 * The deliberate disagreement with the shipped tile: the big figure is the
 * 7-DAY AVERAGE, not last night. Garmin heroes the stable number precisely
 * because one night of RMSSD is noise, and that is worth testing head-on. It
 * also means this variant still prints a headline figure at 7am, before the
 * morning webhook has landed.
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
  statusWord,
  useMeasuredWidth,
} from "../_util";

const CHART_H = 62;
const DOT_R = 2.6;

export function GarminStatusStack({ view }: { view: RecoveryView }) {
  const p = prepare(view);
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  if (!p) {
    return (
      <MockCard>
        <CalibratingBody nights={view.baseline?.hrvDays ?? 0} />
      </MockCard>
    );
  }

  const { days, baseline, hrv, drift, today, domain } = p;
  const sd = baseline.hrvStdDev as number;
  const base = baseline.hrvAvg as number;
  const hasReading = today.hrv !== null;

  // Where the 7-day average sits on the athlete's own SD scale. This PLOTS
  // three server figures against each other; it derives none of them.
  const shortZ = hrv.shortAvg !== null ? (hrv.shortAvg - base) / sd : null;
  const tickPct = shortZ === null ? null : Math.min(100, Math.max(0, ((shortZ + 2) / 4) * 100));

  const y = scaler(domain, DOT_R, CHART_H - DOT_R * 2);
  const x = (i: number) => (i / Math.max(1, days.length - 1)) * width;

  return (
    <MockCard>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {/* 1 — the verdict. A status dot and a word, nothing else. */}
        <div className="flex items-center justify-between gap-2 pb-2.5">
          <div className="flex items-center gap-2">
            <span
              className="h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: statusColor(today.status) }}
            />
            <span className="text-[13px] font-medium text-[var(--foreground)]">
              {statusWord(today.status, hasReading)}
            </span>
          </div>
          <span
            className="font-mono text-[11px] tabular-nums"
            style={{ color: driftColor(drift.direction) }}
          >
            {driftTag(drift)}
          </span>
        </div>

        {/* 2 — the stable figure. Garmin heroes the 7-day mean, not last night. */}
        <div className="py-2.5">
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
              {hrv.shortAvg !== null ? Math.round(hrv.shortAvg) : "—"}
            </span>
            <span className="text-xs font-medium text-[var(--muted)]">ms</span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            7d avg
          </div>
        </div>

        {/* 3 — the distribution gauge: this athlete's own −2/−1/+1/+2 SD zones. */}
        <div className="py-2.5">
          <div className="relative">
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
                className="absolute top-[-3px] h-[14px] w-[2px] rounded-full bg-[var(--foreground)]"
                style={{ left: `${tickPct}%`, transform: "translateX(-1px)" }}
              />
            )}
          </div>
          <div className="relative mt-1.5 h-[11px]">
            <span
              className="absolute font-mono text-[9px] tabular-nums text-[var(--faint)]"
              style={{ left: "25%", transform: "translateX(-50%)" }}
            >
              {Math.round(hrv.balancedLow as number)}
            </span>
            <span
              className="absolute font-mono text-[9px] tabular-nums text-[var(--faint)]"
              style={{ left: "75%", transform: "translateX(-50%)" }}
            >
              {Math.round(hrv.balancedHigh as number)}
            </span>
          </div>
        </div>

        {/* 4 — the compact 30-day scatter, band neutral, dots carrying status. */}
        <div ref={ref} className="pt-2.5">
          {width > 0 && (
            <svg
              width={width}
              height={CHART_H}
              viewBox={`0 0 ${width} ${CHART_H}`}
              className="block"
              role="img"
              aria-label="Thirty nights of HRV against a baseline band that drifts"
            >
              {/* Neutral drifting band — one polygon per unbroken run. */}
              {bandRuns(days).map((run, k) => {
                const top = run.map(({ i, d }) => `${x(i)},${y(d.balancedHigh as number)}`);
                const bottom = run
                  .slice()
                  .reverse()
                  .map(({ i, d }) => `${x(i)},${y(d.balancedLow as number)}`);
                return (
                  <polygon
                    key={k}
                    points={[...top, ...bottom].join(" ")}
                    fill="var(--surface-3)"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                  />
                );
              })}
              {/* One mark per night. A missing night is simply an absent dot. */}
              {days.map((d, i) =>
                d.hrv === null ? null : (
                  <circle
                    key={d.date}
                    cx={x(i)}
                    cy={y(d.hrv)}
                    r={i === days.length - 1 ? DOT_R + 1 : DOT_R}
                    fill={d.status === "balanced" ? "var(--muted)" : statusColor(d.status)}
                    fillOpacity={d.status === "unknown" ? 0.45 : 1}
                    stroke="var(--surface)"
                    strokeWidth={1}
                  />
                ),
              )}
            </svg>
          )}
        </div>
      </div>
    </MockCard>
  );
}
