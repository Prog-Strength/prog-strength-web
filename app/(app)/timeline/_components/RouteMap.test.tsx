/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { RouteMap, projectRoute } from "./RouteMap";
import type { TimelineRoute } from "@/lib/api";

const ROUTE: TimelineRoute = {
  points: [
    [40.0, -105.0],
    [40.0, -104.0],
    [41.0, -104.0],
  ],
  bounds: { min_lat: 40.0, min_lng: -105.0, max_lat: 41.0, max_lng: -104.0 },
};

describe("projectRoute", () => {
  it("maps the corners of bounds into the viewbox with latitude flipped", () => {
    const pts = projectRoute(ROUTE, 100, 100);
    // first point is min_lat/min_lng → x=0, y=100 (lat flipped: min_lat at bottom)
    expect(pts[0]).toEqual({ x: 0, y: 100 });
    // last point is max_lat/max_lng → x=100, y=0
    expect(pts[2]).toEqual({ x: 100, y: 0 });
  });
});

describe("RouteMap", () => {
  it("renders a placeholder when no route is supplied", () => {
    render(<RouteMap />);
    expect(screen.getByTestId("route-placeholder")).toBeInTheDocument();
    expect(screen.queryByTestId("route-polyline")).not.toBeInTheDocument();
  });

  it("draws the polyline when a route is supplied", () => {
    render(<RouteMap route={ROUTE} />);
    expect(screen.getByTestId("route-polyline")).toBeInTheDocument();
    expect(screen.queryByTestId("route-placeholder")).not.toBeInTheDocument();
  });
});
