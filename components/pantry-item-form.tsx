"use client";

import { useState } from "react";
import type { PantryItemPayload } from "@/lib/api";
import { MACRO_COLORS } from "@/lib/macro-colors";

/**
 * Reusable form for creating or editing a pantry item. Same shape for
 * both flows: the parent modal wires onSubmit + initial values, the
 * form owns its own draft state, validation kicks in client-side
 * before the API rejects with a 400.
 *
 * Layout: a flat three-column top row (Name | Serving size | Serving
 * unit), a `Per serving` divider, then a four-column macro row where
 * protein / fat / carbs gain a color swatch in the label and a 2px
 * colored left border on the input — same palette the rings, log
 * column headers, and catalog item lines already use. Calories stays
 * neutral by deliberate design (no ring color allocated).
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
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Eggland's Best Large Egg"
            disabled={busy}
            className={inputClass}
          />
        </Field>
        <Field label="Serving size">
          <input
            type="number"
            min={0}
            step="any"
            value={servingSize}
            onChange={(e) => setServingSize(e.target.value)}
            disabled={busy}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
        <Field label="Serving unit">
          <input
            type="text"
            value={servingUnit}
            onChange={(e) => setServingUnit(e.target.value)}
            placeholder="egg, slice, g, cup"
            disabled={busy}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Per serving
        </span>
        <hr className="flex-1 border-[var(--border)]" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MacroField label="Calories" value={calories} onChange={setCalories} disabled={busy} />
        <MacroField
          label="Protein (g)"
          value={proteinG}
          onChange={setProteinG}
          disabled={busy}
          tone="protein"
        />
        <MacroField label="Fat (g)" value={fatG} onChange={setFatG} disabled={busy} tone="fat" />
        <MacroField
          label="Carbs (g)"
          value={carbsG}
          onChange={setCarbsG}
          disabled={busy}
          tone="carbs"
        />
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function MacroField({
  label,
  value,
  onChange,
  disabled,
  tone,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  tone?: "protein" | "fat" | "carbs";
}) {
  const color = tone ? MACRO_COLORS[tone] : null;
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-[var(--muted)]">
        {color && (
          <span
            aria-hidden
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: color }}
          />
        )}
        {label}
      </span>
      <input
        type="number"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${inputClass} tabular-nums`}
        style={color ? { borderLeftWidth: "2px", borderLeftColor: color } : undefined}
      />
    </label>
  );
}
