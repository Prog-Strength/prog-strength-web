/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import type { NutritionLogEntry, PantryItem, Recipe } from "@/lib/api";
import { NutritionLogView } from "./nutrition-log-view";

// --- fixtures (the representative day) -------------------------------------

let nextID = 0;
function entry(
  meal: NutritionLogEntry["meal"],
  name: string,
  macros: { calories: number; protein_g: number; fat_g: number; carbs_g: number },
  quantity = 1,
): NutritionLogEntry {
  return {
    id: `entry-${nextID++}`,
    consumed_at: "2026-06-16T12:00:00Z",
    created_at: "2026-06-16T12:00:00Z",
    pantry_item_id: null,
    recipe_id: null,
    custom_meal_name: name,
    quantity,
    meal,
    ...macros,
  };
}

const CHIPOTLE_NAME =
  "Chipotle double-steak bowl with brown rice, black beans, queso, pico de gallo, " +
  "cilantro lime sauce, and nacho chips";

function makeEntries(): NutritionLogEntry[] {
  nextID = 0;
  return [
    entry("breakfast", "Egg", { calories: 350, protein_g: 30, fat_g: 25, carbs_g: 5 }, 5),
    entry(
      "breakfast",
      "La Favorita Flour Tortillas",
      { calories: 320, protein_g: 8, fat_g: 5, carbs_g: 58 },
      2,
    ),
    entry("lunch", "PBJ Grape Uncrustables", {
      calories: 260,
      protein_g: 8,
      fat_g: 13,
      carbs_g: 31,
    }),
    entry("lunch", "Elev8 — Creamy Rice (Peanut Butter Cup)", {
      calories: 130,
      protein_g: 3,
      fat_g: 1,
      carbs_g: 27,
    }),
    entry("lunch", "1st Phorm Birthday Cake Protein Powder", {
      calories: 120,
      protein_g: 24,
      fat_g: 2,
      carbs_g: 2,
    }),
    entry("dinner", CHIPOTLE_NAME, { calories: 1380, protein_g: 67, fat_g: 59.5, carbs_g: 141 }),
  ];
}

const EMPTY_PANTRY = new Map<string, PantryItem>();
const EMPTY_RECIPES = new Map<string, Recipe>();

function renderView(entries: NutritionLogEntry[], onEdit = vi.fn(), onDelete = vi.fn()) {
  render(
    <NutritionLogView
      entries={entries}
      pantryByID={EMPTY_PANTRY}
      recipeByID={EMPTY_RECIPES}
      onEdit={onEdit}
      onDelete={onDelete}
    />,
  );
  return { onEdit, onDelete };
}

describe("NutritionLogView", () => {
  it("renders all four meal headers, even the empty bucket", () => {
    renderView(makeEntries());
    expect(screen.getByRole("heading", { name: "Breakfast" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lunch" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dinner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Snacks" })).toBeInTheDocument();
  });

  it("shows 'nothing logged' for the empty Snacks bucket", () => {
    renderView(makeEntries());
    expect(screen.getByText("nothing logged")).toBeInTheDocument();
  });

  it("renders the per-meal subtotal for a non-empty meal (Breakfast)", () => {
    renderView(makeEntries());
    // Breakfast: cal 670, P 38, C 63, F 30.
    expect(screen.getByText("670 cal · P 38g · C 63g · F 30g")).toBeInTheDocument();
  });

  it("renders the long Chipotle entry in full in a wrapping (non-truncated) name cell", () => {
    renderView(makeEntries());
    // The name renders in both the desktop and mobile row layouts (jsdom
    // applies no CSS, so both are present). Both share the same EntryName
    // cell, so assert the wrap affordance on the first match.
    const nameNodes = screen.getAllByText(CHIPOTLE_NAME, { exact: false });
    expect(nameNodes.length).toBeGreaterThan(0);
    const cell = nameNodes[0].closest("span");
    expect(cell).not.toBeNull();
    expect(cell!.className).toMatch(/min-w-0/);
    expect(cell!.className).toMatch(/flex-1/);
    // No truncation affordance on the wrapping cell.
    expect(cell!.className).not.toMatch(/truncate/);
  });

  it("fires onEdit with the entry when a desktop Edit button is clicked", () => {
    const entries = makeEntries();
    const { onEdit } = renderView(entries);
    // Desktop edit buttons are opacity-0 but present/clickable in jsdom.
    const editButtons = screen.getAllByRole("button", { name: "Edit entry" });
    // Click the first row's Edit (Breakfast → Egg, the first entry).
    fireEvent.click(editButtons[0]);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(entries[0]);
  });

  it("fires onDelete with the entry when a desktop Delete button is clicked", () => {
    const entries = makeEntries();
    const { onDelete } = renderView(entries);
    const deleteButtons = screen.getAllByRole("button", { name: "Delete entry" });
    fireEvent.click(deleteButtons[0]);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledWith(entries[0]);
  });
});
