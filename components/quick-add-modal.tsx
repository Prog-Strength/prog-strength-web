"use client";

import { useEffect, useState } from "react";
import { type MealType, type PantryItem, type Recipe } from "@/lib/api";

// Section order in the meal <select>. Pinned here rather than sorted
// to match the page-level MEAL_ORDER convention.
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * Quick-add modal — wraps the original inline log form in the same
 * shell used by the macro-goals + headline-exercises modals. Opened
 * from a "Quick add" button on the Nutrition page; closes itself on
 * a successful log so the user immediately sees the new entry in
 * the meal sections below.
 *
 * `onLog` returns a Promise so the modal can await success vs.
 * failure. On rejection the modal stays open — the parent surfaces
 * the error via the `error` prop. On resolution the modal calls
 * `onClose` itself; logging multiple things back-to-back means
 * tapping the button each time, which is a small price for keeping
 * the page surface clean by default.
 */
export function QuickAddModal({
  pantry,
  recipes,
  busy,
  error,
  onLog,
  onClose,
}: {
  pantry: PantryItem[];
  recipes: Recipe[];
  busy: boolean;
  error: string | null;
  onLog: (
    source: { kind: "pantry" | "recipe"; id: string },
    quantity: number,
    meal: MealType,
  ) => Promise<void>;
  onClose: () => void;
}) {
  // Picker value is a "kind:id" string so a single <select> can host
  // both pantry items and recipes. Parsed back into the discriminated
  // shape at log time.
  const [selection, setSelection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  // Meal default tracks the user's local time of day when the modal
  // opens, then sticks — easier to log multiple breakfast items in
  // a row without the field re-inferring mid-session.
  const [meal, setMeal] = useState<MealType>(() => defaultMealForLocalHour(new Date()));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    if (!selection || !Number.isFinite(q) || q <= 0) return;
    const [kind, id] = selection.split(":", 2);
    if ((kind !== "pantry" && kind !== "recipe") || !id) return;
    try {
      await onLog({ kind, id }, q, meal);
      onClose();
    } catch {
      // Error surfaces via the `error` prop; modal stays open so the
      // user can correct + retry without losing their selection.
    }
  }

  const emptyState = pantry.length === 0 && recipes.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-add-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="quick-add-modal-title" className="text-base font-semibold">
              Quick add
            </h2>
            <p className="text-xs text-[var(--muted)]">Log a pantry item or recipe to today.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        {emptyState ? (
          <div className="px-5 py-5 text-center text-sm text-[var(--muted)]">
            Add a pantry item first.{" "}
            <a className="text-[var(--accent)] hover:underline" href="/nutrition?view=pantry">
              Go to Pantry →
            </a>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                Item or recipe
              </span>
              <select
                value={selection}
                onChange={(e) => setSelection(e.target.value)}
                disabled={busy}
                autoFocus
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                <option value="">Pick something…</option>
                {recipes.length > 0 && (
                  <optgroup label="Recipes">
                    {recipes.map((r) => (
                      <option key={`recipe:${r.id}`} value={`recipe:${r.id}`}>
                        {r.name} ({formatNumber(r.macros.calories)} cal / batch)
                      </option>
                    ))}
                  </optgroup>
                )}
                {pantry.length > 0 && (
                  <optgroup label="Pantry items">
                    {pantry.map((p) => (
                      <option key={`pantry:${p.id}`} value={`pantry:${p.id}`}>
                        {p.name} ({formatNumber(p.calories)} cal/
                        {formatNumber(p.serving_size)} {p.serving_unit})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Meal
                </span>
                <select
                  value={meal}
                  onChange={(e) => setMeal(e.target.value as MealType)}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                >
                  {MEAL_ORDER.map((m) => (
                    <option key={m} value={m}>
                      {MEAL_LABELS[m]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex w-24 flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Servings
                </span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
            </div>

            {error && (
              <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !selection}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-80 disabled:opacity-50"
              >
                {busy ? "Logging…" : "Log"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function defaultMealForLocalHour(d: Date): MealType {
  const h = d.getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
