"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  createPantryItem,
  deletePantryItem,
  listPantryItems,
  updatePantryItem,
  type PantryItem,
  type PantryItemPayload,
} from "@/lib/api";
import { PantryItemForm } from "@/components/pantry-item-form";

/**
 * Pantry — the user's saved-foods table.
 *
 * One persistent "new item" form at the top, a search input, and a
 * list of saved items below. Each row shows the item's macros at a
 * glance and exposes Edit / Delete affordances. Edit flips the row
 * into the same form component used for new items.
 *
 * Recipes ship in a later phase; the SOW calls for a two-tab layout
 * eventually, but Phase 1 is pantry-only so the tab nav is deferred.
 */
export default function PantryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingID, setEditingID] = useState<string | null>(null);
  const [rowBusyID, setRowBusyID] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const refetch = useCallback(
    (q: string) => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return;
      }
      listPantryItems(token, q)
        .then(setItems)
        .catch((err: Error) => {
          if (err.message.toLowerCase().includes("401")) {
            clearToken();
            router.replace("/login");
            return;
          }
          setError(err.message);
        });
    },
    [router],
  );

  useEffect(() => {
    refetch("");
  }, [refetch]);

  // Debounce search so we don't fire a request on every keystroke.
  // 250ms feels responsive without hammering the API.
  useEffect(() => {
    const handle = setTimeout(() => {
      refetch(query);
    }, 250);
    return () => clearTimeout(handle);
  }, [query, refetch]);

  function handleCreate(payload: PantryItemPayload) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setCreateBusy(true);
    setCreateError(null);
    createPantryItem(token, payload)
      .then((created) => {
        setItems((prev) =>
          prev
            ? [created, ...prev].sort((a, b) =>
                a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
              )
            : [created],
        );
      })
      .catch((err: Error) => setCreateError(err.message))
      .finally(() => setCreateBusy(false));
  }

  function handleUpdate(id: string, payload: PantryItemPayload) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setRowBusyID(id);
    setRowError(null);
    updatePantryItem(token, id, payload)
      .then((updated) => {
        setItems((prev) =>
          prev
            ? prev
                .map((p) => (p.id === id ? updated : p))
                .sort((a, b) =>
                  a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
                )
            : prev,
        );
        setEditingID(null);
      })
      .catch((err: Error) => setRowError(err.message))
      .finally(() => setRowBusyID(null));
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this pantry item? Historical log entries keep their macros.")) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setRowBusyID(id);
    setRowError(null);
    deletePantryItem(token, id)
      .then(() => {
        setItems((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
      })
      .catch((err: Error) => setRowError(err.message))
      .finally(() => setRowBusyID(null));
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Pantry</h1>
        <p className="text-xs text-[var(--muted)]">
          Your saved foods with per-serving macros. Log a meal on the
          Nutrition page (or in chat) by picking from these.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              Add a new item
            </h2>
            <PantryItemForm
              submitLabel="Save"
              busy={createBusy}
              error={createError}
              onSubmit={handleCreate}
            />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-semibold tracking-tight">
                Saved items
              </h2>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-48 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
              />
            </div>

            {rowError && (
              <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
                {rowError}
              </div>
            )}

            {items === null && !error && (
              <p className="text-sm text-[var(--muted)]">Loading…</p>
            )}

            {items && items.length === 0 && (
              <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
                {query
                  ? "No items match that search."
                  : "Your pantry is empty. Add an item above to get started."}
              </p>
            )}

            {items && items.length > 0 && (
              <ul className="flex flex-col gap-2">
                {items.map((p) =>
                  editingID === p.id ? (
                    <li key={p.id}>
                      <PantryItemForm
                        initial={p}
                        submitLabel="Save changes"
                        busy={rowBusyID === p.id}
                        error={rowError}
                        onSubmit={(payload) => handleUpdate(p.id, payload)}
                        onCancel={() => {
                          setEditingID(null);
                          setRowError(null);
                        }}
                      />
                    </li>
                  ) : (
                    <li key={p.id}>
                      <PantryRow
                        item={p}
                        busy={rowBusyID === p.id}
                        onEdit={() => setEditingID(p.id)}
                        onDelete={() => handleDelete(p.id)}
                      />
                    </li>
                  ),
                )}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function PantryRow({
  item,
  busy,
  onEdit,
  onDelete,
}: {
  item: PantryItem;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <p className="text-xs text-[var(--muted)] tabular-nums">
          {formatNumber(item.calories)} cal · P {formatNumber(item.protein_g)}g ·
          F {formatNumber(item.fat_g)}g · C {formatNumber(item.carbs_g)}g
          <span className="ml-2 text-[10px] uppercase tracking-wider">
            per {formatNumber(item.serving_size)} {item.serving_unit}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={busy}
          className="rounded-md border border-[var(--border)] px-2 py-1 text-xs hover:opacity-80 disabled:opacity-50"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)] hover:opacity-80 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function formatNumber(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
