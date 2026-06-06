"use client";

import { useEffect } from "react";
import type { BodyweightEntry } from "@/lib/api";

/**
 * Action sheet shown when the user taps a reading card on mobile.
 * Two large action rows (Edit, Delete) route back through the page's
 * existing onEdit / onDelete callbacks so the downstream modals
 * (BodyweightEditModal, BodyweightDeleteModal) don't change shape.
 *
 * On desktop the per-row pencil + trash icons fire those callbacks
 * directly; this sheet only exists because icon-action columns can't
 * survive on phone-width tables without crowding the reading itself.
 *
 * Mirrors components/nutrition/entry-action-sheet.tsx so the two pages
 * read as a set on mobile.
 */
export function BodyweightActionSheet({
  entry,
  onEdit,
  onDelete,
  onClose,
}: {
  entry: BodyweightEntry;
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
      aria-labelledby="bodyweight-action-sheet-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex flex-col gap-1 border-b border-[var(--border)] px-5 py-3">
          <h2
            id="bodyweight-action-sheet-title"
            className="text-sm font-semibold tracking-tight tabular-nums"
          >
            {formatWeight(entry.weight)} {entry.unit}
          </h2>
          <p className="text-[11px] text-[var(--muted)] tabular-nums">
            {formatRowDate(entry.measured_at)} · {formatRowTime(entry.measured_at)}
          </p>
        </header>

        <div className="flex flex-col gap-2 px-3 py-3">
          <ActionRow icon={<PencilIcon />} label="Edit reading" onClick={onEdit} />
          <ActionRow icon={<TrashIcon />} label="Delete reading" onClick={onDelete} tone="danger" />
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

function formatWeight(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function formatRowDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatRowTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
