"use client";

import type { MacroGoals } from "@/lib/api";

/**
 * Four ring charts — one per macro (protein, carbs, fat, calories) —
 * showing today's intake as an arc filling 0–100% of the user's goal.
 *
 * Empty state: when goals were never set (the API returns null
 * `created_at`), or any individual goal is 0, that ring renders as a
 * grey outline with no fill text. We deliberately do not show "0%
 * of 0" math; the SOW calls that out as misleading.
 *
 * Over-goal display: per the SOW's open-question lean (b), the arc
 * caps at 100% but the text label below the ring reads the true
 * percentage in the warning color. Lets the user see the truth while
 * keeping the visual readable.
 *
 * Hand-rolled SVG donut. ~30 lines for the geometry — pulling in
 * recharts' RadialBarChart is overkill for four trivially-shaped
 * rings.
 */
export function MacroGoalRings({
  totals,
  goals,
  onSetGoals,
}: {
  totals: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    calories: number;
  };
  goals: MacroGoals;
  onSetGoals: () => void;
}) {
  const goalsAreSet = goals.created_at !== null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Daily goals
        </h2>
        <button
          type="button"
          onClick={onSetGoals}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs hover:opacity-80"
        >
          {goalsAreSet ? "Edit goals" : "Set goals"}
        </button>
      </div>

      {!goalsAreSet && (
        <p className="mb-3 text-xs text-[var(--muted)]">
          Set targets for protein, carbs, fat, and calories to see how
          close today is.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Ring label="Protein" unit="g" intake={totals.protein_g} goal={goals.protein_g} />
        <Ring label="Carbs" unit="g" intake={totals.carbs_g} goal={goals.carbs_g} />
        <Ring label="Fat" unit="g" intake={totals.fat_g} goal={goals.fat_g} />
        <Ring label="Calories" unit="kcal" intake={totals.calories} goal={goals.calories} />
      </div>
    </section>
  );
}

function Ring({
  label,
  unit,
  intake,
  goal,
}: {
  label: string;
  unit: string;
  intake: number;
  goal: number;
}) {
  // Geometry: 56-radius circle on a 128×128 canvas. Stroke width 14
  // keeps the inner hole readable for the numeric text. The track
  // (background ring) sits at the same radius in a faint colour so
  // the empty state still reads as "a goal could go here."
  const size = 128;
  const radius = 56;
  const stroke = 14;
  const circumference = 2 * Math.PI * radius;

  const ratio = goal > 0 ? intake / goal : 0;
  const filled = Math.min(ratio, 1);
  const over = ratio > 1;
  const pctText =
    goal > 0 ? `${Math.round(ratio * 100)}%` : "—";

  // Round to one decimal for grams; calories are integer-shaped.
  const intakeText = unit === "g"
    ? `${formatGrams(intake)} g`
    : `${Math.round(intake)} kcal`;
  const goalText = goal > 0
    ? unit === "g"
      ? `${goal} g`
      : `${goal} kcal`
    : "—";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${intakeText} of ${goalText}`}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        {/* Filled arc — rotated -90° so it starts at 12 o'clock. */}
        {goal > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        {/* Inner percentage text */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="fill-[var(--foreground)] tabular-nums"
          style={{ fontSize: "18px", fontWeight: 600 }}
        >
          {pctText}
        </text>
      </svg>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      <p className="text-xs tabular-nums">
        {intakeText} <span className="text-[var(--muted)]">/ {goalText}</span>
      </p>
      {over && (
        <p
          className="text-[10px] font-semibold text-amber-300 tabular-nums"
          aria-label="Over goal"
        >
          {Math.round(ratio * 100)}% of goal
        </p>
      )}
    </div>
  );
}

function formatGrams(n: number): string {
  // Avoid "180.0" for clean integers; round to one decimal otherwise.
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
