"use client";

import { useMemo } from "react";
import type { MealType, NutritionLogEntry, PantryItem, Recipe } from "@/lib/api";
import { formatNumber } from "@/lib/format";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * The meal-bucketed daily log for /nutrition. Pulled out of the page
 * so the page-level shell can render it alongside Pantry and Recipes
 * views without duplicating the meal-sections markup.
 */
export function NutritionLogView({
  entries,
  pantryByID,
  recipeByID,
  rowBusyID,
  onDelete,
}: {
  entries: NutritionLogEntry[] | null;
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  rowBusyID: string | null;
  onDelete: (id: string) => void;
}) {
  if (entries === null) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  return (
    <MealSections
      entries={entries}
      pantryByID={pantryByID}
      recipeByID={recipeByID}
      rowBusyID={rowBusyID}
      onDelete={onDelete}
    />
  );
}

function MealSections({
  entries,
  pantryByID,
  recipeByID,
  rowBusyID,
  onDelete,
}: {
  entries: NutritionLogEntry[];
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  rowBusyID: string | null;
  onDelete: (id: string) => void;
}) {
  const byMeal = useMemo(() => {
    const m: Record<MealType, NutritionLogEntry[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
    };
    for (const e of entries) m[e.meal].push(e);
    return m;
  }, [entries]);

  if (entries.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        Nothing logged on this day yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {MEAL_ORDER.map((m) => (
        <MealSection
          key={m}
          meal={m}
          entries={byMeal[m]}
          pantryByID={pantryByID}
          recipeByID={recipeByID}
          rowBusyID={rowBusyID}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function MealSection({
  meal,
  entries,
  pantryByID,
  recipeByID,
  rowBusyID,
  onDelete,
}: {
  meal: MealType;
  entries: NutritionLogEntry[];
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  rowBusyID: string | null;
  onDelete: (id: string) => void;
}) {
  const subtotal = useMemo(() => {
    const t = { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
    for (const e of entries) {
      t.calories += e.calories;
      t.protein_g += e.protein_g;
      t.fat_g += e.fat_g;
      t.carbs_g += e.carbs_g;
    }
    return t;
  }, [entries]);

  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">{MEAL_LABELS[meal]}</h2>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {entries.length === 0 ? (
            <span className="italic">No entries</span>
          ) : (
            <>
              {formatNumber(subtotal.calories)} cal · P {formatNumber(subtotal.protein_g)}g · F{" "}
              {formatNumber(subtotal.fat_g)}g · C {formatNumber(subtotal.carbs_g)}g
            </>
          )}
        </p>
      </header>
      {entries.length > 0 && (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const name = e.pantry_item_id
              ? (pantryByID.get(e.pantry_item_id)?.name ?? "Unknown item")
              : e.recipe_id
                ? (recipeByID.get(e.recipe_id)?.name ?? "Unknown recipe")
                : "Untitled entry";
            return (
              <li key={e.id}>
                <LogEntryRow
                  entry={e}
                  itemName={name}
                  isRecipe={!!e.recipe_id}
                  busy={rowBusyID === e.id}
                  onDelete={() => onDelete(e.id)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function LogEntryRow({
  entry,
  itemName,
  isRecipe,
  busy,
  onDelete,
}: {
  entry: NutritionLogEntry;
  itemName: string;
  isRecipe: boolean;
  busy: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">
          {itemName}{" "}
          <span className="text-xs text-[var(--muted)] tabular-nums">
            × {formatNumber(entry.quantity)}
            {isRecipe && (
              <span className="ml-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[10px] uppercase tracking-wider">
                recipe
              </span>
            )}
          </span>
        </p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(entry.calories)} cal · P {formatNumber(entry.protein_g)}g · F{" "}
          {formatNumber(entry.fat_g)}g · C {formatNumber(entry.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">
            {formatLocalTime(entry.consumed_at)}
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
      >
        Delete
      </button>
    </div>
  );
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
