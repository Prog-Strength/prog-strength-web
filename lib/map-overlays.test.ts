/// <reference types="vitest/globals" />
import type { RouteFeature } from "@/lib/api";
import {
  ARROW_IMAGE_ID,
  DEM_ENCODING,
  DEM_TILEJSON,
  DEM_TILE_SIZE,
  EMPTY_FC,
  OVERLAY_LAYER_IDS,
  OVERLAY_SOURCE_IDS,
  arrowIconRGBA,
  installOverlays,
  mileMarkersGeoJSON,
  routeEndpoints,
  scrubGeoJSON,
  travelledGeoJSON,
  updateScrub,
  type OverlayMap,
  type OverlaySpec,
  type StyleLayerSpec,
} from "./map-overlays";

/**
 * A fake that models the MapLibre semantics this module depends on — and, more
 * importantly, the ones that BITE:
 *
 *  - `addLayer`/`addSource`/`addImage` THROW on a duplicate id, exactly as
 *    MapLibre does. A non-idempotent installer therefore fails loudly here
 *    instead of silently working in jsdom and breaking in a browser.
 *  - `setStyle()` wipes every source, layer, and image the caller added. This
 *    is the whole reason `installOverlays` exists (SOW Risk R2); modelling it
 *    is what makes the reinstall test real rather than decorative.
 */
class FakeMap implements OverlayMap {
  sources = new Map<string, unknown>();
  /** Layers the *basemap style* brought — removable, like the real thing. */
  basemap: StyleLayerSpec[];
  /** Layers WE installed. Kept separate purely so assertions can talk about
   *  our overlays without filtering the basemap's 114 layers out by hand. */
  layers: { id: string; spec: { id: string; type?: string }; beforeId?: string }[] = [];
  images = new Set<string>();

  constructor(basemap: StyleLayerSpec[]) {
    this.basemap = [...basemap];
  }

  getStyle() {
    return {
      layers: [
        ...this.basemap,
        ...this.layers.map((l) => ({ id: l.id, type: l.spec.type ?? "line" })),
      ],
    };
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  /** Records every setData push, so tests can assert the cheap update path. */
  setData = vi.fn();
  addSource(id: string, spec: unknown) {
    if (this.sources.has(id)) throw new Error(`source ${id} already exists`);
    // GeoJSON sources are drivable after installation, as in MapLibre.
    const isGeoJSON = (spec as { type?: string } | null)?.type === "geojson";
    const stored = isGeoJSON
      ? { ...(spec as object), setData: (data: unknown) => this.setData(id, data) }
      : spec;
    this.sources.set(id, stored);
  }
  removeSource(id: string) {
    if (!this.sources.has(id)) throw new Error(`no source ${id}`);
    this.sources.delete(id);
  }
  getLayer(id: string) {
    return this.layers.find((l) => l.id === id) ?? this.basemap.find((l) => l.id === id);
  }
  addLayer(spec: { id: string; type?: string }, beforeId?: string) {
    if (this.getLayer(spec.id)) throw new Error(`layer ${spec.id} already exists`);
    this.layers.push({ id: spec.id, spec, beforeId });
  }
  removeLayer(id: string) {
    const i = this.layers.findIndex((l) => l.id === id);
    if (i >= 0) return void this.layers.splice(i, 1);
    const j = this.basemap.findIndex((l) => l.id === id);
    if (j >= 0) return void this.basemap.splice(j, 1);
    throw new Error(`no layer ${id}`);
  }
  paint: { layerId: string; name: string; value: unknown }[] = [];
  setPaintProperty(layerId: string, name: string, value: unknown) {
    if (!this.getLayer(layerId)) throw new Error(`no layer ${layerId}`);
    this.paint.push({ layerId, name, value });
  }
  hasImage(id: string) {
    return this.images.has(id);
  }
  addImage(id: string) {
    if (this.images.has(id)) throw new Error(`image ${id} already exists`);
    this.images.add(id);
  }
  removeImage(id: string) {
    this.images.delete(id);
  }

  /** What `map.setStyle()` does to application-added state: all of it, gone. */
  setStyle(nextBasemap: StyleLayerSpec[]) {
    this.basemap = [...nextBasemap];
    this.sources.clear();
    this.layers = [];
    this.images.clear();
  }

  layerIds() {
    return this.layers.map((l) => l.id);
  }
  basemapIds() {
    return this.basemap.map((l) => l.id);
  }
  /** Our installed layer record, including the `beforeId` it anchored to.
   *  `getLayer` returns a basemap-or-overlay union and can't carry that. */
  installed(id: string) {
    return this.layers.find((l) => l.id === id);
  }
}

const BASEMAP_LAYERS = [
  { id: "background", type: "background" },
  { id: "landcover", type: "fill" },
  { id: "water", type: "fill" },
  { id: "road-minor", type: "line" },
  // Carries a text-font, which is what the mile labels borrow so they resolve
  // against whichever provider's glyph endpoint is in play.
  { id: "place-label", type: "symbol", layout: { "text-font": ["Noto Sans Regular"] } },
  { id: "poi-label", type: "symbol" },
];

function route(): RouteFeature {
  return {
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [-106.0, 39.39],
          [-106.001, 39.395],
        ],
        [
          [-106.002, 39.4],
          [-106.003, 39.405],
        ],
      ],
    },
    properties: {
      bounds: { min_lat: 39.39, min_lng: -106.003, max_lat: 39.405, max_lng: -106.0 },
    },
  };
}

