/**
 * StageBar — one night's sleep as a single horizontal STACKED bar: deep, light,
 * REM, awake, left to right, each segment proportional to the night.
 *
 * A stacked bar is the right mark because the question the tile is answering is
 * *composition of a whole* — "what kind of sleep was it" — which is exactly what
 * a part-to-whole mark is for. A four-series line chart would answer a question
 * nobody asked, and four separate bars would lose the "of one night" framing
 * that makes the proportions legible at tile size.
 *
 * Proportions are taken over the stages actually present, not over `inBedMilli`:
 * a night missing one stage should draw the three it has correctly rather than
 * leaving a phantom gap standing in for a field WHOOP never sent. A stage that
 * is null or zero renders NO segment at all — a zero-width sliver carrying a
 * tooltip is unhoverable furniture — and a night with no stage data at all gets
 * the bar's own empty track rather than four NaN widths.
 *
 * Colour is `shared.ts`'s ordinal ramp; this file holds no palette of its own.
 */

import type { SleepNightView } from "@/lib/dashboard";
import {
  STAGE_ORDER,
  type SleepStage,
  formatSleepDuration,
  stageColor,
  stageLabel,
  stageMilli,
} from "./shared";

const TRACK = "flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]";

export function StageBar({ night, className }: { night: SleepNightView; className?: string }) {
  const segments: { stage: SleepStage; ms: number }[] = [];
  for (const stage of STAGE_ORDER) {
    const ms = stageMilli(night, stage);
    if (ms !== null && Number.isFinite(ms) && ms > 0) segments.push({ stage, ms });
  }
  const total = segments.reduce((sum, s) => sum + s.ms, 0);

  if (total <= 0) {
    return (
      <div
        className={`${TRACK} ${className ?? ""}`}
        role="img"
        aria-label="No sleep stages recorded for this night"
      />
    );
  }

  return (
    <div className={`${TRACK} ${className ?? ""}`}>
      {segments.map(({ stage, ms }) => {
        // The name is built once and used for both the pointer affordance
        // (`title`) and the accessible one (`aria-label`), so hover and focus
        // report the same duration rather than drifting apart.
        const label = `${stageLabel(stage)} ${formatSleepDuration(ms)}`;
        return (
          <span
            key={stage}
            data-stage={stage}
            role="img"
            aria-label={label}
            title={label}
            // Focusable so the per-stage duration is not a mouse-only fact.
            tabIndex={0}
            className="h-full focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--accent)]"
            style={{ width: `${(ms / total) * 100}%`, backgroundColor: stageColor(stage) }}
          />
        );
      })}
    </div>
  );
}
