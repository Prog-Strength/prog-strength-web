/**
 * Pure operations over a dashboard layout (an ordered `DashboardSection[]`,
 * each section owning its ordered tiles). These back the edit-mode
 * drag/add/remove/regroup interactions and the view-mode collapse toggle, and
 * are unit-tested independently of the drag-and-drop library.
 *
 * Every op returns a NEW array and never mutates its input, so React state
 * updates stay referentially honest. Ops are total: an id that isn't in the
 * layout makes the op a no-op rather than an error, because a drag can always
 * resolve against a target that a concurrent render just removed.
 *
 * The invariant these ops preserve, and which the API also enforces: a tile id
 * appears at most once across the WHOLE layout, not merely within a section.
 */
import type { DashboardSection } from "@/lib/api";
import { TILE_CATALOG, type TileCatalogEntry, type TileId } from "@/lib/dashboard-tiles";

/** Caps mirrored from the API (internal/dashboard/layout.go). */
export const MAX_SECTIONS = 12;
export const MAX_SECTION_TITLE_LEN = 40;

/**
 * A fresh section id. Ids only have to be unique within one layout, so a
 * counter seeded off the existing ids is enough — no crypto, no collisions
 * with an id the server assigned during normalization.
 */
export function newSectionId(sections: DashboardSection[]): string {
  const taken = new Set(sections.map((s) => s.id));
  let n = sections.length + 1;
  while (taken.has(`s${n}`)) n += 1;
  return `s${n}`;
}

/** Append an empty section. No-op at MAX_SECTIONS. */
export function createSection(sections: DashboardSection[], title = ""): DashboardSection[] {
  if (sections.length >= MAX_SECTIONS) return sections.slice();
  return [
    ...sections,
    {
      id: newSectionId(sections),
      title: title.slice(0, MAX_SECTION_TITLE_LEN),
      collapsed: false,
      tile_ids: [],
    },
  ];
}

/** Retitle a section. The title is capped, not rejected, so typing never hard-stops mid-word. */
export function renameSection(
  sections: DashboardSection[],
  id: string,
  title: string,
): DashboardSection[] {
  return sections.map((s) =>
    s.id === id ? { ...s, title: title.slice(0, MAX_SECTION_TITLE_LEN) } : s,
  );
}

/**
 * Remove a section AND the tiles inside it. The tiles are not rehomed — this
 * is the destructive delete the page guards behind a confirm. Deleting the
 * last remaining section instead clears it back to an untitled empty one, so
 * the layout is never sectionless.
 */
export function deleteSection(sections: DashboardSection[], id: string): DashboardSection[] {
  const next = sections.filter((s) => s.id !== id);
  if (next.length === 0) {
    return [{ id: newSectionId([]), title: "", collapsed: false, tile_ids: [] }];
  }
  return next;
}

/**
 * Move the section `fromId` to the position currently held by `toId`,
 * preserving the order of the others. No-op when either id is absent or they're
 * equal.
 */
export function moveSection(
  sections: DashboardSection[],
  fromId: string,
  toId: string,
): DashboardSection[] {
  const from = sections.findIndex((s) => s.id === fromId);
  const to = sections.findIndex((s) => s.id === toId);
  if (from === -1 || to === -1 || from === to) return sections.slice();
  const next = sections.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Flip a section's collapsed flag. */
export function toggleCollapsed(sections: DashboardSection[], id: string): DashboardSection[] {
  return sections.map((s) => (s.id === id ? { ...s, collapsed: !s.collapsed } : s));
}

/**
 * Move `tileId` into `toSectionId` at `toIndex`, removing it from wherever it
 * was. This covers BOTH a within-section reorder and a cross-section move —
 * one function, because the drag layer often cannot tell which one a drop is
 * until it has resolved the target container.
 *
 * `toIndex` is clamped, and is interpreted against the target section AFTER
 * the tile has been pulled out of its old home, so dragging a tile rightward
 * within its own section lands where the pointer is rather than one short.
 *
 * No-op when the tile or the target section is absent.
 */
export function moveTile(
  sections: DashboardSection[],
  tileId: TileId,
  toSectionId: string,
  toIndex: number,
): DashboardSection[] {
  if (!sections.some((s) => s.tile_ids.includes(tileId))) return sections.slice();
  if (!sections.some((s) => s.id === toSectionId)) return sections.slice();

  const stripped = sections.map((s) =>
    s.tile_ids.includes(tileId) ? { ...s, tile_ids: s.tile_ids.filter((t) => t !== tileId) } : s,
  );
  return stripped.map((s) => {
    if (s.id !== toSectionId) return s;
    const at = Math.max(0, Math.min(toIndex, s.tile_ids.length));
    const tiles = s.tile_ids.slice();
    tiles.splice(at, 0, tileId);
    return { ...s, tile_ids: tiles };
  });
}

/**
 * Append `tileId` to `sectionId`. No-op when the tile is already anywhere in
 * the layout (global uniqueness) or the section is absent.
 */
export function addTile(
  sections: DashboardSection[],
  tileId: TileId,
  sectionId: string,
): DashboardSection[] {
  if (sections.some((s) => s.tile_ids.includes(tileId))) return sections.slice();
  if (!sections.some((s) => s.id === sectionId)) return sections.slice();
  return sections.map((s) =>
    s.id === sectionId ? { ...s, tile_ids: [...s.tile_ids, tileId] } : s,
  );
}

/** Remove `tileId` from wherever it lives (no-op if absent). */
export function removeTile(sections: DashboardSection[], tileId: TileId): DashboardSection[] {
  return sections.map((s) =>
    s.tile_ids.includes(tileId) ? { ...s, tile_ids: s.tile_ids.filter((t) => t !== tileId) } : s,
  );
}

/** Every enabled tile, flattened in display order across sections. */
export function allTileIds(sections: DashboardSection[]): TileId[] {
  return sections.flatMap((s) => s.tile_ids);
}

/** The section holding `tileId`, or undefined. */
export function sectionOf(
  sections: DashboardSection[],
  tileId: TileId,
): DashboardSection | undefined {
  return sections.find((s) => s.tile_ids.includes(tileId));
}

/**
 * The catalog entries NOT currently anywhere in the layout, in catalog order —
 * the tiles the add-tile tray offers.
 */
export function availableTiles(sections: DashboardSection[]): TileCatalogEntry[] {
  const enabled = new Set(allTileIds(sections));
  return TILE_CATALOG.filter((t) => !enabled.has(t.id));
}
