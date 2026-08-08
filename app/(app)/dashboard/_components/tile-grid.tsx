/**
 * TileGrid — ONE section's tiles in the responsive grid.
 *
 * View mode renders the section's tiles in order. Edit mode wraps them in a
 * sortable context scoped to this section and registers the grid itself as a
 * droppable, so a tile can be dragged into a section that is currently EMPTY
 * (there would be no tile to drop onto otherwise). Each tile gains a labelled
 * drag handle and a remove button.
 *
 * The DndContext and all layout math live one level up in SectionList — this
 * component owns no drag state and never reimplements a move.
 */
"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type TileId, tileEntry } from "@/lib/dashboard-tiles";
import type { DashboardData } from "@/lib/dashboard";
import { TileCard } from "./tile-renderer";

const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function TileGrid({
  sectionId,
  tileIds,
  data,
  mode,
  onRemove,
}: {
  sectionId: string;
  tileIds: TileId[];
  data: DashboardData;
  mode: "view" | "edit";
  onRemove: (id: TileId) => void;
}) {
  if (mode === "view") {
    return (
      <div className={GRID}>
        {tileIds.map((id) => (
          <TileCard key={id} id={id} data={data} />
        ))}
      </div>
    );
  }

  return (
    <SortableContext items={tileIds} strategy={rectSortingStrategy}>
      <SectionDropZone sectionId={sectionId} empty={tileIds.length === 0}>
        {tileIds.map((id) => (
          <SortableTile
            key={id}
            id={id}
            sectionId={sectionId}
            title={tileEntry(id).title}
            onRemove={() => onRemove(id)}
          >
            <TileCard id={id} data={data} />
          </SortableTile>
        ))}
      </SectionDropZone>
    </SortableContext>
  );
}

/**
 * SectionDropZone — the section's grid, registered as a drop target so an
 * empty section is droppable. When empty it renders a dashed placeholder
 * rather than collapsing to nothing, which is both the visual affordance and
 * the hit area for the drop.
 */
function SectionDropZone({
  sectionId,
  empty,
  children,
}: {
  sectionId: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop:${sectionId}`,
    data: { type: "section-drop", sectionId },
  });

  if (empty) {
    return (
      <div
        ref={setNodeRef}
        className={`flex items-center justify-center rounded-[var(--radius-card)] border border-dashed px-4 py-8 text-xs transition ${
          isOver
            ? "border-[var(--accent)] text-[var(--accent)]"
            : "border-[var(--border)] text-[var(--faint)]"
        }`}
      >
        Drag a tile here
      </div>
    );
  }

  return (
    <div ref={setNodeRef} className={GRID}>
      {children}
    </div>
  );
}

/**
 * SortableTile — the edit-mode wrapper around one tile. Renders a drag handle
 * and a remove button as calm chrome over the card, both with accessible names
 * derived from the tile title. `sectionId` rides along in the drag data so the
 * drag handlers can tell which section a dragged tile came from.
 */
function SortableTile({
  id,
  sectionId,
  title,
  onRemove,
  children,
}: {
  id: TileId;
  sectionId: string;
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "tile", sectionId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 1 : undefined,
  };

  const chrome =
    "flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition";

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1">
        <button
          type="button"
          aria-label={`Reorder ${title}`}
          className={`${chrome} cursor-grab hover:text-[var(--foreground)] active:cursor-grabbing`}
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="3" r="1.2" />
            <circle cx="11" cy="3" r="1.2" />
            <circle cx="5" cy="8" r="1.2" />
            <circle cx="11" cy="8" r="1.2" />
            <circle cx="5" cy="13" r="1.2" />
            <circle cx="11" cy="13" r="1.2" />
          </svg>
        </button>
        <button
          type="button"
          aria-label={`Remove ${title}`}
          onClick={onRemove}
          className={`${chrome} hover:border-[var(--danger)] hover:text-[var(--danger)]`}
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}
