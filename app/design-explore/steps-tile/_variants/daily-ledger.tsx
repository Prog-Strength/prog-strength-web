/**
 * Variant: daily-ledger  (idiom 5 of 5)
 *
 * Heroes THE LOG ITSELF — "daily log count" taken at its word. Drops the
 * chart for a compact stack of the most-recent day rows, a mini-ledger a
 * power user would actually read. Draws on Robinhood's sparkline list rows:
 * an inline per-row mini-bar + delta that turns a short list into a trend.
 *
 * - Type scale:   small functional tabular rows, no giant figure — the
 *                 weekday/count column does the work.
 * - Color logic:  the accent/success is spent ENTIRELY on the goal-delta sign
 *                 and the inline mini-bar (accent/success ▲ on a beat, muted ▼
 *                 on a miss); the rows are otherwise neutral ink.
 * - Spacing:      dense blotter, tight vertical rhythm, under a quiet
 *                 `avg · goal` header.
 *
 * Rows are most-recent-first (today at top). A zero day renders honestly as a
 * `0` with an empty bar and no delta — never a faked "unlogged" guess.
 */

import { compact } from "../../../(app)/dashboard/_components/compact";
import type { StepsFixture } from "../_fixtures";

const MET = "#86b39f";
const ROWS = 4; // most-recent N days

export function DailyLedger({ fixture }: { fixture: StepsFixture }) {
  const { days, view } = fixture;
  const { avg, goal, spark } = view;

  const hasGoal = goal !== null;
  const ceiling = Math.max(...spark, goal ?? 0) || 1;

  // newest → oldest, top N
  const rows = spark
    .map((value, i) => ({ value, day: days[i] }))
    .slice(-ROWS)
    .reverse();

  return (
    <div className="flex flex-col gap-2.5">
      {/* quiet header */}
      <div className="flex flex-wrap items-center gap-x-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">avg</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">{compact(avg)}</span>
        </span>
        <span className="text-[var(--faint)]">·</span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">goal</span>
          {hasGoal ? (
            <span className="font-mono tabular-nums text-[var(--foreground)]">{compact(goal)}</span>
          ) : (
            <span className="text-[var(--accent)]">set a goal</span>
          )}
        </span>
      </div>

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {rows.map(({ value, day }, idx) => {
          const zero = value === 0;
          const met = hasGoal && value >= goal;
          const delta = hasGoal ? value - goal : 0;
          const barColor = zero
            ? "transparent"
            : hasGoal
              ? met
                ? MET
                : "var(--surface-3)"
              : "var(--surface-3)";
          return (
            <div key={idx} className="flex items-center gap-2 py-1">
              <span className="w-4 text-[11px] font-medium text-[var(--muted)]">{day}</span>
              <span className="w-12 font-mono text-xs tabular-nums text-[var(--foreground)]">
                {zero ? "—" : compact(value)}
              </span>
              {/* inline mini-bar — the Robinhood row texture */}
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min((value / ceiling) * 100, 100)}%`,
                    backgroundColor: barColor,
                  }}
                />
              </div>
              {/* goal-delta sign — where the accent/success is spent */}
              {hasGoal && !zero ? (
                <span
                  className="w-14 text-right font-mono text-[11px] tabular-nums"
                  style={{ color: met ? MET : "var(--faint)" }}
                >
                  {met ? "▲" : "▼"} {delta >= 0 ? "+" : "−"}
                  {compact(Math.abs(delta))}
                </span>
              ) : (
                <span className="w-14 text-right text-[11px] text-[var(--faint)]">·</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
