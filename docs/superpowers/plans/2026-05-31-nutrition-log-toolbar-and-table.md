# Nutrition Log Toolbar + Condensed Table + Edit/Delete Modals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third right-side **Log** toolbar button to the `/nutrition` page, switch the daily-log layout from per-row cards to a per-meal compact table, and replace the inline single-click Delete button with pencil-edit and trash-delete actions that open dedicated modals.

**Architecture:** Two small additive tasks first — the new toolbar button (page only) and two new modal components (new files only) — so the page stays working at every checkpoint. Then a single atomic task swaps the `NutritionLogView` body to a per-meal table with pencil/trash actions and rewires the page-level state to render the new edit/delete modals. Finally a manual verification pass in the browser.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Tailwind v4. No test framework is wired in this repo; verification per task is `npm run typecheck` + `npm run lint`. A manual browser pass via `npm run dev` happens at the end. Each task ends with a commit.

**Spec:** `docs/superpowers/specs/2026-05-31-nutrition-log-toolbar-and-table-design.md`

---

## Working directory

All paths below are relative to `repos/prog-strength-web/`. Run all `npm` commands from that directory.

## File map

- Modify: `app/(app)/nutrition/page.tsx` — add `LogIcon`, add **Log** toolbar button (Task 1); add edit/delete modal state + extract `resolveItemName` helper + render new modals (Task 4); also remove the `handleDelete` callback and `rowBusyID` state in Task 4.
- Create: `components/nutrition/log-entry-edit-modal.tsx` — modal that calls `updateNutritionLogEntry` (Task 2).
- Create: `components/nutrition/log-entry-delete-modal.tsx` — confirmation modal that calls `deleteNutritionLogEntry` (Task 3).
- Modify: `components/nutrition/nutrition-log-view.tsx` — replace per-row card with per-meal `<table>`, add pencil/trash action buttons, swap props (`onEdit` added, `onDelete` takes the full entry, `rowBusyID` removed) (Task 4). Add a `TrashIcon` SVG + a `PencilIcon` SVG (local, since the existing `PencilIcon` lives in `page.tsx`). Export a `resolveItemName` helper so the page can label modals consistently.

---

## Task 1: Add the "Log" toolbar button

**Why first:** Smallest visible change. Purely additive — no existing code paths shift. Easy to land and verify in isolation.

**Files:**

- Modify: `app/(app)/nutrition/page.tsx`

- [ ] **Step 1: Add the `LogIcon` SVG**

Append this function alongside the other icon helpers at the bottom of `app/(app)/nutrition/page.tsx` (after `ListIcon`, before the closing of the file):

```tsx
function LogIcon() {
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
      <rect x="6" y="3" width="12" height="18" rx="1.5" />
      <path d="M9 3v2h6V3" />
      <path d="M9 10h6" />
      <path d="M9 14h6" />
      <path d="M9 18h4" />
    </svg>
  );
}
```

This is a clipboard glyph with three lines — visually distinct from `ListIcon` (which has bullet dots) and reads as "daily log" at 16px.

- [ ] **Step 2: Add the "Log" toolbar button**

Find the right-side toolbar group in `app/(app)/nutrition/page.tsx` (currently the second `<div className="flex items-center gap-5">` inside the toolbar row, around lines 251–264). Replace it with:

```tsx
<div className="flex items-center gap-5">
  <ToolbarButton
    onClick={() => setView("log")}
    icon={<LogIcon />}
    label="Log"
    active={view === "log"}
  />
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
```

- [ ] **Step 3: Run typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: both pass with no errors. If lint complains about an unused import or similar, fix inline.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/nutrition/page.tsx
git commit -m "$(cat <<'EOF'
feat(nutrition): add Log button to the right-side toolbar

Adds a third right-aligned toolbar entry so the user can return to the
daily log view from Pantry or Recipes without re-clicking the sidebar.
Active styling matches the existing Pantry/Recipes tabs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `LogEntryEditModal`

**Why second:** New file, not yet referenced. Safe to land before the view refactor. Builds the modal the row's pencil button will open.

**Files:**

- Create: `components/nutrition/log-entry-edit-modal.tsx`

- [ ] **Step 1: Create the file**

