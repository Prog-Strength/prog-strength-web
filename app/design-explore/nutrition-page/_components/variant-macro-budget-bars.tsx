/**
 * DX variant — idiom: macro-budget-bars  (draws on MacroFactor's energy
 * budget: consumed-vs-remaining bars and "remaining" as the headline number)
 *
 * Reframes the day as a BUDGET you spend down. Horizontal consumed-vs-
 * remaining bars replace the rings as the hero: each macro is a full-width
 * track, the filled portion in that macro's tint, the remainder a faint slate
 * track — and the REMAINING figure is the headline, not the consumed one.
 * The spread levers, all inside the design system:
 *   - type scale: mid — one confident "remaining" numeral per row, calm
 *     supporting text; less extreme than dashboard-hero, denser than timeline.
 *   - color logic: each macro tint OWNS its bar; the page is otherwise neutral.
 *   - spacing rhythm: calm, even horizontal rhythm — bars stacked and evenly
 *     gapped, a metronome down the page.
 * Over-goal (fat 132%) is the cleanest encoding of the spread: the bar
 * literally overflows its track and flips to the amber over-state.
 */
import { MACRO_COLORS } from "@/lib/macro-colors";
import {
  DAY_STRIP,
  DAY_TOTAL,
  GOALS,
  MEAL_LABEL,
  MEAL_ORDER,
  entriesForMeal,
  formatGrams,
  sumMacros,
  type MacroKey,
} from "../_fixtures";

const TINT: Record<MacroKey, string> = {
  protein: MACRO_COLORS.protein,
  carbs: MACRO_COLORS.carbs,
  fat: MACRO_COLORS.fat,
};

export function VariantMacroBudgetBars() {
  return (
    <div className="flex flex-col gap-7">
      {/* Day strip — minimal, the budget hero owns the attention. */}
      <div className="flex items-center justify-center gap-2 sm:justify-start">
        {DAY_STRIP.map((d) => (
          <div
            key={d.dom}
            className={
              d.selected
                ? "flex h-12 w-11 flex-col items-center justify-center rounded-xl border border-[var(--accent-line)] bg-[var(--accent-soft)]"
                : "flex h-12 w-11 flex-col items-center justify-center rounded-xl text-[var(--faint)]"
            }
          >
            <span className="text-[9px] font-bold tracking-widest">{d.label}</span>
            <span className="text-sm font-bold tabular-nums">{d.dom}</span>
          </div>
        ))}
      </div>

      {/* BUDGET HERO — stacked spend-down bars, "remaining" headlined. */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-7 py-7 shadow-[var(--shadow-soft)]">
        <p className="mb-6 text-xs font-bold uppercase tracking-widest text-[var(--faint)]">
          Tuesday, Jun 16 · budget remaining
        </p>
        <div className="flex flex-col gap-6">
          <BudgetBar
            label="Calories"
            consumed={DAY_TOTAL.calories}
            goal={GOALS.calories}
            unit="kcal"
            tint="var(--foreground)"
          />
          <BudgetBar
            label="Protein"
            consumed={DAY_TOTAL.protein_g}
            goal={GOALS.protein_g}
            unit="g"
            tint={TINT.protein}
          />
          <BudgetBar
            label="Carbs"
            consumed={DAY_TOTAL.carbs_g}
            goal={GOALS.carbs_g}
            unit="g"
            tint={TINT.carbs}
          />
          <BudgetBar
            label="Fat"
            consumed={DAY_TOTAL.fat_g}
            goal={GOALS.fat_g}
            unit="g"
            tint={TINT.fat}
          />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-fg)]">
          + Quick Add
        </button>
        <button className="rounded-full border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)]">
          Edit Macros
        </button>
        <div className="ml-auto flex gap-4 text-xs font-semibold text-[var(--faint)]">
          <span className="text-[var(--foreground)]">Log</span>
          <span>Pantry</span>
          <span>Recipes</span>
        </div>
      </div>

      {/* Log — medium density, neutral; the budget is the page's voice. */}
      <div className="flex flex-col gap-3">
        {MEAL_ORDER.map((meal) => {
          const items = entriesForMeal(meal);
          const sub = sumMacros(items);
          return (
            <section
              key={meal}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-bold">{MEAL_LABEL[meal]}</h3>
                <span className="text-[11px] font-medium text-[var(--faint)] tabular-nums">
                  {items.length ? `−${sub.calories} kcal` : "—"}
                </span>
              </div>
              {items.length === 0 ? (
                <p className="text-xs text-[var(--faint)]">Nothing logged yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-4 text-sm">
                      <span className="min-w-0 flex-1 text-[var(--muted)]">
                        {e.name} <span className="text-[var(--faint)]">×{e.quantity}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">−{e.calories}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function BudgetBar({
  label,
  consumed,
  goal,
  unit,
  tint,
}: {
  label: string;
  consumed: number;
  goal: number;
  unit: string;
  tint: string;
}) {
  const left = goal - consumed;
  const over = left < 0;
  const pct = (consumed / goal) * 100;
  // The fill is sized relative to the GOAL, inside an overflow-visible row, so
  // an over-budget macro literally pushes past the end of its track.
  const fillWidth = `${Math.min(pct, 118)}%`;
  const barColor = over ? "var(--warning)" : tint;

  return (
    <div>
      <div className="flex items-end justify-between">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--faint)]">
          {label}
        </span>
        <span className="text-xs text-[var(--faint)] tabular-nums">
          {formatGrams(consumed)} / {goal} {unit}
        </span>
      </div>
      {/* Headline = what's LEFT (or how far over). */}
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className="text-3xl font-extrabold tabular-nums tracking-tight"
          style={{ color: over ? "var(--warning)" : "var(--foreground)" }}
        >
          {over ? `${formatGrams(Math.abs(left))}` : formatGrams(left)}
        </span>
        <span
          className="text-sm font-bold"
          style={{ color: over ? "var(--warning)" : "var(--muted)" }}
        >
          {unit} {over ? "over budget" : "left"}
        </span>
      </div>
      {/* Track + fill. Track is the goal; fill can overflow it. */}
      <div className="relative mt-2 h-3 w-full overflow-visible rounded-full bg-[var(--surface-2)]">
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: fillWidth, backgroundColor: barColor }}
        />
        {over && (
          // A small marker at the goal line so "where 100% was" stays legible
          // even as the fill spills past it.
          <div
            className="absolute top-1/2 h-5 w-0.5 -translate-y-1/2 rounded bg-[var(--surface)]"
            style={{ left: "100%" }}
          />
        )}
      </div>
    </div>
  );
}
