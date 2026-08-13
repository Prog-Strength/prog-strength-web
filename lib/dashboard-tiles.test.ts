import { describe, expect, test } from "vitest";
import { resolveTileId, TILE_CATALOG, tileEntry, type TileId } from "./dashboard-tiles";

describe("dashboard tile catalog", () => {
  test("has exactly 22 tiles", () => {
    expect(TILE_CATALOG.length).toBe(22);
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
      "resting_hr",
      "sleep",
      "streak",
      "quote",
      "weather",
      "calendar",
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
  const PAGELESS_TILE_IDS: readonly TileId[] = ["quote", "weather", "calendar"];

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
    resting_hr: true,
    sleep: true,
    streak: true,
    quote: true,
    weather: true,
    calendar: true,
  };

  test("every TileId is in the catalog", () => {
    const catalogIds = new Set(TILE_CATALOG.map((t) => t.id));
    for (const id of Object.keys(ALL_TILE_IDS) as TileId[]) {
      expect(catalogIds.has(id)).toBe(true);
    }
    expect(TILE_CATALOG.length).toBe(Object.keys(ALL_TILE_IDS).length);
  });

  // The five tiles that share the one `recovery` section, in catalog order.
  const RECOVERY_FAMILY: readonly TileId[] = [
    "recovery",
    "hrv_balance",
    "morning_vitals",
    "recovery_log",
    "resting_hr",
  ];

  test("the five recovery-family tiles have distinct titles and descriptions", () => {
    const titles = RECOVERY_FAMILY.map((id) => tileEntry(id).title);
    const descriptions = RECOVERY_FAMILY.map((id) => tileEntry(id).description);
    // Deduped-vs-raw rather than `size === 5`: a duplicate then fails with both
    // lists printed, naming the offending entry instead of "expected 4 to be 5".
    expect([...new Set(titles)]).toEqual(titles);
    expect([...new Set(descriptions)]).toEqual(descriptions);
    for (const id of RECOVERY_FAMILY) {
      expect(tileEntry(id).href).toBe("/recovery");
    }
    // The rewritten recovery entry no longer describes the retired card.
    expect(tileEntry("recovery").description).not.toContain("resting HR");
  });

  // Weaker than the exact-order test above and cannot fail alone — that test
  // pins all 22 ids, so nothing can break this run without breaking that array
  // first. It is kept as documentation of WHY resting_hr sits between
  // recovery_log and sleep: catalog order IS the add-tile tray order, so the
  // family staying contiguous is the whole reason for the position.
  test("the recovery family is a contiguous run ending in resting_hr, before sleep", () => {
    const ids = TILE_CATALOG.map((t) => t.id);
    const at = ids.indexOf("recovery");
    expect(ids.slice(at, at + RECOVERY_FAMILY.length)).toEqual(RECOVERY_FAMILY);
    expect(ids[at + RECOVERY_FAMILY.length]).toBe("sleep");
  });

  test("the resting_hr title is stored in sentence-plus-initialism case", () => {
    // MiniCardTitle uppercases for display, so the catalog never stores a
    // shouted string — the same way every other entry is stored.
    expect(tileEntry("resting_hr").title).toBe("Resting HR");
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