Write `components/nutrition/log-entry-edit-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateNutritionLogEntry, type MealType, type NutritionLogEntry } from "@/lib/api";
import { clearToken } from "@/lib/auth";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * Edit-log-entry modal. Surfaces the three fields the server's
 * UpdateLogEntryPayload accepts: meal, quantity (servings), and
 * consumed_at — with the time-input covering only the time-of-day,
 * preserving the entry's calendar day. Same shell ergonomics as
 * QuickAddModal: Escape to close, body scroll lock, backdrop click
 * dismiss while idle.
 */
export function LogEntryEditModal({
  token,
  entry,
  itemName,
  onSaved,
  onClose,
}: {
  token: string;
  entry: NutritionLogEntry;
  itemName: string;
  onSaved: (updated: NutritionLogEntry) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [meal, setMeal] = useState<MealType>(entry.meal);
  const [quantity, setQuantity] = useState<string>(String(entry.quantity));
  const [time, setTime] = useState<string>(() => toLocalHHMM(entry.consumed_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    if (!Number.isFinite(q) || q <= 0) return;
    const consumedAt = combineDateAndLocalTime(entry.consumed_at, time);
    setBusy(true);
    setError(null);
    updateNutritionLogEntry(token, entry.id, {
      quantity: q,
      meal,
      consumed_at: consumedAt,
    })
      .then((updated) => {
        onSaved(updated);
        onClose();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(msg);
      })
      .finally(() => setBusy(false));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-entry-edit-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="log-entry-edit-modal-title" className="text-base font-semibold">
              Edit log entry
            </h2>
            <p className="truncate text-xs text-[var(--muted)]">{itemName}</p>
          </div>
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

        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                Meal
              </span>
              <select
                value={meal}
                onChange={(e) => setMeal(e.target.value as MealType)}
                disabled={busy}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              >
                {MEAL_ORDER.map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-24 flex-col gap-1 text-xs">
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
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Convert an ISO timestamp to the local "HH:MM" string for an <input type=time>. */
function toLocalHHMM(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Take the YYYY-MM-DD part of the entry's existing local consumed_at
 * and combine it with the modal's HH:MM input to produce a new ISO
 * timestamp on the same calendar day. Preserves the day the entry was
 * logged against even if the user only meant to fix the time-of-day.
 */
function combineDateAndLocalTime(existingIso: string, hhmm: string): string {
  const base = new Date(existingIso);
  const [hh, mm] = hhmm.split(":").map((s) => Number(s));
  const next = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Number.isFinite(hh) ? hh : 0,
    Number.isFinite(mm) ? mm : 0,
    0,
    0,
  );
  return next.toISOString();
}
```

- [ ] **Step 2: Run typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: both pass. The component compiles even though it's not yet imported (TypeScript treats unused exports as fine; ESLint's `no-unused-vars` only flags locals).

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/log-entry-edit-modal.tsx
git commit -m "$(cat <<'EOF'
feat(nutrition): add LogEntryEditModal

Modal for editing meal, servings, and time on a logged entry. Combines
the time input with the entry's existing calendar day to preserve the
day the entry was logged against. Mirrors QuickAddModal's shell:
Escape to close, body scroll lock, backdrop dismiss while idle, 401
redirect to /login.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Create `LogEntryDeleteModal`

**Why third:** New file, not yet referenced. Pairs with Task 2 and lands the delete-confirm UI before the view starts pointing at it.

**Files:**

- Create: `components/nutrition/log-entry-delete-modal.tsx`

- [ ] **Step 1: Create the file**

