import { describe, expect, it } from "vitest";
import type { DashboardSection } from "@/lib/api";
import { TILE_CATALOG } from "@/lib/dashboard-tiles";
import {
  MAX_SECTIONS,
  MAX_SECTION_TITLE_LEN,
  addTile,
  allTileIds,
  availableTiles,
  createSection,
  deleteSection,
  moveSection,
  moveTile,
  newSectionId,
  removeTile,
  renameSection,
  sectionOf,
  toggleCollapsed,
} from "./layout-ops";

/** Terse section builder — the ops only ever read id/title/collapsed/tile_ids. */
function sec(
  id: string,
  tiles: DashboardSection["tile_ids"],
  extra: Partial<DashboardSection> = {},
): DashboardSection {
  return { id, title: "", collapsed: false, tile_ids: tiles, ...extra };
}

/** Two sections: a=[running, steps], b=[lifting]. */
function base(): DashboardSection[] {
  return [sec("a", ["running", "steps"]), sec("b", ["lifting"])];
}

/** Flatten to a comparable shape so assertions read as data, not object graphs. */
function shape(sections: DashboardSection[]) {
  return sections.map((s) => [s.id, s.tile_ids] as const);
}

describe("newSectionId", () => {
  it("avoids ids already in the layout", () => {
    const taken = [sec("s1", []), sec("s2", []), sec("s3", [])];
    expect(taken.map((s) => s.id)).not.toContain(newSectionId(taken));
  });
});

describe("createSection", () => {
  it("appends an empty section with a unique id", () => {
    const next = createSection(base());
    expect(next).toHaveLength(3);
    expect(next[2].tile_ids).toEqual([]);
    expect(next[2].title).toBe("");
    expect(new Set(next.map((s) => s.id)).size).toBe(3);
  });

  it("caps the title", () => {
    const next = createSection([], "x".repeat(MAX_SECTION_TITLE_LEN + 10));
    expect(next[0].title).toHaveLength(MAX_SECTION_TITLE_LEN);
  });

  it("is a no-op at the section cap", () => {
    const full = Array.from({ length: MAX_SECTIONS }, (_, i) => sec(`s${i}`, []));
    expect(createSection(full)).toHaveLength(MAX_SECTIONS);
  });

  it("does not mutate its input", () => {
    const input = base();
    createSection(input);
    expect(input).toHaveLength(2);
  });
});

describe("renameSection", () => {
  it("retitles only the named section", () => {
    const next = renameSection(base(), "b", "Strength");
    expect(next[0].title).toBe("");
    expect(next[1].title).toBe("Strength");
  });

  it("caps rather than rejects an overlong title", () => {
    const next = renameSection(base(), "a", "y".repeat(MAX_SECTION_TITLE_LEN + 5));
    expect(next[0].title).toHaveLength(MAX_SECTION_TITLE_LEN);
  });

  it("is a no-op for an unknown id", () => {
    expect(shape(renameSection(base(), "nope", "X"))).toEqual(shape(base()));
  });
});

describe("deleteSection", () => {
  it("removes the section AND its tiles", () => {
    const next = deleteSection(base(), "a");
    expect(shape(next)).toEqual([["b", ["lifting"]]]);
    expect(allTileIds(next)).not.toContain("running");
  });

  it("clears the last section back to an untitled empty one rather than emptying the layout", () => {
    const next = deleteSection([sec("a", ["running"], { title: "Only" })], "a");
    expect(next).toHaveLength(1);
    expect(next[0].title).toBe("");
    expect(next[0].tile_ids).toEqual([]);
  });

  it("is a no-op for an unknown id", () => {
    expect(shape(deleteSection(base(), "nope"))).toEqual(shape(base()));
  });
});

describe("moveSection", () => {
  it("moves a section to the target's position", () => {
    expect(shape(moveSection(base(), "b", "a"))).toEqual([
      ["b", ["lifting"]],
      ["a", ["running", "steps"]],
    ]);
  });

  it("is a no-op when the ids are equal or either is absent", () => {
    expect(shape(moveSection(base(), "a", "a"))).toEqual(shape(base()));
    expect(shape(moveSection(base(), "a", "nope"))).toEqual(shape(base()));
    expect(shape(moveSection(base(), "nope", "a"))).toEqual(shape(base()));
  });
});

describe("toggleCollapsed", () => {
  it("flips only the named section", () => {
    const next = toggleCollapsed(base(), "b");
    expect(next[0].collapsed).toBe(false);
    expect(next[1].collapsed).toBe(true);
    expect(toggleCollapsed(next, "b")[1].collapsed).toBe(false);
  });
});

