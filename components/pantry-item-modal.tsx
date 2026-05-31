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
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
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
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
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