Write `components/nutrition/log-entry-delete-modal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNutritionLogEntry, type MealType, type NutritionLogEntry } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { formatNumber } from "@/lib/format";

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * Confirm-and-delete modal for one log entry. Stays open on server
 * error (matches the keep-open-on-error pattern from
 * commit 737715b) so the user can read the failure and retry.
 */
export function LogEntryDeleteModal({
  token,
  entry,
  itemName,
  onDeleted,
  onClose,
}: {
  token: string;
  entry: NutritionLogEntry;
  itemName: string;
  onDeleted: (id: string) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  function confirmDelete() {
    setBusy(true);
    setError(null);
    deleteNutritionLogEntry(token, entry.id)
      .then(() => {
        onDeleted(entry.id);
        onClose();
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(msg);
      })
      .finally(() => setBusy(false));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-entry-delete-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="log-entry-delete-modal-title" className="text-base font-semibold">
            Delete log entry?
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
          <p className="text-sm">Delete this log entry? This can&apos;t be undone.</p>
          <p className="text-xs text-[var(--muted)] tabular-nums">
            {itemName} · × {formatNumber(entry.quantity)} · {MEAL_LABELS[entry.meal]}
          </p>

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busy}
              className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)] px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add components/nutrition/log-entry-delete-modal.tsx
git commit -m "$(cat <<'EOF'
feat(nutrition): add LogEntryDeleteModal

Small confirm-and-delete modal. Stays open on server error so the user
can read the message and retry — matches the keep-open-on-error
pattern from 737715b. 401 redirects to /login.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Convert log view to per-meal table + wire edit/delete

**Why fourth:** The view's prop signature changes (`onEdit` added, `onDelete` now takes the full entry, `rowBusyID` removed). The page must update at the same time, otherwise either file fails typecheck in isolation. Single atomic commit.

**Files:**

- Modify: `components/nutrition/nutrition-log-view.tsx` — replace per-row `<div>` cards with a `<table>` per meal section; add `PencilIcon` + `TrashIcon` local SVGs; add `resolveItemName` exported helper; swap props.
- Modify: `app/(app)/nutrition/page.tsx` — add `editingEntry` + `deletingEntry` state; remove `handleDelete`, `rowBusyID`, `setRowBusyID`; pass `onEdit`/`onDelete` to the view; render the two new modals at the bottom of `<main>`.

- [ ] **Step 1: Rewrite `components/nutrition/nutrition-log-view.tsx`**

Replace the entire file's contents with:

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
 * The meal-bucketed daily log for /nutrition. Renders one compact
 * table per meal so a full day fits on screen without paging. Per-row
 * pencil/trash buttons hand the entry up to the page, which owns the
 * edit/delete modals.
 */
export function NutritionLogView({
  entries,
  pantryByID,
  recipeByID,
  onEdit,
  onDelete,
}: {
  entries: NutritionLogEntry[] | null;
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  onEdit: (entry: NutritionLogEntry) => void;
  onDelete: (entry: NutritionLogEntry) => void;
}) {
  if (entries === null) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  return (
    <MealSections
      entries={entries}
      pantryByID={pantryByID}
      recipeByID={recipeByID}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

/**
 * Resolve the display name for a log entry. Exported so the page can
 * label the edit and delete modals with the same name the row shows.
 */
export function resolveItemName(
  entry: NutritionLogEntry,
  pantryByID: Map<string, PantryItem>,
  recipeByID: Map<string, Recipe>,
): string {
  if (entry.pantry_item_id) {
    return pantryByID.get(entry.pantry_item_id)?.name ?? "Unknown item";
  }
  if (entry.recipe_id) {
    return recipeByID.get(entry.recipe_id)?.name ?? "Unknown recipe";
  }
  return "Untitled entry";
}

function MealSections({
  entries,
  pantryByID,
  recipeByID,
  onEdit,
  onDelete,
}: {
  entries: NutritionLogEntry[];
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  onEdit: (entry: NutritionLogEntry) => void;
  onDelete: (entry: NutritionLogEntry) => void;
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
          onEdit={onEdit}
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
  onEdit,
  onDelete,
}: {
  meal: MealType;
  entries: NutritionLogEntry[];
  pantryByID: Map<string, PantryItem>;
  recipeByID: Map<string, Recipe>;
  onEdit: (entry: NutritionLogEntry) => void;
  onDelete: (entry: NutritionLogEntry) => void;
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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <th className="py-1.5 pr-3 text-left font-semibold">Time</th>
              <th className="py-1.5 pr-3 text-left font-semibold">Item</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Serv</th>
              <th className="py-1.5 pr-3 text-right font-semibold">Cal</th>
              <th className="py-1.5 pr-3 text-right font-semibold">P</th>
              <th className="py-1.5 pr-3 text-right font-semibold">F</th>
              <th className="py-1.5 pr-3 text-right font-semibold">C</th>
              <th className="py-1.5 text-right font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => {
              const name = resolveItemName(e, pantryByID, recipeByID);
              return (
                <tr
                  key={e.id}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface)]"
                >
                  <td className="py-2 pr-3 text-left text-xs text-[var(--muted)] tabular-nums">
                    {formatLocalTime(e.consumed_at)}
                  </td>
                  <td className="py-2 pr-3 text-left">
                    <span className="truncate font-medium">{name}</span>
                    {e.recipe_id && (
                      <span className="ml-2 rounded-full border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-[10px] uppercase tracking-wider">
                        recipe
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.quantity)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.calories)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {formatNumber(e.protein_g)}g
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.fat_g)}g</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(e.carbs_g)}g</td>
                  <td className="py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onEdit(e)}
                        aria-label="Edit entry"
                        className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(e)}
                        aria-label="Delete entry"
                        className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--danger)]"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
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

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
```

- [ ] **Step 2: Update `app/(app)/nutrition/page.tsx` — imports**

At the top of the file, update the `@/lib/api` import block so the `NutritionLogEntry` type stays available (it already is), and add imports for the new modals and the `resolveItemName` helper. Replace the existing `NutritionLogView` import line with:

