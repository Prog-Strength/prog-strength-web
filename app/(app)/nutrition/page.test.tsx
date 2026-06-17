/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { MacroGoals, NutritionLogEntry } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
// A stable router object — the real next/navigation useRouter returns a
// referentially-stable instance, which the page relies on (its fetch
// callbacks are memoized on `router`). A fresh object per render would make
// those callbacks change identity every render and refire the data effects.
const routerMock = vi.hoisted(() => ({ replace: replaceMock, push: vi.fn() }));
const searchParamsMock = vi.hoisted(() => new URLSearchParams(""));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useSearchParams: () => searchParamsMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), dismiss: vi.fn() }),
}));

// Keep the real type exports + helpers resolving by spreading the actual
// module, then override only the data functions the page calls.
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  listNutritionLog: vi.fn(async () => ENTRIES),
  getMacroGoals: vi.fn(async () => GOALS),
  listPantryItems: vi.fn(async () => []),
  listRecipes: vi.fn(async () => []),
  deleteNutritionLogEntry: vi.fn(async () => {}),
}));

import { deleteNutritionLogEntry, listNutritionLog, getMacroGoals } from "@/lib/api";
import NutritionPage from "./page";

// --- fixtures (the representative day, Tue Jun 16) -------------------------

const GOALS: MacroGoals = {
  calories: 3400,
  protein_g: 185,
  carbs_g: 400,
  fat_g: 80,
  created_at: "2026-01-04T00:00:00Z",
  updated_at: "2026-01-04T00:00:00Z",
};

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

const ENTRIES: NutritionLogEntry[] = [
  entry("breakfast", "Egg", { calories: 350, protein_g: 30, fat_g: 25, carbs_g: 5 }, 5),
  entry(
    "breakfast",
    "La Favorita Flour Tortillas",
    { calories: 320, protein_g: 8, fat_g: 5, carbs_g: 58 },
    2,
  ),
  entry("lunch", "PBJ Grape Uncrustables", { calories: 260, protein_g: 8, fat_g: 13, carbs_g: 31 }),
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

// jsdom doesn't implement matchMedia; DateTileStrip subscribes to it for its
// mobile/desktop snapshot. A minimal, non-matching stub is enough here.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  replaceMock.mockClear();
  vi.mocked(listNutritionLog).mockResolvedValue(ENTRIES);
  vi.mocked(getMacroGoals).mockResolvedValue(GOALS);
  vi.mocked(deleteNutritionLogEntry).mockClear();
  vi.mocked(deleteNutritionLogEntry).mockResolvedValue(undefined);
});

describe("NutritionPage", () => {
  it("sums the loaded entries client-side into the hero (2560 kcal, Fat OVER)", async () => {
    render(<NutritionPage />);

    // Hero calories numeral proves the totals are summed client-side from the
    // loaded entries (350+320+260+130+120+1380 = 2560).
    expect(await screen.findByText("2560")).toBeInTheDocument();
    // Fat is over goal (105.5 / 80) → the OVER marker surfaces.
    expect(await screen.findByText(/OVER/)).toBeInTheDocument();
  });

  it("optimistically removes a deleted entry and drops the hero total", async () => {
    render(<NutritionPage />);

    // Wait for the hero (summation proof) and the log rows to render. The name
    // renders in both the desktop and mobile row layouts (jsdom applies no CSS,
    // so both are present), hence getAllByText.
    expect(await screen.findByText("2560")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByText(CHIPOTLE_NAME, { exact: false }).length).toBeGreaterThan(0),
    );

    // Open the delete modal for the Chipotle (dinner) row. Its Delete button is
    // the dinner section's only "Delete entry" button.
    const deleteButtons = screen.getAllByRole("button", { name: "Delete entry" });
    // Dinner is the last meal section, so its row's delete button is last.
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    // The confirm modal appears, scoped to the Chipotle (dinner) entry.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Delete log entry?")).toBeInTheDocument();
    expect(within(dialog).getByText(CHIPOTLE_NAME, { exact: false })).toBeInTheDocument();

    // Confirm the delete.
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteNutritionLogEntry).toHaveBeenCalledTimes(1));
    // The dinner entry's id is the last fixture entry's id.
    expect(deleteNutritionLogEntry).toHaveBeenCalledWith(
      "test-token",
      ENTRIES[ENTRIES.length - 1].id,
    );

    // Optimistic removal: the Chipotle name disappears, and the hero total
    // drops by 1380 → 1180.
    await waitFor(() =>
      expect(screen.queryAllByText(CHIPOTLE_NAME, { exact: false })).toHaveLength(0),
    );
    expect(await screen.findByText("1180")).toBeInTheDocument();
    expect(screen.queryByText("2560")).not.toBeInTheDocument();
  });
});
