/**
 * Variant: micro-bars-goal-line  (idiom 1 of 5)
 *
 * Heroes TODAY against a per-day bar week — the most literal answer to the
 * brief and a faithful shrink of the deep Steps page's own goal-relative bars.
 * Draws on Apple Fitness / Gentler Streak's goal-relative day treatment.
 *
 * - Type scale:   one big tabular "16k today" figure over a row of tiny bars.
 * - Color logic:  success = cleared goal, muted slate = under, accent = today;
 *                 a dashed goal line is the dominant reference, a fainter line
 *                 marks the average. The accent is spent only on today's bar.
 * - Spacing:      the current tile's exact rhythm — BigNum, chart, MetaRow —
 *                 with the chart swapped 1:1 for the old normalized sparkline.
 *
 * Bars are scaled LINEARLY from zero (not min/max-normalized), so one 16k day
 * can't flatten the rest into stubs and a logged 0 renders as a floor bar.
 */

import { compact } from "../../../(app)/dashboard/_components/compact";
import type { StepsFixture } from "../_fixtures";

const MET = "#86b39f"; // CHART_STEPS_MET — day at/over goal (desaturated success)
const UNDER = "#5b6168"; // CHART_STEPS_UNDER — day under goal (muted slate)

const CHART_H = 60; // px — inside the ~180px tile budget
const PAD_TOP = 6;

export function MicroBarsGoalLine({ fixture }: { fixture: StepsFixture }) {
  const { days, view } = fixture;
  const { today, avg, goal, spark } = view;

  // Linear scale from 0 to a headroom above the tallest value (or the goal,
  // whichever is larger) so the goal line always sits on-chart.
  const ceiling = Math.max(...spark, goal ?? 0) * 1.08 || 1;
  const y = (v: number) => PAD_TOP + (1 - v / ceiling) * (CHART_H - PAD_TOP);
  const goalY = goal !== null ? y(goal) : null;
  const avgY = y(avg);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {compact(today)}
        </span>
        <span className="text-xs font-medium text-[var(--muted)]">today</span>
      </div>

      <div className="relative" style={{ height: CHART_H }}>
        {/* average reference — faint, secondary */}
        <div
          className="absolute inset-x-0 border-t border-[var(--border-strong)]"
          style={{ top: avgY }}
          aria-hidden
        />
        {/* goal reference — the dominant dashed line the days are read against */}
        {goalY !== null && (
          <div
            className="absolute inset-x-0 border-t border-dashed"
            style={{ top: goalY, borderColor: "var(--faint)" }}
            aria-hidden
          />
        )}
        <div className="absolute inset-0 flex items-end justify-between gap-[3px]">
          {spark.map((v, i) => {
            const isToday = i === spark.length - 1;
            const met = goal !== null && v >= goal;
            const color = isToday ? "var(--accent)" : goal === null ? UNDER : met ? MET : UNDER;
            const h = Math.max((v / ceiling) * (CHART_H - PAD_TOP), v > 0 ? 2 : 0);
            return (
              <div
                key={i}
                className="flex-1 rounded-[2px]"
                style={{ height: h, backgroundColor: color, minWidth: 4 }}
                title={`${days[i]} · ${compact(v)}`}
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">avg</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">{compact(avg)}</span>
        </span>
        <span className="text-[var(--faint)]">·</span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">goal</span>
          {goal !== null ? (
            <span className="font-mono tabular-nums text-[var(--foreground)]">{compact(goal)}</span>
          ) : (
            <span className="text-[var(--accent)]">set a goal</span>
          )}
        </span>
      </div>
    </div>
  );
}
