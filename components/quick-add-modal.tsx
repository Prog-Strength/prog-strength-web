"use client";

import { useEffect, useState } from "react";
import { type MealType, type PantryItem, type Recipe } from "@/lib/api";
import { MacroField } from "@/components/pantry-item-form";

// Section order in the meal <select>. Pinned here rather than sorted
// to match the page-level MEAL_ORDER convention.
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

// Which source the user is logging from. Pantry and recipes each get
// their own filtered dropdown + quantity; custom is a free-form name +
// macro form with no quantity (the user types the totals they ate).
type Tab = "pantry" | "recipe" | "custom";

/**
 * Quick-add modal — wraps the original inline log form in the same
 * shell used by the macro-goals + headline-exercises modals. Opened
 * from a "Quick add" button on the Nutrition page; closes itself on
 * a successful log so the user immediately sees the new entry in
 * the meal sections below.
 *
 * The source picker is a three-tab segmented control (Pantry / Recipes
 * / Custom). Meal type and the "When" timestamp stay shared across all
 * three tabs.
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
  date,
  busy,
  error,
  onLog,
  onClose,
}: {
  pantry: PantryItem[];
  recipes: Recipe[];
  // The currently-selected calendar day on the page. Used to derive the
  // logged `consumed_at` (now if today, else noon of that day) — matching
  // the page's prior behavior.
  date: Date;
  busy: boolean;
  error: string | null;
  onLog: (
    source:
      | { kind: "pantry"; id: string; quantity: number }
      | { kind: "recipe"; id: string; quantity: number }
      | {
          kind: "custom";
          name: string;
          calories: number;
          protein_g: number;
          fat_g: number;
          carbs_g: number;
        },
    meal: MealType,
    consumedAt: string,
  ) => Promise<void>;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("pantry");

  // Pantry / recipe picker state. A "kind:id" string isn't needed
  // anymore since each tab hosts a single source kind, so the value is
  // just the id.
  const [pantryId, setPantryId] = useState<string>("");
  const [recipeId, setRecipeId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");

  // Custom-tab state.
  const [customName, setCustomName] = useState<string>("");
  const [calories, setCalories] = useState<string>("");
  const [proteinG, setProteinG] = useState<string>("");
  const [fatG, setFatG] = useState<string>("");
  const [carbsG, setCarbsG] = useState<string>("");

  const [localError, setLocalError] = useState<string | null>(null);

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

  // Clear any inline validation message when the user switches tabs.
  function selectTab(next: Tab) {
    setTab(next);
    setLocalError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    // consumed_at: now if logging to today, else noon of the selected
    // day — same derivation the page used previously.
    const isToday = sameLocalDay(date, new Date());
    const consumedAt = (
      isToday ? new Date() : new Date(date.getTime() + 12 * 60 * 60 * 1000)
    ).toISOString();

    try {
      if (tab === "custom") {
        const name = customName.trim();
        if (!name) {
          setLocalError("Name is required.");
          return;
        }
        const cal = Number(calories || "0");
        const p = Number(proteinG || "0");
        const f = Number(fatG || "0");
        const c = Number(carbsG || "0");
        if (![cal, p, f, c].every(Number.isFinite)) {
          setLocalError("Macros must be numbers.");
          return;
        }
        if (cal < 0 || p < 0 || f < 0 || c < 0) {
          setLocalError("Macros must be non-negative.");
          return;
        }
        await onLog(
          { kind: "custom", name, calories: cal, protein_g: p, fat_g: f, carbs_g: c },
          meal,
          consumedAt,
        );
        onClose();
        return;
      }

      const q = Number(quantity);
      if (!Number.isFinite(q) || q <= 0) {
        setLocalError("Servings must be greater than zero.");
        return;
      }
      const id = tab === "pantry" ? pantryId : recipeId;
      if (!id) {
        setLocalError(tab === "pantry" ? "Pick a pantry item." : "Pick a recipe.");
        return;
      }
      await onLog({ kind: tab, id, quantity: q }, meal, consumedAt);
      onClose();
    } catch {
      // Error surfaces via the `error` prop; modal stays open so the
      // user can correct + retry without losing their input.
    }
  }

  const emptyState = pantry.length === 0 && recipes.length === 0;

  // The submit button is disabled only when the active tab can't
  // possibly produce a valid log (no source selected / no name typed).
  const submitDisabled =
    busy ||
    (tab === "pantry" && !pantryId) ||
    (tab === "recipe" && !recipeId) ||
    (tab === "custom" && !customName.trim());

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
            <p className="text-xs text-[var(--muted)]">
              Log a pantry item, recipe, or a one-off meal.
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

        {emptyState ? (
          <div className="px-5 py-5 text-center text-sm text-[var(--muted)]">
            Add a pantry item first, or log a one-off meal from the{" "}
            <button
              type="button"
              onClick={() => selectTab("custom")}
              className="text-[var(--accent)] hover:underline"
            >
              Custom tab
            </button>
            .
            <div className="mt-3">
              <a className="text-[var(--accent)] hover:underline" href="/nutrition?view=pantry">
                Go to Pantry →
              </a>
            </div>
          </div>
        ) : null}

        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)]">
            <TabButton active={tab === "pantry"} onClick={() => selectTab("pantry")}>
              Pantry
            </TabButton>
            <TabButton active={tab === "recipe"} onClick={() => selectTab("recipe")}>
              Recipes
            </TabButton>
            <TabButton active={tab === "custom"} onClick={() => selectTab("custom")}>
              Custom
            </TabButton>
          </div>

          {tab === "pantry" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Pantry item
                </span>
                <select
                  value={pantryId}
                  onChange={(e) => setPantryId(e.target.value)}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                >
                  <option value="">Pick a pantry item…</option>
                  {pantry.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatNumber(p.calories)} cal/
                      {formatNumber(p.serving_size)} {p.serving_unit})
                    </option>
                  ))}
                </select>
              </label>
              <QuantityField value={quantity} onChange={setQuantity} disabled={busy} />
            </div>
          )}

          {tab === "recipe" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Recipe
                </span>
                <select
                  value={recipeId}
                  onChange={(e) => setRecipeId(e.target.value)}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                >
                  <option value="">Pick a recipe…</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({formatNumber(r.macros.calories)} cal / batch)
                    </option>
                  ))}
                </select>
              </label>
              <QuantityField value={quantity} onChange={setQuantity} disabled={busy} />
            </div>
          )}

          {tab === "custom" && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                  Name
                </span>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Chipotle chicken bowl"
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MacroField
                  label="Calories"
                  value={calories}
                  onChange={setCalories}
                  disabled={busy}
                />
                <MacroField
                  label="Protein (g)"
                  value={proteinG}
                  onChange={setProteinG}
                  disabled={busy}
                  tone="protein"
                />
                <MacroField
                  label="Fat (g)"
                  value={fatG}
                  onChange={setFatG}
                  disabled={busy}
                  tone="fat"
                />
                <MacroField
                  label="Carbs (g)"
                  value={carbsG}
                  onChange={setCarbsG}
                  disabled={busy}
                  tone="carbs"
                />
              </div>
            </div>
          )}

          {/* Shared across all tabs: meal bucket + when. */}
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
              disabled={submitDisabled}
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

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "px-3 py-2 text-sm font-medium transition " +
        (active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--muted)] hover:bg-[var(--background)] hover:text-[var(--foreground)]")
      }
    >
      {children}
    </button>
  );
}

function QuantityField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex w-24 flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">Servings</span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
      />
    </label>
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

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
