"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteFeature, RunningTrackpoint } from "@/lib/api";
import { config } from "@/lib/config";
import {
  coordAt,
  nearestTrackpointIndex,
  travelledSegments,
  type MileMarker,
} from "@/lib/elevation-scrub";
import { installOverlays, updateScrub, type OverlayMap } from "@/lib/map-overlays";
import {
  MAP_STYLES,
  availableStyles,
  pickStyle,
  styleUrl,
  type MapKeys,
  type MapStyleId,
} from "@/lib/map-styles";
import { MapStyleSwitcher } from "./MapStyleSwitcher";

const FIT_PADDING = 32;

/** Discipline hue for the route stroke, resolved to a concrete colour at
 *  mount — MapLibre paint expressions do not read CSS custom properties. */
const STROKE_TOKEN: Record<Discipline, string> = {
  run: "--discipline-run-fg",
  hike: "--discipline-hike-fg",
};
const STROKE_FALLBACK: Record<Discipline, string> = {
  run: "#9cc7b8",
  hike: "#c9a690",
};
const CASING_FALLBACK = "rgba(8, 9, 11, 0.85)";
const MUTED_FALLBACK = "#565a63";

/** Layers a pointer must be over for a map hover to move the profile cursor.
 *  The casing is the wide one — a 3px line is not a hit target. */
const ROUTE_HIT_LAYERS = ["ps-route-casing", "ps-route-line", "ps-route-travelled"];

export type Discipline = "run" | "hike";

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

type MapViewProps = {
  route: RouteFeature | undefined;
  /** Drives the route stroke hue and the default basemap. */
  discipline: Discipline;
  /** Accessible name for the map surface. Shared across activity detail pages,
   *  so the caller names the activity — a hike's map must not announce itself
   *  as a run route. */
  label?: string;
  /** The served trackpoints, index-aligned with the elevation strip. Supplying
   *  these turns on the linked-cursor behaviour; omitting them leaves the map
   *  exactly as it was. */
  trackpoints?: RunningTrackpoint[];
  /** Cursor index into `trackpoints`, owned by the page and shared with the
   *  elevation profile. */
  scrubIndex?: number | null;
  /** Map → profile binding. Omit to make the map read-only. */
  onScrub?: (index: number | null) => void;
  /** Whole-unit distance marks, precomputed in the user's active unit. */
  mileMarkers?: MileMarker[];
};

/**
 * The activity route map.
 *
 * Renders the simplified GPS route over a switchable basemap, fitted to the
 * route bounds. Renders nothing when there is no route (indoor / no-GPS
 * activities), so those detail pages are byte-for-byte unchanged.
 *
 * Two lifecycle rules carry the whole feature:
 *
 *  1. **The map is created ONCE.** A style change calls `setStyle()` on the
 *     live instance rather than remounting, which preserves the user's pan and
 *     zoom and — because MapTiler bills per *session*, the binding meter on
 *     every plan — keeps one visit to one session no matter how many styles the
 *     user cycles through (SOW Risk R6).
 *  2. **Overlays reinstall on `styledata`.** `setStyle()` destroys every source,
 *     layer, and image we added, so the route is re-installed on every style
 *     load rather than added once at mount. This is Risk R2, the highest-
 *     probability defect in the SOW; see lib/map-overlays.ts.
 */
