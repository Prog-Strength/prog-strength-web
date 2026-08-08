/**
 * The dashboard tile catalog — the TypeScript mirror of the Go catalog
 * (internal/dashboard/tiles.go). The Go `Catalog` and this `TILE_CATALOG`
 * must stay identical in id set and order; the API contract test and this
 * file's test both guard that. Order fixes the add-tile tray order.
 */

export type TileId =
  | "running"
  | "running_log"
  | "running_effort"
  | "running_vertical"
  | "walking"
  | "cycling"
  | "hiking"
  | "lifting"
  | "steps"
  | "nutrition"
  | "bodyweight"
  | "blood_pressure"
  | "recovery"
  | "hrv_balance"
  | "morning_vitals"
  | "recovery_trend"
  | "recovery_log"
  | "streak"
  | "quote";

export type TileCatalogEntry = {
  id: TileId;
  title: string;
  /**
   * Deep link into the tile's full page. Optional: a tile with no page
   * behind it (the quote tile) omits it and renders as a non-navigable
   * card. Every data-backed tile sets it.
   */
  href?: string;
  description: string; // one-line tray description
};

export const TILE_CATALOG: readonly TileCatalogEntry[] = [
  {
    id: "running",
    title: "Training Load",
    href: "/activities?view=running",
    description: "Whether you're building or backing off, against your 4-week normal.",
  },
  {
    id: "running_log",
    title: "Runs This Week",
    href: "/activities?view=running",
    description: "Every run this week as a dated row.",
  },
  {
    id: "running_effort",
    title: "Run Effort",
    href: "/activities?view=running",
    description: "How hard your runs were, by average heart rate.",
  },
  {
    id: "running_vertical",
    title: "Vertical Gain",
    href: "/activities?view=running",
    description: "How much climbing was in this week's runs.",
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
    description: "Today's readiness as a sentence, with baseline deltas.",
  },
  {
    id: "hrv_balance",
    title: "HRV Balance",
    href: "/recovery",
    description: "Today's HRV against your own balanced range.",
  },
  {
    id: "morning_vitals",
    title: "Morning Vitals",
    href: "/recovery",
    description: "Score, resting HR, and HRV vs your 30-day averages.",
  },
  {
    id: "recovery_trend",
    title: "Recovery Trend",
    href: "/recovery",
    description: "Which way your HRV is heading this week.",
  },
  {
    id: "recovery_log",
    title: "Recovery Log",
    href: "/recovery",
    description: "Your last few mornings as dated readings.",
  },
  {
    id: "streak",
    title: "Streak",
    href: "/activities",
    description: "Your weekly training streak.",
  },
  {
    id: "quote",
    title: "Daily Quote",
    description: "A line to sit with for the day. Tap to draw another.",
  },
] as const;

export const TILE_IDS: readonly TileId[] = TILE_CATALOG.map((t) => t.id);

const CATALOG_BY_ID: Record<TileId, TileCatalogEntry> = Object.fromEntries(
  TILE_CATALOG.map((t) => [t.id, t]),
) as Record<TileId, TileCatalogEntry>;

export function tileEntry(id: TileId): TileCatalogEntry {
  return CATALOG_BY_ID[id];
}
