"use client";

/**
 * The three stat tiles above the chart, plus the tone math that drives
 * their color. The tiles answer the page's headline question — "am I
 * getting stronger?" — at three altitudes: how many lifts are gaining
 * ground, the median per-exercise slope, and the single best session in
 * the window.
 *
 * Tone selectors and formatSlope are exported so the unit tests can
 * exercise their boundaries directly (the SOW pins the exact thresholds,
 * which match the backend's progressingSlopeThreshold so a slope the API
 * counts as "progressing" never reads neutral on the card).
 */

import type { ProgressionAggregate, MuscleGroupProgressionPoint } from "@/lib/api";

export type StatTone = "positive" | "negative" | "neutral";

/**
 * Tone for the "Lifts progressing" tile. Positive when at least half the
 * tracked lifts are progressing, negative when a quarter or fewer are,
 * neutral in between (and neutral when nothing is tracked yet).
 */
export function progressTone(progressing: number, tracked: number): StatTone {
  if (tracked <= 0) return "neutral";
  const ratio = progressing / tracked;
  if (ratio >= 0.5) return "positive";
  if (ratio <= 0.25) return "negative";
  return "neutral";
}

/**
 * Tone for the "Strength trend" tile, off the median per-exercise slope.
 * The ±0.5 %/mo band matches the chart legend's direction thresholds.
 */
export function slopeTone(slope: number | null): StatTone {
  if (slope === null) return "neutral";
  if (slope > 0.5) return "positive";
  if (slope < -0.5) return "negative";
  return "neutral";
}

/** `null` → "—"; otherwise a signed one-decimal percent-per-month, e.g. "+1.4%/mo". */
export function formatSlope(slope: number | null): string {
  if (slope === null || !Number.isFinite(slope)) return "—";
  const sign = slope > 0 ? "+" : "";
  return `${sign}${slope.toFixed(1)}%/mo`;
}

function formatPercent(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function StatCards({
  aggregate,
  bestPoint,
}: {
  aggregate: ProgressionAggregate | null;
  bestPoint: MuscleGroupProgressionPoint | null;
}) {
  // When the aggregate is absent (API revert, or no exercises cleared the
  // session threshold) the tiles read 0 / 0 and "—" with neutral tone.
  const liftsTracked = aggregate?.lifts_tracked ?? 0;
  const liftsProgressing = aggregate?.lifts_progressing ?? 0;
  const medianSlope = aggregate?.median_slope_per_month ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <StatTile
        value={`${liftsProgressing} / ${liftsTracked}`}
        label="Lifts progressing"
        tone={progressTone(liftsProgressing, liftsTracked)}
      />
      <StatTile
        value={formatSlope(medianSlope)}
        label="Median per-exercise slope"
        tone={slopeTone(medianSlope)}
      />
      <StatTile
        value={bestPoint ? `${formatPercent(bestPoint.normalized_max)} of baseline` : "—"}
        label={bestPoint ? `Best session • ${formatDate(bestPoint.performed_at)}` : "Best session"}
      />
    </div>
  );
}

/**
 * One stat tile — large value over a small uppercase label. Tone drives
 * the value color only; the value text itself carries the direction (e.g.
 * "+1.4%/mo") so the signal survives without color for screen readers.
 */
function StatTile({
  value,
  label,
  tone = "neutral",
}: {
  value: string;
  label: string;
  tone?: StatTone;
}) {
  const toneColor =
    tone === "positive"
      ? "text-[#86efac]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className={`text-2xl font-semibold tracking-tight ${toneColor}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}
