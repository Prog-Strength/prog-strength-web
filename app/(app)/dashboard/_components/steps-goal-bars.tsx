/**
 * StepsGoalBars — the dashboard Steps tile's goal-relative bar chart.
 *
 * Replaces the min/max-normalized `Spark` for steps: seven slim daily bars
 * drawn on ONE linear scale (ceiling = max(goal, maxDay) × headroom), a
 * dominant dashed goal line and a fainter average line at their scaled
 * heights, and color used as goal-state (over-goal success, under muted,
 * today the accent) rather than decoration. In-system to design-system v0.4
 * — reads `--success` / `--muted` / `--accent` / `--border`, never raw hex.
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

/** Per-tone bar fill. `empty` slots render only a faint track (no fill). */
const BAR_COLOR: Record<Exclude<StepsBarTone, "empty">, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  muted: "var(--muted)",
};

/**
 * The steps tile's goal-relative bar week. Swaps 1:1 for `<Spark>` inside
 * `StepsCard`, keeping the tile's rhythm and ~180px budget. Presentational
 * and pure — all layout math is in `buildStepsGoalBars`.
 */
export function StepsGoalBars({
  spark,
  avg,
  goal,
}: {
  spark: number[];
  avg: number;
  goal: number | null;
}) {
  const model = buildStepsGoalBars(spark, avg, goal);

  return (
    <div
      className="relative h-12 w-full"
      role="img"
      aria-label="Daily steps versus goal, last seven days"
    >
      {/* Average line — quiet, thin, behind the bars. */}
      {model.avgPct !== null && (
        <div
          data-testid="steps-avg-line"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-0 border-t border-[var(--muted)]/60"
          style={{ bottom: `${model.avgPct}%` }}
        />
      )}

      {/* Bars — a seven-column floor-anchored row. */}
      <div className="absolute inset-0 z-10 flex items-end gap-[3px]">
        {model.slots.map((slot, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            {slot.tone === "empty" ? (
              <div
                data-testid="steps-bar"
                data-tone="empty"
                aria-hidden="true"
                className="w-full rounded-sm bg-[var(--border)]"
                style={{ height: "2px" }}
              />
            ) : (
              <div
                data-testid="steps-bar"
                data-tone={slot.tone}
                aria-hidden="true"
                className="w-full rounded-sm"
                style={{
                  height: `${slot.heightPct}%`,
                  minHeight: "2px",
                  backgroundColor: BAR_COLOR[slot.tone],
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Goal line — dominant, dashed, in front of the bars. */}
      {model.goalPct !== null && (
        <div
          data-testid="steps-goal-line"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-20 border-t border-dashed border-[var(--success)]"
          style={{ bottom: `${model.goalPct}%` }}
        />
      )}
    </div>
  );
}
