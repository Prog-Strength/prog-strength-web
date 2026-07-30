/**
 * The overlay stack that rides on top of whichever basemap is active.
 *
 * WHY THIS IS A MODULE AND NOT A `useEffect` BODY: `map.setStyle()` replaces
 * the entire style document and **destroys every source, layer, and image the
 * application added**. A style switcher that adds the route once at load
 * therefore loses it the first time the user changes basemap. So overlays are
 * declared here and *installed* — idempotently — on every `styledata` event,
 * which fires for both the initial load and each subsequent `setStyle`. One
 * subscription, one installation site, one place for this bug to not live.
 * (sows/outdoor-hiking-maps.md § Overlay architecture, Risk R2.)
 *
 * Everything here is expressed against `OverlayMap`, a structural subset of
 * MapLibre's `Map`. That is deliberate: it keeps the module unit-testable
 * against a fake that models MapLibre's real semantics (duplicate-id throws,
 * setStyle wipes) without a WebGL context.
 *
 * Adding an overlay later — a weather raster, a public-land boundary — is
 * appending to `routeLayers()` / the source block below. No lifecycle code
 * changes. That is the extensibility this SOW is buying.
 */

import type { RouteFeature } from "@/lib/api";

export type OverlayMap = {
  getStyle(): { layers?: { id: string; type: string }[] } | undefined;
  getSource(id: string): unknown | undefined;
  addSource(id: string, spec: unknown): void;
  removeSource(id: string): void;
  getLayer(id: string): unknown | undefined;
  addLayer(spec: { id: string; type?: string }, beforeId?: string): void;
  removeLayer(id: string): void;
  hasImage(id: string): boolean;
  addImage(id: string, image: { width: number; height: number; data: Uint8Array }): void;
  removeImage(id: string): void;
};

export type OverlaySpec = {
  route: RouteFeature;
  /** Concrete colour — the discipline hue, resolved from its token at mount.
   *  MapLibre paint expressions do not read CSS custom properties. */
  strokeColor: string;
  casingColor: string;
  /** Install our own DEM + hillshade pair. See `installOverlays` for why this
   *  is ours rather than the basemap's on styles that ship one. */
  hillshade: boolean;
};

export const OVERLAY_SOURCE_IDS = {
  route: "ps-route",
  endpoints: "ps-route-endpoints",
  dem: "ps-terrain-dem",
} as const;

/** Bottom-to-top. Insertion order IS z-order (see `installOverlays`). */
export const OVERLAY_LAYER_IDS = [
  "ps-hillshade",
  "ps-route-casing",
  "ps-route-line",
  "ps-route-arrows",
  "ps-route-endpoints",
] as const;

export const ARROW_IMAGE_ID = "ps-route-arrow";

/**
 * Mapterhorn — free, global, open (BSD-3), maintained as MapLibre's default
 * terrain source and distributed as static PMTiles. Chosen over MapTiler's own
 * terrain-rgb because hillshade tiles are requested at roughly the same rate as
 * basemap tiles: sourcing them here keeps them entirely off the metered plan.
 * The AWS open-data terrarium set is a drop-in fallback — same encoding, so it
 * is a URL swap and nothing else.
 */
export const DEM_TILEJSON = "https://tiles.mapterhorn.com/tilejson.json";

/**
 * ⚠️ LOAD-BEARING. MapLibre's `raster-dem` default is `"mapbox"`; Mapterhorn
 * and the AWS set are **terrarium**-encoded. Declaring the wrong one does not
 * error — it renders a plausible-looking but numerically wrong hillshade. This
 * is a named risk in the SOW (R3) and is asserted in test.
 */
export const DEM_ENCODING = "terrarium";

/**
 * Mapterhorn serves 512px tiles — confirmed against the live TileJSON, which
 * reports `"tileSize": 512`. MapLibre's `raster-dem` default is 256, and the
 * mismatch is another silent one: the hillshade renders, at the wrong scale,
 * with slopes shifted by a factor of two. Declared explicitly for the same
 * reason `encoding` is.
 */
export const DEM_TILE_SIZE = 512;

// Attribution is deliberately NOT set here: the source is declared by `url`, so
// MapLibre reads the TileJSON's own `attribution` ("© Mapterhorn") into the
// attribution control. Setting it again would render it twice.

