/**
 * Hero pace-recap area chart beneath the splits ledger — the pace-configured
 * instance of the shared `RecapChart`. Pure and prop-driven over the
 * client-mapped chart points (`buildPaceStrip`) plus the SERVER's
 * `strip_summary` block, which owns the header numbers (fastest/slowest) and
 * the dropout count; the plotted extremes are only a fallback when the summary
 * is absent. Chart geometry (domains, ticks, paths) lives in `RecapChart`.
 * Two load-bearing conventions, both visual:
 *
 *  1. FASTER IS HIGHER. The y-axis is inverted (min pace → small y → top), so a
 *     rising curve always reads as speeding up, never as slowing down. The axis
 *     labels and the "Faster is higher" pill make the inversion explicit.
 *  2. A DROPOUT IS NEVER BRIDGED. Every `null` flushes the current line/area
 *     segment and the next sample starts a fresh `M`, so the gap stays a gap (no
 *     diagonal drawn across missing GPS). Each `null` window also gets a muted
 *     band behind it (RecapChart's `showGapBands`).
 *
 * Pace labels go through `formatPaceClock` (bare seconds → "m:ss"), NOT the
 * unit-context formatters, which convert sec/km → unit and would double-convert
 * the already-per-unit `paceSecPerUnit`. `unit` is only an axis-label suffix.
 *
 * Series token: the pace stroke/area/dot carry the run discipline hue
 * (`--discipline-run-dot`) — `--accent` is reserved for edit/focus chrome, so
 * the "Faster is higher" pill is a quiet neutral, not accent (design-system
 * "activity ≠ selection"; SOW Resolved Q5).
 */

import type { RunningStripSummary } from "@/lib/api";
import type { PaceStripPoint } from "@/lib/running-splits";
import { formatPaceClock } from "@/lib/pace-format";
import { RecapChart, type RecapPoint } from "./RecapChart";

export function PaceRecap({
  points,
  stripSummary,
  unit,
}: {
  points: PaceStripPoint[];
  stripSummary: RunningStripSummary | null;
  unit: "km" | "mi";
}) {
  const hasDropout = (stripSummary?.dropout_count ?? 0) > 0;
  const plottable = points.filter(
    (p): p is { distanceUnit: number; paceSecPerUnit: number } => p.paceSecPerUnit != null,
  );

  if (plottable.length < 2) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 text-center"
        style={{ minHeight: 220 }}
      >
        <p className="text-[20px] font-semibold tracking-[-0.02em] text-[var(--muted)]">
          No pace data
        </p>
        <p className="mt-2 text-[13px] text-[var(--faint)]">
          This run has fewer than two usable samples per {unit}.
        </p>
      </div>
    );
  }

  // The HEADER numbers come from the server summary, falling back to the
  // plotted extremes only when the summary is absent.
  const paces = plottable.map((p) => p.paceSecPerUnit);
  const lo = Math.min(...paces); // fastest (plotted)
  const hi = Math.max(...paces); // slowest (plotted)
  const headerLo = stripSummary?.fastest_sec_per_unit ?? lo;
  const headerHi = stripSummary?.slowest_sec_per_unit ?? hi;

  // Each contiguous run of nulls is one drawn gap window.
  let drawnGaps = 0;
  let inGap = false;
  for (const p of points) {
    if (p.paceSecPerUnit == null) {
      if (!inGap) {
        inGap = true;
        drawnGaps += 1;
      }
    } else {
      inGap = false;
    }
  }

  // The caption states the SERVER's sample count (falling back to the drawn
  // windows when the summary is absent).
  const dropoutCount = stripSummary?.dropout_count ?? drawnGaps;
  const dropoutPhrase = dropoutCount === 1 ? "one GPS dropout" : `${dropoutCount} GPS dropouts`;

  const chartPoints: RecapPoint[] = points.map((p) => ({
    distanceUnit: p.distanceUnit,
    value: p.paceSecPerUnit,
  }));

  const ariaLabel =
    `Pace recap: fastest ${formatPaceClock(headerLo)}, slowest ${formatPaceClock(headerHi)} per ${unit}` +
    (hasDropout ? `; ${dropoutPhrase}.` : ".");

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-6 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="text-[26px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
            Pace
          </h3>
          <p className="mt-2 text-[13px] text-[var(--muted)]">
            Fastest {formatPaceClock(headerLo)} · slowest {formatPaceClock(headerHi)} /{unit}
            {hasDropout && ` · ${dropoutPhrase} bridged`}
          </p>
        </div>
        <span className="shrink-0 rounded-[var(--radius-pill)] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-[12px] font-medium text-[var(--muted)]">
          Faster is higher
        </span>
      </div>
      <RecapChart
        points={chartPoints}
        color="var(--discipline-run-dot)"
        gradientId="pace-recap-grad"
        invertY
        formatValue={formatPaceClock}
        unit={unit}
        showGapBands={drawnGaps > 0}
        extreme={{ kind: "min", label: () => `Fastest ${formatPaceClock(headerLo)}` }}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
