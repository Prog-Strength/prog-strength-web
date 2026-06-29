/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import type { PaceStripPoint } from "@/lib/running-splits";
import { PaceRecap } from "./PaceRecap";

// A run with a mid-run null window (a dropout) the line must NOT bridge.
const withDropout: PaceStripPoint[] = [
  { distanceUnit: 0.0, paceSecPerUnit: 348 }, // 5:48 — slowest here
  { distanceUnit: 0.5, paceSecPerUnit: 335 },
  { distanceUnit: 1.0, paceSecPerUnit: null },
  { distanceUnit: 1.5, paceSecPerUnit: null },
  { distanceUnit: 2.0, paceSecPerUnit: 312 },
  { distanceUnit: 2.5, paceSecPerUnit: 291 }, // fastest
];

const clean: PaceStripPoint[] = [
  { distanceUnit: 0.0, paceSecPerUnit: 348 },
  { distanceUnit: 1.0, paceSecPerUnit: 300 },
  { distanceUnit: 2.0, paceSecPerUnit: 291 },
];

function lineStrokePaths(container: HTMLElement): SVGPathElement[] {
  return Array.from(container.querySelectorAll("path")).filter(
    (p) => p.getAttribute("stroke") === "var(--accent)",
  );
}

describe("PaceRecap", () => {
  it("breaks the path at a dropout — two stroke segments, never bridged", () => {
    const { container } = render(<PaceRecap points={withDropout} hasDropout unit="km" />);
    const strokes = lineStrokePaths(container);
    expect(strokes).toHaveLength(2);
    // No single stroke path may contain two `M` commands (a bridged path).
    for (const p of strokes) {
      const ms = (p.getAttribute("d") ?? "").match(/M/g) ?? [];
      expect(ms).toHaveLength(1);
    }
  });

  it("inverts the y-axis — the fastest sample sits at a smaller y than the slowest", () => {
    const { container } = render(<PaceRecap points={clean} hasDropout={false} unit="km" />);
    // Concatenate every plotted coordinate from the line segments.
    const coords = lineStrokePaths(container)
      .flatMap((p) => Array.from((p.getAttribute("d") ?? "").matchAll(/[ML]([\d.]+),([\d.]+)/g)))
      .map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    const ys = coords.map((c) => c.y);
    const minY = Math.min(...ys); // fastest pace (291) → top
    const maxY = Math.max(...ys); // slowest pace (348) → bottom
    expect(minY).toBeLessThan(maxY);
  });

  it("labels pace via formatPaceClock with no double conversion (348 → 5:48)", () => {
    const { container } = render(<PaceRecap points={clean} hasDropout={false} unit="mi" />);
    // 348 sec/unit must read 5:48 (subtitle "slowest"), NOT a unit-converted
    // ~9:20 — even in miles, where the converting formatter would re-scale it.
    expect(container.textContent).toMatch(/slowest 5:48/);
    expect(container.textContent).not.toMatch(/9:2\d/);
    // The fastest annotation reads the global min through the same formatter.
    expect(screen.getAllByText(/Fastest 4:51/).length).toBeGreaterThan(0);
  });

  it("renders the No-pace-data card (not an svg) when < 2 plottable points", () => {
    const sparse: PaceStripPoint[] = [{ distanceUnit: 0, paceSecPerUnit: null }];
    const { container } = render(<PaceRecap points={sparse} hasDropout={false} unit="km" />);
    expect(screen.getByText("No pace data")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("toggles the dropout-bridged subtitle copy on hasDropout", () => {
    const { rerender } = render(<PaceRecap points={clean} hasDropout={false} unit="km" />);
    expect(screen.queryByText(/one GPS dropout bridged/)).not.toBeInTheDocument();

    rerender(<PaceRecap points={clean} hasDropout unit="km" />);
    expect(screen.getByText(/one GPS dropout bridged/)).toBeInTheDocument();
  });

  it("gives the svg an aria-label summarising the run including the dropout", () => {
    render(<PaceRecap points={withDropout} hasDropout unit="km" />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute(
      "aria-label",
      "Pace recap: fastest 4:51, slowest 5:48 per km; one GPS dropout.",
    );
  });
});