/** Fallback when the caller hands us an unresolved CSS custom property. */
const STROKE_FALLBACK = "#c9a690";

type Rgb = { r: number; g: number; b: number };

/** Parse `#rgb` / `#rrggbb`. Returns null on anything else — including the
 *  empty string `getComputedStyle` yields for an unresolved custom property. */
export function parseHex(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

/**
 * A right-pointing triangle as a raw RGBA bitmap, tinted to the route hue.
 *
 * Deliberately NOT a text glyph: a `symbol` layer drawn with `text-field` needs
 * a `text-font` that exists in the active style's glyph source, and the font
 * stacks differ between OpenFreeMap and MapTiler — a mismatch makes the layer
 * fail to render with no useful error. A generated bitmap depends on nothing in
 * the style, so direction arrows survive every basemap.
 *
 * Non-SDF (so no `icon-color`): the hue is baked in here, which is free because
 * `installOverlays` re-adds the image on every style change anyway.
 */
export function arrowIconRGBA(
  color: string,
  size = 16,
): {
  width: number;
  height: number;
  data: Uint8Array;
} {
  const { r, g, b } = parseHex(color) ?? parseHex(STROKE_FALLBACK)!;
  const data = new Uint8Array(size * size * 4);

  // Triangle inset from the edges so the glyph has breathing room on the line.
  const x0 = size * 0.25;
  const x1 = size * 0.8;
  const yTop = size * 0.2;
  const yBot = size * 0.8;
  const yMid = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Inside the triangle (x0,yTop)-(x0,yBot)-(x1,yMid): left of the apex,
      // right of the base, and within the linearly-narrowing vertical span.
      const t = (x - x0) / (x1 - x0);
      const inside =
        x >= x0 && x <= x1 && y >= yTop + (yMid - yTop) * t && y <= yBot - (yBot - yMid) * t;
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = inside ? 255 : 0;
    }
  }
  return { width: size, height: size, data };
}

export type EndpointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { role: "start" | "finish" };
};

/**
 * Start and finish markers derived from the route geometry.
 *
 * The route is a gap-split `MultiLineString` (sows/sow-trail-map.md), so the
 * finish is the last coordinate of the LAST segment — not of the first. Getting
 * that wrong plants the finish marker mid-hike on any route with a GPS dropout.
 */
export function routeEndpoints(route: RouteFeature): {
  type: "FeatureCollection";
  features: EndpointFeature[];
} {
  const lines = route.geometry.coordinates.filter((l) => l.length > 0);
  if (lines.length === 0) return { type: "FeatureCollection", features: [] };

  const first = lines[0][0] as [number, number];
  const lastLine = lines[lines.length - 1];
  const last = lastLine[lastLine.length - 1] as [number, number];

  const point = (coordinates: [number, number], role: "start" | "finish"): EndpointFeature => ({
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties: { role },
  });
  return { type: "FeatureCollection", features: [point(first, "start"), point(last, "finish")] };
}

/**
 * The id of the style's first symbol layer — the anchor every overlay inserts
 * before, so labels (place names, peak names, contour elevations) stay legible
 * ON TOP of the route while the route stays on top of terrain and trails.
 *
 * `undefined` when the style has no symbol layer, in which case overlays append
 * to the top, which is the correct degenerate behaviour.
 */
export function firstSymbolLayerId(map: OverlayMap): string | undefined {
  return map.getStyle()?.layers?.find((l) => l.type === "symbol")?.id;
}

const OVERLAY_LAYER_SET: ReadonlySet<string> = new Set(OVERLAY_LAYER_IDS);

/** Tear down anything a previous install left behind. Existence-guarded, so it
 *  is safe on a freshly-wiped style where none of it is present. */
function removeOverlays(map: OverlayMap): void {
  for (const id of [...OVERLAY_LAYER_IDS].reverse()) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of Object.values(OVERLAY_SOURCE_IDS)) {
    if (map.getSource(id)) map.removeSource(id);
  }
  if (map.hasImage(ARROW_IMAGE_ID)) map.removeImage(ARROW_IMAGE_ID);
}

