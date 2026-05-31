"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  createNutritionLogEntry,
  deleteNutritionLogEntry,
  getMacroGoals,
  listNutritionLog,
  listPantryItems,
  listRecipes,
  type MacroGoals,
  type MealType,
  type NutritionLogEntry,
  type PantryItem,
  type Recipe,
} from "@/lib/api";
import { MacroGoalRings } from "@/components/macro-goal-rings";
import { MacroGoalsModal } from "@/components/macro-goals-modal";

// Section order on the page. Pinning here (rather than sorting by
// section averages of consumed_at) means an empty Lunch still
// appears between Breakfast and Dinner, which is the readable
// shape users expect.
const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * Nutrition — today's log + macro widget for a navigable date.
 *
 * The date selector defaults to the user's local "today" and supports
 * previous/next/picker controls. Behind the scenes the API queries are
 * scoped by UTC bounds derived from the local-day boundaries — the SOW
 * deliberately keeps timezone math client-side for v1.
 *
 * The macro widget at the top sums whatever's in `entries` for the
 * selected day (rather than calling /nutrition-log/daily separately)
 * because we already have the per-entry rows on hand. Saves a round
 * trip; the math is trivial.
 */
export default function NutritionPage() {
  const router = useRouter();
  const [date, setDate] = useState<Date>(() => startOfLocalDay(new Date()));
  const [entries, setEntries] = useState<NutritionLogEntry[] | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [goals, setGoals] = useState<MacroGoals | null>(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);

  const refetch = useCallback(
    (d: Date) => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      const since = d.toISOString();
      const until = endOfLocalDay(d).toISOString();
      Promise.all([
        listNutritionLog(token, { since, until }),
        listPantryItems(token),
        listRecipes(token),
        getMacroGoals(token),
      ])
        .then(([logs, pantryItems, recipeList, macroGoals]) => {
          setEntries(logs);
          setPantry(pantryItems);
          setRecipes(recipeList);
          setGoals(macroGoals);
        })
        .catch((err: Error) => {
          if (err.message.toLowerCase().includes("401")) {
            clearToken();
            router.replace("/login");
            return;
          }
          setError(err.message);
        });
    },
    [router],
  );

  useEffect(() => {
    refetch(date);
  }, [date, refetch]);

  // Pantry-item lookup for entry row rendering — entries carry a
  // pantry_item_id (or recipe_id) but no name; denormalized macros are
  // the only thing on the entry row itself. Same shape for the
  // recipe lookup below.
  const pantryByID = useMemo(() => {
    const m = new Map<string, PantryItem>();
    for (const p of pantry) m.set(p.id, p);
    return m;
  }, [pantry]);
  const recipeByID = useMemo(() => {
    const m = new Map<string, Recipe>();
    for (const r of recipes) m.set(r.id, r);
    return m;
  }, [recipes]);

  const totals = useMemo(() => {
    const out = { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 };
    for (const e of entries ?? []) {
      out.calories += e.calories;
      out.protein_g += e.protein_g;
      out.fat_g += e.fat_g;
      out.carbs_g += e.carbs_g;
    }
    return out;
  }, [entries]);

  function handleLog(
    source: { kind: "pantry" | "recipe"; id: string },
    quantity: number,
    meal: MealType,
  ) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setLogBusy(true);
    setLogError(null);
    // consumed_at: noon on the selected local day if not today; current
    // local time if today. Noon avoids the "midnight UTC entry shows
    // as the previous day in some zones" trap on backdated logs.
    const isToday = sameLocalDay(date, new Date());
    const consumedAt = isToday ? new Date() : new Date(date.getTime() + 12 * 60 * 60 * 1000);
    createNutritionLogEntry(token, {
      ...(source.kind === "pantry"
        ? { pantry_item_id: source.id }
        : { recipe_id: source.id }),
      quantity,
      meal,
      consumed_at: consumedAt.toISOString(),
    })
      .then((entry) => {
        setEntries((prev) => (prev ? [entry, ...prev] : [entry]));
      })
      .catch((err: Error) => setLogError(err.message))
      .finally(() => setLogBusy(false));
  }

  function handleDelete(id: string) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setRowBusyID(id);
    deleteNutritionLogEntry(token, id)
      .then(() => {
        setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setRowBusyID(null));
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Nutrition</h1>
          <DateSelector value={date} onChange={setDate} />
        </div>
        <p className="text-xs text-[var(--muted)]">
          Log meals here or in chat. Macros are frozen at log time, so
          editing a pantry item later won&apos;t rewrite this day.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {goals && (
            <MacroGoalRings
              totals={totals}
              goals={goals}
              onSetGoals={() => setShowGoalsModal(true)}
            />
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight">Quick-add</h2>
            <QuickAdd
              pantry={pantry}
              recipes={recipes}
              busy={logBusy}
              error={logError}
              onLog={handleLog}
            />
          </section>

          {entries === null && (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          )}
          {entries && (
            <MealSections
              entries={entries}
              pantryByID={pantryByID}
              recipeByID={recipeByID}
              rowBusyID={rowBusyID}
              onDelete={handleDelete}
            />
          )}
        </div>
      </div>
      {showGoalsModal && goals && (
        <MacroGoalsModal
          token={getToken() ?? ""}
          initial={goals}
          onSaved={(saved) => {
            setGoals(saved);
            setShowGoalsModal(false);
          }}
          onClose={() => setShowGoalsModal(false)}
        />
      )}
    </main>
  );
}

function DateSelector({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const isToday = sameLocalDay(value, new Date());
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(addDays(value, -1))}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs hover:opacity-80"
        aria-label="Previous day"
      >
        ←
      </button>
      <input
        type="date"
        value={toLocalDateInputValue(value)}
        onChange={(e) => {
          if (e.target.value) onChange(fromLocalDateInputValue(e.target.value));
        }}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs tabular-nums"
      />
      <button
        type="button"
        onClick={() => onChange(addDays(value, 1))}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs hover:opacity-80"
        aria-label="Next day"
      >
        →
      </button>
      {!isToday && (
        <button
          type="button"
          onClick={() => onChange(startOfLocalDay(new Date()))}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs hover:opacity-80"
        >
          Today
        </button>
      )}
    </div>
  );
}

