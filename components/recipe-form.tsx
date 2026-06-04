"use client";

import { useMemo, useState } from "react";
import { formatNumber } from "@/lib/format";
import { MACRO_COLORS } from "@/lib/macro-colors";
import type { PantryItem, Recipe, RecipePayload } from "@/lib/api";

/**
 * Reusable form for creating or editing a recipe. Components list is
 * mutable: add via the picker, adjust per-component quantity, reorder
 * with up/down arrows, remove with the trash icon. Macros at the top
 * recompute live from the selection as the user edits.
 *
 * Layout follows the pantry-form vocabulary: flat surface (no nested
 * card), section divider, ghost text-button for Add component, and a
 * MacroPreview tile row colored against the shared MACRO_COLORS
 * palette so the same protein-emerald / fat-pink / carbs-amber
 * identity carries from the rings through to the recipe builder.
 */

// Mirrors the API's MaxRecipeComponents constant. Worth duplicating
// since it's a small int the Save button reacts to without a round
// trip, and there are exactly two places to keep in sync.
const MAX_COMPONENTS = 20;

type DraftComponent = {
  // Stable client-side row key for React's reconciliation. The
  // saved-server ID lives on the original recipe's components and is
  // not surfaced here — the SOW's set-replacement pattern means
  // editing a recipe writes brand-new component rows server-side.
  key: string;
  pantry_item_id: string;
  quantity: number;
};

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
  const [name, setName] = useState(initial?.name ?? "");
  const [components, setComponents] = useState<DraftComponent[]>(
    initial?.components.map((c, i) => ({
      key: `c-${i}-${c.pantry_item_id}`,
      pantry_item_id: c.pantry_item_id,
      quantity: c.quantity,
    })) ?? [],
  );
  const [localError, setLocalError] = useState<string | null>(null);

  // Macro preview: sum (component.quantity × pantry-item per-serving
  // macros) over every component that points at a known pantry item.
  // Mirrors the server-side ComputeRecipeMacros math so the user sees
  // the same number before and after saving.
  const pantryByID = useMemo(() => {
    const m = new Map<string, PantryItem>();
    for (const p of pantry) m.set(p.id, p);
    return m;
  }, [pantry]);
  const macros = useMemo(() => {
    let calories = 0;
    let protein = 0;
    let fat = 0;
    let carbs = 0;
    for (const c of components) {
      const p = pantryByID.get(c.pantry_item_id);
      if (!p || !Number.isFinite(c.quantity)) continue;
      calories += c.quantity * p.calories;
      protein += c.quantity * p.protein_g;
      fat += c.quantity * p.fat_g;
      carbs += c.quantity * p.carbs_g;
    }
    return { calories, protein, fat, carbs };
  }, [components, pantryByID]);

  const atCap = components.length >= MAX_COMPONENTS;

  function addComponent() {
    if (atCap) return;
    // Default to the first pantry item not already in the recipe,
    // falling back to the first item overall. Mild UX nicety:
    // adding two rows in a row doesn't duplicate by default.
    const taken = new Set(components.map((c) => c.pantry_item_id));
    const candidate = pantry.find((p) => !taken.has(p.id)) ?? pantry[0];
    if (!candidate) return;
    setComponents((prev) => [
      ...prev,
      {
        key: `c-${prev.length}-${candidate.id}-${Date.now()}`,
        pantry_item_id: candidate.id,
        quantity: 1,
      },
    ]);
  }

  function updateComponent(key: string, patch: Partial<DraftComponent>) {
    setComponents((prev) => prev.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }

  function removeComponent(key: string) {
    setComponents((prev) => prev.filter((c) => c.key !== key));
  }

  function moveComponent(idx: number, delta: -1 | 1) {
    setComponents((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Recipe name is required.");
      return;
    }
    if (components.length === 0) {
      setLocalError("At least one component is required.");
      return;
    }
    const seen = new Set<string>();
    for (const c of components) {
      if (!c.pantry_item_id) {
        setLocalError("Every component needs a pantry item.");
        return;
      }
      if (seen.has(c.pantry_item_id)) {
        setLocalError("Duplicate component — combine into a single row by adjusting quantity.");
        return;
      }
      seen.add(c.pantry_item_id);
      if (!Number.isFinite(c.quantity) || c.quantity <= 0) {
        setLocalError("Component quantity must be greater than zero.");
        return;
      }
    }
    onSubmit({
      name: name.trim(),
      components: components.map((c) => ({
        pantry_item_id: c.pantry_item_id,
        quantity: c.quantity,
      })),
    });
  }

  const shownError = error ?? localError;

  if (pantry.length === 0) {
    return (
      <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
        Add a pantry item before building a recipe.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Standard Breakfast"
          disabled={busy}
          className={inputClass}
        />
      </label>

      <MacroPreview macros={macros} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Components ({components.length}/{MAX_COMPONENTS})
            </span>
            <hr className="flex-1 border-[var(--border)]" />
          </div>
          <button
            type="button"
            onClick={addComponent}
            disabled={busy || atCap}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)] transition hover:opacity-70 disabled:opacity-40"
          >
            <PlusIcon />
            Add component
          </button>
        </div>

        {components.length === 0 ? (
          <p className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface)] px-3 py-4 text-center text-xs text-[var(--muted)]">
            No components yet — add one to start.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {components.map((c, idx) => (
              <li key={c.key}>
                <ComponentRow
                  component={c}
                  pantry={pantry}
                  isFirst={idx === 0}
                  isLast={idx === components.length - 1}
                  disabled={!!busy}
                  onChange={(patch) => updateComponent(c.key, patch)}
                  onRemove={() => removeComponent(c.key)}
                  onMoveUp={() => moveComponent(idx, -1)}
                  onMoveDown={() => moveComponent(idx, 1)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {shownError && <p className="text-xs text-[var(--danger)]">{shownError}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
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
    </form>
  );
}

const inputClass =
  "rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm transition focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-[var(--accent)] disabled:opacity-60";

function ComponentRow({
  component,
  pantry,
  isFirst,
  isLast,
  disabled,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  component: DraftComponent;
  pantry: PantryItem[];
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onChange: (patch: Partial<DraftComponent>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 sm:flex-row sm:items-end">
      <div className="flex flex-col gap-1 sm:hidden">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Item
        </span>
      </div>
      <select
        value={component.pantry_item_id}
        onChange={(e) => onChange({ pantry_item_id: e.target.value })}
        disabled={disabled}
        className="flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
      >
        {pantry.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <label className="flex flex-col gap-1 text-xs sm:w-24">
        <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">Servings</span>
        <input
          type="number"
          min={0}
          step="any"
          value={component.quantity}
          onChange={(e) => onChange({ quantity: Number(e.target.value) })}
          disabled={disabled}
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm tabular-nums"
        />
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || isFirst}
          aria-label="Move up"
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:opacity-80 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || isLast}
          aria-label="Move down"
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:opacity-80 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label="Remove component"
          className="rounded p-1.5 text-[var(--danger)] transition hover:bg-[var(--background)] hover:opacity-80 disabled:opacity-50"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function MacroPreview({
  macros,
}: {
  macros: { calories: number; protein: number; fat: number; carbs: number };
}) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <Tile label="Cal" value={formatNumber(macros.calories)} />
      <Tile label="Protein" value={`${formatNumber(macros.protein)}g`} tone="protein" />
      <Tile label="Fat" value={`${formatNumber(macros.fat)}g`} tone="fat" />
      <Tile label="Carbs" value={`${formatNumber(macros.carbs)}g`} tone="carbs" />
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "protein" | "fat" | "carbs";
}) {
  const color = tone ? MACRO_COLORS[tone] : null;
  return (
    <div className="text-center">
      <p className="text-sm font-semibold tabular-nums" style={color ? { color } : undefined}>
        {value}
      </p>
      <p className="inline-flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--muted)]">
        {color && (
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: color }}
          />
        )}
        {label}
      </p>
    </div>
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

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
