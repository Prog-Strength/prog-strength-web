/**
 * Pure operations over a dashboard layout (an ordered TileId[]). These back the
 * edit-mode drag/add/remove interactions and are unit-tested independently of
 * the drag-and-drop library, per the SOW.
 */
import { TILE_CATALOG, type TileCatalogEntry, type TileId } from "@/lib/dashboard-tiles";

/**
 * Move the tile `fromId` to the position currently held by `toId`, preserving
 * the order of the others. No-op when either id is absent or they're equal.
 */
export function reorderTiles(ids: TileId[], fromId: TileId, toId: TileId): TileId[] {
  const from = ids.indexOf(fromId);
  const to = ids.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return ids.slice();
  const next = ids.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** Append `id` if it isn't already present (no-op if present). */
export function addTile(ids: TileId[], id: TileId): TileId[] {
  if (ids.includes(id)) return ids.slice();
  return [...ids, id];
}

/** Remove `id` (no-op if absent). */
export function removeTile(ids: TileId[], id: TileId): TileId[] {
  return ids.filter((x) => x !== id);
}

/**
 * The catalog entries NOT currently in `ids`, in catalog order — the tiles the
 * add-tile tray offers.
 */
export function availableTiles(ids: TileId[]): TileCatalogEntry[] {
  const enabled = new Set(ids);
  return TILE_CATALOG.filter((t) => !enabled.has(t.id));
}
