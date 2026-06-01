# Nutrition Log: toolbar entry, condensed table, edit/delete modals

## Problem

The `/nutrition` page has a right-side toolbar with view-switches for **Pantry** and **Recipes**, but no switch for the default **Log** view. After navigating to Pantry or Recipes, the user has no obvious way back to Log other than clicking the **Nutrition** entry in the sidebar — an unintuitive return path.

Within the Log view itself, each logged entry currently renders as a roomy card. A typical day's worth of entries produces a long vertical scroll. The Log also exposes only a single inline **Delete** button per row — and only as a one-shot click with no confirmation — and no edit affordance at all. Correcting a mis-logged servings count, time, or meal bucket requires deleting and re-logging.

## Goals

1. Add a third right-side toolbar button — **Log** — that switches back to the daily-log view from Pantry/Recipes. Active styling mirrors the existing Pantry/Recipes buttons.
2. Replace the per-row card layout in the Log view with a compact per-meal table so substantially more rows fit on screen without paging.
3. Surface per-row **edit** and **delete** affordances as a pencil icon and a trash-can icon, both in an Actions column on the right of each row.
4. Clicking the pencil opens an edit modal where the user can change **servings**, **meal**, and **time**, then save.
5. Clicking the trash opens a small confirmation modal; confirming deletes the entry.

The Log view is already the page's default — `parseView(searchParams.get("view"))` falls through to `"log"` when the URL has no `?view=` — so no routing-default change is needed.

## Non-goals

- Editing **which** pantry item or recipe an entry references. Server side, an entry is tied to either `pantry_item_id` or `recipe_id`, and `UpdateLogEntryPayload` (`lib/api.ts:519`) does not include those fields. Item identity stays immutable; a wrong item still requires delete + re-log.
- Bulk edit or bulk delete.
- Undo for deletes. The confirm modal _is_ the safety net.
- Mobile-specific table treatments. The existing nutrition page is desktop-first and the table inherits that posture; horizontal overflow on narrow viewports is acceptable for this iteration.

## Design

### 1. Toolbar: third "Log" button

File: `app/(app)/nutrition/page.tsx`.

Add a third `ToolbarButton` to the right-side group in the toolbar row. Order, left-to-right: **Log · Pantry · Recipes**. This matches the reading flow of the underlying `View` type's three values.

```tsx
<div className="flex items-center gap-5">
  <ToolbarButton
    onClick={() => setView("log")}
    icon={<LogIcon />}
    label="Log"
    active={view === "log"}
  />
  <ToolbarButton ... Pantry ... />
  <ToolbarButton ... Recipes ... />
</div>
```

Define a new `LogIcon` SVG in the same file (alongside `PlusIcon`, `JarIcon`, etc.). It must be visually distinct from `ListIcon` (used for Recipes). A clipboard-with-checkmark or a notebook-with-lines glyph works; the exact glyph is an implementation detail — pick one that reads as "daily log" at 16px.

No change to `parseView` or `setView`. `setView("log")` already routes to `/nutrition` (no query string).

### 2. Log view: per-meal compact tables

File: `components/nutrition/nutrition-log-view.tsx`.

Replace the `LogEntryRow` card (currently a `flex` `div` with a Delete button) with a `<table>` rendered inside each `MealSection`. The meal section header (label + subtotal line) stays exactly as-is — only the body changes.

Columns (left-to-right):

| Column   | Content                                             | Alignment |
| -------- | --------------------------------------------------- | --------- |
| Time     | `formatLocalTime(entry.consumed_at)` e.g. "7:42 AM" | left      |
| Item     | item name + recipe pill (if `entry.recipe_id` set)  | left      |
| Servings | `× {formatNumber(entry.quantity)}`                  | right     |
| Cal      | `formatNumber(entry.calories)`                      | right     |
| P        | `formatNumber(entry.protein_g)` + "g"               | right     |
| F        | `formatNumber(entry.fat_g)` + "g"                   | right     |
| C        | `formatNumber(entry.carbs_g)` + "g"                 | right     |
| Actions  | pencil button + trash button, both icon-only        | right     |

Styling notes:

- Numeric cells use `tabular-nums` so columns line up.
- Row hover paints a subtle `bg-[var(--surface)]/50` (or equivalent) so the Actions buttons feel anchored to the row they affect.
- Header row uses the existing `text-[var(--muted)]` muted style at `text-xs uppercase tracking-wider` to match other section headers in the codebase.
- Border treatment: a single top border under the header row and thin `border-[var(--border)]` between body rows. No outer card around the whole table — the meal section header already provides the visual grouping.
- The recipe pill keeps its current shape: `rounded-full border bg-[var(--background)] px-2 py-0.5 text-[10px] uppercase tracking-wider` reading "recipe".

Action buttons:

