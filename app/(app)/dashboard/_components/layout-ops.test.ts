/// <reference types="vitest/globals" />

import { TILE_CATALOG, type TileId } from "@/lib/dashboard-tiles";
import { addTile, availableTiles, removeTile, reorderTiles } from "./layout-ops";

describe("reorderTiles", () => {
  it("moves the first tile to the last position", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    expect(reorderTiles(ids, "running", "steps")).toEqual(["lifting", "steps", "running"]);
  });

  it("moves the last tile to the first position", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    expect(reorderTiles(ids, "steps", "running")).toEqual(["steps", "running", "lifting"]);
  });

  it("moves a middle tile to another middle position", () => {
    const ids: TileId[] = ["running", "lifting", "steps", "nutrition"];
    expect(reorderTiles(ids, "lifting", "nutrition")).toEqual([
      "running",
      "steps",
      "nutrition",
      "lifting",
    ]);
  });

  it("is a no-op (returns an equal copy) when moving to the same position", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    const result = reorderTiles(ids, "lifting", "lifting");
    expect(result).toEqual(ids);
    expect(result).not.toBe(ids);
  });

  it("is a no-op when fromId is absent from the list", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    const result = reorderTiles(ids, "nutrition", "running");
    expect(result).toEqual(ids);
  });

  it("is a no-op when toId is absent from the list", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    const result = reorderTiles(ids, "running", "nutrition");
    expect(result).toEqual(ids);
  });

  it("returns a new array and does not mutate the input", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    const original = ids.slice();
    const result = reorderTiles(ids, "running", "steps");
    expect(ids).toEqual(original);
    expect(result).not.toBe(ids);
  });
});

describe("addTile", () => {
  it("appends the tile when absent", () => {
    const ids: TileId[] = ["running", "lifting"];
    expect(addTile(ids, "steps")).toEqual(["running", "lifting", "steps"]);
  });

  it("is a no-op when the tile is already present", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    expect(addTile(ids, "lifting")).toEqual(ids);
  });

  it("does not mutate the input", () => {
    const ids: TileId[] = ["running", "lifting"];
    const original = ids.slice();
    addTile(ids, "steps");
    expect(ids).toEqual(original);
  });

  it("returns a new array reference", () => {
    const ids: TileId[] = ["running", "lifting"];
    expect(addTile(ids, "steps")).not.toBe(ids);
    expect(addTile(ids, "running")).not.toBe(ids);
  });
});

describe("removeTile", () => {
  it("drops the tile when present", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    expect(removeTile(ids, "lifting")).toEqual(["running", "steps"]);
  });

  it("is a no-op when the tile is absent", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    expect(removeTile(ids, "nutrition")).toEqual(ids);
  });

  it("does not mutate the input", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    const original = ids.slice();
    removeTile(ids, "lifting");
    expect(ids).toEqual(original);
  });

  it("returns a new array reference", () => {
    const ids: TileId[] = ["running", "lifting", "steps"];
    expect(removeTile(ids, "lifting")).not.toBe(ids);
    expect(removeTile(ids, "nutrition")).not.toBe(ids);
  });
});

describe("availableTiles", () => {
  it("returns catalog entries not in the list, in catalog order", () => {
    const ids: TileId[] = ["steps", "running"];
    const result = availableTiles(ids);
    const expectedIds = TILE_CATALOG.filter((t) => t.id !== "steps" && t.id !== "running").map(
      (t) => t.id,
    );
    expect(result.map((t) => t.id)).toEqual(expectedIds);
  });

  it("returns all catalog entries for an empty list", () => {
    const result = availableTiles([]);
    expect(result.map((t) => t.id)).toEqual(TILE_CATALOG.map((t) => t.id));
    expect(result).toHaveLength(18);
  });

  it("returns an empty array when every tile is enabled", () => {
    const allIds = TILE_CATALOG.map((t) => t.id);
    expect(availableTiles(allIds)).toEqual([]);
  });

  it("returns entries with title and description", () => {
    const result = availableTiles(["running"]);
    for (const entry of result) {
      expect(typeof entry.title).toBe("string");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe("string");
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });
});
