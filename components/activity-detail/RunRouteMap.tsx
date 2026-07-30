"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteFeature } from "@/lib/api";

// OpenFreeMap's dark first-party style — no account, no API key. Chosen to sit
// under the app's near-black chrome; the periwinkle --accent route stroke reads
// clearly on it. See sows/sow-trail-map.md.
const BASEMAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
const FIT_PADDING = 32;
const ACCENT_FALLBACK = "#9aa6d6";

type RunRouteMapProps = {
  route: RouteFeature | undefined;
  // Accessible name for the map surface. Shared across activity detail
  // pages, so the caller names the activity — a hike's map must not
  // announce itself as a run route.
  label?: string;
};

// RunRouteMap renders the simplified GPS route on a MapLibre map fitted to the
// route bounds. It renders nothing when there is no route (indoor / no-GPS
// runs), so the detail page is byte-for-byte unchanged for those. Purely
// presentational: it owns the map lifecycle for the route prop it is given.
export function RunRouteMap({ route, label = "Run route map" }: RunRouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!route || !containerRef.current) return;

    // MapLibre doesn't resolve CSS custom properties in paint expressions, so
    // resolve the accent to a concrete color at mount.
    const accent =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() ||
      ACCENT_FALLBACK;

    const { bounds } = route.properties;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      interactive: true,
    });

    map.on("load", () => {
      map.addSource("route", { type: "geojson", data: route });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": accent, "line-width": 3 },
      });
      map.fitBounds(
        [
          [bounds.min_lng, bounds.min_lat],
          [bounds.max_lng, bounds.max_lat],
        ],
        { padding: FIT_PADDING, duration: 0 },
      );
    });

    return () => map.remove();
  }, [route]);

  if (!route) return null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
      <div ref={containerRef} className="h-64 w-full" aria-label={label} />
    </div>
  );
}
