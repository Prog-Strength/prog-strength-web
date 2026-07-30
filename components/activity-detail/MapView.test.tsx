/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from "@testing-library/react";
import type { RouteFeature } from "@/lib/api";

const mapCtor = vi.hoisted(() => vi.fn());
vi.mock("maplibre-gl", () => ({ default: { Map: mapCtor }, Map: mapCtor }));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

// The key is read through config at module scope, so it is mocked rather than
// set via process.env — this suite covers BOTH the keyed and keyless paths and
// needs to flip between them per test.
const maptilerKey = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("@/lib/config", () => ({
  get config() {
    return { maptilerKey: maptilerKey.value };
  },
}));

import { createMapStub } from "@/lib/test-fixtures/maplibre-stub";
import { MapView } from "./MapView";

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
      ],
    },
    properties: {
      bounds: { min_lat: 39.39, min_lng: -106.001, max_lat: 39.395, max_lng: -106.0 },
    },
  };
}

/** A short positioned track, index-aligned with what the profile would plot. */
function tps() {
  return Array.from({ length: 5 }, (_, i) => ({
    sequence: i,
    elapsed_seconds: i * 10,
    distance_meters: i * 100,
    heart_rate_bpm: null,
    pace_sec_per_km: null,
    elevation_meters: 3300 + i * 10,
    clean_pace: false,
    latitude: 39.39 + i * 0.001,
    longitude: -106.0 - i * 0.001,
    grade_percent: null,
  }));
}

let stub: ReturnType<typeof createMapStub>;

beforeEach(() => {
  vi.clearAllMocks();
  maptilerKey.value = null;
  stub = createMapStub([{ id: "place-label", type: "symbol" }]);
  mapCtor.mockImplementation(() => stub);
});

