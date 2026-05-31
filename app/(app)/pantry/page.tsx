"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import {
  createPantryItem,
  createRecipe,
  deletePantryItem,
  deleteRecipe,
  listPantryItems,
  listRecipes,
  updatePantryItem,
  updateRecipe,
  type PantryItem,
  type PantryItemPayload,
  type Recipe,
  type RecipePayload,
} from "@/lib/api";
import { PantryItemForm } from "@/components/pantry-item-form";
import { RecipeForm } from "@/components/recipe-form";

/**
 * Pantry — two-tab page covering the user's saved foods.
 *
 * The Pantry tab is the table of individual items (per-serving
 * macros). The Recipes tab is the bag-of-pantry-items quick-add
 * builder; both tabs share the underlying pantry list because every
 * recipe component points at a pantry item.
 *
 * Data flow: page-level fetches the pantry list once and reshares it
 * with both tabs. The recipes tab additionally fetches its own
 * recipes list. Save flows splice the response into local state to
 * avoid a refetch round trip.
 */

type Tab = "pantry" | "recipes";

export default function PantryPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pantry");
  const [pantry, setPantry] = useState<PantryItem[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPantry = useCallback(
    (q?: string) => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.resolve();
      }
      return listPantryItems(token, q)
        .then(setPantry)
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

  const fetchRecipes = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return Promise.resolve();
    }
    return listRecipes(token)
      .then(setRecipes)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  useEffect(() => {
    fetchPantry();
    fetchRecipes();
  }, [fetchPantry, fetchRecipes]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Pantry</h1>
        <p className="text-xs text-[var(--muted)]">
          Your saved foods on the left tab; recipes you&apos;ve built on
          top of them on the right. Both feed the Nutrition page&apos;s
          quick-add and the agent&apos;s log tools.
        </p>
        <TabBar value={tab} onChange={setTab} />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
          {tab === "pantry" ? (
            <PantryTab
              items={pantry}
              onChanged={() => {
                fetchPantry();
                // Recipes' derived macros depend on pantry items;
                // refetch recipes too so the macro pills stay
                // consistent after an edit.
                fetchRecipes();
              }}
              onError={setError}
            />
          ) : (
            <RecipesTab
              pantry={pantry ?? []}
              recipes={recipes}
              onChanged={fetchRecipes}
              onError={setError}
            />
          )}
        </div>
      </div>
    </main>
  );
}

