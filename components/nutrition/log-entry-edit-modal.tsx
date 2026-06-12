"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateNutritionLogEntry, type MealType, type NutritionLogEntry } from "@/lib/api";
import { clearToken } from "@/lib/auth";
import { MacroField } from "@/components/pantry-item-form";
import { useToast } from "@/components/toast";

const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

/**
 * Edit-log-entry modal. For pantry/recipe entries it surfaces the three
 * fields the server's UpdateLogEntryPayload accepts: meal, quantity
 * (servings), and consumed_at — with the time-input covering only the
 * time-of-day, preserving the entry's calendar day.
 *
 * For custom entries (`custom_meal_name != null`) the quantity input is
 * hidden — custom rows store the totals the user typed, not a
 * per-serving × multiplier pair — and the modal instead renders a name
 * input plus a four-column macro row (same palette as the QuickAdd
 * Custom tab). The save call routes name + macros through the extended
 * PUT and omits quantity.
 *
 * Same shell ergonomics as QuickAddModal: Escape to close, body scroll
 * lock, backdrop click dismiss while idle.
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
  const toast = useToast();
  const isCustom = entry.custom_meal_name != null;
  const [meal, setMeal] = useState<MealType>(entry.meal);
  const [quantity, setQuantity] = useState<string>(String(entry.quantity));
  const [time, setTime] = useState<string>(() => toLocalHHMM(entry.consumed_at));
  // Custom-entry state. Seeded from the row's stored name + macros; only
  // read when `isCustom`.
  const [customName, setCustomName] = useState<string>(entry.custom_meal_name ?? "");
  const [calories, setCalories] = useState<string>(String(entry.calories));
  const [proteinG, setProteinG] = useState<string>(String(entry.protein_g));
  const [fatG, setFatG] = useState<string>(String(entry.fat_g));
  const [carbsG, setCarbsG] = useState<string>(String(entry.carbs_g));
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
    const consumedAt = combineDateAndLocalTime(entry.consumed_at, time);

    // Build the payload per entry type: custom rows send name + macros
    // (no quantity); pantry/recipe rows send quantity exactly as before.
    let payload: Parameters<typeof updateNutritionLogEntry>[2];
    if (isCustom) {
      const name = customName.trim();
      if (!name) {
        setError("Name is required.");
        return;
      }
      const cal = Number(calories || "0");
      const p = Number(proteinG || "0");
      const f = Number(fatG || "0");
      const c = Number(carbsG || "0");
      if (![cal, p, f, c].every(Number.isFinite)) {
        setError("Macros must be numbers.");
        return;
      }
      if (cal < 0 || p < 0 || f < 0 || c < 0) {
        setError("Macros must be non-negative.");
        return;
      }
      payload = {
        consumed_at: consumedAt,
        meal,
        name,
        calories: cal,
        protein_g: p,
        fat_g: f,
        carbs_g: c,
      };
    } else {
      const q = Number(quantity);
      if (!Number.isFinite(q) || q <= 0) return;
      payload = {
        quantity: q,
        meal,
        consumed_at: consumedAt,
      };
    }

    setBusy(true);
    setError(null);
    updateNutritionLogEntry(token, entry.id, payload)
      .then((updated) => {
        toast.success(`Updated "${itemName}".`);
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
          {isCustom && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[var(--muted)]">
                Name
              </span>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Chipotle chicken bowl"
                disabled={busy}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
              />
            </label>
          )}

          {isCustom && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MacroField
                label="Calories"
                value={calories}
                onChange={setCalories}
                disabled={busy}
              />
              <MacroField
                label="Protein (g)"
                value={proteinG}
                onChange={setProteinG}
                disabled={busy}
                tone="protein"
              />
              <MacroField
                label="Fat (g)"
                value={fatG}
                onChange={setFatG}
                disabled={busy}
                tone="fat"
              />
              <MacroField
                label="Carbs (g)"
                value={carbsG}
                onChange={setCarbsG}
                disabled={busy}
                tone="carbs"
              />
            </div>
          )}

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
            {!isCustom && (
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
            )}
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
