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
