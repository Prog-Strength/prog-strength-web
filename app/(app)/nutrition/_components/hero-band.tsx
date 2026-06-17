"use client";

import type { MacroGoals } from "@/lib/api";
import { MACRO_COLORS } from "@/lib/macro-colors";
import { formatNumber } from "@/lib/format";

/**
 * Hero band for the Nutrition Today view — the oversized "how's my day?"
 * readout that crowns the page. One large violet calories ring sits beside
 * three big, tinted macro numerals (protein / carbs / fat), each backed by a
 * thin budget bar.
 *
 * Calories deliberately has no macro color: it uses the page accent (violet)
 * here, mirroring the deliberate non-allocation in lib/macro-colors.ts.
 *
 * Two behaviors worth flagging up front, both shared via `macroStatus` so the
 * ring and the three macros agree on over/under:
 *   - Over-goal flip: when consumed > goal we recolor the fill (ring stroke /
 *     macro numeral / budget bar) to --warning and surface an explicit
 *     over-by readout. The arc/bar sweep still caps at 100% — the warning
 *     color, not an overflowing arc, signals the overage.
 *   - Goals-never-set degrade: when goals were never saved (created_at is
 *     null) we strip every goal-relative affordance (track fill, "left"/"%"
 *     captions, "/goal" sublabels) and show only the consumed numerals, plus
 *     an inviting prompt to set goals.
 */

/**
 * Shared goal-progress math for both the calories ring and the macros, so the
 * over/under logic can't drift between them.
 *   - hasGoal: a goal of 0 (or unset) means "no target to compare against".
 *   - pct: integer percent of goal consumed (0 when there's no goal).
 *   - over: strictly past the goal (only meaningful when a goal exists).
 */
function macroStatus(
  value: number,
  goal: number,
): { pct: number; over: boolean; hasGoal: boolean } {
  const hasGoal = goal > 0;
  const pct = hasGoal ? Math.round((value / goal) * 100) : 0;
  const over = hasGoal && value > goal;
  return { pct, over, hasGoal };
}

export function HeroBand({
  totals,
  goals,
  onEditGoals,
}: {
  totals: { calories: number; protein_g: number; fat_g: number; carbs_g: number };
  goals: MacroGoals;
  /** Opens the page's MacroGoalsModal. */
  onEditGoals: () => void;
}) {
  // Goals are "set" only once they've been saved at least once (the API
  // returns a null created_at until then). This single flag drives the
  // goals-never-set degrade across the ring, the macros, and the prompt.
  const goalsSet = goals.created_at !== null;

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8 shadow-[var(--shadow-soft)] sm:px-8 sm:py-10">
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-14">
        {/* Calories ring — left/top. Stays violet (page accent); no macro
            color, by design. */}
        <CaloriesRing consumed={totals.calories} goal={goals.calories} goalsSet={goalsSet} />

        {/* Big macro numerals — the tints carry the hero. Order: P, C, F. */}
        <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-3">
          <HeroMacro
            label="Protein"
            value={totals.protein_g}
            goal={goals.protein_g}
            tint={MACRO_COLORS.protein}
            goalsSet={goalsSet}
          />
          <HeroMacro
            label="Carbs"
            value={totals.carbs_g}
            goal={goals.carbs_g}
            tint={MACRO_COLORS.carbs}
            goalsSet={goalsSet}
          />
          <HeroMacro
            label="Fat"
            value={totals.fat_g}
            goal={goals.fat_g}
            tint={MACRO_COLORS.fat}
            goalsSet={goalsSet}
          />
        </div>
      </div>

      {/* Goals-never-set prompt — an inviting nudge to commit to targets, so
          the hero has a clear next action before any goal exists. */}
      {!goalsSet && (
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-[var(--border)] pt-6 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-[var(--muted)]">
            Set targets for protein, carbs, fat, and calories to see how close today is.
          </p>
          <button
            type="button"
            onClick={onEditGoals}
            className="shrink-0 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-fg)]"
          >
            Set your goals
          </button>
        </div>
      )}
    </section>
  );
}

