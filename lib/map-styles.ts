/**
 * The basemap style registry.
 *
 * Replaces the single hardcoded style URL the route map shipped with. Adding a
 * sixth style is adding ONE record entry: nothing in `MapView`, the switcher,
 * or the overlay installer enumerates styles. The switcher maps over
 * `availableStyles()`, and per-style behaviour is driven by declared fields
 * (`supportsHillshade`, `canvas`) rather than by an `if (id === …)` at each
 * consumer — so a new style declares its own needs instead of being
 * special-cased in three places.
 *
 * `resolve()` returning null is the fallback contract: a style whose key is
 * unconfigured is filtered out of the switcher rather than rendering a broken
 * tile grid. With no MapTiler key at all the map degrades to exactly the
 * OpenFreeMap dark basemap it shipped with — which is why local dev and CI need
 * no key. (sows/outdoor-hiking-maps.md § The style registry, Risk R5.)
 */

export type MapStyleId = "standard" | "topo" | "satellite" | "satellite-trails" | "dark";

/**
 * What the style renders under our chrome. Drives stroke weight and control
 * contrast without any consumer branching on a style id — a new style declares
 * what it needs and every consumer already handles it.
 *
 * `imagery` is the one place the design system's dark-theme Fixed Point does
 * not apply: a photograph has no theme. That is a scoped, deliberate carve-out
 * for the basemap pixels only — chrome, route, and controls stay on system
 * tokens over it.
 */
export type MapCanvas = "dark" | "imagery";

export type MapKeys = {
  maptiler: string | null;
};

export type MapStyleDef = {
  id: MapStyleId;
  label: string;
  /** Short line under the label in the switcher — what this style is FOR. */
  hint: string;
  /** The style URL, or null when its key is unconfigured. */
  resolve: (keys: MapKeys) => string | null;
  requiresKey: "maptiler" | null;
  /**
   * Whether to install our own Mapterhorn hillshade over this basemap (and
   * strip any the basemap ships). False on styles that are deliberately
   * unchanged from what the map looked like before this work.
   */
  supportsHillshade: boolean;
  canvas: MapCanvas;
};

const maptiler =
  (styleId: string) =>
  ({ maptiler: key }: MapKeys): string | null =>
    key ? `https://api.maptiler.com/maps/${styleId}/style.json?key=${key}` : null;

/**
 * Every style here is dark. That is not a coincidence to be tidied away later —
 * dark theme is a design-system Fixed Point, so a basemap that cannot be dark
 * is disqualified rather than accommodated. MapTiler ships first-party dark
 * variants of its outdoor and dataviz styles (`outdoor-v2-dark`,
 * `dataviz-dark`), which is why no runtime re-tone transform exists in this
 * module: the provider does it, correctly, upstream.
 *
 * The one planned exception is the satellite style in Phase 3 — photographic
 * imagery has no theme. That is a scoped carve-out recorded in the design
 * system, not a precedent.
 */
