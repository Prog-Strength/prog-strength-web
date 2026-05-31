"use client";

import { useEffect, useMemo, useState } from "react";
import { type PantryItem } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { PantryItemModal } from "@/components/pantry-item-modal";

const PAGE_SIZE = 25;

type ModalTarget = null | { mode: "create" } | { mode: "edit"; id: string };

/**
 * Pantry view rendered when /nutrition?view=pantry. Owns its own UI
 * state (query, page, modal target) but reads the pantry list from
 * the page-level shell. Save and delete callbacks bubble up so the
 * shell can refetch pantry + recipes (recipe macros depend on pantry).
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
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium hover:opacity-80"
        >
          + Add
        </button>
      </div>

      <input
        type="search"
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
                <ul className="flex flex-col gap-2">
                  {g.items.map((p) => (
                    <li key={p.id}>
                      <PantryRow item={p} onClick={() => setModal({ mode: "edit", id: p.id })} />
                    </li>
                  ))}
                </ul>
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
    </section>
  );
}

function PantryRow({ item, onClick }: { item: PantryItem; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left transition hover:opacity-90"
    >
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(item.calories)} cal · P {formatNumber(item.protein_g)}g · F{" "}
          {formatNumber(item.fat_g)}g · C {formatNumber(item.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">
            per {formatNumber(item.serving_size)} {item.serving_unit}
          </span>
        </p>
      </div>
    </button>
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
