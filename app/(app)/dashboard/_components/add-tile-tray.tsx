/**
 * AddTileTray — the inline "add a tile" panel shown below the sections in edit
 * mode. It lists exactly the catalog tiles NOT anywhere in the current draft
 * (in catalog order, via the pure `availableTiles`), each with its title,
 * one-line description, and an Add affordance. When every tile is already
 * enabled it collapses to a quiet "All tiles added" note.
 *
 * With more than one section, adding a tile needs a destination, so the tray
 * carries a target picker. It defaults to the last section and is pre-set when
 * the tray was opened from a section's own "Add tile" button. A single-section
 * layout has nothing to choose, so the picker is hidden entirely.
 *
 * It is a tray, not a modal: no focus trap, no scroll lock — just a hairline
 * panel that flows in the document beneath the sections.
 */
"use client";

import type { DashboardSection } from "@/lib/api";
import type { TileId } from "@/lib/dashboard-tiles";
import { availableTiles } from "./layout-ops";

export function AddTileTray({
  sections,
  targetSectionId,
  onTargetChange,
  onAdd,
}: {
  sections: DashboardSection[];
  targetSectionId: string;
  onTargetChange: (id: string) => void;
  onAdd: (id: TileId, sectionId: string) => void;
}) {
  const entries = availableTiles(sections);

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Add a tile
        </h3>
        {sections.length > 1 && (
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            Add to
            <select
              value={targetSectionId}
              onChange={(e) => onTargetChange(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-line)]"
            >
              {sections.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {s.title || `Untitled section ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
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
                onClick={() => onAdd(entry.id, targetSectionId)}
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
