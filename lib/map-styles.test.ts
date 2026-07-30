/// <reference types="vitest/globals" />
import {
  DEFAULT_STYLE,
  MAP_STYLES,
  MAP_STYLE_ORDER,
  MAP_STYLE_STORAGE_KEY,
  availableStyles,
  loadMapStylePreference,
  pickStyle,
  saveMapStylePreference,
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

  // Dark theme is a design-system Fixed Point, and `imagery` is the ONE
  // deliberate carve-out from it. Any style that is neither is a light
  // cartographic basemap sneaking in without that decision being made.
  it("registers only dark or imagery canvases", () => {
    for (const def of Object.values(MAP_STYLES)) {
      expect(["dark", "imagery"]).toContain(def.canvas);
    }
  });

  it("carves out imagery for the satellite styles only", () => {
    const imagery = Object.values(MAP_STYLES)
      .filter((s) => s.canvas === "imagery")
      .map((s) => s.id)
      .sort();
    expect(imagery).toEqual(["satellite", "satellite-trails"]);
  });
});

describe("imagery styles", () => {
  it("resolves both satellite views from the same key as the rest", () => {
    // No second provider and no second account: MapTiler serves imagery from
    // the key already configured for the topographic basemap.
    expect(styleUrl("satellite", WITH_KEY)).toBe(
      "https://api.maptiler.com/maps/satellite/style.json?key=test-key",
    );
    // `hybrid` IS `satellite` with its 16 vector layers flipped visible —
    // paths and labels included — so "Satellite + Trails" needs no composition.
    expect(styleUrl("satellite-trails", WITH_KEY)).toBe(
      "https://api.maptiler.com/maps/hybrid/style.json?key=test-key",
    );
  });

  // Imagery already carries its own shading: the sun was out when the photo was
  // taken. A hillshade over it reads as mud rather than as terrain.
  it("installs no hillshade over imagery", () => {
    expect(MAP_STYLES.satellite.supportsHillshade).toBe(false);
    expect(MAP_STYLES["satellite-trails"].supportsHillshade).toBe(false);
  });

  it("keeps the two satellite views adjacent in the switcher", () => {
    const i = MAP_STYLE_ORDER.indexOf("satellite");
    expect(MAP_STYLE_ORDER[i + 1]).toBe("satellite-trails");
  });

  it("drops both from the switcher when no key is configured", () => {
    expect(styleUrl("satellite", NO_KEY)).toBeNull();
    expect(styleUrl("satellite-trails", NO_KEY)).toBeNull();
    expect(availableStyles(NO_KEY).map((s) => s.id)).toEqual(["standard"]);
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

describe("style preference persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("round-trips a chosen style", () => {
    saveMapStylePreference("satellite");
    expect(window.localStorage.getItem(MAP_STYLE_STORAGE_KEY)).toBe("satellite");
    expect(loadMapStylePreference()).toBe("satellite");
  });

  it("reads null when nothing has been chosen", () => {
    expect(loadMapStylePreference()).toBeNull();
  });

  // A stored id can go stale when the registry changes, or be hand-edited. It
  // must never be handed on as if it were a real style.
  it("rejects a stored id the registry no longer knows", () => {
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, "terrain-3d");
    expect(loadMapStylePreference()).toBeNull();
  });

  it("rejects an inherited Object property masquerading as a style id", () => {
    // `"constructor" in MAP_STYLES` is true; `Object.hasOwn` is the reason this
    // does not resolve to a style that was never registered.
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, "constructor");
    expect(loadMapStylePreference()).toBeNull();
  });

  // Safari private browsing THROWS on localStorage access rather than returning
  // null. A preference must never be the reason a map fails to open.
  it("survives storage that throws on read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied");
    });
    expect(loadMapStylePreference()).toBeNull();
  });

  it("survives storage that throws on write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota");
    });
    expect(() => saveMapStylePreference("topo")).not.toThrow();
  });

  it("feeds pickStyle, outranking the discipline default", () => {
    saveMapStylePreference("satellite");
    // A run would default to standard; the explicit choice wins.
    expect(pickStyle(loadMapStylePreference(), "run", WITH_KEY)).toBe("satellite");
  });

  it("falls back when the remembered style is no longer resolvable", () => {
    saveMapStylePreference("satellite");
    // Key removed since the choice was made — must not strand the user.
    expect(pickStyle(loadMapStylePreference(), "hike", NO_KEY)).toBe("standard");
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
