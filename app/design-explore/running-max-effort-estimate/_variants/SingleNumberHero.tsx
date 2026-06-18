"use client";

/**
 * IDIOM: single-number-hero — draws on Whoop's one-big-confident-metric readout.
 *
 * The estimate IS the page. One oversized time dominates; the confidence
 * interval rides in the headline as the subtitle (53:10 – 54:18) so the
 * uncertainty is part of the number, not buried in a chart. Trend sits as a
 * small directional tag beside it; the chart + attempts demote to a calm
 * strip below.
 *
 * DIVERGES ON (in-system — palette/accent/type fixed):
 *  · type scale — dramatic: one hero numeral huge, everything else fine.
 *  · color logic — near-monochrome; the periwinkle accent is spent ONLY on
 *    the one number, plus a single desaturated trend tint.
 *  · spacing rhythm — generous and airy; the page opens centred on the number.
 */

import type { RunningMaxEffortDetail } from "@/lib/api";
import {
  bandHalfWidth,
  confidenceLevel,
  estimateTrend,
  fmtMagnitude,
  fmtTime,
} from "../_shared/format";

export function SingleNumberHero({ detail }: { detail: RunningMaxEffortDetail }) {
  const est = detail.estimate;
  const trend = estimateTrend(detail.estimate_history);
  const conf = confidenceLevel(detail.stats.confidence);
  const half = bandHalfWidth(detail);

  if (!est) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center px-8 py-16 text-center">
        <p className="text-7xl font-semibold tracking-[-0.03em] text-[var(--faint)]">—:—</p>
        <p className="mt-6 max-w-xs text-sm text-[var(--muted)]">
          Log a few efforts at the {detail.distance_label} and your max-effort projection takes its
          place here.
        </p>
      </div>
    );
  }

  const trendColor =
    trend.tone === "positive"
      ? "text-[var(--success)]"
      : trend.tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";

  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center px-8 py-14 text-center">
      {/* tiny eyebrow — the only thing above the number */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        Max-effort {detail.distance_label}
      </p>

      {/* THE number — the whole reason for the page */}
      <p className="mt-5 text-[5.25rem] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[var(--accent)] sm:text-[6.5rem]">
        {fmtTime(est.seconds)}
      </p>

      {/* the range lives IN the headline, not in a chart */}
      <p className="mt-4 text-lg font-medium tracking-[-0.02em] tabular-nums text-[var(--muted)]">
        {fmtTime(est.lower_seconds)} <span className="text-[var(--faint)]">–</span>{" "}
        {fmtTime(est.upper_seconds)}
      </p>
      {half != null && (
        <p className="mt-1 text-xs text-[var(--faint)]">
          ± {fmtMagnitude(half)} range · {conf.label.toLowerCase()} confidence
        </p>
      )}

      {/* trend as a single quiet tag */}
      {trend.direction !== "none" && (
        <span
          className={`mt-7 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-medium ${trendColor}`}
        >
          <span aria-hidden>{trend.arrow}</span>
          {trend.phrase}
          <span className="text-[var(--faint)]">· 6 wks</span>
        </span>
      )}

      {/* calm strip below: confidence pips + a one-line proof note */}
      <div className="mt-10 flex w-full max-w-sm items-center justify-center gap-2">
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-1 w-12 rounded-full"
            style={{
              backgroundColor: i <= conf.level ? "var(--accent)" : "var(--surface-3)",
            }}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {detail.actual_best ? (
          <>
            Your proof at this distance is{" "}
            <span className="font-medium text-[var(--accent-2)] tabular-nums">
              {fmtTime(detail.actual_best.seconds)}
            </span>{" "}
            — already faster than the projection.
          </>
        ) : (
          <>No logged effort at this distance yet — projected from nearby distances.</>
        )}
      </p>
    </div>
  );
}
