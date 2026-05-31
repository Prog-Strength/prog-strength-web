"use client";

import type { MacroGoals } from "@/lib/api";

// Per-macro accent colors lifted from the legacy MacroSummary tiles
// so the visual language of "this is the protein number" carries over
// from the prior design. Calories stays neutral (foreground) because
// it was the headline tile and read white before.
//
// Tailwind palette hex values, inlined: SVG attributes can't accept
// Tailwind class names, and the page consumes these as both SVG
// stroke colors and CSS variables for the surrounding text. Keeping
// them in one place means the ring stroke and the macro label share
// the same exact pixel.
const COLORS = {
  protein: "#6ee7b7", // emerald-300
  carbs: "#fcd34d", // amber-300
  fat: "#f9a8d4", // pink-300
  calories: "var(--foreground)",
} as const;

/**
 * Four ring charts — one per macro (protein, carbs, fat, calories) —
 * showing today's intake as an arc filling 0–100% of the user's goal.
 * As of the tile-removal pass, the rings are also the sole macro
 * readout on the Nutrition Today view; the old MacroSummary tiles
 * were folded into the ring labels (intake / goal numbers under each
 * ring).
 *
 * Empty state: when goals were never set (the API returns null
 * `created_at`), or any individual goal is 0, that ring renders as a
 * grey outline with no arc fill. The intake number still shows
 * underneath so users without goals can still see "what I ate today"
 * before they commit to targets.
 *
 * Over-goal display: per the SOW's open-question lean (b), the arc
 * caps at 100% but the text label below the ring reads the true
 * percentage in amber. Amber stays the warning color regardless of
 * the macro's own color — it's a state indicator, not a category
 * indicator, so the contrast against the ring's identity color is
 * the point.
 *
 * Hand-rolled SVG donut. ~30 lines for the geometry — pulling in
 * recharts' RadialBarChart is overkill for four trivially-shaped
 * rings.
 */
export function MacroGoalRings({
  totals,
  goals,
}: {
  totals: {
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    calories: number;
  };
  goals: MacroGoals;
}) {
  const goalsAreSet = goals.created_at !== null;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        Today
      </h2>

      {!goalsAreSet && (
        <p className="mb-3 text-xs text-[var(--muted)]">
          Set targets for protein, carbs, fat, and calories to see how
          close today is.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Ring
          label="Calories"
          unit="kcal"
          intake={totals.calories}
          goal={goals.calories}
          color={COLORS.calories}
        />
        <Ring
          label="Protein"
          unit="g"
          intake={totals.protein_g}
          goal={goals.protein_g}
          color={COLORS.protein}
        />
        <Ring
          label="Carbs"
          unit="g"
          intake={totals.carbs_g}
          goal={goals.carbs_g}
          color={COLORS.carbs}
        />
        <Ring
          label="Fat"
          unit="g"
          intake={totals.fat_g}
          goal={goals.fat_g}
          color={COLORS.fat}
        />
      </div>
    </section>
  );
}

function Ring({
  label,
  unit,
  intake,
  goal,
  color,
}: {
  label: string;
  unit: string;
  intake: number;
  goal: number;
  // Hex string or CSS variable reference. Used as the SVG arc stroke,
  // the inner percent-text fill, and the macro label below.
  color: string;
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
        {/* Track — same color as the arc, dimmed via stroke-opacity
            so the unfilled portion of each ring still carries the
            macro's identity rather than reading as inert border. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeOpacity={0.2}
          strokeWidth={stroke}
        />
        {/* Filled arc — rotated -90° so it starts at 12 o'clock. */}
        {goal > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled * circumference} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
        {/* Inner percentage text — colored to match the arc so the
            ring reads as a single visual unit. Empty-state ("—")
            stays muted via the no-goal branch on `pctText`. */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill={goal > 0 ? color : "var(--muted)"}
          className="tabular-nums"
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