```tsx
import { NutritionLogView, resolveItemName } from "@/components/nutrition/nutrition-log-view";
import { LogEntryEditModal } from "@/components/nutrition/log-entry-edit-modal";
import { LogEntryDeleteModal } from "@/components/nutrition/log-entry-delete-modal";
```

- [ ] **Step 3: Update `app/(app)/nutrition/page.tsx` — state**

In `NutritionPageInner`, find this state block (around lines 64–66):

```tsx
const [logBusy, setLogBusy] = useState(false);
const [logError, setLogError] = useState<string | null>(null);
const [rowBusyID, setRowBusyID] = useState<string | null>(null);
```

Replace it with:

```tsx
const [logBusy, setLogBusy] = useState(false);
const [logError, setLogError] = useState<string | null>(null);
const [editingEntry, setEditingEntry] = useState<NutritionLogEntry | null>(null);
const [deletingEntry, setDeletingEntry] = useState<NutritionLogEntry | null>(null);
```

- [ ] **Step 4: Update `app/(app)/nutrition/page.tsx` — remove `handleDelete`**

Delete the entire `handleDelete` function (currently around lines 190–202):

```tsx
function handleDelete(id: string) {
  const token = requireToken();
  if (!token) return;
  setRowBusyID(id);
  deleteNutritionLogEntry(token, id)
    .then(() => {
      setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
    })
    .catch((err: unknown) => {
      handleApiError(err);
    })
    .finally(() => setRowBusyID(null));
}
```

Then remove `deleteNutritionLogEntry` from the `@/lib/api` import block since it's no longer referenced from `page.tsx` (it's now imported inside `LogEntryDeleteModal`). The current import block is:

```tsx
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
```

Replace it with:

```tsx
import {
  createNutritionLogEntry,
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
```

- [ ] **Step 5: Update `app/(app)/nutrition/page.tsx` — view render call**

Find the `NutritionLogView` render in the body (around lines 267–275):

```tsx
{
  view === "log" && (
    <NutritionLogView
      entries={entries}
      pantryByID={pantryByID}
      recipeByID={recipeByID}
      rowBusyID={rowBusyID}
      onDelete={handleDelete}
    />
  );
}
```

Replace it with:

```tsx
{
  view === "log" && (
    <NutritionLogView
      entries={entries}
      pantryByID={pantryByID}
      recipeByID={recipeByID}
      onEdit={(entry) => setEditingEntry(entry)}
      onDelete={(entry) => setDeletingEntry(entry)}
    />
  );
}
```

- [ ] **Step 6: Update `app/(app)/nutrition/page.tsx` — render the two new modals**

Find the bottom of `<main>` (after the `QuickAddModal` render, currently around lines 295–304):

```tsx
{
  showQuickAdd && (
    <QuickAddModal
      pantry={pantry ?? []}
      recipes={recipes ?? []}
      busy={logBusy}
      error={logError}
      onLog={handleLog}
      onClose={() => setShowQuickAdd(false)}
    />
  );
}
```

Immediately after that block (still inside `</main>`), add:

```tsx
{
  editingEntry && (
    <LogEntryEditModal
      token={token}
      entry={editingEntry}
      itemName={resolveItemName(editingEntry, pantryByID, recipeByID)}
      onSaved={(updated) => {
        setEntries((prev) => (prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev));
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
        setEntries((prev) => (prev ? prev.filter((e) => e.id !== id) : prev));
        setDeletingEntry(null);
      }}
      onClose={() => setDeletingEntry(null)}
    />
  );
}
```

- [ ] **Step 7: Run typecheck + lint**

```bash
npm run typecheck
npm run lint
```

Expected: both pass. If typecheck flags `MealType` as unused in `page.tsx` (it was used by `handleLog` and should still be), recheck — it's still referenced in `handleLog`'s `meal: MealType` param.

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/nutrition/page.tsx components/nutrition/nutrition-log-view.tsx
git commit -m "$(cat <<'EOF'
feat(nutrition): per-meal log tables with edit + delete modals

Switches NutritionLogView from per-row cards to a compact <table>
inside each meal section so the whole day fits without paging. Each
row gains a pencil button that opens LogEntryEditModal and a trash
button that opens LogEntryDeleteModal, replacing the previous
single-click inline Delete.

NutritionLogView's prop signature changes — onEdit added, onDelete
now hands up the full entry, and the unused rowBusyID prop is gone.
The page owns the modal state and refetches via callback (no full
list refetch needed: edit replaces in place, delete filters out).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Manual browser verification