describe("moveTile", () => {
  it("moves a tile into another section at an index", () => {
    expect(shape(moveTile(base(), "running", "b", 0))).toEqual([
      ["a", ["steps"]],
      ["b", ["running", "lifting"]],
    ]);
  });

  it("moves a tile into an empty section", () => {
    const withEmpty = [...base(), sec("c", [])];
    expect(shape(moveTile(withEmpty, "steps", "c", 0))).toEqual([
      ["a", ["running"]],
      ["b", ["lifting"]],
      ["c", ["steps"]],
    ]);
  });

  it("reorders within a section", () => {
    expect(shape(moveTile(base(), "steps", "a", 0))).toEqual([
      ["a", ["steps", "running"]],
      ["b", ["lifting"]],
    ]);
  });

  it("interprets the index after the tile is pulled out of its old home", () => {
    // a=[running, steps, nutrition]; dragging running to index 2 must land it
    // LAST, not second — the index is against the section post-removal.
    const three = [sec("a", ["running", "steps", "nutrition"])];
    expect(shape(moveTile(three, "running", "a", 2))).toEqual([
      ["a", ["steps", "nutrition", "running"]],
    ]);
  });

  it("clamps an out-of-range index instead of leaving a hole", () => {
    expect(shape(moveTile(base(), "lifting", "a", 99))).toEqual([
      ["a", ["running", "steps", "lifting"]],
      ["b", []],
    ]);
    expect(shape(moveTile(base(), "lifting", "a", -5))).toEqual([
      ["a", ["lifting", "running", "steps"]],
      ["b", []],
    ]);
  });

  it("never leaves the tile in two sections", () => {
    const next = moveTile(base(), "running", "b", 0);
    expect(allTileIds(next).filter((t) => t === "running")).toHaveLength(1);
  });

  it("is a no-op when the tile or the target section is absent", () => {
    expect(shape(moveTile(base(), "hiking", "a", 0))).toEqual(shape(base()));
    expect(shape(moveTile(base(), "running", "nope", 0))).toEqual(shape(base()));
  });

  it("does not mutate its input", () => {
    const input = base();
    moveTile(input, "running", "b", 0);
    expect(shape(input)).toEqual(shape(base()));
  });
});

describe("addTile", () => {
  it("appends to the named section", () => {
    expect(shape(addTile(base(), "hiking", "b"))).toEqual([
      ["a", ["running", "steps"]],
      ["b", ["lifting", "hiking"]],
    ]);
  });

  it("is a no-op when the tile is already elsewhere in the layout", () => {
    expect(shape(addTile(base(), "running", "b"))).toEqual(shape(base()));
  });

  it("is a no-op for an unknown section", () => {
    expect(shape(addTile(base(), "hiking", "nope"))).toEqual(shape(base()));
  });
});

describe("removeTile", () => {
  it("removes the tile from whichever section holds it", () => {
    expect(shape(removeTile(base(), "steps"))).toEqual([
      ["a", ["running"]],
      ["b", ["lifting"]],
    ]);
  });

  it("is a no-op for a tile that isn't in the layout", () => {
    expect(shape(removeTile(base(), "hiking"))).toEqual(shape(base()));
  });
});

describe("allTileIds / sectionOf", () => {
  it("flattens in display order across sections", () => {
    expect(allTileIds(base())).toEqual(["running", "steps", "lifting"]);
  });

  it("finds the holding section, or undefined", () => {
    expect(sectionOf(base(), "lifting")?.id).toBe("b");
    expect(sectionOf(base(), "hiking")).toBeUndefined();
  });
});

describe("availableTiles", () => {
  it("offers every catalog tile not already somewhere in the layout", () => {
    const offered = availableTiles(base()).map((t) => t.id);
    expect(offered).not.toContain("running");
    expect(offered).not.toContain("lifting");
    expect(offered).toContain("hiking");
    expect(offered).toHaveLength(TILE_CATALOG.length - 3);
  });

  it("preserves catalog order", () => {
    const offered = availableTiles([]).map((t) => t.id);
    expect(offered).toEqual(TILE_CATALOG.map((t) => t.id));
  });

  it("dedupes across sections, not just within one", () => {
    // The same tile split across sections cannot happen via the ops, but a
    // hand-edited/legacy payload must still not double-offer.
    const offered = availableTiles([sec("a", ["running"]), sec("b", ["steps"])]).map((t) => t.id);
    expect(offered).not.toContain("running");
    expect(offered).not.toContain("steps");
  });
});
