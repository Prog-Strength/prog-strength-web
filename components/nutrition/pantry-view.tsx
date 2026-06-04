"use client";

import { useEffect, useMemo, useState } from "react";
import { type PantryItem } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { MACRO_COLORS } from "@/lib/macro-colors";
import { PantryItemModal } from "@/components/pantry-item-modal";
import { PantryItemDeleteModal } from "@/components/nutrition/pantry-item-delete-modal";

const PAGE_SIZE = 40;

type ModalTarget = null | { mode: "create" } | { mode: "edit"; id: string };

/**
 * Pantry view rendered when /nutrition?view=pantry. Owns its own UI
 * state (query, page, modal target, delete target) but reads the
 * pantry list from the page-level shell. Save and delete callbacks
 * bubble up so the shell can refetch pantry + recipes (recipe macros
 * depend on pantry).
 */
export function PantryView({
  token,
  pantry,
  onChanged,
}: {
  token: string;
  pantry: PantryItem[] | null;
  onChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<ModalTarget>(null);
  const [deleting, setDeleting] = useState<PantryItem | null>(null);

  const filtered = useMemo(() => {
    if (pantry === null) return null;
    const q = query.trim().toLowerCase();
    const sorted = pantry
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    if (q === "") return sorted;
    return sorted.filter((p) => p.name.toLowerCase().includes(q));
  }, [pantry, query]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;

  // Clamp page inline so we never render an empty slice if filtering
  // shrinks the list below the current page. Avoids a setState-in-effect.
  const effectivePage = Math.min(page, pageCount);

  const pageItems = useMemo(() => {
    if (!filtered) return [];
    const start = (effectivePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, effectivePage]);

  // Group the page slice by first-letter bucket so we can emit
  // headers when the bucket changes within the page.
  const pageGroups = useMemo(() => {
    const groups: { letter: string; items: PantryItem[] }[] = [];
    for (const item of pageItems) {
      const letter = bucketLetter(item.name);
      const last = groups[groups.length - 1];
      if (last && last.letter === letter) {
        last.items.push(item);
      } else {
        groups.push({ letter, items: [item] });
      }
    }
    return groups;
  }, [pageItems]);

  const editingItem =
    modal && modal.mode === "edit" ? (pantry ?? []).find((p) => p.id === modal.id) : undefined;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Pantry</h2>
        <button
          type="button"
          onClick={() => setModal({ mode: "create" })}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] transition hover:opacity-70"
        >
          <PlusIcon />
          Add
        </button>
      </div>

      <input
        type="search"
        aria-label="Search pantry items"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search…"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
      />

      {pantry === null && <p className="text-sm text-[var(--muted)]">Loading…</p>}

      {filtered && filtered.length === 0 && (
        <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
          {query.trim()
            ? "No items match that search."
            : "Your pantry is empty. Add an item to get started."}
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <>
          <div className="flex flex-col gap-3">
            {pageGroups.map((g) => (
              <div key={g.letter} className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                  {g.letter}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {g.items.map((p) => (
                    <PantryRow
                      key={p.id}
                      item={p}
                      onEdit={() => setModal({ mode: "edit", id: p.id })}
                      onDelete={() => setDeleting(p)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <PaginationFooter
            page={effectivePage}
            pageCount={pageCount}
            onPrev={() => setPage(Math.max(1, effectivePage - 1))}
            onNext={() => setPage(Math.min(pageCount, effectivePage + 1))}
          />
        </>
      )}

      {modal?.mode === "create" && (
        <PantryItemModal
          mode="create"
          token={token}
          onSaved={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.mode === "edit" && editingItem && (
        <PantryItemModal
          mode="edit"
          token={token}
          initial={editingItem}
          onSaved={onChanged}
          onDeleted={onChanged}
          onClose={() => setModal(null)}
        />
      )}
      {/* Edge case: if the edit target was deleted out from under us
          (e.g. by an external mutation), close the modal silently. */}
      {modal?.mode === "edit" && !editingItem && <CloseStaleModal onClose={() => setModal(null)} />}

      {deleting && (
        <PantryItemDeleteModal
          token={token}
          item={deleting}
          onDeleted={onChanged}
          onClose={() => setDeleting(null)}
        />
      )}
    </section>
  );
}

function PantryRow({
  item,
  onEdit,
  onDelete,
}: {
  item: PantryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="truncate text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(item.calories)} cal ·{" "}
          <span style={{ color: MACRO_COLORS.protein }} className="font-semibold">
            P
          </span>{" "}
          {formatNumber(item.protein_g)} ·{" "}
          <span style={{ color: MACRO_COLORS.fat }} className="font-semibold">
            F
          </span>{" "}
          {formatNumber(item.fat_g)} ·{" "}
          <span style={{ color: MACRO_COLORS.carbs }} className="font-semibold">
            C
          </span>{" "}
          {formatNumber(item.carbs_g)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${item.name}`}
          className="rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
        >
          <PencilIcon />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${item.name}`}
          className="rounded p-1.5 text-[var(--danger)] transition hover:bg-[var(--background)] hover:opacity-80"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function PaginationFooter({
  page,
  pageCount,
  onPrev,
  onNext,
}: {
  page: number;
  pageCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 pt-2 text-xs">
      <button
        type="button"
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        ◀ Prev
      </button>
      <span className="text-[var(--muted)] tabular-nums">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={page >= pageCount}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-medium transition hover:opacity-80 disabled:opacity-40"
      >
        Next ▶
      </button>
    </div>
  );
}

function CloseStaleModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    onClose();
  }, [onClose]);
  return null;
}

function bucketLetter(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
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
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
