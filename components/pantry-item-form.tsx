"use client";

import { useState } from "react";
import type { PantryItemPayload } from "@/lib/api";

/**
 * Reusable form for creating or editing a pantry item. Same shape for
 * both flows: the parent page wires onSubmit + initial values, the
 * form owns its own draft state, validation kicks in client-side
 * before the API rejects with a 400.
 *
 * Used by the /pantry page (new item at the top of the page; edit
 * in-place inside each row).
 */
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
  const [name, setName] = useState(initial?.name ?? "");
  const [calories, setCalories] = useState(initial?.calories?.toString() ?? "");
  const [proteinG, setProteinG] = useState(initial?.protein_g?.toString() ?? "");
  const [fatG, setFatG] = useState(initial?.fat_g?.toString() ?? "");
  const [carbsG, setCarbsG] = useState(initial?.carbs_g?.toString() ?? "");
  const [servingSize, setServingSize] = useState(initial?.serving_size?.toString() ?? "1");
  const [servingUnit, setServingUnit] = useState(initial?.serving_unit ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!name.trim()) {
      setLocalError("Name is required.");
      return;
    }
    if (!servingUnit.trim()) {
      setLocalError("Serving unit is required.");
      return;
    }
    const cal = Number(calories);
    const p = Number(proteinG);
    const f = Number(fatG);
    const c = Number(carbsG);
    const s = Number(servingSize);
    if (![cal, p, f, c, s].every(Number.isFinite)) {
      setLocalError("Macros and serving size must be numbers.");
      return;
    }
    if (cal < 0 || p < 0 || f < 0 || c < 0) {
      setLocalError("Macros must be non-negative.");
      return;
    }
    if (s <= 0) {
      setLocalError("Serving size must be greater than zero.");
      return;
    }
    onSubmit({
      name: name.trim(),
      calories: cal,
      protein_g: p,
      fat_g: f,
      carbs_g: c,
      serving_size: s,
      serving_unit: servingUnit.trim(),
    });
  }

  const shownError = error ?? localError;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Eggland's Best Large Egg"
            disabled={busy}
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
              Serving size
            </span>
            <input
              type="number"
              min={0}
              step="any"
              value={servingSize}
              onChange={(e) => setServingSize(e.target.value)}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm tabular-nums"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
              Serving unit
            </span>
            <input
              type="text"
              value={servingUnit}
              onChange={(e) => setServingUnit(e.target.value)}
              placeholder="egg, slice, g, cup"
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MacroField label="Calories" value={calories} onChange={setCalories} disabled={busy} />
        <MacroField label="Protein (g)" value={proteinG} onChange={setProteinG} disabled={busy} />
        <MacroField label="Fat (g)" value={fatG} onChange={setFatG} disabled={busy} />
        <MacroField label="Carbs (g)" value={carbsG} onChange={setCarbsG} disabled={busy} />
      </div>

      {shownError && <p className="text-xs text-[var(--danger)]">{shownError}</p>}

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
    </form>
  );
}

function MacroField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm tabular-nums"
      />
    </label>
  );
}
