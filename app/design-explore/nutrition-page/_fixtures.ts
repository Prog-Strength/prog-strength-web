/**
 * Static fixtures for the nutrition-page Design Exploration.
 *
 * Mirrors the representative day from the DX ticket so every variant
 * renders the states that break lazy designs: a partially-eaten day,
 * one macro (fat) over goal at 132%, a long brand-heavy custom entry
 * (the Chipotle bowl), and an empty meal bucket (Snacks). These are
 * intentionally NOT wired to lib/api — a DX renders disposable mockups
 * off realistic static data, never live services.
 *
 * Shapes echo lib/api.ts (NutritionLogEntry / MacroGoals) closely
 * enough that a downstream SOW reimplementing the winning variant maps
 * cleanly onto the real types.
 */

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type FixtureEntry = {
  id: string;
  name: string;
  /** Free-text custom entry (e.g. the Chipotle bowl) — wraps long. */
  custom: boolean;
  /** The "Serv" column. */
  quantity: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  meal: MealType;
  /** ISO timestamp; drives the timeline-feed ordering. */
  consumed_at: string;
};

export type Macros = {
  calories: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

export type MacroGoals = Macros & {
  /** null ⇒ never set ⇒ degrade to the inviting empty state. */
  created_at: string | null;
};

/** Tue, Jun 16 2026 — the day the whole exploration renders against. */
export const FIXTURE_DATE = new Date(2026, 5, 16);

/** A week of date tiles ending on the selected day. */
export const DAY_STRIP: { label: string; dom: number; selected: boolean }[] = [
  { label: "WED", dom: 10, selected: false },
  { label: "THU", dom: 11, selected: false },
  { label: "FRI", dom: 12, selected: false },
  { label: "SAT", dom: 13, selected: false },
  { label: "SUN", dom: 14, selected: false },
  { label: "MON", dom: 15, selected: false },
  { label: "TUE", dom: 16, selected: true },
];

export const GOALS: MacroGoals = {
  calories: 3400,
  protein_g: 185,
  carbs_g: 400,
  fat_g: 80,
  created_at: "2026-01-04T00:00:00Z",
};

export const ENTRIES: FixtureEntry[] = [
  // Breakfast — 2 items.
  {
    id: "e1",
    name: "Egg",
    custom: false,
    quantity: 5,
    calories: 350,
    protein_g: 30,
    fat_g: 25,
    carbs_g: 5,
    meal: "breakfast",
    consumed_at: "2026-06-16T07:25:00",
  },
  {
    id: "e2",
    name: "La Favorita Flour Tortillas",
    custom: false,
    quantity: 2,
    calories: 320,
    protein_g: 8,
    fat_g: 5,
    carbs_g: 58,
    meal: "breakfast",
    consumed_at: "2026-06-16T07:35:00",
  },
  // Lunch — 3 items, brand-heavy names.
  {
    id: "e3",
    name: "PBJ Grape Uncrustables",
    custom: false,
    quantity: 1,
    calories: 260,
    protein_g: 8,
    fat_g: 13,
    carbs_g: 31,
    meal: "lunch",
    consumed_at: "2026-06-16T12:20:00",
  },
  {
    id: "e4",
    name: "Elev8 — Creamy Rice (Peanut Butter Cup)",
    custom: false,
    quantity: 1,
    calories: 130,
    protein_g: 3,
    fat_g: 1,
    carbs_g: 27,
    meal: "lunch",
    consumed_at: "2026-06-16T12:35:00",
  },
  {
    id: "e5",
    name: "1st Phorm Birthday Cake Protein Powder",
    custom: false,
    quantity: 1,
    calories: 120,
    protein_g: 24,
    fat_g: 2,
    carbs_g: 2,
    meal: "lunch",
    consumed_at: "2026-06-16T12:40:00",
  },
  // Dinner — 1 long custom entry.
  {
    id: "e6",
    name: "Chipotle double-steak bowl with brown rice, black beans, queso, pico de gallo, cilantro lime sauce, and nacho chips",
    custom: true,
    quantity: 1,
    calories: 1380,
    protein_g: 67,
    fat_g: 59.5,
    carbs_g: 141,
    meal: "dinner",
    consumed_at: "2026-06-16T19:05:00",
  },
  // Snacks — intentionally empty.
];

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/** Rough clock label for each meal — drives the timeline-feed and
 * keeps custom timestamps out of the variant components. */
export const MEAL_TIME: Record<MealType, string> = {
  breakfast: "7:25 AM",
  lunch: "12:20 PM",
  dinner: "7:05 PM",
  snack: "—",
};

export function emptyMacros(): Macros {
  return { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
}

export function sumMacros(entries: FixtureEntry[]): Macros {
  return entries.reduce<Macros>((acc, e) => {
    acc.calories += e.calories;
    acc.protein_g += e.protein_g;
    acc.fat_g += e.fat_g;
    acc.carbs_g += e.carbs_g;
    return acc;
  }, emptyMacros());
}

export function entriesForMeal(meal: MealType): FixtureEntry[] {
  return ENTRIES.filter((e) => e.meal === meal);
}

export const DAY_TOTAL = sumMacros(ENTRIES);

/** One decimal for grams, integer for kcal — matches the shipped rings. */
export function formatGrams(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export type MacroKey = "protein" | "carbs" | "fat";

/** The four macro axes, in the canonical display order. `key` maps to
 * the shipped macro tints (lib/macro-colors.ts); calories is the
 * deliberate non-allocation that reads in the page foreground. */
export const MACRO_AXES: {
  key: MacroKey | "calories";
  label: string;
  short: string;
  unit: string;
  goalField: keyof Macros;
  field: keyof Macros;
}[] = [
  {
    key: "calories",
    label: "Calories",
    short: "Cal",
    unit: "kcal",
    goalField: "calories",
    field: "calories",
  },
  {
    key: "protein",
    label: "Protein",
    short: "P",
    unit: "g",
    goalField: "protein_g",
    field: "protein_g",
  },
  { key: "carbs", label: "Carbs", short: "C", unit: "g", goalField: "carbs_g", field: "carbs_g" },
  { key: "fat", label: "Fat", short: "F", unit: "g", goalField: "fat_g", field: "fat_g" },
];
