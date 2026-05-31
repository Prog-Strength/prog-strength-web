# Nutrition Page Pantry/Recipes Tabs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the `/pantry` page's Pantry and Recipes catalogs into `/nutrition` as URL-backed view tabs (Pantry / Recipes), alongside the existing Quick Add / Edit Macros actions in the toolbar, and delete the standalone `/pantry` route.

**Architecture:** `NutritionPage` becomes a thin shell that owns four per-resource fetches (entries on date-change, pantry/recipes/goals on mount + mutation) and renders one of three view components (`NutritionLogView`, `PantryView`, `RecipesView`) based on the `?view=` URL param. Edit and delete for pantry items and recipes move into modal wrappers around the existing forms; both modals call the API directly and notify the shell via a callback that triggers a targeted refetch.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Tailwind v4. No test suite exists in `prog-strength-web` — per the spec, verification is `npm run lint`, `npm run build`, and manual browser smoke testing via `npm run dev`. Each task ends with the relevant verification commands and a commit.

**Spec:** `docs/superpowers/specs/2026-05-31-nutrition-tabs-design.md`

---

## Working directory

All paths below are relative to `repos/prog-strength-web/` unless otherwise noted. Run all `npm` commands from that directory.

## Next.js 16 note on `useSearchParams`

The new shell reads `view` from the URL via `useSearchParams` (from `next/navigation`). Per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`, a Client Component that calls `useSearchParams` must be wrapped in a `<Suspense>` boundary or the production build fails with "Missing Suspense boundary with useSearchParams." Task 9 introduces this wrapper.

---

## Task 1: Extract `formatNumber` into `lib/format.ts`

**Why first:** Three new view components will need `formatNumber`, and it's currently duplicated across three files. Centralizing it first means later tasks can import from one place.

**Files:**

- Create: `lib/format.ts`
- Modify: `app/(app)/nutrition/page.tsx` (remove duplicate, import shared)
- Modify: `app/(app)/pantry/page.tsx` (remove duplicate, import shared — this file will be deleted in Task 11, but we keep it functional until then)
- Modify: `components/recipe-form.tsx` (remove duplicate, import shared)

- [ ] **Step 1: Create `lib/format.ts`**

```ts
/**
 * Format a numeric value for display: at most one decimal place, no
 * trailing zero on integers, em-dash for non-finite. Used by the
 * Nutrition log subtotals, pantry/recipe rows, and the recipe form's
 * macro preview tiles.
 */
export function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
```

- [ ] **Step 2: Replace local `formatNumber` in `app/(app)/nutrition/page.tsx`**

Remove the local function definition at the bottom of the file (currently at lines ~456-460):

```ts
function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
```

Add the import at the top of the file's existing import block:

```ts
import { formatNumber } from "@/lib/format";
```

- [ ] **Step 3: Replace local `formatNumber` in `app/(app)/pantry/page.tsx`**

Remove the local function definition at the bottom of the file (currently at lines ~557-561).

Add to the imports:

```ts
import { formatNumber } from "@/lib/format";
```

- [ ] **Step 4: Replace local `formatNumber` in `components/recipe-form.tsx`**

Remove the local function definition at the bottom of the file (currently at lines ~371-375).

Add to the imports:

```ts
import { formatNumber } from "@/lib/format";
```

- [ ] **Step 5: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds.

```bash
git add lib/format.ts app/\(app\)/nutrition/page.tsx app/\(app\)/pantry/page.tsx components/recipe-form.tsx
git commit -m "refactor: extract formatNumber to lib/format"
```

---

## Task 2: Add optional `onDelete` prop to `PantryItemForm`

**Why:** The new `PantryItemModal` (Task 4) reuses this form and needs a Delete button in the footer alongside Cancel/Save in edit mode. Adding the prop here keeps the form's footer the single source of truth for its action row.

**Files:**

- Modify: `components/pantry-item-form.tsx`

- [ ] **Step 1: Extend the props type**

In the component signature, add `onDelete` as the last optional prop:

```ts
export function PantryItemForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Partial<PantryItemPayload>;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (payload: PantryItemPayload) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
```

- [ ] **Step 2: Render the Delete button in the footer**

Replace the existing footer row (currently at lines ~143-161) with:

```tsx
<div className="flex items-center justify-end gap-2">
  {onCancel && (
    <button
      type="button"
      onClick={onCancel}
      disabled={busy}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
    >
      Cancel
    </button>
  )}
  {onDelete && (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:opacity-80 disabled:opacity-50"
    >
      Delete
    </button>
  )}
  <button
    type="submit"
    disabled={busy}
    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
  >
    {busy ? "Saving…" : submitLabel}
  </button>
