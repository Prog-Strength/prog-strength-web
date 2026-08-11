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
 *
 * ACCESSIBILITY follows the sibling data graphics (`recovery/trend-rail.tsx`,
 * `recovery/balance-band.tsx`): ONE `role="img"` with a summary label on the
 * track, and plain spans for the marks. The whole tile is a link, so making
 * every segment focusable would spend four tab stops on which Enter does
 * nothing.
 *
 * The per-segment `title` is therefore the POINTER affordance and nothing more
 * — a `title` never reaches a keyboard-only sighted user. The durations proper
 * are printed in the tile's legend (`sleep-tile.tsx`), which every user sees
 * whatever they are driving; the track's summary label carries them for a
 * screen reader. Nothing about a stage's duration is behind hover alone.
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
  const segments: { stage: SleepStage; ms: number; label: string }[] = [];
  for (const stage of STAGE_ORDER) {
    const ms = stageMilli(night, stage);
    // The name is built once and used for both the pointer affordance (`title`)
    // and the accessible one (the track's summary), so hover and screen reader
    // report the same duration rather than drifting apart.
    if (ms !== null && Number.isFinite(ms) && ms > 0)
      segments.push({ stage, ms, label: `${stageLabel(stage)} ${formatSleepDuration(ms)}` });
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
    <div
      className={`${TRACK} ${className ?? ""}`}
      role="img"
      aria-label={`Sleep stages: ${segments.map((s) => s.label).join(", ")}`}
    >
      {segments.map(({ stage, ms, label }) => (
        <span
          key={stage}
          data-stage={stage}
          // Hover keeps its per-stage duration as a convenience; the readable
          // copies live in the track's one label above and in the legend.
          title={label}
          aria-hidden="true"
          className="h-full"
          style={{ width: `${(ms / total) * 100}%`, backgroundColor: stageColor(stage) }}
        />
      ))}
    </div>
  );
}
