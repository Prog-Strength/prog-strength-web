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

  it("draws two polylines on a shared scale when a second series is given", () => {
    // series 1 spans [10,20]; series 2 spans [0,40]. Combined extent is
    // [0,40], so series 1's own max (20) must NOT reach the top of the box —
    // it should sit at the vertical middle of the shared scale.
    const { container } = render(
      <Spark points={[10, 20]} points2={[0, 40]} accent="var(--accent)" accent2="var(--muted)" />,
    );
    const lines = container.querySelectorAll("polyline");
    expect(lines).toHaveLength(2);
    expect(lines[0].getAttribute("stroke")).toBe("var(--accent)");
    expect(lines[1].getAttribute("stroke")).toBe("var(--muted)");

    const y = (line: Element, idx: number) =>
      Number(line.getAttribute("points")!.trim().split(/\s+/)[idx].split(",")[1]);
    // Shared scale: series 2's top point (40) is the global max → highest
    // (smallest y); its bottom (0) is the global min → lowest (largest y).
    const s2Top = y(lines[1], 1); // value 40
    const s2Bottom = y(lines[1], 0); // value 0
    const s1Top = y(lines[0], 1); // value 20 — the midpoint of [0,40]
    expect(s2Top).toBeLessThan(s1Top);
    expect(s1Top).toBeLessThan(s2Bottom);
    // Series 1's high point (20) sits mid-scale, not pinned to the top edge.
    expect(s1Top).toBeGreaterThan(s2Top);
  });

  it("ignores a degenerate second series (renders only the first line)", () => {
    const { container } = render(<Spark points={[1, 2, 3]} points2={[9]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
  });
});
