/**
 * Self-contained display helpers for the running-max-effort-estimate DX.
 *
 * Re-implemented locally (rather than imported from the production route's
 * `_components/format.ts`) so each throwaway variant stays decoupled from the
 * shipped surface — the DX must never reach into, or be reached by, product
 * code. Duplication here is intentional and expected for a disposable mockup.
 */

import type { RunningMaxEffortDetail, RunningMaxEffortHistoryPoint } from "@/lib/api";

const MILE_PER_KM = 1.609344;

/** "m:ss" under an hour, "h:mm:ss" at/above one hour. Em-dash for nullish. */
export function fmtTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Signed "±m:ss" magnitude (true minus sign for negatives). */
export function fmtSigned(deltaSeconds: number | null | undefined): string {
  if (deltaSeconds == null || !Number.isFinite(deltaSeconds)) return "—";
  const sign = deltaSeconds < 0 ? "−" : deltaSeconds > 0 ? "+" : "";
  return `${sign}${fmtTime(Math.abs(deltaSeconds))}`;
}

/** Unsigned magnitude, no sign glyph — for "X faster / X slower" prose. */
export function fmtMagnitude(deltaSeconds: number | null | undefined): string {
  if (deltaSeconds == null || !Number.isFinite(deltaSeconds)) return "—";
  return fmtTime(Math.abs(deltaSeconds));
}

/** Pace per mile from the API's sec/km. The DX renders /mi to match the
 *  ticket fixture; the production surface honours the user's unit setting. */
export function fmtPaceMi(paceSecPerKm: number): string {
  if (!Number.isFinite(paceSecPerKm) || paceSecPerKm <= 0) return "—";
  return `${fmtTime(paceSecPerKm * MILE_PER_KM)} /mi`;
}

/** "Mon D" (compact, for chart ticks / inline). */
export function fmtDayMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Mon D, YYYY" (full, for tables / milestones). */
export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function humanizeSource(source: string): string {
  switch (source) {
    case "race_like":
      return "Race-like";
    case "long_run":
    case "long_run_window":
      return "Long-run window";
    case "tempo":
      return "Tempo";
    default:
      return source
        .split("_")
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(" ");
  }
}

export function titleCase(s: string): string {
  if (!s) return "—";
  return s
    .split(/[\s_]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export type TrendTone = "positive" | "negative" | "neutral";

export type Trend = {
  direction: "faster" | "slower" | "flat" | "none";
  arrow: "↓" | "↑" | "→" | null;
  /** Signed delta over the window in seconds (last − first; negative = faster). */
  deltaSeconds: number;
  /** "11:05 slower" style phrase (magnitude + direction word). */
  phrase: string;
  tone: TrendTone;
};

/** First vs last estimate-history point → a faster/slower trend. Lower
 *  seconds is faster, so a drop is positive. */
export function estimateTrend(history: RunningMaxEffortHistoryPoint[]): Trend {
  if (history.length < 2) {
    return {
      direction: "none",
      arrow: null,
      deltaSeconds: 0,
      phrase: "Not enough history",
      tone: "neutral",
    };
  }
  const delta = history[history.length - 1].seconds - history[0].seconds;
  if (Math.abs(delta) < 0.5) {
    return {
      direction: "flat",
      arrow: "→",
      deltaSeconds: 0,
      phrase: "Holding steady",
      tone: "neutral",
    };
  }
  const mag = fmtMagnitude(delta);
  if (delta < 0) {
    return {
      direction: "faster",
      arrow: "↓",
      deltaSeconds: delta,
      phrase: `${mag} faster`,
      tone: "positive",
    };
  }
  return {
    direction: "slower",
    arrow: "↑",
    deltaSeconds: delta,
    phrase: `${mag} slower`,
    tone: "negative",
  };
}

/** Confidence as an ordinal 1–3 (for filled-pip / ledger encodings). */
export function confidenceLevel(confidence: string): { level: number; label: string } {
  switch ((confidence || "").toLowerCase()) {
    case "high":
      return { level: 3, label: "High" };
    case "medium":
      return { level: 2, label: "Medium" };
    case "low":
      return { level: 1, label: "Low" };
    default:
      return { level: 0, label: "—" };
  }
}

/** Half-width of the confidence interval in seconds (± band). */
export function bandHalfWidth(detail: RunningMaxEffortDetail): number | null {
  const e = detail.estimate;
  if (!e) return null;
  return Math.round((e.upper_seconds - e.lower_seconds) / 2);
}
