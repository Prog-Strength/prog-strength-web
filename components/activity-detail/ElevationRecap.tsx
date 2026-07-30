/**
 * Elevation recap — a thin, uninverted sibling of PaceRecap over the shared
 * `RecapChart`. Plots the client-mapped elevation strip (`buildElevationStrip`)
 * over the same distance axis; higher altitude sits higher. The demoted header
 * number (total gain) lives in the subtitle. Renders nothing when the series
 * has fewer than two plottable samples (no empty frame). Series token:
 * `--discipline-run-fg`.
 */

import type { MetricStripPoint } from "@/lib/running-traces";
import { RecapChart, type RecapPoint } from "./RecapChart";

export function ElevationRecap({
  points,
  gainMeters,
  unit,
}: {
  points: MetricStripPoint[];
  gainMeters: number | null;
  unit: "km" | "mi";
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
        color="var(--discipline-run-fg)"
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
