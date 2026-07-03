/**
 * StepsGoalBars — the dashboard Steps tile's goal-relative bar chart.
 *
 * Replaces the min/max-normalized `Spark` for steps: seven slim daily bars
 * drawn on ONE linear scale (ceiling = max(goal, maxDay) × headroom), a
 * dominant dashed goal line and a fainter average line at their scaled
 * heights, and color used as goal-state (over-goal success, under muted,
 * today the accent) rather than decoration. In-system to design-system v0.4
 * — reads `--success` / `--muted` / `--accent` / `--faint`, never raw hex.
 *
 * `buildStepsGoalBars` is the pure render model; the component only draws it.
 */

const SLOTS = 7;
const HEADROOM = 1.1; // lift the ceiling above the tallest reference so an
// over-goal day crests the goal line and the top bar isn't pinned to the frame.

/** One of the seven day slots. `empty` = no data for that slot (a padded,
 * pre-history day) — a quiet track, distinct from a logged `0` floor bar. */
export type StepsBarTone = "accent" | "success" | "muted" | "empty";

export type StepsBarSlot = {
  steps: number | null;
  heightPct: number;
  tone: StepsBarTone;
  isToday: boolean;
};

export type StepsGoalBarsModel = {
  slots: StepsBarSlot[];
  goalPct: number | null;
  avgPct: number | null;
  hasGoal: boolean;
};

/**
 * Derive the seven-slot render model from the three values the tile already
 * holds. Pure and null-safe: no goal → no goal line and no over/under split;
 * all-zero / empty → a flat floor with no divide-by-zero or NaN.
 */
export function buildStepsGoalBars(
  spark: number[],
  avg: number,
  goal: number | null,
): StepsGoalBarsModel {
  const clean = (spark ?? []).map((n) => (Number.isFinite(n) ? n : 0));
  const recent = clean.slice(-SLOTS);
  const pad = SLOTS - recent.length;
  const values: (number | null)[] = [...Array(pad).fill(null), ...recent];

  const hasGoal = goal !== null && goal > 0;
  const maxDay = recent.length ? Math.max(...recent) : 0;
  const base = Math.max(hasGoal ? (goal as number) : 0, maxDay, 0);
  const ceiling = base > 0 ? base * HEADROOM : 0;
  const scale = (v: number) => (ceiling > 0 ? Math.min(100, Math.max(0, (v / ceiling) * 100)) : 0);

  const slots: StepsBarSlot[] = values.map((steps, i) => {
    const isToday = i === SLOTS - 1 && steps !== null;
    let tone: StepsBarTone;
    if (steps === null) {
      tone = "empty";
    } else if (isToday) {
      tone = "accent";
    } else if (hasGoal && steps >= (goal as number)) {
      tone = "success";
    } else {
      tone = "muted";
    }
    return { steps, heightPct: steps === null ? 0 : scale(steps), tone, isToday };
  });

  return {
    slots,
    goalPct: hasGoal ? scale(goal as number) : null,
    avgPct: Number.isFinite(avg) && ceiling > 0 ? scale(avg) : null,
    hasGoal,
  };
}
