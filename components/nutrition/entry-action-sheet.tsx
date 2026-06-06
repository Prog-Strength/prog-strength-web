"use client";

import { useEffect } from "react";
import type { NutritionLogEntry } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { MACRO_COLORS } from "@/lib/macro-colors";

/**
 * Action sheet shown when the user taps a log entry card on mobile.
 * Two large action rows (Edit, Delete) route back through the page's
 * existing onEdit / onDelete callbacks so the downstream modals
 * (LogEntryEditModal, LogEntryDeleteModal) don't change shape.
 *
 * On desktop the per-row pencil + trash icons fire those callbacks
 * directly; this sheet only exists because icon-action columns can't
 * survive on phone-width tables without crowding the item name.
 */
export function EntryActionSheet({
  entry,
  itemName,
  onEdit,
  onDelete,
  onClose,
}: {
  entry: NutritionLogEntry;
  itemName: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-action-sheet-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex flex-col gap-1 border-b border-[var(--border)] px-5 py-3">
          <h2 id="entry-action-sheet-title" className="text-sm font-semibold tracking-tight">
            {itemName}
          </h2>
          <p className="text-[11px] text-[var(--muted)] tabular-nums">
            {formatNumber(entry.calories)} cal ·{" "}
            <span style={{ color: MACRO_COLORS.protein }} className="font-semibold">
              P
            </span>{" "}
            {formatNumber(entry.protein_g)}g ·{" "}
            <span style={{ color: MACRO_COLORS.fat }} className="font-semibold">
              F
            </span>{" "}
            {formatNumber(entry.fat_g)}g ·{" "}
            <span style={{ color: MACRO_COLORS.carbs }} className="font-semibold">
              C
            </span>{" "}
            {formatNumber(entry.carbs_g)}g
          </p>
        </header>

        <div className="flex flex-col gap-2 px-3 py-3">
          <ActionRow icon={<PencilIcon />} label="Edit entry" onClick={onEdit} />
          <ActionRow icon={<TrashIcon />} label="Delete entry" onClick={onDelete} tone="danger" />
        </div>

        <footer className="flex items-center justify-end border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80"
          >
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "text-[var(--danger)] hover:bg-[var(--danger)]/10"
      : "text-[var(--foreground)] hover:bg-[var(--surface)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition ${toneClasses}`}
    >
      <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}

function PencilIcon() {
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
      strokeWidth="1.8"
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
