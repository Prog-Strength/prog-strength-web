/**
 * TileGrid — the dashboard's tile surface in view and edit modes.
 *
 * View mode renders the enabled tiles in `layout` order inside the same
 * responsive grid the page has always used. Edit mode wraps that grid in
 * dnd-kit's sortable context: each tile gains a labelled drag handle and a
 * remove button, and a completed drag delegates the reorder math to the pure,
 * separately-tested `reorderTiles` (this file never reimplements it).
 *
 * The 8px pointer activation constraint lets a touch drag still scroll the page
 * before it turns into a reorder. Keyboard sorting is wired via the sortable
 * coordinate getter so the grid is operable without a pointer.
 */
"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type TileId, tileEntry } from "@/lib/dashboard-tiles";
import type { DashboardData } from "@/lib/dashboard";
import { reorderTiles } from "./layout-ops";
import { TileCard } from "./tile-renderer";

const GRID = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

export function TileGrid({
  layout,
  data,
  mode,
  onReorder,
  onRemove,
}: {
  layout: TileId[];
  data: DashboardData;
  mode: "view" | "edit";
  onReorder: (next: TileId[]) => void;
  onRemove: (id: TileId) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (mode === "view") {
    return (
      <div className={GRID}>
        {layout.map((id) => (
          <TileCard key={id} id={id} data={data} />
        ))}
      </div>
    );
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (over && active.id !== over.id) {
      onReorder(reorderTiles(layout, active.id as TileId, over.id as TileId));
    }
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={layout} strategy={rectSortingStrategy}>
        <div className={GRID}>
          {layout.map((id) => (
            <SortableTile
              key={id}
              id={id}
              title={tileEntry(id).title}
              onRemove={() => onRemove(id)}
            >
              <TileCard id={id} data={data} />
            </SortableTile>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * SortableTile — the edit-mode wrapper around one tile. Renders a drag handle
 * and a remove button as calm chrome over the card, both with accessible names
 * derived from the tile title.
 */
function SortableTile({
  id,
  title,
  onRemove,
  children,
}: {
  id: TileId;
  title: string;
  onRemove: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
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
