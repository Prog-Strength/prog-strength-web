"use client";

import { useMemo, useState } from "react";
import type { MealType, NutritionLogEntry, PantryItem, Recipe } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { EntryActionSheet } from "@/components/nutrition/entry-action-sheet";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * The meal-bucketed daily log for /nutrition, rebuilt as the "demoted
 * log" of the dashboard-hero design: calm, neutral, small-type meal
 * cards. The hero band above carries the macro story, so the log stays
 * quiet — every meal section header renders (even empty buckets), with
 * per-meal subtotals on the right. Per-row pencil/trash buttons on
 * desktop, and a tap-to-open action sheet on mobile, hand the entry up
 * to the page, which owns the edit/delete modals.
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
  if (entry.custom_meal_name) {
    return entry.custom_meal_name;
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

  // Every meal section header always renders — even an empty bucket
  // shows its header with "nothing logged". A wholly empty day is just
  // four "nothing logged" headers; there is no separate empty state.
  return (
    <div className="flex flex-col gap-3">
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

  // The mobile layout collapses the desktop row's two icon-action
  // buttons into a single tap on the whole row, surfacing Edit /
  // Delete as a small action sheet. State lives here per-section
  // because the action sheet is a modal — only one can be open
  // anywhere on the page at a time.
  const [actionTarget, setActionTarget] = useState<NutritionLogEntry | null>(null);

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold">{MEAL_LABELS[meal]}</h2>
        {entries.length === 0 ? (
          <span className="text-[11px] text-[var(--faint)]">nothing logged</span>
        ) : (
          <span className="text-[11px] text-[var(--faint)] tabular-nums">
            {formatNumber(subtotal.calories)} cal · P {formatNumber(subtotal.protein_g)}g · C{" "}
            {formatNumber(subtotal.carbs_g)}g · F {formatNumber(subtotal.fat_g)}g
          </span>
        )}
      </header>

      {entries.length > 0 && (
        <ul className="mt-2 divide-y divide-[var(--border)]">
          {entries.map((e) => {
            const name = resolveItemName(e, pantryByID, recipeByID);
            return (
              <li key={e.id} className="group">
                {/* Desktop row: name + calories with inline edit/delete. */}
                <div className="hidden items-start justify-between gap-4 py-2 sm:flex">
                  <EntryName name={name} entry={e} />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold tabular-nums">
                      {formatNumber(e.calories)} cal
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onEdit(e)}
                        aria-label="Edit entry"
                        className="rounded p-1 text-[var(--faint)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(e)}
                        aria-label="Delete entry"
                        className="rounded p-1 text-[var(--faint)] transition hover:bg-[var(--background)] hover:text-[var(--danger)]"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile row: tap anywhere to open the action sheet. */}
                <button
                  type="button"
                  onClick={() => setActionTarget(e)}
                  aria-label={`${name} — tap to edit or delete`}
                  className="flex w-full items-start justify-between gap-4 py-2 text-left transition active:opacity-80 sm:hidden"
                >
                  <EntryName name={name} entry={e} />
                  <span className="shrink-0 text-xs font-semibold tabular-nums">
                    {formatNumber(e.calories)} cal
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {actionTarget && (
        <EntryActionSheet
          entry={actionTarget}
          itemName={resolveItemName(actionTarget, pantryByID, recipeByID)}
          onEdit={() => {
            const target = actionTarget;
            setActionTarget(null);
            onEdit(target);
          }}
          onDelete={() => {
            const target = actionTarget;
            setActionTarget(null);
            onDelete(target);
          }}
          onClose={() => setActionTarget(null)}
        />
      )}
    </section>
  );
}

/**
 * Shared row name cell for both the desktop and mobile layouts. The
 * name is allowed to wrap (no truncation) so long entries stay legible;
 * a faint quantity trails it, and a small "recipe" pill marks
 * recipe-sourced entries.
 */
function EntryName({ name, entry }: { name: string; entry: NutritionLogEntry }) {
  return (
    <span className="min-w-0 flex-1 text-xs text-[var(--muted)]">
      {name}
      <span className="text-[var(--faint)]"> ×{formatNumber(entry.quantity)}</span>
      {entry.recipe_id && (
        <span className="ml-2 inline-block rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 align-middle text-[10px] uppercase tracking-wider">
          recipe
        </span>
      )}
    </span>
  );
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
