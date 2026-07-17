/// <reference types="vitest/globals" />
import { render } from "@testing-library/react";
import type { RouteFeature } from "@/lib/api";

const addSource = vi.hoisted(() => vi.fn());
const addLayer = vi.hoisted(() => vi.fn());
const fitBounds = vi.hoisted(() => vi.fn());
const on = vi.hoisted(() =>
  vi.fn((event: string, cb: () => void) => {
    if (event === "load") cb();
  }),
);
const remove = vi.hoisted(() => vi.fn());
const mapCtor = vi.hoisted(() => vi.fn(() => ({ addSource, addLayer, fitBounds, on, remove })));

vi.mock("maplibre-gl", () => ({
  default: { Map: mapCtor },
  Map: mapCtor,
}));
vi.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

import { RunRouteMap } from "./RunRouteMap";

function route(): RouteFeature {
  return {
    type: "Feature",
    geometry: {
      type: "MultiLineString",
      coordinates: [
        [
          [-105.0, 40.0],
          [-105.001, 40.001],
        ],
      ],
    },
    properties: {
      bounds: { min_lat: 40.0, min_lng: -105.001, max_lat: 40.001, max_lng: -105.0 },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

it("renders nothing when route is undefined", () => {
  const { container } = render(<RunRouteMap route={undefined} />);
  expect(container.firstChild).toBeNull();
});

it("mounts a maplibre map and fits the route bounds when a route is present", () => {
  const { container } = render(<RunRouteMap route={route()} />);
  expect(container.firstChild).not.toBeNull();
  expect(mapCtor).toHaveBeenCalledTimes(1);
  expect(fitBounds).toHaveBeenCalledWith(
    [
      [-105.001, 40.0],
      [-105.0, 40.001],
    ],
    expect.objectContaining({ padding: expect.any(Number) }),
  );
  const layerArg = addLayer.mock.calls[0][0];
  expect(layerArg.type).toBe("line");
  // --accent resolves to empty in jsdom (no stylesheet), so the component
  // falls back to the literal hex.
  expect(layerArg.paint["line-color"]).toBe("#9aa6d6");
});
