/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { MetricStripPoint } from "@/lib/running-traces";
import { HeartRateRecap } from "./HeartRateRecap";

// A series with a mid-run null window (a dropout) the line must NOT bridge.
const withGap: MetricStripPoint[] = [
  { distanceUnit: 0.0, value: 120 }, // lowest here
  { distanceUnit: 0.5, value: 135 },
  { distanceUnit: 1.0, value: null },
  { distanceUnit: 1.5, value: null },
  { distanceUnit: 2.0, value: 160 },
  { distanceUnit: 2.5, value: 178 }, // highest
];

const clean: MetricStripPoint[] = [
  { distanceUnit: 0.0, value: 120 }, // min bpm
  { distanceUnit: 1.0, value: 150 },
  { distanceUnit: 2.0, value: 178 }, // max bpm
];

function lineStrokePaths(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll("path")).filter(
    (p) => p.getAttribute("stroke") === "var(--zone-5)",
  );
}

describe("HeartRateRecap", () => {
  it("renders nothing (no svg, no card) when < 2 non-null points", () => {
    const sparse: MetricStripPoint[] = [
      { distanceUnit: 0, value: 120 },
      { distanceUnit: 1, value: null },
    ];
    const { container } = render(
      <HeartRateRecap points={sparse} avgBpm={140} maxBpm={178} unit="km" />,
    );
    expect(container.querySelector("svg")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("breaks the path at a gap — two stroke segments, never bridged", () => {
    const { container } = render(
      <HeartRateRecap points={withGap} avgBpm={150} maxBpm={178} unit="km" />,
    );
    const strokes = lineStrokePaths(container);
    expect(strokes).toHaveLength(2);
    for (const p of strokes) {
      const ms = (p.getAttribute("d") ?? "").match(/M/g) ?? [];
      expect(ms).toHaveLength(1);
    }
  });

  it("does NOT invert — the max-bpm sample sits at a smaller y than the min-bpm sample", () => {
    const { container } = render(
      <HeartRateRecap points={clean} avgBpm={149} maxBpm={178} unit="km" />,
    );
    const coords = lineStrokePaths(container)
      .flatMap((p) => Array.from((p.getAttribute("d") ?? "").matchAll(/[ML]([\d.]+),([\d.]+)/g)))
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    const ys = coords.map((c) => c.y);
    const minY = Math.min(...ys); // max bpm (178) → top
    const maxY = Math.max(...ys); // min bpm (120) → bottom
    // Uninverted: larger value is higher on screen (smaller y).
    // Find y of the first (min-bpm) and last (max-bpm) coordinates.
    const firstY = coords[0].y; // 120 bpm
    const lastY = coords[coords.length - 1].y; // 178 bpm
    expect(lastY).toBeLessThan(firstY);
    expect(minY).toBeLessThan(maxY);
  });

  it("shows the avg · max bpm subtitle", () => {
    const { container } = render(
      <HeartRateRecap points={clean} avgBpm={149} maxBpm={178} unit="km" />,
    );
    expect(container.textContent).toMatch(/Avg 149 · max 178 bpm/);
  });

  it("annotates the max sample with a Max label", () => {
    render(<HeartRateRecap points={clean} avgBpm={149} maxBpm={178} unit="km" />);
    expect(screen.getAllByText(/Max 178/).length).toBeGreaterThan(0);
  });
});
