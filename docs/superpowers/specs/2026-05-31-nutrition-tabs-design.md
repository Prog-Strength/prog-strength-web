# Nutrition page: Pantry/Recipes tabs

**Date:** 2026-05-31

## Summary

Move the standalone `/pantry` page into the `/nutrition` page as two new tab-style view switches in the existing toolbar. The default `/nutrition` view stays the daily meal log. Two new tabs — Pantry and Recipes — swap the area below the white separator for paginated, searchable catalogs of the user's saved foods and recipes. Edit and delete move into modals. The standalone `/pantry` page and its sidebar entry are removed.

## Goals

- Make Pantry and Recipes feel like first-class views of the Nutrition page rather than a separate destination.
- Keep the macro rings, date strip, and Quick Add / Edit Macros actions visible across all three views, so the daily-status anchor never disappears.
- Stop redundant backend fetches: the date-independent resources (pantry, recipes, goals) should fetch on mount and on mutation only — not on every date change like today.

## Non-goals

- Server-side pagination or server-side search. Pantry/recipe sizes are small.
- Changing the macro rings, date strip, Quick Add modal, Edit Macros modal, or any of the underlying API endpoints.
- Backward compatibility for the `/pantry` URL — old links 404.

## Routing & sidebar

- `/nutrition` reads a `view` search param.
  - Allowed values: `log` (default), `pantry`, `recipes`.
  - Missing or unrecognized value → treat as `log`.
- Switching tabs uses `router.replace('/nutrition?view=...')` — not push — so rapid switching doesn't pollute back history. Switching to the log tab strips the param entirely (`/nutrition`).
- The sidebar's existing `/nutrition` link stays untyped (no query string), so clicking Nutrition from anywhere returns to the log view.
- Sidebar's `/pantry` NAV entry is removed. If `JarIcon` is only referenced by that entry, remove the icon definition too.
- `app/(app)/pantry/page.tsx` is deleted along with the now-empty `(app)/pantry/` directory.

## Page structure

`NutritionPage` becomes a thin shell that:

1. Reads `view` from the URL via `useSearchParams`.
2. Owns the four data fetches (entries, pantry, recipes, goals) and exposes per-resource refetch callbacks.
3. Performs the auth check identical to today's behavior: if `getToken()` returns null at any fetch call, `router.replace('/login')`.
4. Renders, in order:
   - Header (`<h1>Nutrition</h1>` + helper copy — unchanged).
   - `DateTileStrip` — unchanged.
   - `MacroGoalRings` — unchanged; only renders when `goals` is set.
   - **Toolbar row** (see next section).
   - **White separator** (`border-b border-[var(--border)]`).
   - **Body** — one of `<NutritionLogView>`, `<PantryView>`, `<RecipesView>`, switched on `view`.

The Quick Add modal and Goals modal continue to mount at the shell level (triggered from the toolbar).

## Toolbar

Layout: `flex items-center justify-between`. Left group hugs left, right group hugs right.

- **Left group** (`flex gap-5`): `Quick Add`, `Edit Macros`. Unchanged `ToolbarButton`s, unchanged onClick handlers.
- **Right group** (`flex gap-5`): `Pantry`, `Recipes`. Same `ToolbarButton` shape; clicking them sets the URL `view` param.

`ToolbarButton` grows one new optional prop, `active: boolean`. When `active` is true, the button adds underline classes (`border-b-2 border-[var(--foreground)] -mb-px pb-3`) so the underline ties cleanly to the row's bottom border. Quick Add and Edit Macros never pass `active`. Pantry / Recipes pass `active={view === "pantry"}` / `active={view === "recipes"}` respectively.

Active-state styling (Option A from brainstorming): a 2px underline on the active view tab; Quick Add and Edit Macros never show an active state because they're actions, not views.

## Data flow

Split fetches by what they actually depend on:

| Resource  | Depends on | Refetch trigger                         |
| --------- | ---------- | --------------------------------------- |
| `entries` | `date`     | mount; date change                      |
| `pantry`  | nothing    | mount; pantry mutation                  |
| `recipes` | nothing    | mount; recipe mutation; pantry mutation |
| `goals`   | nothing    | mount; goals mutation                   |

Recipes get refetched on pantry mutation because the API derives recipe macros by joining `recipe_items` to `pantry_items` server-side — editing a pantry item can change a recipe's displayed macros. This mirrors today's `/pantry` page behavior.

Implementation shape:

```ts
useEffect(() => {
  fetchPantry();
  fetchRecipes();
  fetchGoals();
}, []);
useEffect(() => {
  fetchEntries(date);
}, [date]);
```

Each fetch is its own `useCallback`. Modals call the specific refetch(es) they need:

- Save/delete pantry item → `fetchPantry()` + `fetchRecipes()`
- Save/delete recipe → `fetchRecipes()` only
- Save goals → `fetchGoals()` only
- Quick Add (log entry) → splice locally; no refetch
- Date change → `fetchEntries(newDate)` only

Tab switching triggers no fetches.

## State ownership

