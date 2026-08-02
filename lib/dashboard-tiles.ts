/**
 * The dashboard tile catalog — the TypeScript mirror of the Go catalog
 * (internal/dashboard/tiles.go). The Go `Catalog` and this `TILE_CATALOG`
 * must stay identical in id set and order; the API contract test and this
 * file's test both guard that. Order fixes the add-tile tray order.
 */

export type TileId =
  | "running"
  | "walking"
  | "cycling"
  | "hiking"
  | "lifting"
  | "steps"
  | "nutrition"
  | "bodyweight"
  | "blood_pressure"
  | "recovery"
  | "streak";

export type TileCatalogEntry = {
  id: TileId;
  title: string;
  href: string; // deep link into the tile's full page
  description: string; // one-line tray description
};

export const TILE_CATALOG: readonly TileCatalogEntry[] = [
  {
    id: "running",
    title: "Running",
    href: "/activities?view=running",
    description: "Weekly running distance and pace.",
  },
  {
    id: "walking",
    title: "Walking",
    href: "/activities",
    description: "Weekly walking distance and time.",
  },
  {
    id: "cycling",
    title: "Cycling",
    href: "/activities",
    description: "Weekly cycling distance and time.",
  },
  {
    id: "hiking",
    title: "Hiking",
    href: "/hiking",
    description: "Weekly hiking distance and elevation.",
  },
  {
    id: "lifting",
    title: "Lifting",
    href: "/workouts",
    description: "This week's lifting volume and PRs.",
  },
  {
    id: "steps",
    title: "Steps",
    href: "/activities?view=steps",
    description: "Daily steps against your goal.",
  },
  {
    id: "nutrition",
    title: "Nutrition",
    href: "/nutrition",
    description: "Today's calories and macros.",
  },
  {
    id: "bodyweight",
    title: "Bodyweight",
    href: "/bodyweight",
    description: "Bodyweight trend and goal.",
  },
  {
    id: "blood_pressure",
    title: "Blood Pressure",
    href: "/blood-pressure",
    description: "Latest reading and trend against the healthy range.",
  },
  {
    id: "recovery",
    title: "Recovery",
    href: "/recovery",
    description: "Whoop recovery and resting HR.",
  },
  {
    id: "streak",
    title: "Streak",
    href: "/activities",
    description: "Your weekly training streak.",
  },
] as const;

export const TILE_IDS: readonly TileId[] = TILE_CATALOG.map((t) => t.id);

const CATALOG_BY_ID: Record<TileId, TileCatalogEntry> = Object.fromEntries(
  TILE_CATALOG.map((t) => [t.id, t]),
) as Record<TileId, TileCatalogEntry>;

export function tileEntry(id: TileId): TileCatalogEntry {
  return CATALOG_BY_ID[id];
}
