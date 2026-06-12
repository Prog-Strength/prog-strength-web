"use client";

import { useEffect } from "react";
import { formatNumber } from "@/lib/format";
import { MACRO_COLORS } from "@/lib/macro-colors";

/**
 * Action sheet shown when the user taps a pantry-item or recipe card
 * on mobile. Mirrors EntryActionSheet (the log-view equivalent): three
 * large action rows (Log, Edit, Delete) route back through the view's
 * existing callbacks so the downstream modals don't change shape.
 *
 * On desktop the per-row plus + pencil + trash icons fire those
 * callbacks directly; this sheet only exists because three icon
 * buttons can't survive on phone-width cards without crowding the
 * item name.
 */
export function CatalogActionSheet({
  name,
  macros,
  onLog,
  onEdit,
  onDelete,
  onClose,
}: {
  name: string;
  macros: { calories: number; protein_g: number; fat_g: number; carbs_g: number };
  onLog: () => void;
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
      aria-labelledby="catalog-action-sheet-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex flex-col gap-1 border-b border-[var(--border)] px-5 py-3">
          <h2 id="catalog-action-sheet-title" className="text-sm font-semibold tracking-tight">
            {name}
          </h2>
          <p className="text-[11px] text-[var(--muted)] tabular-nums">
            {formatNumber(macros.calories)} cal ·{" "}
            <span style={{ color: MACRO_COLORS.protein }} className="font-semibold">
              P
            </span>{" "}
            {formatNumber(macros.protein_g)} ·{" "}
            <span style={{ color: MACRO_COLORS.fat }} className="font-semibold">
              F
            </span>{" "}
            {formatNumber(macros.fat_g)} ·{" "}
            <span style={{ color: MACRO_COLORS.carbs }} className="font-semibold">
              C
            </span>{" "}
            {formatNumber(macros.carbs_g)}
          </p>
        </header>

        <div className="flex flex-col gap-2 px-3 py-3">
          <ActionRow icon={<PlusIcon />} label="Log" onClick={onLog} />
          <ActionRow icon={<PencilIcon />} label="Edit" onClick={onEdit} />
          <ActionRow icon={<TrashIcon />} label="Delete" onClick={onDelete} tone="danger" />
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