function spec(overrides: Partial<OverlaySpec> = {}): OverlaySpec {
  return {
    route: route(),
    strokeColor: "#c9a690",
    casingColor: "rgba(8, 9, 11, 0.85)",
    mutedColor: "#565a63",
    hillshade: true,
    ...overrides,
  };
}

describe("installOverlays", () => {
  it("installs the route source and every overlay layer", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());

    expect(map.getSource(OVERLAY_SOURCE_IDS.route)).toBeTruthy();
    expect(map.getSource(OVERLAY_SOURCE_IDS.endpoints)).toBeTruthy();
    for (const id of OVERLAY_LAYER_IDS) {
      expect(map.getLayer(id), `expected layer ${id}`).toBeTruthy();
    }
  });

  // THE regression test this SOW's Risk R2 names. `setStyle()` destroys every
  // application-added source, layer, and image; if the installer isn't re-run
  // and isn't idempotent, the user changes basemap and the route vanishes.
  it("re-installs every overlay after a style change, with no duplicates", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());
    const before = map.layerIds();

    // The user picks a different basemap. MapLibre wipes our work.
    map.setStyle([
      { id: "bg", type: "background" },
      { id: "contour", type: "line" },
      { id: "contour-label", type: "symbol", layout: { "text-font": ["Open Sans Regular"] } },
    ]);
    expect(map.layerIds()).toEqual([]);
    expect(map.getSource(OVERLAY_SOURCE_IDS.route)).toBeUndefined();

    // What the `styledata` handler does.
    installOverlays(map, spec());

    expect(map.layerIds()).toEqual(before);
    expect(map.getSource(OVERLAY_SOURCE_IDS.route)).toBeTruthy();
    // Anchored to the NEW style's first symbol layer, not the old one's.
    expect(map.installed("ps-route-line")?.beforeId).toBe("contour-label");
  });

  // Belt and braces: a double-install on a live style (two `styledata` events
  // for one style load is normal MapLibre behaviour) must not throw on the
  // duplicate-id guard or leave two copies of a layer.
  it("is idempotent when called twice against a live style", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());
    expect(() => installOverlays(map, spec())).not.toThrow();

    expect(map.layerIds()).toEqual(OVERLAY_LAYER_IDS.filter((id) => map.getLayer(id)));
    expect(new Set(map.layerIds()).size).toBe(map.layerIds().length);
  });

  it("declares terrarium encoding on the DEM source", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec({ hillshade: true }));

    const dem = map.getSource(OVERLAY_SOURCE_IDS.dem) as {
      type: string;
      url: string;
      encoding: string;
    };
    expect(dem.type).toBe("raster-dem");
    expect(dem.url).toBe(DEM_TILEJSON);
    // Mapterhorn and the AWS open-data set are BOTH terrarium-encoded, while
    // MapLibre's raster-dem default is "mapbox". Getting this wrong renders a
    // plausible-looking but numerically wrong hillshade — it does not error.
    // SOW Risk R3.
    expect(dem.encoding).toBe(DEM_ENCODING);
    expect(DEM_ENCODING).toBe("terrarium");
  });

  it("declares the DEM tile size Mapterhorn actually serves", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec({ hillshade: true }));

    // Mapterhorn's TileJSON reports "tileSize": 512; MapLibre's raster-dem
    // default is 256. The mismatch renders a hillshade at the wrong scale
    // rather than erroring — the same class of silent failure as `encoding`.
    const dem = map.getSource(OVERLAY_SOURCE_IDS.dem) as { tileSize: number };
    expect(dem.tileSize).toBe(DEM_TILE_SIZE);
    expect(DEM_TILE_SIZE).toBe(512);
  });

  it("leaves DEM attribution to the TileJSON rather than duplicating it", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec({ hillshade: true }));

    // The source is declared by `url`, so MapLibre pulls "© Mapterhorn" from
    // the TileJSON itself. Setting it here too would render it twice.
    const dem = map.getSource(OVERLAY_SOURCE_IDS.dem) as { attribution?: string };
    expect(dem.attribution).toBeUndefined();
  });

  it("omits the DEM and hillshade layer when the style bakes its own shading", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec({ hillshade: false }));

    expect(map.getSource(OVERLAY_SOURCE_IDS.dem)).toBeUndefined();
    expect(map.getLayer("ps-hillshade")).toBeUndefined();
    // The route still installs — hillshade is independent of it.
    expect(map.getLayer("ps-route-line")).toBeTruthy();
  });

  it("orders overlays bottom-to-top under the first symbol layer", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());

    // Every overlay anchors before the basemap's first symbol layer, so labels
    // stay on top of the route and the route stays on top of terrain.
    for (const l of map.layers) {
      expect(l.beforeId, `layer ${l.id}`).toBe("place-label");
    }
    // Insertion order IS z-order when every insert shares one anchor: each new
    // layer lands directly beneath the anchor, hence above its predecessor.
    expect(map.layerIds()).toEqual([
      "ps-hillshade",
      "ps-route-casing",
      "ps-route-line",
      "ps-route-travelled",
      "ps-route-arrows",
      "ps-mile-dots",
      "ps-mile-labels",
      "ps-route-endpoints",
      // The cursor is topmost: it must never be occluded by the route it
      // sits on.
      "ps-scrub-marker",
    ]);
  });

  it("appends on top when the style has no symbol layer to anchor to", () => {
    const map = new FakeMap([{ id: "background", type: "background" }]);
    installOverlays(map, spec());

    for (const l of map.layers) expect(l.beforeId).toBeUndefined();
    expect(map.getLayer("ps-route-line")).toBeTruthy();
  });

  // MapTiler's outdoor styles ship a hillshade over their own METERED
  // terrain-rgb source. Leaving it stacks two shadings into mud and doubles the
  // billed request count that choosing Mapterhorn exists to avoid.
  it("drops the basemap's own hillshade so ours is the only one", () => {
    const map = new FakeMap([
      { id: "background", type: "background" },
      { id: "Hillshade", type: "hillshade" },
      { id: "Contour line", type: "line" },
      { id: "Contour labels", type: "symbol" },
    ]);
    installOverlays(map, spec({ hillshade: true }));

    expect(map.basemapIds()).not.toContain("Hillshade");
    expect(map.getLayer("ps-hillshade")).toBeTruthy();
    expect(map.getSource(OVERLAY_SOURCE_IDS.dem)).toBeTruthy();
  });

  // Matched on layer TYPE, not on MapTiler's layer id — a rename upstream must
  // not silently reintroduce the metered source.
  it("drops a renamed basemap hillshade too", () => {
    const map = new FakeMap([
      { id: "background", type: "background" },
      { id: "terrain-shading-v3", type: "hillshade" },
      { id: "place-label", type: "symbol" },
    ]);
    installOverlays(map, spec({ hillshade: true }));
    expect(map.basemapIds()).not.toContain("terrain-shading-v3");
  });

  it("leaves the basemap's hillshade alone when we are not installing our own", () => {
    const map = new FakeMap([
      { id: "background", type: "background" },
      { id: "Hillshade", type: "hillshade" },
      { id: "place-label", type: "symbol" },
    ]);
    installOverlays(map, spec({ hillshade: false }));
    expect(map.basemapIds()).toContain("Hillshade");
  });

  // The basemap hillshade comes BACK with the new style document, so the drop
  // has to be part of every install rather than a one-shot at mount.
  it("re-drops the basemap hillshade after a style change", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec({ hillshade: true }));

    map.setStyle([
      { id: "background", type: "background" },
      { id: "Hillshade", type: "hillshade" },
      { id: "Contour labels", type: "symbol" },
    ]);
    expect(map.basemapIds()).toContain("Hillshade");

    installOverlays(map, spec({ hillshade: true }));
    expect(map.basemapIds()).not.toContain("Hillshade");
  });

  // Text needs a `text-font` that resolves against the ACTIVE style's glyph
  // endpoint, and the stacks differ between providers. Borrowing one the style
  // already uses guarantees it resolves; with no text anywhere, the labels are
  // skipped and the dots stand alone rather than a layer failing silently.
  it("borrows a font stack the style already uses for the mile labels", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec({ mileMarkers: [{ coord: [-106, 39.4], label: "1" }] }));

    const labels = map.installed("ps-mile-labels")?.spec as {
      layout?: Record<string, unknown>;
    };
    expect(labels?.layout?.["text-font"]).toEqual(["Noto Sans Regular"]);
  });

  it("skips the mile labels when the style exposes no font stack", () => {
    const map = new FakeMap([
      { id: "background", type: "background" },
      { id: "water", type: "fill" },
    ]);
    installOverlays(map, spec({ mileMarkers: [{ coord: [-106, 39.4], label: "1" }] }));

    expect(map.getLayer("ps-mile-labels")).toBeUndefined();
    // The dots still install — the marks degrade to unlabelled, not absent.
    expect(map.getLayer("ps-mile-dots")).toBeTruthy();
    expect(map.getLayer("ps-route-line")).toBeTruthy();
  });

  it("registers the direction-arrow image so the symbol layer can resolve it", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());
    expect(map.hasImage(ARROW_IMAGE_ID)).toBe(true);
  });
});

