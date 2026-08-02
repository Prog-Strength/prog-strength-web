/**
 * VARIANT — trend-rail  ·  Proposed title: "Recovery Trend"
 * Idiom: HEROES THE DIRECTION, DEMOTES TODAY. Draws on ROBINHOOD's delta-figure
 * headline with the GITHUB contribution row's spatial-consistency read. One
 * large delta figure — the 7-day HRV mean (`shortAvg`) against the 30-day
 * baseline (`hrvAvg`) — with the trend word beneath. Under it, a full-width rail
 * of day marks, each shaded by whether that day sat inside or outside the band;
 * gaps left blank. Today is just the last mark, not the headline.
 *
 * The only variant whose primary figure is still meaningful when today has no
 * reading — the week's direction survives a missing morning webhook.
 *
 * Type scale: one big delta numeral over a tiny rail — the strongest size
 * contrast in the spread. Color logic: status on the delta figure; per-mark
 * in-band shading in success, out-of-band muted, warning for a sustained run
 * below. Spacing: one figure stacked over a single full-width rail, no columns.
 *
 * Throwaway DX mockup — self-contained, no shared abstraction by design.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard } from "../_shell";
import { hrvStatusColor, trendLabel } from "../_util";

const TITLE = "Recovery Trend";
const RUN_THRESHOLD = 3; // consecutive below-band days that read as a sustained dip

export function TrendRail({ view }: { view: RecoveryView }) {
  const { days, baseline, hrv } = view;

  if (!days || !baseline || !hrv || baseline.hrvAvg === null || hrv.shortAvg === null) {
    return (
      <MockCard title={TITLE}>
        <div className="flex flex-col gap-2 py-1">
          <span className="text-sm font-medium text-[var(--muted)]">Trend calibrating</span>
          <p className="text-[11px] text-[var(--faint)]">
            <span className="font-mono tabular-nums text-[var(--muted)]">
              {baseline?.hrvDays ?? 0} of 14
            </span>{" "}
            nights · the week-over-baseline read needs a baseline first
          </p>
        </div>
      </MockCard>
    );
  }

  const deltaMs = hrv.shortAvg - baseline.hrvAvg;
  const deltaPct = Math.round((deltaMs / baseline.hrvAvg) * 100);
  const { glyph, word } = trendLabel(hrv.trend);
  const statusColor = hrvStatusColor(hrv.status);

  // Per-mark tone: shade by in/out of band; a sustained run below reads warning.
  const low = hrv.balancedLow;
  const high = hrv.balancedHigh;
  const marks = days.map((d) => classify(d.hrv, low, high));
  markSustainedRuns(marks, RUN_THRESHOLD);

  return (
    <MockCard title={TITLE}>
      {/* The hero: one big delta figure. Today is NOT here. */}
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: statusColor }}
        >
          {glyph} {Math.abs(deltaPct)}%
        </span>
        <span className="font-mono text-sm tabular-nums text-[var(--muted)]">
          {deltaMs > 0 ? "+" : "−"}
          {Math.abs(deltaMs).toFixed(1)} ms
        </span>
      </div>
      <p className="-mt-1 text-xs text-[var(--muted)]">
        7-day HRV {word} · vs 30-day baseline{" "}
        <span className="font-mono tabular-nums">{Math.round(baseline.hrvAvg)} ms</span>
      </p>

      {/* Full-width rail of day marks — spatial consistency, gaps blank. */}
      <div
        className="mt-1 flex items-end gap-[2px]"
        role="img"
        aria-label="Thirty days in or out of your balanced band"
      >
        {marks.map((tone, i) => (
          <span
            key={i}
            className="h-4 flex-1 rounded-[1px]"
            style={{ backgroundColor: MARK_COLOR[tone], opacity: tone === "blank" ? 1 : 0.9 }}
          />
        ))}
      </div>
      <p className="text-[10px] text-[var(--faint)]">
        <span className="inline-flex items-center gap-1">
          <Dot c={MARK_COLOR.in} /> in band
        </span>
        <span className="mx-1.5 inline-flex items-center gap-1">
          <Dot c={MARK_COLOR.out} /> outside
        </span>
        <span className="inline-flex items-center gap-1">
          <Dot c={MARK_COLOR.run} /> sustained dip
        </span>
      </p>
    </MockCard>
  );
}

type MarkTone = "in" | "out" | "run" | "blank";

const MARK_COLOR: Record<MarkTone, string> = {
  in: "var(--success)",
  out: "var(--faint)",
  run: "var(--warning)",
  blank: "var(--surface-2)",
};

function classify(hrv: number | null, low: number | null, high: number | null): MarkTone {
  if (hrv === null) return "blank";
  if (low === null || high === null) return "out";
  return hrv >= low && hrv <= high ? "in" : "out";
}

/** Promote runs of ≥threshold consecutive below-band ("out") marks to "run". */
function markSustainedRuns(marks: MarkTone[], threshold: number) {
  let start = -1;
  for (let i = 0; i <= marks.length; i++) {
    if (i < marks.length && marks[i] === "out") {
      if (start === -1) start = i;
    } else {
      if (start !== -1 && i - start >= threshold) {
        for (let j = start; j < i; j++) marks[j] = "run";
      }
      start = -1;
    }
  }
}

function Dot({ c }: { c: string }) {
  return (
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-[1px]" style={{ backgroundColor: c }} />
  );
}
