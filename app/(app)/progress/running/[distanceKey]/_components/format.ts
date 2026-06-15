/**
 * Display helpers local to the max-effort detail view. The API returns
 * `basis`, `confidence`, and attempt `source` as machine strings; these
 * humanize them for the UI without baking the enum into multiple files.
 */

import type { RunningMaxEffortHistoryPoint } from "@/lib/api";

/** "Mon D, YYYY" for an RFC3339 string; em-dash for null/empty. */
export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Title-case a snake_case / lowercase confidence label, e.g. "high" → "High". */
export function humanizeConfidence(confidence: string): string {
  if (!confidence) return "—";
  return confidence
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Humanize an attempt `source` into a short label. Known sources get a
 * curated phrase; anything else falls back to a title-cased version of
 * the raw value so a new server source still reads cleanly.
 */
export function humanizeSource(source: string): string {
  switch (source) {
    case "race_like":
      return "Race-like";
    case "long_run":
    case "long_run_window":
      return "Long-run window";
    default:
      if (!source) return "—";
      return source
        .split("_")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
  }
}

export type Trend = {
  arrow: "↑" | "→" | "↓" | null;
  text: string;
  tone: "positive" | "negative" | "neutral";
};

/**
 * Compare the first and last points of the estimate-history series to a
 * faster/slower trend. Lower seconds is faster, so a drop reads positive.
 * Needs at least two points; otherwise "not enough data".
 */
export function estimateTrend(history: RunningMaxEffortHistoryPoint[]): Trend {
  if (history.length < 2) {
    return { arrow: null, text: "not enough data", tone: "neutral" };
  }
  const first = history[0].seconds;
  const last = history[history.length - 1].seconds;
  const delta = last - first; // negative = got faster
  if (Math.abs(delta) < 0.5) {
    return { arrow: "→", text: "Holding steady", tone: "neutral" };
  }
  const magnitude = formatSignedDuration(delta);
  if (delta < 0) {
    return { arrow: "↓", text: `${magnitude} faster`, tone: "positive" };
  }
  return { arrow: "↑", text: `${magnitude} slower`, tone: "negative" };
}

/**
 * Format a signed second delta as "±m:ss" (absolute clock value with a
 * leading sign). Used for the "−0:12 vs estimate" gap and trend deltas.
 */
export function formatSignedDuration(deltaSeconds: number): string {
  if (!Number.isFinite(deltaSeconds)) return "—";
  const sign = deltaSeconds < 0 ? "−" : deltaSeconds > 0 ? "+" : "";
  const total = Math.round(Math.abs(deltaSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${sign}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}
