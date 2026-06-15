"use client";

/**
 * The headline stat tiles for the max-effort detail view, reusing the
 * progress-page StatTile visual (large value over small uppercase
 * label). Four tiles:
 *
 *   - Estimated max-effort time (headline, REQUIRED — drives the page)
 *   - Current best + signed gap vs the estimate
 *   - Confidence + a basis/data-summary caption
 *   - Trend — first vs last estimate-history point (faster/slower)
 *
 * All numeric fields are nullable on the API; missing values render "—".
 */

import type { RunningMaxEffortDetail } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { estimateTrend, formatSignedDuration, humanizeConfidence, type Trend } from "./format";

type Tone = "positive" | "negative" | "neutral";

function durationOrDash(seconds: number | null): string {
  return seconds == null ? "—" : formatDuration(seconds);
}

export function EstimateStatTiles({ detail }: { detail: RunningMaxEffortDetail }) {
  const { stats, estimate_history } = detail;

  // Gap caption: current best vs estimate. The API ships `gap_seconds`
  // (current_best − estimate); negative means the actual best is already
  // faster than the projection.
  const gap = stats.gap_seconds;
  const gapCaption = gap == null ? null : `${formatSignedDuration(gap)} vs estimate`;

  const trend: Trend = estimateTrend(estimate_history);

  const confidence = humanizeConfidence(stats.confidence);
  const confidenceCaption = stats.data_summary || null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatTile
        value={durationOrDash(stats.estimated_max_effort_seconds)}
        label="Estimated max-effort time"
        headline
      />
      <StatTile
        value={durationOrDash(stats.current_best_seconds)}
        label="Current best"
        caption={gapCaption}
      />
      <StatTile value={confidence} label="Confidence" caption={confidenceCaption} />
      <StatTile value={trend.text} label="Trend" tone={trend.tone} arrow={trend.arrow} />
    </div>
  );
}

/**
 * One stat tile — large value over a small uppercase label, with an
 * optional caption and a tone that colors the value (the value text
 * itself carries the direction so the signal survives without color).
 */
function StatTile({
  value,
  label,
  caption,
  tone = "neutral",
  headline = false,
  arrow,
}: {
  value: string;
  label: string;
  caption?: string | null;
  tone?: Tone;
  headline?: boolean;
  arrow?: Trend["arrow"];
}) {
  const toneColor =
    tone === "positive"
      ? "text-[#86efac]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  const size = headline ? "text-3xl" : "text-2xl";
  return (
    <div
      className={`rounded-lg border bg-[var(--surface)] px-4 py-3 ${
        headline ? "border-[var(--accent)]/40" : "border-[var(--border)]"
      }`}
    >
      <p className={`${size} font-semibold tracking-tight tabular-nums ${toneColor}`}>
        {arrow && (
          <span aria-hidden className="mr-1">
            {arrow}
          </span>
        )}
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      {caption && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{caption}</p>}
    </div>
  );
}
