/// <reference types="vitest/globals" />

import { render } from "@testing-library/react";
import { Spark } from "./spark";

function polyline(container: HTMLElement): SVGPolylineElement | null {
  return container.querySelector("polyline");
}

describe("Spark", () => {
  it("renders a polyline with one coordinate per point", () => {
    const { container } = render(<Spark points={[1, 5, 2, 8, 3]} />);
    const line = polyline(container);
    expect(line).not.toBeNull();
    const coords = line!.getAttribute("points")!.trim().split(/\s+/);
    expect(coords).toHaveLength(5);
  });

  it("renders no polyline for an empty series", () => {
    const { container } = render(<Spark points={[]} />);
    expect(polyline(container)).toBeNull();
    // Still emits the svg shell so layout doesn't jump.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders no polyline for a single point", () => {
    const { container } = render(<Spark points={[7]} />);
    expect(polyline(container)).toBeNull();
  });

  it("draws a flat centered line for an all-equal series", () => {
    const { container } = render(<Spark points={[5, 5, 5]} />);
    const line = polyline(container);
    expect(line).not.toBeNull();
    const ys = line!
      .getAttribute("points")!
      .trim()
      .split(/\s+/)
      .map((pair) => Number(pair.split(",")[1]));
    // Every y identical (flat), and not pinned to an edge.
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBeGreaterThan(0);
  });

  it("applies an accent colour override to the stroke", () => {
    const { container } = render(<Spark points={[1, 2]} accent="var(--success)" />);
    expect(polyline(container)!.getAttribute("stroke")).toBe("var(--success)");
  });
});