describe("updateScrub", () => {
  // Scrubbing must NOT reinstall. Installation tears layers down and rebuilds
  // them, which is right once per style load and visibly wrong at pointer-move
  // rates. This asserts the cheap path is the one taken.
  function scrubbed(coord: [number, number] | null) {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());
    const addsBefore = map.layers.length;
    updateScrub(map, {
      travelled: coord
        ? [
            [
              [-106.0, 39.39],
              [-106.001, 39.395],
            ],
          ]
        : [],
      scrubCoord: coord,
      strokeColor: "#c9a690",
      mutedColor: "#565a63",
    });
    return { map, addsBefore };
  }

  it("pushes data into existing sources without adding or removing layers", () => {
    const { map, addsBefore } = scrubbed([-106.001, 39.395]);
    expect(map.layers.length).toBe(addsBefore);
    expect(map.setData).toHaveBeenCalled();
  });

  it("demotes the base route while a cursor is active", () => {
    const { map } = scrubbed([-106.001, 39.395]);
    const last = map.paint[map.paint.length - 1];
    expect(last).toEqual({ layerId: "ps-route-line", name: "line-color", value: "#565a63" });
  });

  it("restores the full route hue when the cursor clears", () => {
    const { map } = scrubbed(null);
    const last = map.paint[map.paint.length - 1];
    expect(last.value).toBe("#c9a690");
  });

  // A scrub event can land between a style change wiping the layers and
  // styledata reinstalling them. That window must be a no-op, not a throw.
  it("is a no-op against a wiped style", () => {
    const map = new FakeMap(BASEMAP_LAYERS);
    installOverlays(map, spec());
    map.setStyle(BASEMAP_LAYERS);
    expect(() =>
      updateScrub(map, {
        travelled: [],
        scrubCoord: [-106, 39.4],
        strokeColor: "#c9a690",
        mutedColor: "#565a63",
      }),
    ).not.toThrow();
  });
});

