"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteFeature } from "@/lib/api";
import { config } from "@/lib/config";
import { installOverlays, type OverlayMap } from "@/lib/map-overlays";
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
export function MapView({ route, discipline, label = "Activity route map" }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Guards re-entrancy: our own `addSource` calls emit `styledata`, so an
  // unguarded handler would recurse into itself on every install.
  const installingRef = useRef(false);

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
        installOverlays(map as unknown as OverlayMap, {
          route,
          strokeColor: stroke,
          casingColor: casing,
          hillshade: MAP_STYLES[styleIdRef.current].supportsHillshade,
        });
      } finally {
        installingRef.current = false;
      }
    };

    map.on("styledata", install);

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
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, discipline]);

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
      <div ref={containerRef} className="h-64 w-full md:h-80" aria-label={label} />
      <MapStyleSwitcher styles={styles} value={styleId} onChange={setStyleId} />
    </div>
  );
}
