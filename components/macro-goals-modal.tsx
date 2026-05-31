"use client";

import { useEffect, useState } from "react";
import { putMacroGoals, type MacroGoals } from "@/lib/api";

// Mirrors the API's MaxMacroGrams / MaxCalories. Duplicated so the
// form can show an inline error without a roundtrip; the API
// re-enforces the same caps as the source of truth.
const MAX_MACRO_GRAMS = 10_000;
const MAX_CALORIES = 100_000;

/**
 * Set Goals modal.
 *
 * One form for all four macro targets (protein/carbs/fat/calories).
 * A live "macros total X kcal" hint computes the implied calorie
 * total from the four-four-nine math and reports the delta against
 * whatever the user typed for calories — but does NOT block save.
 * Per the SOW (daily-macro-goals.md), some lifters set independent
 * macro and calorie targets on purpose, so we surface the math
 * without enforcing consistency.
 *
 * Dismissal ergonomics mirror the other modals: Escape, backdrop
 * click, explicit Close. Body scroll locks while open.
 */
export function MacroGoalsModal({
  token,
  initial,
  onSaved,
  onClose,
}: {
  token: string;
  initial: MacroGoals;
  onSaved: (saved: MacroGoals) => void;
  onClose: () => void;
}) {
  // Use strings (not numbers) so the input can be cleared without
  // collapsing to 0 mid-edit. The save handler parses on submit and
  // rejects empties / non-integers there.
  const [protein, setProtein] = useState(() => String(initial.protein_g));
  const [carbs, setCarbs] = useState(() => String(initial.carbs_g));
  const [fat, setFat] = useState(() => String(initial.fat_g));
  const [calories, setCalories] = useState(() => String(initial.calories));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Parse current input. Non-integers parse to NaN and surface as
  // null here so the hint and save-validation can share the check.
  const parseIntOrNull = (s: string): number | null => {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const p = parseIntOrNull(protein);
  const c = parseIntOrNull(carbs);
  const f = parseIntOrNull(fat);
  const k = parseIntOrNull(calories);

  // 4/4/9 calories-from-macros hint. Only shown when all three macro
  // fields parse cleanly — partial input would mislead.
  const computedCalories = p !== null && c !== null && f !== null ? p * 4 + c * 4 + f * 9 : null;
  const delta = computedCalories !== null && k !== null ? k - computedCalories : null;

  async function save() {
    if (p === null || c === null || f === null || k === null) {
      setError("Enter a non-negative integer for each field.");
      return;
    }
    if (p > MAX_MACRO_GRAMS || c > MAX_MACRO_GRAMS || f > MAX_MACRO_GRAMS) {
      setError(`Each macro must be ≤ ${MAX_MACRO_GRAMS} g.`);
      return;
    }
    if (k > MAX_CALORIES) {
      setError(`Calories must be ≤ ${MAX_CALORIES}.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await putMacroGoals(token, {
        protein_g: p,
        carbs_g: c,
        fat_g: f,
        calories: k,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="macro-goals-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !saving && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="macro-goals-modal-title" className="text-base font-semibold">
              Set daily goals
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Targets drive the rings on the Nutrition page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <GoalField
            label="Protein"
            unit="g"
            value={protein}
            onChange={setProtein}
            disabled={saving}
          />
          <GoalField label="Carbs" unit="g" value={carbs} onChange={setCarbs} disabled={saving} />
          <GoalField label="Fat" unit="g" value={fat} onChange={setFat} disabled={saving} />
          <GoalField
            label="Calories"
            unit="kcal"
            value={calories}
            onChange={setCalories}
            disabled={saving}
            hint={
              computedCalories !== null && delta !== null ? (
                <span>
                  Macros total {computedCalories} kcal
                  {delta === 0 ? (
                    " (matches your target)"
                  ) : (
                    <>
                      {" "}
                      ({Math.abs(delta)} kcal {delta > 0 ? "under" : "over"} your target)
                    </>
                  )}
                </span>
              ) : null
            }
          />

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-[var(--foreground)] px-3 py-1.5 text-sm font-semibold text-[var(--background)] hover:opacity-80 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function GoalField({
  label,
  unit,
  value,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-[var(--foreground)]/30 disabled:opacity-50"
        />
        <span className="text-xs text-[var(--muted)]">{unit}</span>
      </div>
      {hint && <span className="text-[10px] text-[var(--muted)]">{hint}</span>}
    </label>
  );
}
