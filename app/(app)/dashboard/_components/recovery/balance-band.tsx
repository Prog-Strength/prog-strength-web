/**
 * HrvBalanceCard — the `hrv_balance` tile ("HRV Balance").
 *
 * Four hairline-separated registers, taken structurally from Garmin Connect's
 * HRV Status card and re-toned into the house tokens:
 *
 *   1. THE VERDICT — a status dot and the house word for last night, with the
 *      baseline-drift tag (`▲ +6 ms · 4w`) right-aligned against it. The status
 *      is read off `days[last]`, never off the scalar `hrv.status`, so the dot
 *      cannot disagree with the last mark on the chart below it.
 *   2. THE STABLE FIGURE — the 7-day average at 28px.
 *   3. THE GAUGE — a ±2-band-width bar with a tick where that average falls and
 *      the server's own bounds printed under the 25% and 75% boundaries.
 *   4. THE CHART — one discrete mark per night in the window, over a band
 *      POLYGON that drifts, each day drawn from the band as it stood that
 *      morning. A missing night is an absent mark, never an interpolation; a
 *      null baseline breaks the polygon rather than closing across it.
 *
 * The big figure is the 7-DAY AVERAGE, not last night, and that is the tile's
 * one deliberate disagreement with the thing it replaces. A single night of
 * RMSSD is noise — heroing it makes an ordinary week look like a seismograph.
 * It also means the card still prints a headline at 7am, before the morning
 * webhook lands: `short_avg` is computed over a window that includes today but
 * does not require it, so a missing morning leaves it intact.
 *
 * Balanced marks are `--muted`, not `--success`. Roughly two-thirds of nights
 * are balanced, and painting them green would make an ordinary month the
 * loudest card on the grid; color is spent only where a night departs from
 * normal. The band is `--surface-3` for the same reason — neutral territory,
 * carrying no status of its own.
 *
 * Nothing here recomputes a server figure. The only arithmetic is mapping an
 * already-computed millisecond value onto a pixel, which is what a chart is.
 */
"use client";

import type { RecoveryView } from "@/lib/dashboard";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { MiniCard } from "../mini-card";
import { bandRuns, gaugeTickPct, prepareHrvChart, scaler } from "./hrv-chart";
import { driftColor, driftTag, hrvStatusColor, statusWord } from "./shared";

const TITLE = "HRV Balance";
const CHART_H = 62;
const DOT_R = 2.6;
/** The largest radius drawn — today's mark. Both axes inset by it; see below. */
const R_MAX = DOT_R + 1;

export function HrvBalanceCard({ section, href }: { section: RecoveryView; href: string }) {
  // Measured first, unconditionally: the guard below is an early return, and a
  // hook called after it would run on some renders and not others.
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();

  // Guard once. `null` means the baseline is not established yet — render the
  // honest n-of-14 progress state, not a chart frame around nothing.
  const chart = prepareHrvChart(section);
  if (!chart) {
    return (
      <MiniCard title={TITLE} href={href}>
        <Calibrating nights={section.baseline?.hrvDays ?? 0} />
      </MiniCard>
    );
  }

  const { days, hrvAvg, balancedLow, balancedHigh, shortAvg, drift, today, domain } = chart;
  const tickPct = gaugeTickPct(shortAvg, hrvAvg, balancedHigh);

  // Both axes are inset by the largest radius drawn, which is today's mark. The
  // mockup — and the shipped tile — put the first and last mark's centre on the
  // box edge, so today's dot is drawn half outside the SVG and reads clipped.
  const x = (i: number) => R_MAX + (i / Math.max(1, days.length - 1)) * (width - R_MAX * 2);
  const y = scaler(domain, R_MAX, CHART_H - R_MAX * 2);

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {/* 1 — the verdict. The dot's status comes from the same day object the
            last mark is coloured from, so the two can never disagree. */}
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
              aria-label={`${days.length} nights of HRV against a baseline band that drifts`}
            >
              {/* One polygon per run of banded days — top edge left→right over
                  balancedHigh, bottom edge back over balancedLow. A ONE-DAY run
                  yields a two-point polygon, which is a line rather than a band,
                  so it is skipped; a wholly unbanded series draws none at all,
                  which is the honest rendering of "no range established yet". */}
              {bandRuns(days).map((run) => {
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
              {days.map((d, i) =>
                d.hrv === null ? null : (
                  <circle
                    key={d.date}
                    cx={x(i)}
                    cy={y(d.hrv)}
                    r={i === days.length - 1 ? DOT_R + 1 : DOT_R}
                    fill={d.status === "balanced" ? "var(--muted)" : hrvStatusColor(d.status)}
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
    </MiniCard>
  );
}

/** New-user state — no band to draw yet. Honest progress toward 14 nights. */
function Calibrating({ nights }: { nights: number }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-sm font-medium text-[var(--muted)]">Calibrating your band</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (nights / 14) * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--faint)]">
        <span className="font-mono tabular-nums text-[var(--muted)]">{nights} of 14</span> nights ·
        your normal range appears once Whoop knows your spread
      </p>
    </div>
  );
}
