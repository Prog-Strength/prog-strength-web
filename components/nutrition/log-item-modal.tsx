"use client";

import { useEffect, useState } from "react";
import { type MealType, type PantryItem, type Recipe } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { MACRO_COLORS } from "@/lib/macro-colors";

// Section order in the meal <select>. Pinned here rather than sorted
// to match the page-level MEAL_ORDER convention.
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export type LogItemTarget =
  | { kind: "pantry"; item: PantryItem }
  | { kind: "recipe"; recipe: Recipe };

/**
 * Log-item modal — logs one specific pantry item or recipe, already
 * chosen by tapping it in the Pantry/Recipes catalog views. The
 * QuickAddModal keeps the "search across everything" flow; this modal
 * skips the picker entirely because the user is looking at the item.
 *
 * Same contract as QuickAddModal: `onLog` returns a Promise, the modal
 * closes itself on success and stays open on rejection so the parent
 * can surface the error via the `error` prop.
 */
export function LogItemModal({
  target,
  date,
  busy,
  error,
  onLog,
  onClose,
}: {
  target: LogItemTarget;
  // The currently-selected calendar day on the page. Used to derive the
  // logged `consumed_at` (now if today, else noon of that day) — matching
  // QuickAddModal's behavior.
  date: Date;
  busy: boolean;
  error: string | null;
  onLog: (
    source:
      | { kind: "pantry"; id: string; quantity: number }
      | { kind: "recipe"; id: string; quantity: number },
    meal: MealType,
    consumedAt: string,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState<string>("1");
  const [localError, setLocalError] = useState<string | null>(null);

  // Meal default tracks the user's local time of day when the modal
  // opens, then sticks.
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

  const name = target.kind === "pantry" ? target.item.name : target.recipe.name;
  const macros =
    target.kind === "pantry"
      ? {
          calories: target.item.calories,
          protein_g: target.item.protein_g,
          fat_g: target.item.fat_g,
          carbs_g: target.item.carbs_g,
        }
      : target.recipe.macros;
  const servingHint =
    target.kind === "pantry"
      ? `per ${formatNumber(target.item.serving_size)} ${target.item.serving_unit} serving`
      : "per batch";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) {
      setLocalError("Servings must be greater than zero.");
      return;
    }

    // consumed_at: now if logging to today, else noon of the selected
    // day — same derivation QuickAddModal uses.
    const isToday = sameLocalDay(date, new Date());
    const consumedAt = (
      isToday ? new Date() : new Date(date.getTime() + 12 * 60 * 60 * 1000)
    ).toISOString();

    try {
      await onLog(
        target.kind === "pantry"
          ? { kind: "pantry", id: target.item.id, quantity: q }
          : { kind: "recipe", id: target.recipe.id, quantity: q },
        meal,
        consumedAt,
      );
      onClose();
    } catch {
      // Error surfaces via the `error` prop; modal stays open so the
      // user can correct + retry without losing their input.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-item-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h2 id="log-item-modal-title" className="truncate text-base font-semibold">
              Log {name}
            </h2>
            <p className="text-xs text-[var(--muted)] tabular-nums">
              {formatNumber(macros.calories)} cal ·{" "}
              <span style={{ color: MACRO_COLORS.protein }} className="font-semibold">
                P
              </span>{" "}
              {formatNumber(macros.protein_g)} ·{" "}
              <span style={{ color: MACRO_COLORS.fat }} className="font-semibold">
                F
              </span>{" "}
              {formatNumber(macros.fat_g)} ·{" "}
              <span style={{ color: MACRO_COLORS.carbs }} className="font-semibold">
                C
              </span>{" "}
              {formatNumber(macros.carbs_g)} {servingHint}
            </p>
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

        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
          <div className="flex gap-3">
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
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                When
              </span>
              <span className="flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--muted)]">
                {sameLocalDay(date, new Date()) ? "Now" : formatLocalDay(date)}
              </span>
            </label>
          </div>

          {(error ?? localError) && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error ?? localError}
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
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Logging…" : "Log"}
            </button>
          </div>
        </form>
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

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatLocalDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
