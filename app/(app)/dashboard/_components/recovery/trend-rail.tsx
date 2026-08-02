/**
 * TrendRailCard — the `recovery_trend` tile ("Recovery Trend").
 *
 * Heroes the DIRECTION and deliberately demotes today: one large delta figure
 * — the server 7-day HRV mean (`shortAvg`) against the 30-day baseline
 * (`hrvAvg`), a difference of two server figures, never a re-averaged series —
 * with the trend word beneath and a full-width rail of one mark per day.
 * Marks shade in-band success / out-of-band faint / null blank, and a run of
 * ≥3 consecutive BELOW-band days promotes to warning as a sustained dip
 * (above-band days never warn — elevated is unusual, not alarming). Today is
 * just the last mark, so the headline survives a missing morning webhook.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { hrvStatusColor, signedUnit, trendLabel } from "./shared";

const TITLE = "Recovery Trend";
// Consecutive below-band days that read as a sustained dip.
const RUN_THRESHOLD = 3;

type MarkTone = "in" | "below" | "above" | "run" | "blank";

const MARK_COLOR: Record<MarkTone, string> = {
  in: "var(--success)",
  below: "var(--faint)",
  above: "var(--faint)",
  run: "var(--warning)",
  blank: "var(--surface-2)",
};

export function TrendRailCard({ section, href }: { section: RecoveryView; href: string }) {
  const { days, baseline, hrv } = section;

  if (!days || !baseline || !hrv || baseline.hrvAvg === null || hrv.shortAvg === null) {
    return (
      <MiniCard title={TITLE} href={href}>
        <div className="flex flex-col gap-2 py-1">
          <span className="text-sm font-medium text-[var(--muted)]">Trend calibrating</span>
          <p className="text-[11px] text-[var(--faint)]">
            <span className="font-mono tabular-nums text-[var(--muted)]">
              {baseline?.hrvDays ?? 0} of 14
            </span>{" "}
            nights · the week-over-baseline read needs a baseline first
          </p>
        </div>
      </MiniCard>
    );
  }

  const deltaMs = hrv.shortAvg - baseline.hrvAvg;
  const deltaPct = Math.round((deltaMs / baseline.hrvAvg) * 100);
  const { glyph, word } = trendLabel(hrv.trend);
  const statusColor = hrvStatusColor(hrv.status);

  const marks = days.map((d) => classify(d.hrv, hrv.balancedLow, hrv.balancedHigh));
  promoteSustainedDips(marks, RUN_THRESHOLD);

  return (
    <MiniCard title={TITLE} href={href}>
      {/* The hero: one big delta figure. Today is NOT here. */}
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: statusColor }}
        >
          {glyph} {Math.abs(deltaPct)}%
        </span>
        <span className="font-mono text-sm tabular-nums text-[var(--muted)]">
          {signedUnit(deltaMs, "ms", 1)}
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
            className="h-4 min-w-[2px] flex-1 rounded-[1px]"
            style={{ backgroundColor: MARK_COLOR[tone], opacity: tone === "blank" ? 1 : 0.9 }}
          />
        ))}
      </div>
      <p className="text-[10px] text-[var(--faint)]">
        <span className="inline-flex items-center gap-1">
          <Dot c={MARK_COLOR.in} /> in band
        </span>
        <span className="mx-1.5 inline-flex items-center gap-1">
          <Dot c={MARK_COLOR.below} /> outside
        </span>
        <span className="inline-flex items-center gap-1">
          <Dot c={MARK_COLOR.run} /> sustained dip
        </span>
      </p>
    </MiniCard>
  );
}

function classify(hrv: number | null, low: number | null, high: number | null): MarkTone {
  if (hrv === null) return "blank";
  if (low === null || high === null) return "above";
  if (hrv < low) return "below";
  if (hrv > high) return "above";
  return "in";
}

/** Promote runs of ≥threshold consecutive below-band marks to "run". */
function promoteSustainedDips(marks: MarkTone[], threshold: number) {
  let start = -1;
  for (let i = 0; i <= marks.length; i++) {
    if (i < marks.length && marks[i] === "below") {
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
