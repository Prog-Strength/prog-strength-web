/**
 * Variant: goal-hit-columns  (idiom 2 of 5)
 *
 * Heroes CONSISTENCY in the shipped `StreakCard`'s own idiom (the sibling
 * tile two cells over), so it reads as one of the grid. Drops the y-axis
 * entirely — the read is "did I or didn't I," not magnitude. Draws on the
 * GitHub contribution row + Gentler Streak's on/off-target framing, and adds
 * a fact the current tile can't show at all: a `5/7 hit` attainment ratio.
 *
 * - Type scale:   modest — hierarchy comes from the `5/7` ratio and the row
 *                 of outcome cells, never one giant number.
 * - Color logic:  success-filled = day hit goal, muted = under, faint-outline
 *                 = a zero day (rendered honestly as empty, not guessed
 *                 "unlogged"). Color is the primary signal.
 * - Spacing:      tight, gridded, streak-card-consistent — a labelled row of
 *                 seven cells under `T W T F S S M`.
 *
 * Cells scale subtly by attainment (a floor so every logged day stays
 * visible) but color carries the meaning, per the ticket.
 */

import { compact } from "../../../(app)/dashboard/_components/compact";
import type { StepsFixture } from "../_fixtures";

const MET = "#86b39f"; // day at/over goal
const CELL_H = 40; // px — the tallest a cell can grow

export function GoalHitColumns({ fixture }: { fixture: StepsFixture }) {
  const { days, view } = fixture;
  const { avg, goal, spark } = view;

  const hasGoal = goal !== null;
  const hits = hasGoal ? spark.filter((v) => v >= goal).length : 0;
  const ceiling = Math.max(...spark, goal ?? 0) || 1;

  return (
    <div className="flex flex-col gap-3">
      {/* Ratio as the semi-hero — modest type, the row does the work. */}
      <div className="flex items-baseline gap-1.5">
        {hasGoal ? (
          <>
            <span className="font-mono text-xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {hits}
              <span className="text-[var(--faint)]">/{spark.length}</span>
            </span>
            <span className="text-xs font-medium text-[var(--muted)]">days at goal</span>
          </>
        ) : (
          <>
            <span className="font-mono text-xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {spark.filter((v) => v > 0).length}
              <span className="text-[var(--faint)]">/{spark.length}</span>
            </span>
            <span className="text-xs font-medium text-[var(--muted)]">days logged</span>
          </>
        )}
      </div>

      <div className="flex items-end justify-between gap-1.5" style={{ height: CELL_H }}>
        {spark.map((v, i) => {
          const zero = v === 0;
          const met = hasGoal && v >= goal;
          // subtle scale by attainment, floored so a logged day is always seen
          const h = zero ? CELL_H : Math.max((v / ceiling) * CELL_H, 12);
          const bg = zero
            ? "transparent"
            : hasGoal
              ? met
                ? MET
                : "var(--surface-3)"
              : "var(--surface-3)";
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-[3px]"
                style={{
                  height: h,
                  backgroundColor: bg,
                  border: zero ? "1px dashed var(--border-strong)" : "none",
                  opacity: met ? 1 : 0.9,
                }}
                title={`${days[i]} · ${compact(v)}`}
              />
              <span className="text-[10px] font-medium text-[var(--faint)]">{days[i]}</span>
            </div>
          );
        })}
      </div>

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
    </div>
  );
}