**Why last:** TypeScript catches signature drift, but the new table, modals, and time-preservation logic only really pay off when seen running. No commit at the end of this task — this is the human/agent verifying behavior.

**Files:** none modified.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: Next 16 dev server starts and prints a local URL. Open it in a browser, sign in, navigate to `/nutrition`.

- [ ] **Step 2: Toolbar — Log routing**

- Click the **Pantry** tab in the right toolbar group. URL becomes `/nutrition?view=pantry`.
- Click the new **Log** tab. URL becomes `/nutrition` (no query string) and the daily log renders.
- The **Log** tab shows the active underline; **Pantry** and **Recipes** do not.

- [ ] **Step 3: Default-view sanity**

- Visit `/nutrition` directly. Log view renders.
- Visit `/nutrition?view=garbage`. Log view still renders (existing `parseView` fallthrough).

- [ ] **Step 4: Table layout — populated day**

- Pick (or log via Quick Add) entries across multiple meals. Confirm:
  - Each meal section header shows the meal name and subtotal as before.
  - Below the header, rows render as a compact table with columns: Time, Item, Serv, Cal, P, F, C, [Actions].
  - Numbers are right-aligned and use tabular figures.
  - The "recipe" pill still appears next to recipe-backed entries.
  - Row hover lights up subtly.

- [ ] **Step 5: Table layout — empty states**

- Switch to a date with no entries. Page shows the "Nothing logged on this day yet." message (unchanged).
- On a populated day, meals with zero entries show "No entries" italicized in the section header (unchanged).

- [ ] **Step 6: Edit flow — happy path**

- Click the pencil on a row. Modal opens with current servings, meal, and time pre-filled.
- Change servings (e.g. `1` → `0.5`), keep meal/time, hit **Save changes**.
- Modal closes. The row updates immediately — servings, calories, protein/fat/carbs all reflect the new portion. The meal subtotal recomputes.

- [ ] **Step 7: Edit flow — cross-meal move**

- Click the pencil on a Breakfast row. Change Meal to "Lunch", save.
- The entry disappears from the Breakfast table and appears in the Lunch table with the same time. Both meals' subtotals recompute.

- [ ] **Step 8: Edit flow — time change preserves day**

- Click the pencil on a row. Change the time field to a new HH:MM, save.
- Row's Time column updates. The entry stays on the same calendar day (still under the current date's tile).

- [ ] **Step 9: Edit flow — invalid input**

- Click pencil, set Servings to `0`, hit Save. Submit is rejected client-side; modal stays open.
- Cancel out.

- [ ] **Step 10: Delete flow — happy path**

- Click trash on a row. Confirm modal appears showing item name, servings, and meal.
- Click **Cancel**. Modal closes; the row is still there.
- Click trash again, then **Delete**. Modal closes; row disappears; meal subtotal recomputes; macro rings at the top of the page update.

- [ ] **Step 11: Pantry/Recipes views still work**

- Switch to Pantry and Recipes tabs and confirm those views still render and operate unchanged (regression check — those code paths weren't touched but the toolbar layout shifted).

- [ ] **Step 12: Stop the dev server**

`Ctrl+C` in the terminal running `npm run dev`.

---

## Self-review summary

**Spec coverage:**

- Toolbar Log button — Task 1.
- Default view stays Log — covered by existing `parseView` (no code change needed; verified in Task 5 Step 3).
- Per-meal compact tables — Task 4 Step 1.
- Pencil/Trash icons per row — Task 4 Step 1 (`PencilIcon`, `TrashIcon` SVGs in the view).
- Edit modal (servings/meal/time) — Task 2 (component) + Task 4 Step 6 (page wiring).
- Delete confirm modal — Task 3 (component) + Task 4 Step 6 (page wiring).
- `resolveItemName` shared between page and view — Task 4 Step 1 (exported helper) + Step 6 (page imports + uses it).
- Removal of `rowBusyID` and the inline `handleDelete` — Task 4 Steps 3–4.
- Day-of-`consumed_at` preservation when editing time — `combineDateAndLocalTime` in Task 2 Step 1.

**Placeholder scan:** No TBDs, no "add appropriate error handling," no "see spec for details." All code blocks are complete.

**Type consistency:** `onEdit` and `onDelete` both take `(entry: NutritionLogEntry) => void` in every place they appear (view definition, page call site). Modal `onSaved` signature is `(updated: NutritionLogEntry) => void`; `onDeleted` is `(id: string) => void`. `LogEntryEditModal` and `LogEntryDeleteModal` both take `{ token, entry, itemName, onSaved/onDeleted, onClose }` per Task 2/3 and per the page render in Task 4 Step 6.
