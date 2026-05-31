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
import { DateTileStrip } from "@/components/date-tile-strip";
import { MacroGoalRings } from "@/components/macro-goal-rings";
import { MacroGoalsModal } from "@/components/macro-goals-modal";
import { QuickAddModal } from "@/components/quick-add-modal";
import { NutritionLogView } from "@/components/nutrition/nutrition-log-view";

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
  const [showQuickAdd, setShowQuickAdd] = useState(false);
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

  // Returns a Promise so the QuickAddModal can await it: on resolve
  // the modal closes itself; on reject the modal stays open and reads
  // the error message off `logError`. Error state is set in the catch
  // before we re-throw so the modal sees the latest message.
  function handleLog(
    source: { kind: "pantry" | "recipe"; id: string },
    quantity: number,
    meal: MealType,
  ): Promise<void> {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.reject(new Error("not signed in"));
    }
    setLogBusy(true);
    setLogError(null);
    // consumed_at: noon on the selected local day if not today; current
    // local time if today. Noon avoids the "midnight UTC entry shows
    // as the previous day in some zones" trap on backdated logs.
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
      .catch((err: Error) => {
        setLogError(err.message);
        throw err;
      })
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

          {/* Small toolbar sitting above the meal sections. White
              icon-text buttons (no fill, no border) keep the page's
              visual weight on the rings; the bottom border doubles as
              the separator between the toolbar and the daily log
              below. Goals-not-set vs goals-set decides the second
              button's label so the same affordance covers both
              flows. */}
          <div className="flex items-center gap-5 border-b border-[var(--border)] pb-3">
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

          <NutritionLogView
            entries={entries}
            pantryByID={pantryByID}
            recipeByID={recipeByID}
            rowBusyID={rowBusyID}
            onDelete={handleDelete}
          />
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
      {showQuickAdd && (
        <QuickAddModal
          pantry={pantry}
          recipes={recipes}
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

// Ghost-style button — no fill, no border. The icon and the label
// both ride on `text-[var(--foreground)]` so the white-on-dark theme
// reads as "clickable text with an icon" rather than a heavyweight
// action chip. The bottom-border on the parent flex row provides the
// only visual frame.
function ToolbarButton({
  onClick,
  icon,
  label,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition hover:opacity-70"
    >
      {icon}
      {label}
    </button>
  );
}

// Inline SVG icons rather than pulling in lucide-react or heroicons:
// two icons used in exactly one place, so the dependency cost isn't
// worth saving ~30 lines. `currentColor` lets the parent button drive
// the stroke color, which means the white-on-dark theme + any future
// theme swap just work.
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
