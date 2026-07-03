/**
 * Variant: dual-baseline-editorial  (idiom 3 of 5)
 *
 * Heroes THE AVERAGE — the headline health metric made to feel like the
 * headline. Draws on The Athletic's authored headline-figure layout: one
 * oversized number with a small caption, the chart demoted to a captioned
 * figure. The most literal take on "goal and average clearly displayed."
 *
 * - Type scale:   dramatic big/small contrast — a huge tabular `13.1k` over a
 *                 tiny "avg / day · this week" caption; today is demoted to a
 *                 small delta chip (`today 16k ▲`).
 * - Color logic:  near-monochrome ink-on-dark. The accent is reserved for the
 *                 AVERAGE baseline; success touches only the goal line / the
 *                 crest above it. Bars themselves are faint and neutral — the
 *                 two reference LINES carry the meaning, not the bars.
 * - Spacing:      airier, editorial — the figure breathes, the figure-caption
 *                 sits beneath a slim two-baseline chart.
 *
 * The big number is the SERVER `avg`, shown as-is (never recomputed from the
 * week, which averages to a different figure over a different window).
 */

import { compact } from "../../../(app)/dashboard/_components/compact";
import type { StepsFixture } from "../_fixtures";

const CHART_H = 42;

export function DualBaselineEditorial({ fixture }: { fixture: StepsFixture }) {
  const { view } = fixture;
  const { today, avg, goal, spark } = view;

  const ceiling = Math.max(...spark, avg, goal ?? 0) * 1.08 || 1;
  const y = (v: number) => (1 - v / ceiling) * CHART_H;
  const avgAboveGoal = goal !== null && avg >= goal;
  const todayDelta = today - avg;

  return (
    <div className="flex flex-col gap-3">
      {/* The one number that matters, oversized. */}
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[2.6rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
          {compact(avg)}
        </span>
        <span className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
          avg / day · this week
        </span>
      </div>

      {/* today, demoted to an editorial delta chip */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--muted)]">today</span>
        <span className="font-mono text-xs tabular-nums text-[var(--foreground)]">
          {compact(today)}
        </span>
        <span
          className="text-xs"
          style={{ color: todayDelta >= 0 ? "var(--accent)" : "var(--faint)" }}
        >
          {todayDelta >= 0 ? "▲" : "▼"} {compact(Math.abs(todayDelta))}
        </span>
      </div>

      {/* Slim figure: faint bars, two labelled baselines (avg = accent, goal = success). */}
      <div className="relative" style={{ height: CHART_H }}>
        <div className="absolute inset-0 flex items-end justify-between gap-[3px]">
          {spark.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-[1px] bg-[var(--foreground)]"
              style={{ height: Math.max((v / ceiling) * CHART_H, v > 0 ? 2 : 0), opacity: 0.14 }}
            />
          ))}
        </div>
        {/* average baseline — the hero reference, in the accent */}
        <div
          className="absolute inset-x-0 border-t"
          style={{ top: y(avg), borderColor: "var(--accent)" }}
          aria-hidden
        />
        {/* goal baseline — success, only when a goal exists */}
        {goal !== null && (
          <div
            className="absolute inset-x-0 border-t border-dashed"
            style={{ top: y(goal), borderColor: "var(--success)" }}
            aria-hidden
          />
        )}
      </div>

      <div className="flex items-center gap-x-3 text-[11px]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-3 bg-[var(--accent)]" />
          <span className="text-[var(--muted)]">avg</span>
        </span>
        {goal !== null ? (
          <span className="flex items-center gap-1">
            <span className="inline-block h-[2px] w-3 bg-[var(--success)]" />
            <span className="text-[var(--muted)]">
              goal {compact(goal)}
              {avgAboveGoal ? " — above" : ""}
            </span>
          </span>
        ) : (
          <span className="text-[var(--accent)]">set a goal</span>
        )}
      </div>
    </div>
  );
}
