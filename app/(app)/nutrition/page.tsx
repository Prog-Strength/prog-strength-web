"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { DateTileStrip } from "@/components/date-tile-strip";
import { MacroGoalRings } from "@/components/macro-goal-rings";
import { MacroGoalsModal } from "@/components/macro-goals-modal";
import { QuickAddModal } from "@/components/quick-add-modal";
import { NutritionLogView } from "@/components/nutrition/nutrition-log-view";
import { PantryView } from "@/components/nutrition/pantry-view";
import { RecipesView } from "@/components/nutrition/recipes-view";

type View = "log" | "pantry" | "recipes";

function parseView(raw: string | null): View {
  if (raw === "pantry" || raw === "recipes") return raw;
  return "log";
}

/**
 * Nutrition — daily log + macro widget + Pantry/Recipes catalogs,
 * switched by the ?view= URL param.
 *
 * The page is split into an outer Suspense wrapper and an inner
 * component so the inner can use `useSearchParams` without tripping
 * Next 16's prerender requirement (see
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md).
 */
export default function NutritionPage() {
  return (
    <Suspense fallback={null}>
      <NutritionPageInner />
    </Suspense>
  );
}

function NutritionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));

  const [date, setDate] = useState<Date>(() => startOfLocalDay(new Date()));
  const [entries, setEntries] = useState<NutritionLogEntry[] | null>(null);
  const [pantry, setPantry] = useState<PantryItem[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [goals, setGoals] = useState<MacroGoals | null>(null);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logBusy, setLogBusy] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);

  const requireToken = useCallback((): string | null => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return null;
    }
    return token;
  }, [router]);

  const handleApiError = useCallback(
    (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("401")) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(msg);
    },
    [router],
  );

  const fetchEntries = useCallback(
    (d: Date) => {
      const token = requireToken();
      if (!token) return;
      const since = d.toISOString();
      const until = endOfLocalDay(d).toISOString();
      listNutritionLog(token, { since, until }).then(setEntries).catch(handleApiError);
    },
    [requireToken, handleApiError],
  );

  const fetchPantry = useCallback(() => {
    const token = requireToken();
    if (!token) return;
    listPantryItems(token).then(setPantry).catch(handleApiError);
  }, [requireToken, handleApiError]);

  const fetchRecipes = useCallback(() => {
    const token = requireToken();
    if (!token) return;
    listRecipes(token).then(setRecipes).catch(handleApiError);
  }, [requireToken, handleApiError]);

  const fetchGoals = useCallback(() => {
    const token = requireToken();
    if (!token) return;
    getMacroGoals(token).then(setGoals).catch(handleApiError);
  }, [requireToken, handleApiError]);

  // Mount: load the date-independent resources once.
  useEffect(() => {
    fetchPantry();
    fetchRecipes();
    fetchGoals();
  }, [fetchPantry, fetchRecipes, fetchGoals]);

  // Date change: only the log entries depend on the date.
  useEffect(() => {
    fetchEntries(date);
  }, [date, fetchEntries]);

  const pantryByID = useMemo(() => {
    const m = new Map<string, PantryItem>();
    for (const p of pantry ?? []) m.set(p.id, p);
    return m;
  }, [pantry]);
  const recipeByID = useMemo(() => {
    const m = new Map<string, Recipe>();
    for (const r of recipes ?? []) m.set(r.id, r);
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

  function setView(next: View) {
    router.replace(next === "log" ? "/nutrition" : `/nutrition?view=${next}`);
  }

  function handleLog(
    source: { kind: "pantry" | "recipe"; id: string },
    quantity: number,
    meal: MealType,
  ): Promise<void> {
    const token = requireToken();
    if (!token) return Promise.reject(new Error("not signed in"));
    setLogBusy(true);
    setLogError(null);
    const isToday = sameLocalDay(date, new Date());
    const consumedAt = isToday ? new Date() : new Date(date.getTime() + 12 * 60 * 60 * 1000);
    return createNutritionLogEntry(token, {
      ...(source.kind === "pantry" ? { pantry_item_id: source.id } : { recipe_id: source.id }),
      quantity,
      meal,
      consumed_at: consumedAt.toISOString(),
    })
      .then((entry) => {
        setEntries((prev) => (prev ? [entry, ...prev] : [entry]));
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setLogError(msg);
        throw err;
      })
      .finally(() => setLogBusy(false));
  }

  function handleDelete(id: string) {
    const token = requireToken();
    if (!token) return;
    setRowBusyID(id);
    deleteNutritionLogEntry(token, id)
      .then(() => {
        setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setRowBusyID(null));
  }

  // Triggered by pantry-item mutations. Recipes' derived macros
  // depend on pantry items, so refresh both.
  const onPantryChanged = useCallback(() => {
    fetchPantry();
    fetchRecipes();
  }, [fetchPantry, fetchRecipes]);

  const token = getToken() ?? "";

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Nutrition</h1>
        <p className="text-xs text-[var(--muted)]">
          Log meals here or in chat. Macros are frozen at log time, so editing a pantry item later
          won&apos;t rewrite this day.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <DateTileStrip value={date} onChange={setDate} />

          {goals && <MacroGoalRings totals={totals} goals={goals} date={date} />}

          {/* Toolbar row: left group are actions, right group are view
              switches. The bottom border of this row doubles as the
              separator between the toolbar and the body below. */}
          <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
            <div className="flex items-center gap-5">
              <ToolbarButton
                onClick={() => setShowQuickAdd(true)}
                icon={<PlusIcon />}
                label="Quick Add"
              />
              <ToolbarButton
                onClick={() => setShowGoalsModal(true)}
                icon={<PencilIcon />}
                label={goals?.created_at ? "Edit Macros" : "Set Macros"}
              />
            </div>
            <div className="flex items-center gap-5">
              <ToolbarButton
                onClick={() => setView("pantry")}
                icon={<JarIcon />}
                label="Pantry"
                active={view === "pantry"}
              />
              <ToolbarButton
                onClick={() => setView("recipes")}
                icon={<ListIcon />}
                label="Recipes"
                active={view === "recipes"}
              />
            </div>
          </div>

          {view === "log" && (
            <NutritionLogView
              entries={entries}
              pantryByID={pantryByID}
              recipeByID={recipeByID}
              rowBusyID={rowBusyID}
              onDelete={handleDelete}
            />
          )}
          {view === "pantry" && (
            <PantryView token={token} pantry={pantry} onChanged={onPantryChanged} />
          )}
          {view === "recipes" && (
            <RecipesView token={token} pantry={pantry} recipes={recipes} onChanged={fetchRecipes} />
          )}
        </div>
      </div>
      {showGoalsModal && goals && (
        <MacroGoalsModal
          token={token}
          initial={goals}
          onSaved={(saved) => {
            setGoals(saved);
            setShowGoalsModal(false);
          }}
          onClose={() => setShowGoalsModal(false)}
        />
      )}
      {showQuickAdd && (
        <QuickAddModal
          pantry={pantry ?? []}
          recipes={recipes ?? []}
          busy={logBusy}
          error={logError}
          onLog={handleLog}
          onClose={() => setShowQuickAdd(false)}
        />
      )}
    </main>
  );
}

// --- helpers --------------------------------------------------------------

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

// --- Toolbar bits --------------------------------------------------

/**
 * Ghost-style button. When `active` is true (used by the Pantry and
 * Recipes tabs), the button paints a 2px underline that aligns with
 * the parent row's bottom border, so the active tab visually
 * "connects" to the separator below.
 */
function ToolbarButton({
  onClick,
  icon,
  label,
  active,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition hover:opacity-70 " +
        (active ? "border-b-2 border-[var(--foreground)] -mb-[14px] pb-3" : "")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function PlusIcon() {
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
      <path d="M12 5v14M5 12h14" />
    </svg>
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

function JarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M7 4h10v3H7z" />
      <path d="M6 9h12v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9z" />
      <path d="M9 13h6" />
    </svg>
  );
}

function ListIcon() {
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
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <circle cx="4" cy="6" r="0.5" fill="currentColor" />
      <circle cx="4" cy="12" r="0.5" fill="currentColor" />
      <circle cx="4" cy="18" r="0.5" fill="currentColor" />
    </svg>
  );
}
