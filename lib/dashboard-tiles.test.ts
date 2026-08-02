import { describe, expect, test } from "vitest";
import { TILE_CATALOG, tileEntry, type TileId } from "./dashboard-tiles";

describe("dashboard tile catalog", () => {
  test("has exactly 15 tiles", () => {
    expect(TILE_CATALOG.length).toBe(15);
  });

  test("ids are in the Go catalog order", () => {
    expect(TILE_CATALOG.map((t) => t.id)).toEqual([
      "running",
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
      "recovery_trend",
      "recovery_log",
      "streak",
    ]);
  });

  test("every entry has non-empty title, href, and description", () => {
    for (const entry of TILE_CATALOG) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.href.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  test("tileEntry resolves the hiking deep link", () => {
    expect(tileEntry("hiking").href).toBe("/hiking");
  });

  // Exhaustiveness: this Record MUST list every TileId. Adding a TileId to the
  // union without adding it here is a compile error — the guard the SOW requires.
  const ALL_TILE_IDS: Record<TileId, true> = {
    running: true,
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
    recovery_trend: true,
    recovery_log: true,
    streak: true,
  };

  test("every TileId is in the catalog", () => {
    const catalogIds = new Set(TILE_CATALOG.map((t) => t.id));
    for (const id of Object.keys(ALL_TILE_IDS) as TileId[]) {
      expect(catalogIds.has(id)).toBe(true);
    }
    expect(TILE_CATALOG.length).toBe(Object.keys(ALL_TILE_IDS).length);
  });

  test("the five recovery-family tiles have distinct titles and descriptions", () => {
    const family = ["recovery", "hrv_balance", "morning_vitals", "recovery_trend", "recovery_log"];
    const titles = new Set(family.map((id) => tileEntry(id as TileId).title));
    const descriptions = new Set(family.map((id) => tileEntry(id as TileId).description));
    expect(titles.size).toBe(5);
    expect(descriptions.size).toBe(5);
    for (const id of family) {
      expect(tileEntry(id as TileId).href).toBe("/recovery");
    }
    // The rewritten recovery entry no longer describes the retired card.
    expect(tileEntry("recovery").description).not.toContain("resting HR");
  });
});