</div>
```

Note: `Delete` sits between `Cancel` and `Save`. Existing call sites in `app/(app)/pantry/page.tsx` omit `onDelete`, so they render identically to today.

- [ ] **Step 3: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds. Visiting `/pantry` in dev should show unchanged behavior (no Delete button anywhere yet).

```bash
git add components/pantry-item-form.tsx
git commit -m "feat: PantryItemForm accepts optional onDelete prop"
```

---

## Task 3: Add optional `onDelete` prop to `RecipeForm`

**Files:**

- Modify: `components/recipe-form.tsx`

- [ ] **Step 1: Extend the props type**

Add `onDelete?: () => void` as the last optional prop:

```ts
export function RecipeForm({
  initial,
  pantry,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Recipe;
  pantry: PantryItem[];
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  onSubmit: (payload: RecipePayload) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
```

- [ ] **Step 2: Render the Delete button in the footer**

Replace the existing footer row (currently at lines ~235-253) with:

```tsx
<div className="flex items-center justify-end gap-2">
  {onCancel && (
    <button
      type="button"
      onClick={onCancel}
      disabled={busy}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
    >
      Cancel
    </button>
  )}
  {onDelete && (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:opacity-80 disabled:opacity-50"
    >
      Delete
    </button>
  )}
  <button
    type="submit"
    disabled={busy}
    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
  >
    {busy ? "Saving…" : submitLabel}
  </button>
</div>
```

- [ ] **Step 3: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds.

```bash
git add components/recipe-form.tsx
git commit -m "feat: RecipeForm accepts optional onDelete prop"
```

---

## Task 4: Create `PantryItemModal`

**Why:** A modal wrapper around `PantryItemForm` that owns its create/edit/delete API calls and includes the inline delete-confirm step. Modeled on `MacroGoalsModal` (overlay, backdrop click, Escape to close, body scroll lock).

**Files:**

- Create: `components/pantry-item-modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  createPantryItem,
  deletePantryItem,
  updatePantryItem,
  type PantryItem,
  type PantryItemPayload,
} from "@/lib/api";
import { PantryItemForm } from "@/components/pantry-item-form";

/**
 * Modal wrapper around PantryItemForm. In create mode the modal calls
 * createPantryItem on submit. In edit mode it calls updatePantryItem
 * on submit and exposes a Delete button that opens an inline confirm
 * panel; confirming calls deletePantryItem.
 *
 * Dismissal: Escape, backdrop click (ignored while busy), or the X in
 * the header. Body scroll locks while open. Same ergonomics as
 * MacroGoalsModal.
 */
type Props =
  | {
      mode: "create";
      token: string;
      onSaved: () => void;
      onClose: () => void;
    }
  | {
      mode: "edit";
      token: string;
      initial: PantryItem;
      onSaved: () => void;
      onDeleted: () => void;
      onClose: () => void;
    };

export function PantryItemModal(props: Props) {
  const { mode, token, onClose } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function handleSubmit(payload: PantryItemPayload) {
    setBusy(true);
    setError(null);
    const op =
      mode === "create"
        ? createPantryItem(token, payload)
        : updatePantryItem(token, props.initial.id, payload);
    op.then(() => {
      props.onSaved();
      onClose();
    })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  }

  function handleDeleteConfirm() {
    if (mode !== "edit") return;
    setBusy(true);
    setError(null);
    deletePantryItem(token, props.initial.id)
      .then(() => {
        props.onDeleted();
        onClose();
      })
      .catch((err: Error) => {
        setError(err.message);
        setConfirmingDelete(false);
      })
      .finally(() => setBusy(false));
  }

  const title = mode === "create" ? "Add pantry item" : "Edit pantry item";
  const submitLabel = mode === "create" ? "Save" : "Save changes";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pantry-item-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="pantry-item-modal-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          {confirmingDelete ? (
            <div className="flex flex-col gap-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3">
              <p className="text-sm">
                Delete this pantry item? Historical log entries keep their macros.
              </p>
              {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setError(null);
                  }}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={busy}
                  className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-80 disabled:opacity-50"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <PantryItemForm
              initial={mode === "edit" ? props.initial : undefined}
              submitLabel={submitLabel}
              busy={busy}
              error={error}
              onSubmit={handleSubmit}
              onCancel={onClose}
              onDelete={mode === "edit" ? () => setConfirmingDelete(true) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds. Component is not yet rendered anywhere — the build is just type-checking it.

```bash
git add components/pantry-item-modal.tsx
git commit -m "feat: add PantryItemModal with inline delete confirm"
```

---

## Task 5: Create `RecipeModal`

**Files:**

- Create: `components/recipe-modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  createRecipe,
  deleteRecipe,
  updateRecipe,
  type PantryItem,
  type Recipe,
  type RecipePayload,
} from "@/lib/api";
import { RecipeForm } from "@/components/recipe-form";

/**
 * Modal wrapper around RecipeForm. Mirrors PantryItemModal: create or
 * edit, with an inline delete-confirm panel in edit mode. Takes the
 * pantry array as a prop and threads it to RecipeForm so the form can
 * render its pantry-item picker.
 */
type Props =
  | {
      mode: "create";
      token: string;
      pantry: PantryItem[];
      onSaved: () => void;
      onClose: () => void;
    }
  | {
      mode: "edit";
      token: string;
      pantry: PantryItem[];
      initial: Recipe;
      onSaved: () => void;
      onDeleted: () => void;
      onClose: () => void;
    };

export function RecipeModal(props: Props) {
  const { mode, token, pantry, onClose } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function handleSubmit(payload: RecipePayload) {
    setBusy(true);
    setError(null);
    const op =
      mode === "create"
        ? createRecipe(token, payload)
        : updateRecipe(token, props.initial.id, payload);
    op.then(() => {
      props.onSaved();
      onClose();
    })
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(false));
  }

  function handleDeleteConfirm() {
    if (mode !== "edit") return;
    setBusy(true);
    setError(null);
    deleteRecipe(token, props.initial.id)
      .then(() => {
        props.onDeleted();
        onClose();
      })
      .catch((err: Error) => {
        setError(err.message);
        setConfirmingDelete(false);
      })
      .finally(() => setBusy(false));
  }

  const title = mode === "create" ? "Add recipe" : "Edit recipe";
  const submitLabel = mode === "create" ? "Save recipe" : "Save changes";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recipe-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="recipe-modal-title" className="text-base font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          {confirmingDelete ? (
            <div className="flex flex-col gap-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3">
              <p className="text-sm">
                Delete this recipe? Historical log entries keep their macros.
              </p>
              {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setError(null);
                  }}
                  disabled={busy}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={busy}
                  className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-80 disabled:opacity-50"
                >
                  {busy ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <RecipeForm
              initial={mode === "edit" ? props.initial : undefined}
              pantry={pantry}
              submitLabel={submitLabel}
              busy={busy}
              error={error}
              onSubmit={handleSubmit}
              onCancel={onClose}
              onDelete={mode === "edit" ? () => setConfirmingDelete(true) : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds.

```bash
git add components/recipe-modal.tsx
git commit -m "feat: add RecipeModal with inline delete confirm"
```

---

## Task 6: Extract `NutritionLogView` from the current page

**Why:** Pure code move — pulls the meal-sections rendering (and supporting helpers) into its own file so `NutritionPage` can swap it in/out alongside the new Pantry/Recipes views. No behavior change.

**Files:**

- Create: `components/nutrition/nutrition-log-view.tsx`
- Modify: `app/(app)/nutrition/page.tsx` (drop the extracted code, import the new component)

- [ ] **Step 1: Create the new directory and file**

```bash
mkdir -p components/nutrition
```

Create `components/nutrition/nutrition-log-view.tsx`:

```tsx
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
```

- [ ] **Step 2: Remove the extracted code from `app/(app)/nutrition/page.tsx`**

Delete the following from the page file:

- The `MEAL_ORDER` and `MEAL_LABELS` constants near the top (lines ~28-34).
- The `LogEntryRow`, `MealSections`, `MealSection` functions and the comment block above `MealSections` (lines ~263-436).
- The `formatLocalTime` function (lines ~462-467).

In the page's JSX, replace the existing rendering block:

```tsx
{
  entries === null && <p className="text-sm text-[var(--muted)]">Loading…</p>;
}
{
  entries && (
    <MealSections
      entries={entries}
      pantryByID={pantryByID}
      recipeByID={recipeByID}
      rowBusyID={rowBusyID}
      onDelete={handleDelete}
    />
  );
}
```

with:

```tsx
<NutritionLogView
  entries={entries}
  pantryByID={pantryByID}
  recipeByID={recipeByID}
  rowBusyID={rowBusyID}
  onDelete={handleDelete}
/>
```

Add the import at the top of the file:

```ts
import { NutritionLogView } from "@/components/nutrition/nutrition-log-view";
```

Also drop the now-unused `MealType` import (still needed elsewhere in the page only if Quick Add uses it; check — `handleLog` uses `MealType` for its `meal` parameter, so keep it). Drop unused imports the lint step flags.

- [ ] **Step 3: Verify and commit**

```bash
npm run lint
npm run build
npm run dev
```

Open `http://localhost:3000/nutrition` in a browser, log in if needed, and confirm: the page renders today's meal sections exactly as before (Breakfast / Lunch / Dinner / Snacks), the macro rings still appear, Quick Add still works. Then stop the dev server.

```bash
git add components/nutrition/nutrition-log-view.tsx app/\(app\)/nutrition/page.tsx
git commit -m "refactor: extract NutritionLogView from nutrition page"
```

---

## Task 7: Create `PantryView`

**Why:** New component for the Pantry tab — search, alphabetical-headers-within-page pagination, `+ Add` button, row-click opens edit modal.

**Files:**

- Create: `components/nutrition/pantry-view.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { type PantryItem } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { PantryItemModal } from "@/components/pantry-item-modal";

const PAGE_SIZE = 25;

type ModalTarget = null | { mode: "create" } | { mode: "edit"; id: string };

/**
 * Pantry view rendered when /nutrition?view=pantry. Owns its own UI
 * state (query, page, modal target) but reads the pantry list from
 * the page-level shell. Save and delete callbacks bubble up so the
 * shell can refetch pantry + recipes (recipe macros depend on pantry).
 */
export function PantryView({
  token,
  pantry,
  onChanged,
}: {
  token: string;
  pantry: PantryItem[] | null;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalTarget>(null);

  const filtered = useMemo(() => {
    if (pantry === null) return null;
    const q = query.trim().toLowerCase();
    const sorted = pantry
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (q === "") return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [pantry, query]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;

  // If filtering shrinks the list below the current page, snap back.
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const pageItems = useMemo(() => {
    if (!filtered) return [];
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // Group the page slice by first-letter bucket so we can emit
  // headers when the bucket changes within the page.
  const pageGroups = useMemo(() => {
    const groups: { letter: string; items: PantryItem[] }[] = [];
    for (const item of pageItems) {
      const letter = bucketLetter(item.name);
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) {
        last.items.push(item);
      } else {
        groups.push({ letter, items: [item] });
      }
    }
    return groups;
  }, [pageItems]);

  const editingItem =
    modal && modal.mode === "edit" ? (pantry ?? []).find((p) => p.id === modal.id) : undefined;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Pantry</h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium hover:opacity-80"
        >
          + Add
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />

      {pantry === null && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {filtered && filtered.length === 0 && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          {query.trim()
            ? "No items match that search."
            : "Your pantry is empty. Add an item to get started."}
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {pageGroups.map((g) => (
              <div key={g.letter} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {g.letter}
                </h3>
                <ul className="flex flex-col gap-2">
                  {g.items.map((p) => (
                    <li key={p.id}>
                      <PantryRow item={p} onClick={() => setModal({ mode: "edit", id: p.id })} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <PaginationFooter
            page={page}
            pageCount={pageCount}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
          />
        </>
      )}

      {modal?.mode === "create" && (
        <PantryItemModal
          mode="create"
          token={token}
          onSaved={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && editingItem && (
        <PantryItemModal
          mode="edit"
          token={token}
          initial={editingItem}
          onSaved={onChanged}
          onDeleted={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {/* Edge case: if the edit target was deleted out from under us
          (e.g. by an external mutation), close the modal silently. */}
      {modal?.mode === "edit" && !editingItem && <CloseStaleModal onClose={() => setModal(null)} />}
    </section>
  );
}

function PantryRow({ item, onClick }: { item: PantryItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:opacity-90"
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(item.calories)} cal · P {formatNumber(item.protein_g)}g · F{" "}
          {formatNumber(item.fat_g)}g · C {formatNumber(item.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">
            per {formatNumber(item.serving_size)} {item.serving_unit}
          </span>
        </p>
      </div>
    </button>
  );
}

function PaginationFooter({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        ◀ Prev
      </button>
      <span className="text-[var(--muted)] tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        Next ▶
      </button>
    </div>
  );
}

function CloseStaleModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

function bucketLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds. Not rendered anywhere yet.

```bash
git add components/nutrition/pantry-view.tsx
git commit -m "feat: add PantryView component for nutrition tabs"
```

---

## Task 8: Create `RecipesView`

**Files:**

- Create: `components/nutrition/recipes-view.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { type PantryItem, type Recipe } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { RecipeModal } from "@/components/recipe-modal";

const PAGE_SIZE = 25;

type ModalTarget = null | { mode: "create" } | { mode: "edit"; id: string };

/**
 * Recipes view rendered when /nutrition?view=recipes. Mirrors
 * PantryView: search, page-25 with letter headers within page, click
 * row to open edit modal. Threads the page-level pantry array through
 * to the RecipeModal so the form can render its component picker.
 */
export function RecipesView({
  token,
  pantry,
  recipes,
  onChanged,
}: {
  token: string;
  pantry: PantryItem[] | null;
  recipes: Recipe[] | null;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalTarget>(null);

  const filtered = useMemo(() => {
    if (recipes === null) return null;
    const q = query.trim().toLowerCase();
    const sorted = recipes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (q === "") return sorted;
    return sorted.filter((r) => r.name.toLowerCase().includes(q));
  }, [recipes, query]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;

  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [pageCount, page]);

  const pageItems = useMemo(() => {
    if (!filtered) return [];
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const pageGroups = useMemo(() => {
    const groups: { letter: string; items: Recipe[] }[] = [];
    for (const item of pageItems) {
      const letter = bucketLetter(item.name);
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) {
        last.items.push(item);
      } else {
        groups.push({ letter, items: [item] });
      }
    }
    return groups;
  }, [pageItems]);

  const editingRecipe =
    modal && modal.mode === "edit" ? (recipes ?? []).find((r) => r.id === modal.id) : undefined;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Recipes</h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium hover:opacity-80"
        >
          + Add
        </button>
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />

      {recipes === null && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {filtered && filtered.length === 0 && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          {query.trim()
            ? "No recipes match that search."
            : "No recipes yet. Add one to quick-add a regular meal."}
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {pageGroups.map((g) => (
              <div key={g.letter} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {g.letter}
                </h3>
                <ul className="flex flex-col gap-2">
                  {g.items.map((r) => (
                    <li key={r.id}>
                      <RecipeRow recipe={r} onClick={() => setModal({ mode: "edit", id: r.id })} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <PaginationFooter
            page={page}
            pageCount={pageCount}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
          />
        </>
      )}

      {modal?.mode === "create" && (
        <RecipeModal
          mode="create"
          token={token}
          pantry={pantry ?? []}
          onSaved={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && editingRecipe && (
        <RecipeModal
          mode="edit"
          token={token}
          pantry={pantry ?? []}
          initial={editingRecipe}
          onSaved={onChanged}
          onDeleted={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && !editingRecipe && (
        <CloseStaleModal onClose={() => setModal(null)} />
      )}
    </section>
  );
}

function RecipeRow({ recipe, onClick }: { recipe: Recipe; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:opacity-90"
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{recipe.name}</p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(recipe.macros.calories)} cal · P {formatNumber(recipe.macros.protein_g)}g ·
          F {formatNumber(recipe.macros.fat_g)}g · C {formatNumber(recipe.macros.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">per batch</span>
        </p>
      </div>
    </button>
  );
}

function PaginationFooter({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        ◀ Prev
      </button>
      <span className="text-[var(--muted)] tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        Next ▶
      </button>
    </div>
  );
}

function CloseStaleModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

function bucketLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}
```

- [ ] **Step 2: Verify and commit**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds.

```bash
git add components/nutrition/recipes-view.tsx
git commit -m "feat: add RecipesView component for nutrition tabs"
```

---

## Task 9: Rewrite `NutritionPage` as a shell with URL-backed view + new toolbar

**Why:** The big one. Splits the four fetches into per-resource `useCallback`s, adds the `view` URL param via a Suspense-wrapped inner component, redesigns the toolbar with left/right groups and a new `active` prop on `ToolbarButton`, and swaps the body based on `view`.

**Files:**

- Modify: `app/(app)/nutrition/page.tsx` (significant rewrite)

- [ ] **Step 1: Replace `app/(app)/nutrition/page.tsx` with the new shell**

Full file contents:

```tsx
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

  // Auth helper — every refetch goes through this so the redirect
  // logic doesn't get duplicated. Returns the token or null after
  // redirecting.
  const requireToken = useCallback((): string | null => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return null;
    }
    return token;
  }, [router]);

  const handleApiError = useCallback(
    (err: Error) => {
      if (err.message.toLowerCase().includes("401")) {
        clearToken();
        router.replace("/login");
        return;
      }
      setError(err.message);
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
      .catch((err: Error) => {
        setLogError(err.message);
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
      .catch((err: Error) => setError(err.message))
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
  // Mason jar: lid + body. Same shape as the sidebar's JarIcon, but
  // owned here too because the sidebar copy is removed in Task 10.
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
  // Three short horizontal lines with leading dots — reads as a
  // recipe / bullet list.
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
```

Note on the active-state underline math: the parent row uses `pb-3` (12px bottom padding) and a 1px bottom border. To make the active tab's 2px underline coincide with the row's bottom border, the button gets `pb-3` (same baseline) and `-mb-[14px]` to overshoot the row's padding-and-border by 2px, parking the 2px underline exactly on the row's bottom border line. Tune by 1px if the visual is off.

- [ ] **Step 2: Run lint + build**

```bash
npm run lint
npm run build
```

Expected: lint clean, build succeeds with no "Missing Suspense boundary with useSearchParams" warning.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

In a browser, log in and walk through these checks at `http://localhost:3000/nutrition`:

1. Default load: log view, date is today, rings render (if goals are set), four-button toolbar visible — left: Quick Add, Edit Macros; right: Pantry, Recipes.
2. Click Pantry → URL becomes `/nutrition?view=pantry`, body swaps to PantryView with the search bar and paginated list, underline shows on Pantry.
3. Type a query → list filters, page resets to 1.
4. Click `+ Add` → modal opens in create mode. Save creates an item; modal closes; list shows the new item.
5. Click an existing pantry row → modal opens in edit mode prefilled. Edit and save → row updates.
6. In edit modal, click Delete → confirm panel; confirm → row disappears.
7. Click Recipes → URL becomes `/nutrition?view=recipes`. Repeat the create / edit / delete cycle. The pantry-item picker inside the recipe modal should be populated.
8. Click Pantry or Recipes label again (or navigate via sidebar's Nutrition link) → returns to log; URL drops the `?view`.
9. Open devtools Network panel. Change the date with the strip → exactly one request fires: `GET /nutrition-log?since=…&until=…`. No `/pantry-items`, `/recipes`, or `/macro-goals` requests.
10. Direct-load `http://localhost:3000/nutrition?view=pantry` → opens on Pantry tab.
11. Direct-load `http://localhost:3000/nutrition?view=garbage` → falls back to log.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/nutrition/page.tsx
git commit -m "feat: tabbed Pantry and Recipes views on /nutrition"
```

---

## Task 10: Remove Pantry from the sidebar

**Files:**

- Modify: `components/sidebar.tsx`

- [ ] **Step 1: Remove the Pantry NAV entry**

In the `NAV` array (around line 23-46), delete this line:

```ts
{ href: "/pantry", label: "Pantry", icon: <JarIcon /> },
```

The leading comment block above the deleted line currently reads:

```ts
  // Nutrition + Pantry are the food-side raw-data + reference pair,
  // analogous to Workouts + Exercises on the lifting side. Slot them
  // together so the mental model is "raw log, then the catalog the
  // log references" — same pattern users already know.
  { href: "/nutrition", label: "Nutrition", icon: <PlateIcon /> },
  { href: "/pantry", label: "Pantry", icon: <JarIcon /> },
```

Replace with:

```ts
  // Pantry and Recipes live inside /nutrition as tabbed views, so the
  // sidebar surfaces only the parent entry.
  { href: "/nutrition", label: "Nutrition", icon: <PlateIcon /> },
```

- [ ] **Step 2: Remove the now-unused `JarIcon` definition**

`JarIcon` was only referenced by the deleted NAV entry. Delete the entire `JarIcon` function (currently at lines ~360-380):

```ts
function JarIcon() {
  // Mason jar — a small rectangle (lid) atop a slightly-rounded
  // larger rectangle (body). Reads as "pantry / saved goods."
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 4h10v3H7z" />
      <path d="M6 9h12v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V9z" />
      <path d="M9 13h6" />
    </svg>
  );
}
```

- [ ] **Step 3: Verify and commit**

```bash
npm run lint
npm run build
npm run dev
```

In the browser, confirm the sidebar no longer shows a Pantry entry. The Nutrition entry still works as today.

```bash
git add components/sidebar.tsx
git commit -m "refactor: remove Pantry from sidebar nav"
```

---

## Task 11: Delete the standalone `/pantry` route

**Files:**

- Delete: `app/(app)/pantry/page.tsx`
- Delete: `app/(app)/pantry/` (the now-empty directory)

- [ ] **Step 1: Delete the page file and parent directory**

```bash
rm app/\(app\)/pantry/page.tsx
rmdir app/\(app\)/pantry
```

- [ ] **Step 2: Verify and commit**

```bash
npm run lint
npm run build
npm run dev
```

In the browser, visiting `http://localhost:3000/pantry` should now 404. `/nutrition` and all its tabs still work as designed.

```bash
git add -A app/\(app\)/pantry
git commit -m "chore: remove standalone /pantry route"
```

---

## Task 12: Final manual smoke test pass

**Why:** One end-to-end pass against the full verification checklist in the spec, after all changes are in.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Walk the spec's verification checklist**

Open `docs/superpowers/specs/2026-05-31-nutrition-tabs-design.md` and run through the _Manual verification plan_ section: the 9-step golden path plus all 6 edge cases.

For each edge case, note whether it behaves as the spec describes. Specifically:

- Direct-load `/nutrition?view=pantry` → opens on Pantry tab. ✓
- Direct-load `/nutrition?view=garbage` → falls back to log. ✓
- Empty pantry → "Your pantry is empty…" copy, no headers, no pagination footer. ✓
- Search with zero matches → "No items match…" copy, no pagination footer. ✓
- Delete a pantry item referenced by a recipe → API error surfaces in the delete-confirm panel; modal stays open. ✓ (Easiest way to set up: create a pantry item, build a recipe that uses it, try to delete the pantry item. If the API allows the delete, document that — there may be no FK constraint.)
- Back button after switching tabs: `router.replace` means intra-tab switches don't accumulate history; back from `/nutrition?view=recipes` goes to the page before `/nutrition`. ✓

- [ ] **Step 3: Stop the dev server and commit any final fixes**

If the smoke test surfaces any small visual or copy issues, fix them, commit, and re-run the relevant parts of the checklist. Otherwise no commit is needed.

```bash
# Only if there were fixes:
git add <fixed-files>
git commit -m "fix: <what was off>"
```

---

## Done

Plan complete. Implementation produces:

- `/nutrition` with `?view=log|pantry|recipes` URL-backed tabs.
- Pantry and Recipes views with search, alphabetical-headers-within-page pagination at 25 per page, `+ Add` and click-to-edit modals with inline delete confirm.
- Per-resource fetch strategy that stops the over-fetching on date change.
- `/pantry` route and sidebar entry removed.
- Existing forms enhanced with one additive `onDelete` prop each; no behavior change at existing call sites.
- `formatNumber` consolidated into `lib/format.ts`.
