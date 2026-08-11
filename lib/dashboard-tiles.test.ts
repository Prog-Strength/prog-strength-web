import { describe, expect, test } from "vitest";
import { resolveTileId, TILE_CATALOG, tileEntry, type TileId } from "./dashboard-tiles";

describe("dashboard tile catalog", () => {
  test("has exactly 19 tiles", () => {
    expect(TILE_CATALOG.length).toBe(19);
  });

  test("ids are in the Go catalog order", () => {
    expect(TILE_CATALOG.map((t) => t.id)).toEqual([
      "running",
      "running_log",
      "running_effort",
      "running_vertical",
      "walking",
      "cycling",
      "hiking",
      "lifting",
      "steps",
      "nutrition",
      "bodyweight",
      "blood_pressure",
      "recovery",
      "hrv_balance",
      "morning_vitals",
      "recovery_log",
      "streak",
      "quote",
      "weather",
    ]);
  });

  test("every entry has a non-empty title and description", () => {
    for (const entry of TILE_CATALOG) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  // `href` is optional only for tiles with no page behind them. TileCard casts
  // away the undefined for every other id, so this pins exactly which ids are
  // allowed to omit it — without this the cast could silently start lying.
  const PAGELESS_TILE_IDS: readonly TileId[] = ["quote", "weather"];

  test("every tile has a non-empty href except the pageless ones", () => {
    for (const entry of TILE_CATALOG) {
      if (PAGELESS_TILE_IDS.includes(entry.id)) {
        expect(entry.href).toBeUndefined();
        continue;
      }
      expect(entry.href && entry.href.length).toBeGreaterThan(0);
    }
  });

  test("tileEntry resolves the hiking deep link", () => {
    expect(tileEntry("hiking").href).toBe("/hiking");
  });

  // Exhaustiveness: this Record MUST list every TileId. Adding a TileId to the
  // union without adding it here is a compile error — the guard the SOW requires.
  const ALL_TILE_IDS: Record<TileId, true> = {
    running: true,
    running_log: true,
    running_effort: true,
    running_vertical: true,
    walking: true,
    cycling: true,
    hiking: true,
    lifting: true,
    steps: true,
    nutrition: true,
    bodyweight: true,
    blood_pressure: true,
    recovery: true,
    hrv_balance: true,
    morning_vitals: true,
    recovery_log: true,
    streak: true,
    quote: true,
    weather: true,
  };

  test("every TileId is in the catalog", () => {
    const catalogIds = new Set(TILE_CATALOG.map((t) => t.id));
    for (const id of Object.keys(ALL_TILE_IDS) as TileId[]) {
      expect(catalogIds.has(id)).toBe(true);
    }
    expect(TILE_CATALOG.length).toBe(Object.keys(ALL_TILE_IDS).length);
  });

  test("the four recovery-family tiles have distinct titles and descriptions", () => {
    const family = ["recovery", "hrv_balance", "morning_vitals", "recovery_log"];
    const titles = new Set(family.map((id) => tileEntry(id as TileId).title));
    const descriptions = new Set(family.map((id) => tileEntry(id as TileId).description));
    expect(titles.size).toBe(4);
    expect(descriptions.size).toBe(4);
    for (const id of family) {
      expect(tileEntry(id as TileId).href).toBe("/recovery");
    }
    // The rewritten recovery entry no longer describes the retired card.
    expect(tileEntry("recovery").description).not.toContain("resting HR");
  });

  test("the retired recovery_trend tile resolves to the tile that absorbed it", () => {
    // It is not in the catalog (so the tray never offers it) but a layout
    // written before the merge still names it, and that layout must keep a tile.
    expect(TILE_CATALOG.some((t) => t.id === ("recovery_trend" as TileId))).toBe(false);
    expect(resolveTileId("recovery_trend")).toBe("hrv_balance");
    expect(resolveTileId("hrv_balance")).toBe("hrv_balance");
    expect(resolveTileId("no_such_tile")).toBeNull();
  });

  test("the running entry was rewritten for the ramp card", () => {
    expect(tileEntry("running").title).toBe("Training Load");
    expect(tileEntry("running").href).toBe("/activities?view=running");
    expect(tileEntry("running_log").title).toBe("Runs This Week");
    expect(tileEntry("running_effort").title).toBe("Run Effort");
    expect(tileEntry("running_vertical").title).toBe("Vertical Gain");
    // The whole family deep-links into the running view.
    for (const id of ["running_log", "running_effort", "running_vertical"] as const) {
      expect(tileEntry(id).href).toBe("/activities?view=running");
    }
  });
});
