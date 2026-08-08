/**
 * SectionList — the dashboard's sectioned tile surface in view and edit modes.
 *
 * This is the one place that owns drag state. It mounts a single DndContext
 * over TWO sortable axes, told apart by the `type` each sortable puts in its
 * drag data:
 *
 *   - "section" — the sections themselves, sorted vertically by their headers.
 *   - "tile"    — the tiles inside one section, sorted in a grid, and
 *                 draggable ACROSS sections.
 *
 * All layout math delegates to the pure, separately-tested ops in layout-ops
 * (`moveSection`, `moveTile`); this file never reimplements a move. Its whole
 * job is turning a drag event into "which tile, into which section, at which
 * index" and handing that over.
 *
 * A cross-section move is applied in onDragOver rather than onDragEnd, which
 * is dnd-kit's multi-container pattern: the tile visibly lands in the new
 * section as you drag over it, and onDragEnd is then only responsible for the
 * final index within whatever section the tile now sits in.
 *
 * The 8px pointer activation constraint lets a touch drag still scroll the
 * page before it turns into a reorder. Keyboard sorting is wired via the
 * sortable coordinate getter so the grid is operable without a pointer.
 */
"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { DashboardSection } from "@/lib/api";
import type { DashboardData } from "@/lib/dashboard";
import type { TileId } from "@/lib/dashboard-tiles";
import { moveSection, moveTile } from "./layout-ops";
import { SectionHeader } from "./section-header";
import { TileGrid } from "./tile-grid";

/**
 * Collision detection, per axis.
 *
 * Dragging a SECTION only ever targets another section, so the candidates are
 * filtered to sections and resolved by closest-center — a whole section is a
 * big rect, and pointer-within would keep matching the one under the cursor.
 *
 * Dragging a TILE targets tiles and section drop zones; the section sortables
 * are filtered out so a big section rect can't outrank the tile the pointer is
 * actually over. Pointer-within is the primary (it is the most precise when
 * the pointer is inside something) with rect-intersection as the fallback for
 * when the pointer has left every droppable mid-drag.
 */
const collisionDetection: CollisionDetection = (args) => {
  const type = args.active.data.current?.type;
  if (type === "section") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === "section",
      ),
    });
  }
  const containers = args.droppableContainers.filter((c) => c.data.current?.type !== "section");
  const pointer = pointerWithin({ ...args, droppableContainers: containers });
  if (pointer.length > 0) return pointer;
  return rectIntersection({ ...args, droppableContainers: containers });
};

export function SectionList({
  sections,
  data,
  mode,
  onChange,
  onRenameSection,
  onDeleteSection,
  onAddTileTo,
  onToggleCollapsed,
  onRemoveTile,
}: {
  sections: DashboardSection[];
  data: DashboardData;
  mode: "view" | "edit";
  /** A drag resolved to a new layout. */
  onChange: (next: DashboardSection[]) => void;
  onRenameSection: (id: string, title: string) => void;
  onDeleteSection: (id: string) => void;
  onAddTileTo: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onRemoveTile: (id: TileId) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const body = sections.map((section, index) => (
    <SectionBlock
      key={section.id}
      section={section}
      index={index}
      data={data}
      mode={mode}
      onRename={(title) => onRenameSection(section.id, title)}
      onDelete={() => onDeleteSection(section.id)}
      onAddTile={() => onAddTileTo(section.id)}
      onToggleCollapsed={() => onToggleCollapsed(section.id)}
      onRemoveTile={onRemoveTile}
    />
  ));

  if (mode === "view") {
    return <div className="flex flex-col gap-6">{body}</div>;
  }

  /**
   * Resolve what the pointer is over into a target section and an insertion
   * index within it. Returns null when the drop target is not a tile surface.
   */
  function resolveTarget(overId: string, overData: Record<string, unknown> | undefined) {
    if (overData?.type === "section-drop") {
      const sectionId = overData.sectionId as string;
      const target = sections.find((s) => s.id === sectionId);
      return target ? { sectionId, index: target.tile_ids.length } : null;
    }
    if (overData?.type === "tile") {
      const sectionId = overData.sectionId as string;
      const target = sections.find((s) => s.id === sectionId);
      if (!target) return null;
      return { sectionId, index: Math.max(0, target.tile_ids.indexOf(overId as TileId)) };
    }
    return null;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over || active.data.current?.type !== "tile") return;
    const from = active.data.current.sectionId as string;
    const target = resolveTarget(String(over.id), over.data.current);
    // Within-section movement is left to onDragEnd; only the cross-section
    // hand-off needs to happen live, so the tile follows the pointer into its
    // new home instead of snapping there on release.
    if (!target || target.sectionId === from) return;
    onChange(moveTile(sections, active.id as TileId, target.sectionId, target.index));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;

    if (active.data.current?.type === "section") {
      if (active.id !== over.id) {
        onChange(moveSection(sections, String(active.id), String(over.id)));
      }
      return;
    }

    if (active.data.current?.type === "tile") {
      const target = resolveTarget(String(over.id), over.data.current);
      if (!target) return;
      onChange(moveTile(sections, active.id as TileId, target.sectionId, target.index));
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-6">{body}</div>
      </SortableContext>
    </DndContext>
  );
}

/**
 * SectionBlock — one section's header plus its grid. In edit mode it is itself
 * sortable (dragged by the handle in its header) and always shows its tiles;
 * collapsing is a view-mode affordance, and a section you cannot see into is
 * one you cannot drag tiles out of.
 */
function SectionBlock({
  section,
  index,
  data,
  mode,
  onRename,
  onDelete,
  onAddTile,
  onToggleCollapsed,
  onRemoveTile,
}: {
  section: DashboardSection;
  index: number;
  data: DashboardData;
  mode: "view" | "edit";
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddTile: () => void;
  onToggleCollapsed: () => void;
  onRemoveTile: (id: TileId) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
    data: { type: "section" },
    disabled: mode === "view",
  });

  // An empty section in VIEW mode is noise — a header over nothing. In edit
  // mode it stays, as the drop zone that lets it be filled.
  if (mode === "view" && section.tile_ids.length === 0) return null;

  const style =
    mode === "edit"
      ? {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.6 : undefined,
        }
      : undefined;

  const dragHandle: ReactNode = (
    <button
      type="button"
      aria-label={`Reorder ${section.title || `Untitled section ${index + 1}`}`}
      className="flex h-6 w-6 shrink-0 cursor-grab items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition hover:text-[var(--foreground)] active:cursor-grabbing"
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
  );

  return (
    <section
      ref={mode === "edit" ? setNodeRef : undefined}
      style={style}
      className="flex flex-col gap-3"
    >
      <SectionHeader
        title={section.title}
        index={index}
        collapsed={section.collapsed}
        tileCount={section.tile_ids.length}
        mode={mode}
        onToggleCollapsed={onToggleCollapsed}
        onRename={onRename}
        onDelete={onDelete}
        onAddTile={onAddTile}
        dragHandle={mode === "edit" ? dragHandle : undefined}
      />
      {(mode === "edit" || !section.collapsed) && (
        <TileGrid
          sectionId={section.id}
          tileIds={section.tile_ids}
          data={data}
          mode={mode}
          onRemove={onRemoveTile}
        />
      )}
    </section>
  );
}