describe("scrub geometry builders", () => {
  it("emits an empty collection rather than a degenerate feature when idle", () => {
    expect(travelledGeoJSON([])).toEqual(EMPTY_FC);
    expect(travelledGeoJSON(undefined)).toEqual(EMPTY_FC);
    expect(scrubGeoJSON(null)).toEqual(EMPTY_FC);
  });

  it("drops single-point segments, which would draw nothing", () => {
    expect(travelledGeoJSON([[[-106, 39.4]]])).toEqual(EMPTY_FC);
  });

  it("builds a MultiLineString from the travelled segments", () => {
    const fc = travelledGeoJSON([
      [
        [-106, 39.4],
        [-106.001, 39.401],
      ],
    ]) as { geometry: { type: string; coordinates: unknown[] } };
    expect(fc.geometry.type).toBe("MultiLineString");
    expect(fc.geometry.coordinates).toHaveLength(1);
  });

  it("carries the label on each mile marker feature", () => {
    const fc = mileMarkersGeoJSON([
      { coord: [-106, 39.4], label: "1" },
      { coord: [-106.01, 39.41], label: "2" },
    ]);
    expect(fc.features.map((f) => f.properties.label)).toEqual(["1", "2"]);
  });
});

describe("routeEndpoints", () => {
  it("marks the first coordinate of the first line and the last of the last", () => {
    const fc = routeEndpoints(route());
    expect(fc.features).toHaveLength(2);
    expect(fc.features[0].properties.role).toBe("start");
    expect(fc.features[0].geometry.coordinates).toEqual([-106.0, 39.39]);
    expect(fc.features[1].properties.role).toBe("finish");
    // Last coordinate of the LAST segment — a gap-split route must not report
    // the end of segment one as the finish.
    expect(fc.features[1].geometry.coordinates).toEqual([-106.003, 39.405]);
  });

  it("returns no features for a route with no usable coordinates", () => {
    const empty: RouteFeature = {
      type: "Feature",
      geometry: { type: "MultiLineString", coordinates: [] },
      properties: { bounds: { min_lat: 0, min_lng: 0, max_lat: 0, max_lng: 0 } },
    };
    expect(routeEndpoints(empty).features).toHaveLength(0);
  });
});

describe("arrowIconRGBA", () => {
  it("produces an opaque triangle in the requested colour on a clear field", () => {
    const { width, height, data } = arrowIconRGBA("#c9a690", 16);
    expect(width).toBe(16);
    expect(height).toBe(16);
    expect(data).toHaveLength(16 * 16 * 4);

    // Centre of a right-pointing triangle is inside it.
    const centre = (8 * 16 + 7) * 4;
    expect(data[centre]).toBe(0xc9);
    expect(data[centre + 1]).toBe(0xa6);
    expect(data[centre + 2]).toBe(0x90);
    expect(data[centre + 3]).toBe(255);

    // Top-left corner is outside it, and must be fully transparent rather than
    // an opaque black box behind every arrow.
    expect(data[3]).toBe(0);
  });

  it("falls back to the discipline hue when the colour is not a parseable hex", () => {
    // getComputedStyle returns "" for an unresolved custom property in jsdom,
    // and callers pass it through — the icon must still be visible.
    const { data } = arrowIconRGBA("", 16);
    const centre = (8 * 16 + 7) * 4;
    expect(data[centre + 3]).toBe(255);
  });
});
