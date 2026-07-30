/// <reference types="vitest/globals" />
import {
  DEFAULT_STYLE,
  MAP_STYLES,
  MAP_STYLE_ORDER,
  availableStyles,
  pickStyle,
  styleUrl,
  type MapKeys,
} from "./map-styles";

const WITH_KEY: MapKeys = { maptiler: "test-key" };
const NO_KEY: MapKeys = { maptiler: null };

describe("MAP_STYLES", () => {
  it("lists every registered style in the switcher order exactly once", () => {
    expect([...MAP_STYLE_ORDER].sort()).toEqual(Object.keys(MAP_STYLES).sort());
    expect(new Set(MAP_STYLE_ORDER).size).toBe(MAP_STYLE_ORDER.length);
  });

  it("keys each entry by its own id", () => {
    for (const [id, def] of Object.entries(MAP_STYLES)) expect(def.id).toBe(id);
  });

  // Dark theme is a design-system Fixed Point. Phase 1 ships no imagery, so
  // every canvas must still be dark — this guards against a light basemap being
  // added without the deliberate carve-out the satellite styles will carry.
  it("registers only dark canvases in this phase", () => {
    for (const def of Object.values(MAP_STYLES)) expect(def.canvas).toBe("dark");
  });
});

describe("resolve / availableStyles", () => {
  it("resolves every style when the MapTiler key is configured", () => {
    expect(availableStyles(WITH_KEY).map((s) => s.id)).toEqual(MAP_STYLE_ORDER);
  });

  // The fallback contract: no key must degrade to the keyless basemap the map
  // already shipped with, never to a broken tile grid or a thrown error.
  it("offers only the keyless style when no key is configured", () => {
    expect(availableStyles(NO_KEY).map((s) => s.id)).toEqual(["standard"]);
    expect(styleUrl("topo", NO_KEY)).toBeNull();
    expect(styleUrl("dark", NO_KEY)).toBeNull();
  });

  it("never requires a key for the fallback style", () => {
    expect(MAP_STYLES.standard.requiresKey).toBeNull();
    expect(styleUrl("standard", NO_KEY)).toBe("https://tiles.openfreemap.org/styles/dark");
  });

  it("builds MapTiler URLs against the dark style variants", () => {
    // First-party dark variants are why this module carries no re-tone
    // transform. If these ids ever stop being dark, the Fixed Point breaks
    // silently — so the ids are asserted, not just the URL shape.
    expect(styleUrl("topo", WITH_KEY)).toBe(
      "https://api.maptiler.com/maps/outdoor-v2-dark/style.json?key=test-key",
    );
    expect(styleUrl("dark", WITH_KEY)).toBe(
      "https://api.maptiler.com/maps/dataviz-dark/style.json?key=test-key",
    );
  });

  it("installs our hillshade on the keyed styles but leaves the fallback untouched", () => {
    expect(MAP_STYLES.topo.supportsHillshade).toBe(true);
    expect(MAP_STYLES.dark.supportsHillshade).toBe(true);
    // Standard is byte-for-byte the pre-existing map; adding terrain to it
    // would change today's product rather than degrade cleanly to it.
    expect(MAP_STYLES.standard.supportsHillshade).toBe(false);
  });
});

describe("pickStyle", () => {
  it("honours an available preference over the discipline default", () => {
    expect(pickStyle("dark", "hike", WITH_KEY)).toBe("dark");
    expect(pickStyle("topo", "run", WITH_KEY)).toBe("topo");
  });

  it("defaults hikes to topographic and runs to standard", () => {
    expect(pickStyle(null, "hike", WITH_KEY)).toBe("topo");
    expect(pickStyle(null, "run", WITH_KEY)).toBe("standard");
    expect(DEFAULT_STYLE.hike).toBe("topo");
  });

  // A persisted preference for a style whose key was later removed must not
  // strand the user on an unresolvable basemap.
  it("falls back when the preferred style is no longer available", () => {
    expect(pickStyle("topo", "hike", NO_KEY)).toBe("standard");
  });

  it("falls back when the discipline default is unavailable", () => {
    // Hikes default to topo, which needs a key; with none, standard wins.
    expect(pickStyle(null, "hike", NO_KEY)).toBe("standard");
  });

  it("always returns a style that resolves", () => {
    for (const keys of [WITH_KEY, NO_KEY]) {
      for (const discipline of ["run", "hike"] as const) {
        expect(styleUrl(pickStyle(null, discipline, keys), keys)).not.toBeNull();
      }
    }
  });
});