| State                                        | Owner                   | Notes                        |
| -------------------------------------------- | ----------------------- | ---------------------------- |
| `view`                                       | URL (`useSearchParams`) | Source of truth              |
| `date`                                       | `NutritionPage`         | Shared by log + rings        |
| `entries`, `pantry`, `recipes`, `goals`      | `NutritionPage`         | Shared across views          |
| Quick Add modal open/state                   | `NutritionPage`         | Triggered from toolbar       |
| Goals modal open/state                       | `NutritionPage`         | Triggered from toolbar       |
| Pantry view: `query`, `page`, `modalTarget`  | `PantryView`            | Tab-local; resets on unmount |
| Recipes view: `query`, `page`, `modalTarget` | `RecipesView`           | Same                         |

Tab-local state resets when a view unmounts (i.e. when the user switches tabs and comes back). Acceptable trade-off given the simpler code; no need to lift into the shell.

## Pantry view

A new component, `PantryView`, rendered when `view === "pantry"`.

**Layout:**

```
Pantry                                       [+ Add]
[ Search…                                          ]

A
  Almond butter      220 cal · P 8g · F 18g · C 8g
                     per 2 tbsp
  Apple              ...
B
  Banana             ...
...

◀ Prev      Page 1 of 4      Next ▶
```

**Search.** Client-side filter on `item.name.toLowerCase().includes(query.toLowerCase())`. Query change resets `page` to 1.

**Sort + sectioning.** Sort the filtered list alphabetically by name (case-insensitive, locale-aware via `String.prototype.localeCompare`). Slice the page (25 items per page). Within the slice, emit a letter header whenever the current item's first letter (uppercased) differs from the previous one. Items whose first character is not A-Z bucket under `#`.

**Pagination.** Page size 25, fixed. Footer with Prev / Next and "Page X of Y". Prev disabled on page 1; Next disabled on last page. Pagination state is not URL-backed — `?view=pantry` stays bare. If a search query shrinks the filtered list below the current page index, snap `page` back to 1.

**Row.** Same content shape as today's `PantryRow`: name, then `X cal · P Yg · F Zg · C Wg · per N unit`. The whole row is clickable and opens the edit modal. No trailing Edit/Delete buttons.

**+ Add button.** Right-aligned in the section header. Opens `PantryItemModal` in create mode.

**Loading state.** While `pantry` is null (cold-load before the first fetch resolves), render "Loading…" in place of the list. Search input and `+ Add` button stay visible and functional (the modal can still open in create mode while the list loads).

**Empty / no-match states:** if `pantry` is non-null but `filtered` is empty:

- Query empty: "Your pantry is empty. Add an item to get started."
- Query non-empty: "No items match that search."
- Either case: no pagination footer.

## Recipes view

A new component, `RecipesView`, mirroring `PantryView`'s structure with three differences:

- **Row content.** Name + `X cal · P Yg · F Zg · C Wg · per batch`. No inline component list.
- **Search.** Same client-side filter, on `recipe.name`.
- **Modal.** `RecipeModal` instead of `PantryItemModal`. Takes a `pantry: PantryItem[]` prop and threads it to `RecipeForm`.

Section header, `+ Add` button, full-width search input, alphabetical headers within page, 25-per-page pagination, loading state, empty/no-match copy, and refetch-on-save/delete all mirror the Pantry view.

## Modals

Two new components, modeled on `MacroGoalsModal` (overlay + centered card + form).

### `PantryItemModal`

```ts
type Props =
  | { mode: "create"; onSaved: () => void; onClose: () => void }
  | {
      mode: "edit";
      initial: PantryItem;
      onSaved: () => void;
      onDeleted: () => void;
      onClose: () => void;
    };
```

- Wraps `PantryItemForm`. The form today renders its own `Cancel` + `Save` footer via the existing `submitLabel` and `onCancel` props; the modal binds those to its own state (Cancel → `onClose`; Save → existing form submit path). To get a three-button footer in edit mode (`Cancel` + `Delete` + `Save`), `PantryItemForm` gains one small optional prop: `onDelete?: () => void`. When provided, the form renders a red `Delete` button between `Cancel` and `Save`. When not provided (every existing call site), the form renders identically to today.
- Modal create-mode footer (via the form): `Cancel`, `Save`.
- Modal edit-mode footer (via the form + new `onDelete` prop): `Cancel`, `Delete` (red), `Save`.
- Clicking `Delete` swaps the modal body for a confirm panel:
  > Delete this pantry item? Historical log entries keep their macros.
  > [Cancel] [Delete]
- `Cancel` in confirm returns to the form. `Delete` in confirm fires `deletePantryItem`.
- API calls (`createPantryItem`, `updatePantryItem`, `deletePantryItem`) happen inside the modal using `getToken()`. On success → fire callback + `onClose`. On error → render in a small red panel inside the modal; modal stays open with values preserved.

### `RecipeModal`

Same shape with one extra prop:

```ts
type Props =
  | { mode: "create"; pantry: PantryItem[]; onSaved: () => void; onClose: () => void }
  | {
      mode: "edit";
      initial: Recipe;
      pantry: PantryItem[];
      onSaved: () => void;
      onDeleted: () => void;
      onClose: () => void;
    };
```

