/**
 * MacroBar — a thin progress bar for one macro (protein / carbs / fat /
 * calories) on the nutrition mini-card.
 *
 * Each macro keys its own token pair (`--macro-protein` / `-bg`, etc.). When
 * a `goal` is set the fill shows today's value as a share of the goal
 * (clamped 0–100%) and the meta reads "today / goal kind". When `goal` is
 * null the bar degrades to a calm "set a goal" affordance: a faint track and
 * a muted invitation rather than a misleading full/empty fill.
 */

import { compact } from "./compact";

export type MacroKind = "protein" | "carbs" | "fat" | "calories";

const TOKENS: Record<MacroKind, { fill: string; track: string; label: string; unit: string }> = {
  protein: {
    fill: "var(--macro-protein)",
    track: "var(--macro-protein-bg)",
    label: "Protein",
    unit: "g",
  },
  carbs: { fill: "var(--macro-carb)", track: "var(--macro-carb-bg)", label: "Carbs", unit: "g" },
  fat: { fill: "var(--macro-fat)", track: "var(--macro-fat-bg)", label: "Fat", unit: "g" },
  calories: {
    fill: "var(--macro-protein)",
    track: "var(--macro-protein-bg)",
    label: "Calories",
    unit: "",
  },
};

export function MacroBar({
  kind,
  value,
  goal,
  className,
}: {
  kind: MacroKind;
  value: number;
  goal: number | null;
  className?: string;
}) {
  const token = TOKENS[kind];
  const hasGoal = goal !== null && Number.isFinite(goal) && goal > 0;
  const safeValue = Number.isFinite(value) ? value : 0;
  const pct = hasGoal ? Math.max(0, Math.min(100, (safeValue / goal) * 100)) : 0;

  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-[var(--muted)]">{token.label}</span>
        {hasGoal ? (
          <span className="font-mono tabular-nums text-[var(--foreground)]">
            {compact(safeValue)}
            <span className="text-[var(--faint)]"> / {compact(goal)}</span>
            {token.unit ? ` ${token.unit}` : ""}
          </span>
        ) : (
          <span className="italic text-[var(--muted)]">set a goal</span>
        )}
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full"
        style={{ backgroundColor: token.track }}
        role="progressbar"
        aria-label={token.label}
        aria-valuenow={hasGoal ? Math.round(pct) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {hasGoal && (
          <div
            className="h-full rounded-full transition-[width]"
            style={{ width: `${pct}%`, backgroundColor: token.fill }}
          />
        )}
      </div>
    </div>
  );
}