export const MAP_STYLES: Record<MapStyleId, MapStyleDef> = {
  // Keyless, and byte-for-byte the basemap the route map shipped with. It is
  // therefore both a real choice (street context: trailheads, parking, the
  // road you drove in on) AND the guaranteed fallback — the reason a missing
  // or failing key can never leave the user with no map.
  standard: {
    id: "standard",
    label: "Standard",
    hint: "Streets and trailhead context",
    resolve: () => "https://tiles.openfreemap.org/styles/dark",
    requiresKey: null,
    // Left exactly as it was. Degradation is to today's product, unchanged.
    supportsHillshade: false,
    canvas: "dark",
  },

  // The reason this SOW exists. 114 layers including six contour layers
  // (lines from z10, labels from z12) and peak labels from z9 — so most of the
  // Terrain Visualization goal is satisfied by choosing this style rather than
  // by building anything. Its own metered hillshade is stripped in favour of
  // ours over free Mapterhorn tiles; see lib/map-overlays.ts.
  topo: {
    id: "topo",
    label: "Topographic",
    hint: "Contours, hillshade, and named peaks",
    resolve: maptiler("outdoor-v2-dark"),
    requiresKey: "maptiler",
    supportsHillshade: true,
    canvas: "dark",
  },

  // Photographic ground truth: what the terrain actually looks like. Every
  // vector layer in this style ships `visibility: none`, so it is imagery and
  // nothing else — the counterpart to Topographic's abstraction.
  satellite: {
    id: "satellite",
    label: "Satellite",
    hint: "Aerial imagery, nothing else",
    resolve: maptiler("satellite"),
    requiresKey: "maptiler",
    // Imagery carries its own shading — the sun was out when the photo was
    // taken. A hillshade over it reads as mud rather than as terrain.
    supportsHillshade: false,
    canvas: "imagery",
  },

  // The same imagery with MapTiler's vector overlay switched on: OSM paths and
  // tracks, roads, and place labels over the photograph.
  //
  // NOT a composed style. The SOW planned to fetch the outdoor style JSON and
  // splice the satellite raster into it, because no provider was thought to
  // ship this pairing — but MapTiler's `hybrid` IS `satellite` with its 16
  // vector layers flipped to visible, `Path` and `Path minor` among them. The
  // composition work was unnecessary.
  "satellite-trails": {
    id: "satellite-trails",
    label: "Satellite + Trails",
    hint: "Imagery with trails and labels",
    resolve: maptiler("hybrid"),
    requiresKey: "maptiler",
    supportsHillshade: false,
    canvas: "imagery",
  },

  // Minimal cartography (42 layers, no contours, few labels) with our hillshade
  // over it: terrain shape and the route, and almost nothing else. The view for
  // reading the line itself rather than the ground it crosses.
  dark: {
    id: "dark",
    label: "Dark",
    hint: "Quiet basemap, route forward",
    resolve: maptiler("dataviz-dark"),
    requiresKey: "maptiler",
    supportsHillshade: true,
    canvas: "dark",
  },
};

/**
 * Switcher order — terrain first, since that is what a hiker opens the map for,
 * then the two imagery views together, then the quiet one. Grouping the
 * satellite pair adjacently matters: they are one idea at two levels of
 * annotation, and a user toggling between them should not cross an unrelated
 * style to do it.
 */
export const MAP_STYLE_ORDER: MapStyleId[] = [
  "topo",
  "standard",
  "satellite",
  "satellite-trails",
  "dark",
];

/**
 * The default basemap per discipline.
 *
 * Runs default to Standard because most runs are on streets, where a
 * topographic canvas is worse rather than better. Trail runs are exactly the
 * case where it would be better, but nothing in the data distinguishes a trail
 * run from a road run today — so the user's own choice covers it, and this
 * becomes a one-line change if a trail signal ever lands. (SOW Open Question 6.)
 */
export const DEFAULT_STYLE: Record<"run" | "hike", MapStyleId> = {
  run: "standard",
  hike: "topo",
};

export function styleUrl(id: MapStyleId, keys: MapKeys): string | null {
  return MAP_STYLES[id].resolve(keys);
}

/** The styles the switcher may offer — those whose keys are configured. */
export function availableStyles(keys: MapKeys): MapStyleDef[] {
  return MAP_STYLE_ORDER.map((id) => MAP_STYLES[id]).filter((s) => s.resolve(keys) !== null);
}

/**
 * Resolve the style to actually mount: the caller's preference if it is
 * available, else the discipline default, else the first available style.
 *
 * The final fallback is total rather than nullable because `standard` needs no
 * key — there is always at least one resolvable style, and the map is never
 * left without one.
 */
export function pickStyle(
  preferred: MapStyleId | null,
  discipline: "run" | "hike",
  keys: MapKeys,
): MapStyleId {
  const available = availableStyles(keys);
  const has = (id: MapStyleId) => available.some((s) => s.id === id);

  if (preferred && has(preferred)) return preferred;
  if (has(DEFAULT_STYLE[discipline])) return DEFAULT_STYLE[discipline];
  return available[0]?.id ?? "standard";
}