/**
 * Drop any hillshade the basemap ships with, so ours is the only one.
 *
 * MapTiler's outdoor styles include a `hillshade` layer over their own metered
 * `terrain-rgb` source. Leaving it in place would (a) double the metered
 * request count this SOW's provider choice exists to avoid, and (b) stack two
 * shadings into mud. Matched on layer TYPE rather than on MapTiler's layer id,
 * so a rename upstream cannot silently reintroduce the cost.
 */
function removeBasemapHillshade(map: OverlayMap): void {
  const foreign = (map.getStyle()?.layers ?? []).filter(
    (l) => l.type === "hillshade" && !OVERLAY_LAYER_SET.has(l.id),
  );
  for (const l of foreign) {
    if (map.getLayer(l.id)) map.removeLayer(l.id);
  }
}

export function installOverlays(map: OverlayMap, spec: OverlaySpec): void {
  removeOverlays(map);
  if (spec.hillshade) removeBasemapHillshade(map);

  // Resolved AFTER the teardown above so the anchor reflects the live style.
  const beforeId = firstSymbolLayerId(map);
  const add = (layer: { id: string; type?: string }) => map.addLayer(layer, beforeId);

  map.addSource(OVERLAY_SOURCE_IDS.route, { type: "geojson", data: spec.route });
  map.addSource(OVERLAY_SOURCE_IDS.endpoints, {
    type: "geojson",
    data: routeEndpoints(spec.route),
  });
  map.addImage(ARROW_IMAGE_ID, arrowIconRGBA(spec.strokeColor));

  // Bottom-to-top. Every insert shares one `beforeId`, so each new layer lands
  // directly beneath the anchor and therefore ABOVE its predecessor — insertion
  // order is z-order, and the array below reads bottom-up.
  if (spec.hillshade) {
    map.addSource(OVERLAY_SOURCE_IDS.dem, {
      type: "raster-dem",
      url: DEM_TILEJSON,
      encoding: DEM_ENCODING,
      tileSize: DEM_TILE_SIZE,
    });
    add({
      id: "ps-hillshade",
      type: "hillshade",
      source: OVERLAY_SOURCE_IDS.dem,
      paint: {
        // Tuned to the near-black ramp rather than to a provider default: a
        // light-map hillshade washes the app's surfaces out.
        "hillshade-shadow-color": "#05070a",
        "hillshade-highlight-color": "#5c6068",
        "hillshade-accent-color": "#1b1e24",
        // Strongest where terrain reads as terrain, easing off as the user
        // zooms into trail detail so contours stay the finer signal.
        "hillshade-exaggeration": {
          stops: [
            [6, 0.45],
            [12, 0.38],
            [16, 0.25],
          ],
        },
      },
    } as { id: string; type: string });
  }

  add({
    id: "ps-route-casing",
    type: "line",
    source: OVERLAY_SOURCE_IDS.route,
    layout: { "line-cap": "round", "line-join": "round" },
    // The legibility workhorse. On the near-black Dark style a bare stroke was
    // enough; over a pale topographic canvas or aerial imagery it disappears
    // without this dark under-stroke.
    paint: { "line-color": spec.casingColor, "line-width": 7 },
  } as { id: string; type: string });

  add({
    id: "ps-route-line",
    type: "line",
    source: OVERLAY_SOURCE_IDS.route,
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": spec.strokeColor, "line-width": 3 },
  } as { id: string; type: string });

  add({
    id: "ps-route-arrows",
    type: "symbol",
    source: OVERLAY_SOURCE_IDS.route,
    layout: {
      "symbol-placement": "line",
      // Thins out as you zoom in so a switchback doesn't fill with arrows.
      "symbol-spacing": 90,
      "icon-image": ARROW_IMAGE_ID,
      "icon-size": 0.75,
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": false,
      "icon-ignore-placement": false,
    },
  } as { id: string; type: string });

  add({
    id: "ps-route-endpoints",
    type: "circle",
    source: OVERLAY_SOURCE_IDS.endpoints,
    paint: {
      "circle-radius": 5,
      // Hollow start, filled finish — readable without a legend and without a
      // second sprite.
      "circle-color": [
        "case",
        ["==", ["get", "role"], "finish"],
        spec.strokeColor,
        spec.casingColor,
      ],
      "circle-stroke-width": 2,
      "circle-stroke-color": spec.strokeColor,
    },
  } as { id: string; type: string });
}
