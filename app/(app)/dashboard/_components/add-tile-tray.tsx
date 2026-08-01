/**
 * AddTileTray — the inline "add a tile" panel shown below the grid in edit
 * mode. It lists exactly the catalog tiles NOT in the current `draft` (in
 * catalog order, via the pure `availableTiles`), each with its title,
 * one-line description, and an Add affordance. When every tile is already
 * enabled it collapses to a quiet "All tiles added" note.
 *
 * It is a tray, not a modal: no focus trap, no scroll lock — just a hairline
 * panel that flows in the document beneath the sortable grid.
 */
"use client";

import type { TileId } from "@/lib/dashboard-tiles";
import { availableTiles } from "./layout-ops";

export function AddTileTray({ draft, onAdd }: { draft: TileId[]; onAdd: (id: TileId) => void }) {
  const entries = availableTiles(draft);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Add a tile
      </h3>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--faint)]">All tiles added</p>
      ) : (
        <ul className="mt-3 flex flex-col divide-y divide-[var(--border)]">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)]">{entry.title}</p>
                <p className="text-xs text-[var(--muted)]">{entry.description}</p>
              </div>
              <button
                type="button"
                aria-label={`Add ${entry.title}`}
                onClick={() => onAdd(entry.id)}
                className="shrink-0 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
              >
                Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