/**
 * Large hand-rolled SVG donut for calories, scaled up from the same ring
 * geometry the page has always used so the hero reads from across the room.
 * The fill arc is violet (page accent); the centered overlay carries the
 * numerals.
 */
function CaloriesRing({
  consumed,
  goal,
  goalsSet,
}: {
  consumed: number;
  goal: number;
  goalsSet: boolean;
}) {
  const { pct, over, hasGoal } = macroStatus(consumed, goal);
  // Show the ring's goal-relative affordances only once goals exist AND this
  // particular goal is non-zero.
  const showGoal = goalsSet && hasGoal;

  const size = 240;
  const r = 104;
  const stroke = 18;
  const c = 2 * Math.PI * r;
  // Sweep caps at 100% — the over-goal state is signaled by the warning color
  // flip below, not by an arc that wraps past full.
  const filled = Math.min(pct / 100, 1);

  const consumedRounded = Math.round(consumed);
  const goalRounded = Math.round(goal);
  // Over-goal: recolor the fill stroke + badge to --warning. See file header.
  const fillColor = over ? "var(--warning)" : "var(--accent)";
  const remaining = over ? consumedRounded - goalRounded : goalRounded - consumedRounded;

  return (
    <div className="relative shrink-0">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          showGoal
            ? `Calories ${consumedRounded} of ${goalRounded} kcal, ${pct}% of goal`
            : `Calories ${consumedRounded} kcal`
        }
      >
        {/* Track. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth={stroke}
        />
        {/* Filled arc — rotated -90° so it starts at 12 o'clock. Only drawn
            once a goal exists; otherwise the bare track stands in for the
            empty state. */}
        {showGoal && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={fillColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>

      {/* Centered overlay. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl font-extrabold leading-none tabular-nums tracking-tight">
          {consumedRounded}
        </span>
        {showGoal && (
          <span className="mt-1 text-sm font-semibold text-[var(--muted)] tabular-nums">
            of {goalRounded} kcal
          </span>
        )}
        {showGoal && (
          <span
            className="mt-3 rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold tabular-nums"
            style={{ color: over ? "var(--warning)" : "var(--muted)" }}
          >
            {over ? `over by ${remaining}` : `${remaining} left`}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * One big tinted macro numeral with a thin budget bar. Rendered 3× (protein,
 * carbs, fat). The tint carries the identity; --warning takes over on the
 * over-goal flip.
 */
function HeroMacro({
  label,
  value,
  goal,
  tint,
  goalsSet,
}: {
  label: string;
  value: number;
  goal: number;
  tint: string;
  goalsSet: boolean;
}) {
  const { pct, over, hasGoal } = macroStatus(value, goal);
  const showGoal = goalsSet && hasGoal;
  // Over-goal flips the numeral, the bar fill, and the caption to --warning.
  const color = over ? "var(--warning)" : tint;

  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--faint)]">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="text-5xl font-extrabold leading-none tabular-nums tracking-tight"
          style={{ color }}
        >
          {formatNumber(value)}
        </span>
        {showGoal && (
          <span className="text-base font-bold text-[var(--faint)] tabular-nums">
            /{formatNumber(goal)}g
          </span>
        )}
      </div>

      {/* Thin budget bar. Track always renders; the fill is omitted in the
          goals-never-set state so the empty track reads as "a goal goes here". */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        {showGoal && (
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              backgroundColor: color,
            }}
          />
        )}
      </div>

      {showGoal && (
        <span
          className="mt-1.5 text-xs font-bold tabular-nums"
          style={{ color: over ? "var(--warning)" : "var(--muted)" }}
        >
          {pct}%{over ? " · OVER" : ""}
        </span>
      )}
    </div>
  );
}