describe("MapView", () => {
  // The pre-existing contract: indoor / no-GPS activity pages must be
  // byte-for-byte unchanged — no map frame, no placeholder, no empty card.
  it("renders nothing when there is no route", () => {
    const { container } = render(<MapView route={undefined} discipline="hike" />);
    expect(container.firstChild).toBeNull();
    expect(mapCtor).not.toHaveBeenCalled();
  });

  it("mounts a map and fits the route bounds", () => {
    render(<MapView route={route()} discipline="hike" />);
    expect(mapCtor).toHaveBeenCalledTimes(1);
    expect(stub.fitBounds).toHaveBeenCalledWith(
      [
        [-106.001, 39.39],
        [-106.0, 39.395],
      ],
      expect.objectContaining({ padding: expect.any(Number) }),
    );
  });

  it("names the map surface for the calling activity", () => {
    render(<MapView route={route()} discipline="hike" label="Hike route map" />);
    expect(screen.getByLabelText("Hike route map")).toBeTruthy();
  });

  it("installs the route overlays through the styledata handler", () => {
    render(<MapView route={route()} discipline="hike" />);
    const layerIds = stub.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
    expect(layerIds).toContain("ps-route-casing");
    expect(layerIds).toContain("ps-route-line");
    expect(layerIds).toContain("ps-route-arrows");
    expect(layerIds).toContain("ps-route-endpoints");
  });

  // The design-system correction this SOW makes: the route is a SERIES, and
  // --accent is reserved for edit/focus chrome ("activity ≠ selection"). The
  // stroke must follow the discipline, matching the elevation chart beside it.
  it("strokes the route in the discipline hue, not the accent", () => {
    render(<MapView route={route()} discipline="hike" />);
    const line = stub.addLayer.mock.calls
      .map((c) => c[0] as { id: string; paint?: Record<string, unknown> })
      .find((l) => l.id === "ps-route-line");
    // jsdom resolves no stylesheet, so the component falls back to the literal
    // token value — the hike clay, and specifically NOT #9aa6d6.
    expect(line?.paint?.["line-color"]).toBe("#c9a690");
    expect(line?.paint?.["line-color"]).not.toBe("#9aa6d6");
  });

  it("strokes a run in the run hue", () => {
    render(<MapView route={route()} discipline="run" />);
    const line = stub.addLayer.mock.calls
      .map((c) => c[0] as { id: string; paint?: Record<string, unknown> })
      .find((l) => l.id === "ps-route-line");
    expect(line?.paint?.["line-color"]).toBe("#9cc7b8");
  });

  describe("without a MapTiler key", () => {
    it("falls back to the keyless basemap with the route intact", () => {
      render(<MapView route={route()} discipline="hike" />);
      // Hikes default to topographic, which needs a key; with none the map must
      // still mount, on OpenFreeMap, rather than break.
      expect(mapCtor.mock.calls[0][0].style).toBe("https://tiles.openfreemap.org/styles/dark");
      const layerIds = stub.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
      expect(layerIds).toContain("ps-route-line");
    });

    it("hides the switcher when there is only one resolvable style", () => {
      render(<MapView route={route()} discipline="hike" />);
      expect(screen.queryByRole("group", { name: "Basemap style" })).toBeNull();
    });

    // Standard is deliberately unchanged from the pre-existing map, so no
    // terrain is added to it.
    it("adds no hillshade to the fallback basemap", () => {
      render(<MapView route={route()} discipline="hike" />);
      const layerIds = stub.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
      expect(layerIds).not.toContain("ps-hillshade");
    });
  });

  describe("with a MapTiler key", () => {
    beforeEach(() => {
      maptilerKey.value = "test-key";
    });

    it("defaults a hike to the topographic basemap", () => {
      render(<MapView route={route()} discipline="hike" />);
      expect(mapCtor.mock.calls[0][0].style).toBe(
        "https://api.maptiler.com/maps/outdoor-v2-dark/style.json?key=test-key",
      );
    });

    it("defaults a run to the standard basemap", () => {
      render(<MapView route={route()} discipline="run" />);
      expect(mapCtor.mock.calls[0][0].style).toBe("https://tiles.openfreemap.org/styles/dark");
    });

    it("installs our hillshade over the topographic basemap", () => {
      render(<MapView route={route()} discipline="hike" />);
      const layerIds = stub.addLayer.mock.calls.map((c) => (c[0] as { id: string }).id);
      expect(layerIds).toContain("ps-hillshade");
    });

    it("offers every resolvable style in the switcher", () => {
      render(<MapView route={route()} discipline="hike" />);
      const group = screen.getByRole("group", { name: "Basemap style" });
      expect(group).toBeTruthy();
      for (const label of ["Topographic", "Standard", "Dark"]) {
        expect(screen.getByRole("button", { name: label })).toBeTruthy();
      }
    });

    // Rule 1 of the component: changing style must call setStyle on the LIVE
    // map, never remount it — remounting would reset the user's pan/zoom and
    // burn a second billable session (SOW Risk R6).
    it("changes basemap via setStyle without recreating the map", () => {
      render(<MapView route={route()} discipline="hike" />);
      expect(mapCtor).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole("button", { name: "Standard" }));

      expect(stub.setStyle).toHaveBeenCalledWith("https://tiles.openfreemap.org/styles/dark");
      expect(mapCtor).toHaveBeenCalledTimes(1);
    });

    // The mounted style is passed to the constructor; re-applying it via
    // setStyle would cost a redundant style load and a second billable session
    // on every render.
    it("does not re-apply the mounted style", () => {
      render(<MapView route={route()} discipline="hike" />);
      expect(stub.setStyle).not.toHaveBeenCalled();
    });

    it("does not re-apply a style that is already active", () => {
      render(<MapView route={route()} discipline="hike" />);
      fireEvent.click(screen.getByRole("button", { name: "Standard" }));
      expect(stub.setStyle).toHaveBeenCalledTimes(1);
      // Clicking the active pill is a no-op at the switcher, and would be one
      // here too.
      fireEvent.click(screen.getByRole("button", { name: "Standard" }));
      expect(stub.setStyle).toHaveBeenCalledTimes(1);
    });

    // The cheap path: scrubbing pushes data into existing sources and swaps one
    // paint property. A reinstall at pointer-move rates would flicker.
    it("moves the cursor without reinstalling overlays", () => {
      // Stable identities, as on the real page: `session` lives in state, so a
      // cursor move re-renders with the SAME route and trackpoint objects.
      const r = route();
      const t = tps();
      const { rerender } = render(
        <MapView route={r} discipline="hike" trackpoints={t} scrubIndex={null} />,
      );
      const addsAfterMount = stub.addLayer.mock.calls.length;

      rerender(<MapView route={r} discipline="hike" trackpoints={t} scrubIndex={2} />);

      expect(stub.addLayer.mock.calls.length).toBe(addsAfterMount);
      expect(stub.setPaintProperty).toHaveBeenCalledWith(
        "ps-route-line",
        "line-color",
        expect.any(String),
      );
    });

    it("seeds the cursor into a reinstall so a style change mid-scrub keeps it", () => {
      render(<MapView route={route()} discipline="hike" trackpoints={tps()} scrubIndex={2} />);
      const scrubSource = stub.addSource.mock.calls.find((c) => c[0] === "ps-scrub");
      expect(scrubSource).toBeTruthy();
      const data = (scrubSource![1] as { data: { geometry?: { coordinates: number[] } } }).data;
      expect(data.geometry?.coordinates).toEqual([-106.002, 39.392]);
    });

    it("passes mile markers through to the map source", () => {
      render(
        <MapView
          route={route()}
          discipline="hike"
          trackpoints={tps()}
          mileMarkers={[{ coord: [-106.001, 39.391], label: "1" }]}
        />,
      );
      const miles = stub.addSource.mock.calls.find((c) => c[0] === "ps-miles");
      const data = (miles![1] as { data: { features: unknown[] } }).data;
      expect(data.features).toHaveLength(1);
    });

    it("marks the active style as pressed", () => {
      render(<MapView route={route()} discipline="hike" />);
      expect(screen.getByRole("button", { name: "Topographic" }).getAttribute("aria-pressed")).toBe(
        "true",
      );
      expect(screen.getByRole("button", { name: "Standard" }).getAttribute("aria-pressed")).toBe(
        "false",
      );
    });
  });
});