export function MapView({
  route,
  discipline,
  label = "Activity route map",
  trackpoints,
  scrubIndex = null,
  onScrub,
  mileMarkers,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Guards re-entrancy: our own `addSource` calls emit `styledata`, so an
  // unguarded handler would recurse into itself on every install.
  const installingRef = useRef(false);

  // Cursor state the mount-time handlers need to read at CURRENT values. The
  // map is created once, so its closures would otherwise capture whatever the
  // props were at mount. Written in an effect, never during render.
  const scrubStateRef = useRef({ trackpoints, scrubIndex, onScrub, mileMarkers });
  useEffect(() => {
    scrubStateRef.current = { trackpoints, scrubIndex, onScrub, mileMarkers };
  });

  const keys: MapKeys = { maptiler: config.maptilerKey };
  const styles = availableStyles(keys);
  const [styleId, setStyleId] = useState<MapStyleId>(() => pickStyle(null, discipline, keys));

  // The `styledata` handler is created once at mount but must install the
  // overlays the CURRENTLY active style needs — whether to add our hillshade
  // depends on the basemap the user just switched to, not the one they landed
  // on. A ref carries that across without re-creating the map. It is written in
  // the style effect below, never during render.
  const styleIdRef = useRef(styleId);
  // The style actually applied to the live map, so the effect below can tell a
  // genuine switch from a re-render and avoid re-setting the mounted style —
  // which would cost a redundant style load and a second billable session.
  const appliedStyleRef = useRef<MapStyleId | null>(null);

  // Mount / teardown. Deliberately does NOT depend on styleId — see rule 1.
  useEffect(() => {
    if (!route || !containerRef.current) return;

    const stroke = cssVar(STROKE_TOKEN[discipline], STROKE_FALLBACK[discipline]);
    const casing = cssVar("--map-route-casing", CASING_FALLBACK);
    const muted = cssVar("--faint", MUTED_FALLBACK);
    const initial = styleUrl(styleId, keys);
    if (!initial) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: initial,
      interactive: true,
    });
    mapRef.current = map;
    appliedStyleRef.current = styleId;

    const install = () => {
      if (installingRef.current) return;
      // addLayer throws against a style that has not finished loading; further
      // styledata events will follow, so skipping early is safe.
      if (!map.isStyleLoaded()) return;
      installingRef.current = true;
      try {
        const st = scrubStateRef.current;
        installOverlays(map as unknown as OverlayMap, {
          route,
          strokeColor: stroke,
          casingColor: casing,
          mutedColor: muted,
          hillshade: MAP_STYLES[styleIdRef.current].supportsHillshade,
          mileMarkers: st.mileMarkers,
          // Seeded from live cursor state so switching basemap mid-scrub
          // restores the cursor rather than dropping it.
          travelled: travelledSegments(st.trackpoints ?? [], st.scrubIndex),
          scrubCoord: coordAt(st.trackpoints ?? [], st.scrubIndex),
        });
      } finally {
        installingRef.current = false;
      }
    };

    map.on("styledata", install);

    // --- map → profile -----------------------------------------------------
    // Hovering the route highlights the matching point on the elevation
    // profile. Scoped by queryRenderedFeatures rather than a bare lngLat
    // lookup, so moving anywhere else on the map does NOT drag the cursor.
    const onMove = (e: maplibregl.MapMouseEvent) => {
      const st = scrubStateRef.current;
      if (!st.onScrub || !st.trackpoints?.length) return;
      const hitLayers = ROUTE_HIT_LAYERS.filter((id) => map.getLayer(id));
      if (hitLayers.length === 0) return;
      if (map.queryRenderedFeatures(e.point, { layers: hitLayers }).length === 0) return;

      const idx = nearestTrackpointIndex(st.trackpoints, e.lngLat.lng, e.lngLat.lat);
      // Idempotent on an unchanged value: without this the map and the profile
      // can ping-pong updates at pointer rates.
      if (idx != null && idx !== st.scrubIndex) st.onScrub(idx);
    };
    const onOut = () => {
      const st = scrubStateRef.current;
      if (st.onScrub && st.scrubIndex != null) st.onScrub(null);
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);

    // Fit once, on first load only: refitting on every style change would throw
    // away a pan or zoom the user had deliberately set.
    map.once("load", () => {
      const { bounds } = route.properties;
      map.fitBounds(
        [
          [bounds.min_lng, bounds.min_lat],
          [bounds.max_lng, bounds.max_lat],
        ],
        { padding: FIT_PADDING, duration: 0 },
      );
    });

    return () => {
      map.off("styledata", install);
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, discipline]);

  // Cursor moves push DATA into existing sources and swap one paint property —
  // never a reinstall, which tears down and rebuilds layers and would flicker
  // and thrash at pointer-move rates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tps = trackpoints ?? [];
    updateScrub(map as unknown as OverlayMap, {
      travelled: travelledSegments(tps, scrubIndex),
      scrubCoord: coordAt(tps, scrubIndex),
      strokeColor: cssVar(STROKE_TOKEN[discipline], STROKE_FALLBACK[discipline]),
      mutedColor: cssVar("--faint", MUTED_FALLBACK),
    });
  }, [scrubIndex, trackpoints, discipline]);

  // Style changes act on the live instance. The ref is updated FIRST so that
  // the `styledata` events `setStyle` triggers install the overlays the new
  // basemap needs, not the old one's.
  useEffect(() => {
    styleIdRef.current = styleId;
    const map = mapRef.current;
    if (!map) return;
    // Already showing it — this is a re-render, not a switch.
    if (appliedStyleRef.current === styleId) return;
    const url = styleUrl(styleId, keys);
    if (!url) return;
    appliedStyleRef.current = styleId;
    map.setStyle(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [styleId]);

  if (!route) return null;

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <div
        ref={containerRef}
        className="h-64 w-full md:h-80"
        aria-label={label}
        style={onScrub ? { cursor: "crosshair" } : undefined}
      />
      <MapStyleSwitcher styles={styles} value={styleId} onChange={setStyleId} />
    </div>
  );
}
