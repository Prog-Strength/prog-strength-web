/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { MetricStripPoint } from "@/lib/running-traces";
import { ElevationRecap } from "./ElevationRecap";

// A series with a mid-run null window the line must NOT bridge.
const withGap: MetricStripPoint[] = [
  { distanceUnit: 0.0, value: 10 },
  { distanceUnit: 0.5, value: 22 },
  { distanceUnit: 1.0, value: null },
  { distanceUnit: 1.5, value: null },
  { distanceUnit: 2.0, value: 48 },
  { distanceUnit: 2.5, value: 71 }, // peak
];

const clean: MetricStripPoint[] = [
  { distanceUnit: 0.0, value: 10 },
  { distanceUnit: 1.0, value: 35 },
  { distanceUnit: 2.0, value: 71 }, // peak
];

function lineStrokePaths(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll("path")).filter(
    (p) => p.getAttribute("stroke") === "var(--discipline-run-fg)",
  );
}

describe("ElevationRecap", () => {
  it("renders nothing when < 2 non-null points", () => {
    const sparse: MetricStripPoint[] = [
      { distanceUnit: 0, value: 10 },
      { distanceUnit: 1, value: null },
    ];
    const { container } = render(<ElevationRecap points={sparse} gainMeters={61} unit="km" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.firstChild).toBeNull();
  });

  it("breaks the path at a gap — two stroke segments, never bridged", () => {
    const { container } = render(<ElevationRecap points={withGap} gainMeters={61} unit="km" />);
    const strokes = lineStrokePaths(container);
    expect(strokes).toHaveLength(2);
    for (const p of strokes) {
      const ms = (p.getAttribute("d") ?? "").match(/M/g) ?? [];
      expect(ms).toHaveLength(1);
    }
  });

  it("does NOT invert — the peak sample sits at a smaller y than the lowest", () => {
    const { container } = render(<ElevationRecap points={clean} gainMeters={61} unit="km" />);
    const coords = lineStrokePaths(container)
      .flatMap((p) => Array.from((p.getAttribute("d") ?? "").matchAll(/[ML]([\d.]+),([\d.]+)/g)))
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    // Uninverted: the 71 m peak (last sample) is higher on screen (smaller y)
    // than the 10 m start (first sample) — the opposite of PaceRecap.
    expect(coords[coords.length - 1].y).toBeLessThan(coords[0].y);
  });

  it("shows the gain subtitle in meters", () => {
    const { container } = render(<ElevationRecap points={clean} gainMeters={61} unit="km" />);
    expect(container.textContent).toMatch(/61 m gain/);
  });

  it("annotates the peak sample with a Peak label", () => {
    render(<ElevationRecap points={clean} gainMeters={61} unit="km" />);
    expect(screen.getAllByText(/Peak 71 m/).length).toBeGreaterThan(0);
  });
});