function QuickAdd({
  pantry,
  recipes,
  busy,
  error,
  onLog,
}: {
  pantry: PantryItem[];
  recipes: Recipe[];
  busy: boolean;
  error: string | null;
  onLog: (
    source: { kind: "pantry" | "recipe"; id: string },
    quantity: number,
    meal: MealType,
  ) => void;
}) {
  // Picker value is a "kind:id" string so a single <select> can host
  // both pantry items and recipes. Parsed back into the discriminated
  // shape at log time.
  const [selection, setSelection] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("1");
  // Meal default tracks the user's local time of day on mount.
  // After they submit, we leave the meal where they last left it
  // (rather than re-inferring) so a string of breakfast entries
  // doesn't suddenly snap to "lunch" because they crossed an
  // imaginary boundary mid-logging.
  const [meal, setMeal] = useState<MealType>(() => defaultMealForLocalHour(new Date()));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    if (!selection || !Number.isFinite(q) || q <= 0) return;
    const [kind, id] = selection.split(":", 2);
    if ((kind !== "pantry" && kind !== "recipe") || !id) return;
    onLog({ kind, id }, q, meal);
    // Keep selection + meal so logging the same thing twice in a
    // row is fast; reset quantity to 1 as the friction-minimizing
    // default.
    setQuantity("1");
  }

  if (pantry.length === 0 && recipes.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        Add a pantry item first.{" "}
        <a className="text-[var(--accent)] hover:underline" href="/pantry">
          Go to Pantry →
        </a>
      </p>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-end"
    >
      <label className="flex flex-1 flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
          Item or recipe
        </span>
        <select
          value={selection}
          onChange={(e) => setSelection(e.target.value)}
          disabled={busy}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
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
      <label className="flex w-full flex-col gap-1 text-xs sm:w-32">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
          Meal
        </span>
        <select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealType)}
          disabled={busy}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
        >
          {MEAL_ORDER.map((m) => (
            <option key={m} value={m}>
              {MEAL_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs sm:w-24">
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
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm tabular-nums"
        />
      </label>
      <button
        type="submit"
        disabled={busy || !selection}
        className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
      >
        {busy ? "Logging…" : "Log"}
      </button>
      {error && (
        <p className="w-full text-xs text-[var(--danger)] sm:ml-3">{error}</p>
      )}
    </form>
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
          {formatNumber(entry.calories)} cal · P {formatNumber(entry.protein_g)}g ·
          F {formatNumber(entry.fat_g)}g · C {formatNumber(entry.carbs_g)}g
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

// --- Meal sections -------------------------------------------------------

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
  // Bucket the entries by meal up front. Within a bucket entries
  // stay in the parent's order (consumed_at DESC from the API),
  // which reads as "freshest first" inside each section.
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

  // Empty sections still render so the user has a visual cue for
  // meals they haven't logged yet — "Lunch (empty)" reads as a
  // reminder, where collapsing the section would just hide the gap.
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">
          {MEAL_LABELS[meal]}
        </h2>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {entries.length === 0 ? (
            <span className="italic">No entries</span>
          ) : (
            <>
              {formatNumber(subtotal.calories)} cal · P{" "}
              {formatNumber(subtotal.protein_g)}g · F{" "}
              {formatNumber(subtotal.fat_g)}g · C{" "}
              {formatNumber(subtotal.carbs_g)}g
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

// --- helpers --------------------------------------------------------------

// defaultMealForLocalHour picks a sensible meal based on the user's
// local time. Loose ranges — covers the bulk case, the picker is
// always overridable. Outside the meal windows we default to snack
// because off-meal foods (coffee, fruit, a protein bar) are usually
// what's logged in those hours.
function defaultMealForLocalHour(d: Date): MealType {
  const h = d.getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 15) return "lunch";
  if (h >= 17 && h < 22) return "dinner";
  return "snack";
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return startOfLocalDay(out);
}

function toLocalDateInputValue(d: Date): string {
  // <input type="date"> expects YYYY-MM-DD in the user's local time —
  // toISOString() would render UTC and slip a day around midnight.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromLocalDateInputValue(v: string): Date {
  const [y, m, d] = v.split("-").map((s) => Number(s));
  return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