Wraps `RecipeForm`. Same footer rules (the form similarly gains an optional `onDelete` prop), same inline confirm panel, same error handling.

**Mount location.** Both modals are rendered by their respective view components (`PantryView`, `RecipesView`), not by the shell. The view holds a small `modalTarget` state:

```ts
type ModalTarget = null | { mode: "create" } | { mode: "edit"; id: string };
```

The view renders the modal when `modalTarget !== null`.

## Component file plan

**New files:**

- `components/pantry-item-modal.tsx`
- `components/recipe-modal.tsx`
- `components/nutrition/nutrition-log-view.tsx` — the meal-sections body extracted from today's `NutritionPage` (the `MealSections`, `MealSection`, `LogEntryRow` functions, the `MEAL_ORDER` / `MEAL_LABELS` constants, and the `formatLocalTime` helper move here essentially as-is).
- `components/nutrition/pantry-view.tsx`
- `components/nutrition/recipes-view.tsx`
- `lib/format.ts` — shared home for `formatNumber`.

**Modified:**

- `app/(app)/nutrition/page.tsx` — slims down to the shell described in _Page structure_. Keeps the date helpers (`startOfLocalDay`, `endOfLocalDay`, `sameLocalDay`) and the `totals` computation. Adds per-resource `useCallback` fetches.
- `components/sidebar.tsx` — remove the Pantry NAV entry; remove `JarIcon` definition if unused elsewhere.
- `components/pantry-item-form.tsx` — add optional `onDelete?: () => void` prop; render a `Delete` button between `Cancel` and `Save` when provided. No other changes.
- `components/recipe-form.tsx` — same additive `onDelete?: () => void` prop.

**Deleted:**

- `app/(app)/pantry/page.tsx`
- `app/(app)/pantry/` (the now-empty directory).

The existing `components/pantry-item-form.tsx` and `components/recipe-form.tsx` each get one small additive change: an optional `onDelete?: () => void` prop that, when provided, renders a red `Delete` button in the form's existing footer row between `Cancel` and `Save`. All current call sites omit the prop and remain unchanged.

The existing `formatNumber` helper (currently defined in both `app/(app)/nutrition/page.tsx` and `app/(app)/pantry/page.tsx` — i.e. already duplicated) is used by `NutritionLogView` (for meal subtotals), `PantryView` (for row macros), and `RecipesView` (for row macros). Define it once in `lib/format.ts` (new) and import it from the three view components. Removes the existing duplication as a side benefit.

## Error handling

Three error surfaces, each owned where it occurs.

- **Shell-level errors** (mount fetches, date-change refetch of entries). `NutritionPage` keeps the existing top-of-page red banner. 401 anywhere in the shell → `clearToken()` + redirect to `/login`.
- **Tab-local errors** (refetch after a mutation fails). Each view component owns a small inline error slot above the list. Rare path; matches today's `/pantry` page error pattern.
- **Modal errors** (create/update/delete fails). Rendered inside the modal in a small red panel. Modal stays open; field values are preserved so the user can retry without re-typing. 401 in a modal → `clearToken()` + redirect.

Specific edge case: **deleting a pantry item referenced by a recipe**. The API surfaces this as a 4xx via FK constraint. The delete-confirm panel renders the error in place and stays open; user can cancel. No orphaned state. Deleting a recipe has no analogous concern because log entries store denormalized macros at log time.

## Manual verification plan

There is no existing test suite in `prog-strength-web`, so this design does not introduce one. Verification is manual.

**Golden path:**

1. Cold-load `/nutrition` → log view renders, date is today, rings show (if goals set), toolbar shows all four buttons.
2. Click Pantry → URL becomes `/nutrition?view=pantry`, body swaps to the paginated list, underline appears on Pantry.
3. Type a query in search → list filters; page index resets to 1.
4. Click `+ Add` → modal opens in create mode; save creates an item; modal closes; list shows the new item.
5. Click an existing row → modal opens in edit mode prefilled; edit and save → row updates.
6. In edit modal, click Delete → confirm panel; confirm → row disappears.
7. Switch to Recipes → URL becomes `?view=recipes`, body swaps. Same create / edit / delete cycle.
8. Switch back to log tab → URL drops `?view`. Log still shows the right entries; rings unchanged.
9. Change the date with the strip → only the log fetch fires (verified via devtools network panel: exactly one new `/nutrition-log` request, no `/pantry-items`, `/recipes`, or `/macro-goals`).

**Edge cases:**

- Direct-load `/nutrition?view=pantry` → opens on Pantry tab.
- Direct-load `/nutrition?view=garbage` → falls back to log.
- Empty pantry → empty-state copy, no headers, no pagination footer.
- Search with zero matches → no-match copy, no pagination footer.
- Delete a pantry item referenced by a recipe → API error surfaces in the delete-confirm panel; modal stays open.
- Back button after switching tabs: because we use `router.replace`, intra-tab switches don't accumulate history. Back from `/nutrition?view=recipes` goes to the page before `/nutrition`, not to `/nutrition?view=pantry`. This is intentional — confirm it reads correctly.
