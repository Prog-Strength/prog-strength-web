/**
 * DX variant — idiom: dense-tracker-table  (draws on MyFitnessPal's
 * meal-bucketed running ledger + Cronometer's at-a-glance targets panel)
 *
 * The LOG is the star. A tight, scannable food diary ledger: compact rows,
 * a fixed daily-target strip with goal-remaining math inline ("45g left"),
 * the four rings shrunk to a slim summary so the entries get the screen.
 * The spread levers, all inside the design system:
 *   - type scale: tight and uniform — almost everything is text-xs/[13px];
 *     hierarchy comes from WEIGHT and column alignment, never size.
 *   - color logic: maximally restrained — macro tints are reduced to thin
 *     column accents and small figures, never filled blocks; violet only on
 *     the active add affordance.
 *   - spacing rhythm: dense, gridded, maximally informative per square inch —
 *     the power-user end of the spread.
 * Over-goal (fat) reads as a negative "over" figure in the remaining row.
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
  type FixtureEntry,
  type MacroKey,
} from "../_fixtures";

const TINT: Record<MacroKey, string> = {
  protein: MACRO_COLORS.protein,
  carbs: MACRO_COLORS.carbs,
  fat: MACRO_COLORS.fat,
};

// Ledger grid: name flexes, the five numeric columns are fixed + right-aligned
// so figures stay column-locked even when the Chipotle name wraps.
const GRID =
  "grid grid-cols-[minmax(0,1fr)_3rem_3.25rem_2.75rem_2.75rem_2.75rem] items-center gap-x-2";

export function VariantDenseTrackerTable() {
  const remaining = {
    calories: GOALS.calories - DAY_TOTAL.calories,
    protein_g: GOALS.protein_g - DAY_TOTAL.protein_g,
    carbs_g: GOALS.carbs_g - DAY_TOTAL.carbs_g,
    fat_g: GOALS.fat_g - DAY_TOTAL.fat_g,
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Compact day strip — single dense row. */}
      <div className="flex items-center gap-1 text-xs">
        <span className="text-[var(--faint)]">‹</span>
        {DAY_STRIP.map((d) => (
          <span
            key={d.dom}
            className={
              d.selected
                ? "rounded-md bg-[var(--surface-3)] px-2.5 py-1 font-bold tabular-nums"
                : "px-2.5 py-1 font-medium text-[var(--faint)] tabular-nums"
            }
          >
            {d.label[0]}
            {d.dom}
          </span>
        ))}
        <span className="text-[var(--faint)]">›</span>
      </div>

      {/* Slim summary strip — rings shrunk to a four-up figure row with the
          Cronometer targets panel feel: consumed, goal, and what's left. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        <TargetCell
          label="Calories"
          consumed={DAY_TOTAL.calories}
          goal={GOALS.calories}
          left={remaining.calories}
          unit=""
        />
        <TargetCell
          label="Protein"
          consumed={DAY_TOTAL.protein_g}
          goal={GOALS.protein_g}
          left={remaining.protein_g}
          unit="g"
          tint={TINT.protein}
        />
        <TargetCell
          label="Carbs"
          consumed={DAY_TOTAL.carbs_g}
          goal={GOALS.carbs_g}
          left={remaining.carbs_g}
          unit="g"
          tint={TINT.carbs}
        />
        <TargetCell
          label="Fat"
          consumed={DAY_TOTAL.fat_g}
          goal={GOALS.fat_g}
          left={remaining.fat_g}
          unit="g"
          tint={TINT.fat}
        />
      </div>

      {/* Action bar — violet is the ONLY color, on the active add. */}
      <div className="flex items-center justify-between text-xs">
        <button className="rounded-md bg-[var(--accent)] px-3 py-1.5 font-bold text-[var(--accent-fg)]">
          + Add food
        </button>
        <div className="flex gap-4 font-semibold text-[var(--faint)]">
          <span className="text-[var(--foreground)] underline decoration-[var(--accent)] decoration-2 underline-offset-4">
            Log
          </span>
          <span>Pantry</span>
          <span>Recipes</span>
        </div>
      </div>

      {/* The ledger. */}
      <div className="overflow-hidden rounded-xl border border-[var(--border)]">
        {/* Column header — tinted glyphs mark the macro columns; no fills. */}
        <div
          className={`${GRID} border-b border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--faint)]`}
        >
          <span>Item</span>
          <span className="text-right">Serv</span>
          <span className="text-right">Cal</span>
          <span className="text-right" style={{ color: TINT.protein }}>
            P
          </span>
          <span className="text-right" style={{ color: TINT.fat }}>
            F
          </span>
          <span className="text-right" style={{ color: TINT.carbs }}>
            C
          </span>
        </div>

        {MEAL_ORDER.map((meal) => {
          const items = entriesForMeal(meal);
          const sub = sumMacros(items);
          return (
            <div key={meal}>
              {/* Meal subtotal header row. */}
              <div className={`${GRID} bg-[var(--surface)] px-3 py-1.5 text-[11px] font-bold`}>
                <span className="uppercase tracking-wide">{MEAL_LABEL[meal]}</span>
                <span className="text-right text-[var(--faint)]">{items.length || ""}</span>
                <span className="text-right tabular-nums text-[var(--muted)]">
                  {sub.calories || "—"}
                </span>
                <span className="text-right tabular-nums text-[var(--muted)]">
                  {formatGrams(sub.protein_g) || "—"}
                </span>
                <span className="text-right tabular-nums text-[var(--muted)]">
                  {formatGrams(sub.fat_g) || "—"}
                </span>
                <span className="text-right tabular-nums text-[var(--muted)]">
                  {formatGrams(sub.carbs_g) || "—"}
                </span>
              </div>
              {items.length === 0 ? (
                <div className="px-3 py-2 text-[11px] italic text-[var(--faint)]">
                  No items — tap “+ Add food”.
                </div>
              ) : (
                items.map((e) => <LedgerRow key={e.id} e={e} />)
              )}
            </div>
          );
        })}

        {/* Daily total + remaining — the running math at the foot. */}
        <div
          className={`${GRID} border-t border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2 text-xs font-bold tabular-nums`}
        >
          <span className="uppercase tracking-wide">Total</span>
          <span className="text-right" />
          <span className="text-right">{DAY_TOTAL.calories}</span>
          <span className="text-right">{formatGrams(DAY_TOTAL.protein_g)}</span>
          <span className="text-right">{formatGrams(DAY_TOTAL.fat_g)}</span>
          <span className="text-right">{formatGrams(DAY_TOTAL.carbs_g)}</span>
        </div>
        <div
          className={`${GRID} bg-[var(--surface)] px-3 py-1.5 text-[11px] font-semibold tabular-nums text-[var(--faint)]`}
        >
          <span className="uppercase tracking-wide">Remaining</span>
          <span className="text-right" />
          <RemainingCell v={remaining.calories} />
          <RemainingCell v={remaining.protein_g} />
          <RemainingCell v={remaining.fat_g} />
          <RemainingCell v={remaining.carbs_g} />
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ e }: { e: FixtureEntry }) {
  return (
    <div
      className={`${GRID} border-t border-[var(--border)] px-3 py-1.5 text-[13px] hover:bg-[var(--surface)]`}
    >
      <span className="min-w-0 break-words pr-1 leading-snug">{e.name}</span>
      <span className="text-right tabular-nums text-[var(--muted)]">{e.quantity}</span>
      <span className="text-right font-semibold tabular-nums">{e.calories}</span>
      <span className="text-right tabular-nums text-[var(--muted)]">
        {formatGrams(e.protein_g)}
      </span>
      <span className="text-right tabular-nums text-[var(--muted)]">{formatGrams(e.fat_g)}</span>
      <span className="text-right tabular-nums text-[var(--muted)]">{formatGrams(e.carbs_g)}</span>
    </div>
  );
}

function RemainingCell({ v }: { v: number }) {
  const over = v < 0;
  return (
    <span className="text-right" style={{ color: over ? "var(--warning)" : undefined }}>
      {over ? `${formatGrams(Math.abs(v))} over` : formatGrams(v)}
    </span>
  );
}

function TargetCell({
  label,
  consumed,
  goal,
  left,
  unit,
  tint,
}: {
  label: string;
  consumed: number;
  goal: number;
  left: number;
  unit: string;
  tint?: string;
}) {
  const over = left < 0;
  return (
    <div className="bg-[var(--surface)] px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {tint && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tint }} />}
        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--faint)]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums">
        {formatGrams(consumed)}
        <span className="text-[var(--faint)]">
          {" "}
          / {goal}
          {unit}
        </span>
      </div>
      <div
        className="text-[11px] font-semibold tabular-nums"
        style={{ color: over ? "var(--warning)" : "var(--muted)" }}
      >
        {over ? `${formatGrams(Math.abs(left))}${unit} over` : `${formatGrams(left)}${unit} left`}
      </div>
    </div>
  );
}
