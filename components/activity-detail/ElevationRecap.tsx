/**
 * Elevation recap — a thin, uninverted sibling of PaceRecap over the shared
 * `RecapChart`. Plots the client-mapped elevation strip (`buildElevationStrip`)
 * over the same distance axis; higher altitude sits higher. The demoted header
 * number (total gain) lives in the subtitle. Renders nothing when the series
 * has fewer than two plottable samples (no empty frame). Series token: the
 * caller's discipline foreground — `--discipline-run-fg` by default, clay on
 * the hike page where this chart is the centerpiece rather than a supporting
 * sibling (a hike's own chart shouldn't be drawn in the run hue).
 */

import type { MetricStripPoint } from "@/lib/running-traces";
import { RecapChart, type RecapPoint } from "./RecapChart";

const SERIES_COLOR: Record<"run" | "hike", string> = {
  run: "var(--discipline-run-fg)",
  hike: "var(--discipline-hike-fg)",
};

export function ElevationRecap({
  points,
  gainMeters,
  unit,
  discipline = "run",
}: {
  points: MetricStripPoint[];
  gainMeters: number | null;
  unit: "km" | "mi";
  discipline?: "run" | "hike";
}) {
  const plottableCount = points.reduce((n, p) => (p.value != null ? n + 1 : n), 0);
  if (plottableCount < 2) return null;

  const chartPoints: RecapPoint[] = points.map((p) => ({
    distanceUnit: p.distanceUnit,
    value: p.value,
  }));

  const subtitle = gainMeters != null ? `${gainMeters.toFixed(0)} m gain` : null;

  const ariaLabel = `Elevation recap over distance in ${unit}.`;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
      <div className="mb-4">
        <h3 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
          Elevation
        </h3>
        {subtitle && <p className="mt-2 text-[13px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      <RecapChart
        points={chartPoints}
        color={SERIES_COLOR[discipline]}
        gradientId="elev-recap-grad"
        invertY={false}
        formatValue={(v) => `${v.toFixed(0)} m`}
        unit={unit}
        extreme={{ kind: "max", label: (v) => `Peak ${v.toFixed(0)} m` }}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
