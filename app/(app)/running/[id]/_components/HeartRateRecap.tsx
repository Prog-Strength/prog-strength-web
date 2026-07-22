/**
 * Heart-rate recap — a thin, uninverted sibling of PaceRecap over the shared
 * `RecapChart`. Plots the client-mapped HR strip (`buildHeartRateStrip`) over
 * the same distance axis; larger bpm sits higher. The demoted header numbers
 * (avg · max) live in the subtitle. Renders nothing when the series has fewer
 * than two plottable samples (no empty frame — the page also gates, but be
 * defensive). Series token: `--zone-5`.
 */

import type { MetricStripPoint } from "@/lib/running-traces";
import { RecapChart, type RecapPoint } from "./RecapChart";

export function HeartRateRecap({
  points,
  avgBpm,
  maxBpm,
  unit,
}: {
  points: MetricStripPoint[];
  avgBpm: number | null;
  maxBpm: number | null;
  unit: "km" | "mi";
}) {
  const plottableCount = points.reduce((n, p) => (p.value != null ? n + 1 : n), 0);
  if (plottableCount < 2) return null;

  const chartPoints: RecapPoint[] = points.map((p) => ({
    distanceUnit: p.distanceUnit,
    value: p.value,
  }));

  const subtitleParts: string[] = [];
  if (avgBpm != null) subtitleParts.push(`Avg ${Math.round(avgBpm)}`);
  if (maxBpm != null) subtitleParts.push(`max ${Math.round(maxBpm)}`);
  const subtitle = subtitleParts.length > 0 ? `${subtitleParts.join(" · ")} bpm` : null;

  const ariaLabel = `Heart rate recap over distance in ${unit}.`;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
      <div className="mb-4">
        <h3 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
          Heart rate
        </h3>
        {subtitle && <p className="mt-2 text-[13px] text-[var(--muted)]">{subtitle}</p>}
      </div>
      <RecapChart
        points={chartPoints}
        color="var(--zone-5)"
        gradientId="hr-recap-grad"
        invertY={false}
        formatValue={(v) => String(Math.round(v))}
        unit={unit}
        extreme={{ kind: "max", label: (v) => `Max ${Math.round(v)}` }}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