function TabBar({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Pantry sections"
      className="inline-flex shrink-0 self-start rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs"
    >
      <TabButton active={value === "pantry"} onClick={() => onChange("pantry")}>
        Pantry
      </TabButton>
      <TabButton active={value === "recipes"} onClick={() => onChange("recipes")}>
        Recipes
      </TabButton>
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 font-medium transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

// --- Pantry tab ---------------------------------------------------

function PantryTab({
  items,
  onChanged,
  onError,
}: {
  items: PantryItem[] | null;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const filtered = items
    ? items.filter((p) =>
        query.trim() === ""
          ? true
          : p.name.toLowerCase().includes(query.toLowerCase()),
      )
    : null;

  function handleCreate(payload: PantryItemPayload) {
    const token = getToken();
    if (!token) return;
    setCreateBusy(true);
    setCreateError(null);
    createPantryItem(token, payload)
      .then(() => onChanged())
      .catch((err: Error) => setCreateError(err.message))
      .finally(() => setCreateBusy(false));
  }

  function handleUpdate(id: string, payload: PantryItemPayload) {
    const token = getToken();
    if (!token) return;
    setRowBusyID(id);
    setRowError(null);
    updatePantryItem(token, id, payload)
      .then(() => {
        setEditingID(null);
        onChanged();
      })
      .catch((err: Error) => setRowError(err.message))
      .finally(() => setRowBusyID(null));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this pantry item? Historical log entries keep their macros.")) {
      return;
    }
    const token = getToken();
    if (!token) return;
    setRowBusyID(id);
    setRowError(null);
    deletePantryItem(token, id)
      .then(() => onChanged())
      .catch((err: Error) => {
        setRowError(err.message);
        onError(err.message);
      })
      .finally(() => setRowBusyID(null));
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Add a new item</h2>
        <PantryItemForm
          submitLabel="Save"
          busy={createBusy}
          error={createError}
          onSubmit={handleCreate}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-tight">Saved items</h2>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-48 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
          />
        </div>

        {rowError && (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
            {rowError}
          </div>
        )}

        {items === null && (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}

        {filtered && filtered.length === 0 && (
          <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            {query
              ? "No items match that search."
              : "Your pantry is empty. Add an item above to get started."}
          </p>
        )}

        {filtered && filtered.length > 0 && (
          <ul className="flex flex-col gap-2">
            {filtered.map((p) =>
              editingID === p.id ? (
                <li key={p.id}>
                  <PantryItemForm
                    initial={p}
                    submitLabel="Save changes"
                    busy={rowBusyID === p.id}
                    error={rowError}
                    onSubmit={(payload) => handleUpdate(p.id, payload)}
                    onCancel={() => {
                      setEditingID(null);
                      setRowError(null);
                    }}
                  />
                </li>
              ) : (
                <li key={p.id}>
                  <PantryRow
                    item={p}
                    busy={rowBusyID === p.id}
                    onEdit={() => setEditingID(p.id)}
                    onDelete={() => handleDelete(p.id)}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </>
  );
}

function PantryRow({
  item,
  busy,
  onEdit,
  onDelete,
}: {
  item: PantryItem;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(item.calories)} cal · P {formatNumber(item.protein_g)}g ·
          F {formatNumber(item.fat_g)}g · C {formatNumber(item.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">
            per {formatNumber(item.serving_size)} {item.serving_unit}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:opacity-80 disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// --- Recipes tab --------------------------------------------------

function RecipesTab({
  pantry,
  recipes,
  onChanged,
  onError,
}: {
  pantry: PantryItem[];
  recipes: Recipe[] | null;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  function handleCreate(payload: RecipePayload) {
    const token = getToken();
    if (!token) return;
    setCreateBusy(true);
    setCreateError(null);
    createRecipe(token, payload)
      .then(() => onChanged())
      .catch((err: Error) => setCreateError(err.message))
      .finally(() => setCreateBusy(false));
  }

  function handleUpdate(id: string, payload: RecipePayload) {
    const token = getToken();
    if (!token) return;
    setRowBusyID(id);
    setRowError(null);
    updateRecipe(token, id, payload)
      .then(() => {
        setEditingID(null);
        onChanged();
      })
      .catch((err: Error) => setRowError(err.message))
      .finally(() => setRowBusyID(null));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this recipe? Historical log entries keep their macros.")) {
      return;
    }
    const token = getToken();
    if (!token) return;
    setRowBusyID(id);
    setRowError(null);
    deleteRecipe(token, id)
      .then(() => onChanged())
      .catch((err: Error) => {
        setRowError(err.message);
        onError(err.message);
      })
      .finally(() => setRowBusyID(null));
  }

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Build a recipe</h2>
        <RecipeForm
          pantry={pantry}
          submitLabel="Save recipe"
          busy={createBusy}
          error={createError}
          onSubmit={handleCreate}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Saved recipes</h2>

        {rowError && (
          <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
            {rowError}
          </div>
        )}

        {recipes === null && (
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        )}

        {recipes && recipes.length === 0 && (
          <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
            No recipes yet. Build one above to quick-add a regular meal.
          </p>
        )}

        {recipes && recipes.length > 0 && (
          <ul className="flex flex-col gap-2">
            {recipes.map((r) =>
              editingID === r.id ? (
                <li key={r.id}>
                  <RecipeForm
                    initial={r}
                    pantry={pantry}
                    submitLabel="Save changes"
                    busy={rowBusyID === r.id}
                    error={rowError}
                    onSubmit={(payload) => handleUpdate(r.id, payload)}
                    onCancel={() => {
                      setEditingID(null);
                      setRowError(null);
                    }}
                  />
                </li>
              ) : (
                <li key={r.id}>
                  <RecipeRow
                    recipe={r}
                    pantry={pantry}
                    busy={rowBusyID === r.id}
                    onEdit={() => setEditingID(r.id)}
                    onDelete={() => handleDelete(r.id)}
                  />
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </>
  );
}

function RecipeRow({
  recipe,
  pantry,
  busy,
  onEdit,
  onDelete,
}: {
  recipe: Recipe;
  pantry: PantryItem[];
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pantryByID = new Map(pantry.map((p) => [p.id, p]));
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium">{recipe.name}</p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={busy}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:opacity-80 disabled:opacity-50"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
      <p className="text-xs text-[var(--muted)] tabular-nums">
        {formatNumber(recipe.macros.calories)} cal · P {formatNumber(recipe.macros.protein_g)}g ·
        F {formatNumber(recipe.macros.fat_g)}g · C {formatNumber(recipe.macros.carbs_g)}g
        <span className="ml-2 text-[10px] uppercase tracking-wider">per batch</span>
      </p>
      <ul className="flex flex-col gap-0.5 text-xs text-[var(--muted)]">
        {recipe.components.map((c) => {
          const name = pantryByID.get(c.pantry_item_id)?.name ?? "Unknown item";
          return (
            <li key={c.id} className="flex items-baseline gap-2">
              <span className="tabular-nums">×{formatNumber(c.quantity)}</span>
              <span className="truncate">{name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// --- helpers ------------------------------------------------------