- Each is a `<button type="button">` with `aria-label="Edit entry"` / `aria-label="Delete entry"`.
- Pencil reuses the existing `PencilIcon` SVG shape (mirror what's in `page.tsx`); trash is a new `TrashIcon` SVG (lid + can + two strokes).
- Buttons are ghost-style: `text-[var(--muted)] hover:text-[var(--foreground)]`, with the trash hovering to `hover:text-[var(--danger)]`.

Empty states:

- If `entries === null`: keep the existing "Loading…" line.
- If `entries.length === 0`: keep the existing centered "Nothing logged on this day yet." message.
- Per-meal empty (a meal section with zero entries): keep the existing `<span className="italic">No entries</span>` in the section header — no empty table is rendered.

Prop changes on `NutritionLogView`:

- **Add** `onEdit: (entry: NutritionLogEntry) => void`.
- **Change** `onDelete` from `(id: string) => void` to `(entry: NutritionLogEntry) => void` so it's symmetric with `onEdit` and the page-level handler doesn't have to re-look-up the entry from the id. The handler's role also changes — it now opens the delete-confirm modal, not the actual delete call.
- **Remove** `rowBusyID: string | null`. With per-row mutations now going through modals (which own their own busy state), the inline busy-disable on the row is no longer needed.

### 3. Edit modal

File: `components/nutrition/log-entry-edit-modal.tsx` (new).

Modal shell mirrors `QuickAddModal` (`components/quick-add-modal.tsx`): `fixed inset-0 z-50`, black/60 backdrop, `max-w-md`, Escape-to-close, body-scroll lock, X button in the header.

Props:

```ts
type Props = {
  token: string;
  entry: NutritionLogEntry;
  itemName: string; // resolved by parent from pantryByID / recipeByID
  onSaved: (updated: NutritionLogEntry) => void;
  onClose: () => void;
};
```

Fields:

| Field    | Control                                    | Initial value                                |
| -------- | ------------------------------------------ | -------------------------------------------- |
| Meal     | `<select>` (Breakfast/Lunch/Dinner/Snack)  | `entry.meal`                                 |
| Servings | `<input type="number" min={0} step="any">` | `String(entry.quantity)`                     |
| Time     | `<input type="time">`                      | local HH:MM derived from `entry.consumed_at` |

Header: `Edit log entry`, subtitle: `{itemName}` (read-only — item identity is not editable).

Submit handler:

1. Parse servings; reject ≤ 0 or non-finite (same guard as `QuickAddModal.submit`).
2. Combine the time-input value with the **date portion** of the existing `entry.consumed_at` to build a new local `Date`, then `.toISOString()` for the `consumed_at` field. This preserves the day the entry was logged against even though the modal only edits time-of-day.
3. Call `updateNutritionLogEntry(token, entry.id, { quantity, meal, consumed_at })`.
4. On success: `onSaved(updated)` then `onClose()`.
5. On failure: if the message contains `"401"`, clear the token and redirect to `/login` (mirror the page's `handleApiError`). Otherwise set local `error` state; modal stays open so the user can correct and retry.

### 4. Delete confirm modal

File: `components/nutrition/log-entry-delete-modal.tsx` (new).

Modal shell same as the edit modal but narrower: `max-w-sm`. Header: `Delete log entry?`.

Props:

```ts
type Props = {
  token: string;
  entry: NutritionLogEntry;
  itemName: string;
  onDeleted: (id: string) => void;
  onClose: () => void;
};
```

Body:

- One sentence: "Delete this log entry? This can't be undone."
- Below it, a single muted line for context: `{itemName} · × {quantity} · {MEAL_LABELS[entry.meal]}`.
- Footer buttons: **Cancel** (ghost) on the left, **Delete** (red `bg-[var(--danger)]`) on the right. Mirror the styles from `components/pantry-item-modal.tsx`'s inline delete-confirm panel (lines 140–167).

Delete handler:

1. Call `deleteNutritionLogEntry(token, entry.id)`.
2. On success: `onDeleted(entry.id)` then `onClose()`.
3. On failure: same 401-handling pattern; otherwise show inline error and **stay open** so the user can see the message. This matches commit `737715b fix(modal): keep delete-confirm open on error; redirect on 401`.

### 5. Page-level wiring

File: `app/(app)/nutrition/page.tsx`.

State additions:

```ts
const [editingEntry, setEditingEntry] = useState<NutritionLogEntry | null>(null);
const [deletingEntry, setDeletingEntry] = useState<NutritionLogEntry | null>(null);
```

Removals:

- Delete the existing `handleDelete` function. Its logic now lives inside `LogEntryDeleteModal`.
- Delete the `rowBusyID` / `setRowBusyID` state and stop passing it to `NutritionLogView`. With modal-mediated edits and deletes, in-row busy is unnecessary.

`NutritionLogView` props become:

```tsx
<NutritionLogView
  entries={entries}
  pantryByID={pantryByID}
  recipeByID={recipeByID}
  onEdit={(entry) => setEditingEntry(entry)}
  onDelete={(entry) => setDeletingEntry(entry)}
/>
```

Modal renders at the bottom of `<main>`, alongside `MacroGoalsModal` / `QuickAddModal`:

```tsx
{
  editingEntry && (
    <LogEntryEditModal
      token={token}
      entry={editingEntry}
      itemName={resolveItemName(editingEntry, pantryByID, recipeByID)}
      onSaved={(updated) => {
        setEntries((prev) => prev?.map((e) => (e.id === updated.id ? updated : e)) ?? prev);
        setEditingEntry(null);
      }}
      onClose={() => setEditingEntry(null)}
    />
  );
}
{
  deletingEntry && (
    <LogEntryDeleteModal
      token={token}
      entry={deletingEntry}
      itemName={resolveItemName(deletingEntry, pantryByID, recipeByID)}
      onDeleted={(id) => {
        setEntries((prev) => prev?.filter((e) => e.id !== id) ?? prev);
        setDeletingEntry(null);
      }}
      onClose={() => setDeletingEntry(null)}
    />
  );
}
```

`resolveItemName` is a tiny helper extracted from the existing name-resolution block inside `MealSection`. Pull it into a module-scope function in `nutrition-log-view.tsx` and export it, so the page and the view share one source of truth for entry naming.

### 6. Data flow summary

```
Page
 ├─ entries (state)
 ├─ editingEntry (state)        ── set by row pencil click
 ├─ deletingEntry (state)       ── set by row trash click
 │
 ├─ NutritionLogView (renders per-meal tables of entries)
 │    └─ onEdit(entry) → setEditingEntry(entry)
 │    └─ onDelete(entry) → setDeletingEntry(entry)
 │
 ├─ LogEntryEditModal           ── calls updateNutritionLogEntry
 │    └─ onSaved(updated) → setEntries(... merge ...); close
 │
 └─ LogEntryDeleteModal         ── calls deleteNutritionLogEntry
      └─ onDeleted(id) → setEntries(... filter ...); close
```

## Testing

Manual verification in a running dev server is the primary check (per `CLAUDE.md` / `AGENTS.md` direction, which keeps this codebase pragmatic about its custom Next 16 patterns):

1. **Log button appears and routes.** On `/nutrition?view=pantry`, click **Log** → URL becomes `/nutrition`, log view renders, Log button shows active underline.
2. **Default-view sanity.** Visiting `/nutrition` directly shows the log; visiting `/nutrition?view=garbage` falls through to log (existing `parseView` behavior, regression-check it still holds).
3. **Table renders.** A day with entries shows compact rows under each meal header. A day with no entries shows the empty message. A meal with no entries shows "No entries" in its section header.
4. **Edit flow happy path.** Pencil opens modal, change servings from 1 → 0.5, save. Modal closes; row updates immediately (no full refetch needed); meal subtotal recomputes.
5. **Edit flow: cross-meal move.** Edit a Breakfast entry, change meal to Lunch, save. The entry disappears from Breakfast and appears under Lunch with the same time.
6. **Edit flow: time change.** Edit time to a new HH:MM. Row's time column updates; entry stays on the same calendar day (verifies the day-of `consumed_at` preservation logic).
7. **Edit flow: error.** Force a server error (e.g. set quantity to 0 if the server rejects it). Modal stays open; error message visible inline.
8. **Edit flow: 401.** Expire the token. Pencil → save → user is redirected to `/login`. (Same path the page already exercises.)
9. **Delete flow happy path.** Trash opens confirm; Cancel closes. Trash again, Delete confirms; row disappears; subtotal recomputes; daily totals on the macro rings update.
10. **Delete flow: error.** Force a server error on delete; confirm modal stays open with the error visible. Mirrors the existing `737715b` behavior.

## Risks and follow-ups

- **Stale macro recomputation.** `UpdateLogEntryPayload` does not include macro fields, so the server is responsible for recomputing `calories`, `protein_g`, `fat_g`, `carbs_g` from the new `quantity` and the entry's frozen reference (pantry item or recipe). The returned entry from `updateNutritionLogEntry` is the source of truth — the modal must `setEntries` with the _returned_ entry rather than locally constructing one. The design already does this; flagging it because a careless implementation could regress.
- **Day-boundary edits.** Editing `consumed_at` to a HH:MM that crosses local midnight is technically allowed by the modal but would move the entry off the currently viewed day, making it disappear without explanation. This is acceptable for v1 (the user is editing a single field they chose to change), and we already preserve the date portion explicitly to avoid accidental day-shifts. If it becomes a footgun, follow up with either a date input alongside the time, or a clamp to the entry's existing day.
- **Mobile.** Eight columns plus Actions will overflow narrow viewports. Out of scope for this work; a later pass can add `overflow-x-auto` on the table wrapper or collapse to a card view at small breakpoints.
