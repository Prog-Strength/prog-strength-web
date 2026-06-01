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
 * The meal-bucketed daily log for /nutrition. Renders one compact
 * table per meal so a full day fits on screen without paging. Per-row
 * pencil/trash buttons hand the entry up to the page, which owns the
 * edit/delete modals.
 */
export function NutritionLogView({
  entries,
  pantryByID,
  recipeByID,
  onEdit,
  onDelete,
}: {
  entries: NutritionLogEntry[] | null;
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  onEdit: (entry: NutritionLogEntry) => void;
  onDelete: (entry: NutritionLogEntry) => void;
}) {
  if (entries === null) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  return (
    <MealSections
      entries={entries}
      pantryByID={pantryByID}
      recipeByID={recipeByID}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

/**
 * Resolve the display name for a log entry. Exported so the page can
 * label the edit and delete modals with the same name the row shows.
 */
export function resolveItemName(
  entry: NutritionLogEntry,
  pantryByID: Map<string, PantryItem>,
  recipeByID: Map<string, Recipe>,
): string {
  if (entry.pantry_item_id) {
    return pantryByID.get(entry.pantry_item_id)?.name ?? "Unknown item";
  }
  if (entry.recipe_id) {
    return recipeByID.get(entry.recipe_id)?.name ?? "Unknown recipe";
  }
  return "Untitled entry";
}

function MealSections({
  entries,
  pantryByID,
  recipeByID,
  onEdit,
  onDelete,
}: {
  entries: NutritionLogEntry[];
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  onEdit: (entry: NutritionLogEntry) => void;
  onDelete: (entry: NutritionLogEntry) => void;
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
          onEdit={onEdit}
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
  onEdit,
  onDelete,
}: {
  meal: MealType;
  entries: NutritionLogEntry[];
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  onEdit: (entry: NutritionLogEntry) => void;
  onDelete: (entry: NutritionLogEntry) => void;
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <th scope="col" className="py-1.5 pr-3 text-left font-semibold">
                Time
              </th>
              <th scope="col" className="py-1.5 pr-3 text-left font-semibold">
                Item
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                Serv
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                Cal
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                P
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                F
              </th>
              <th scope="col" className="py-1.5 pr-3 text-right font-semibold">
                C
              </th>
              <th scope="col" className="py-1.5 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const name = resolveItemName(e, pantryByID, recipeByID);
              return (
                <tr
                  key={e.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)]"
                >
                  <td className="py-2 pr-3 text-left text-xs text-[var(--muted)] tabular-nums">
                    {formatLocalTime(e.consumed_at)}
                  </td>
                  <td className="max-w-0 py-2 pr-3 text-left">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-medium">{name}</span>
                      {e.recipe_id && (
                        <span className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[10px] uppercase tracking-wider">
                          recipe
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.quantity)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.calories)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatNumber(e.protein_g)}g
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.fat_g)}g</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.carbs_g)}g</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(e)}
                        aria-label="Edit entry"
                        className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(e)}
                        aria-label="Delete entry"
                        className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--danger)]"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
