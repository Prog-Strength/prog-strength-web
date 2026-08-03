/**
 * LoadRampCard — the `running` tile, rewritten ("Training Load").
 *
 * Heroes the DIRECTION and deliberately demotes this week's total: one large
 * signed figure for this week's time on feet against the 4-week baseline — a
 * signed delta of two server figures, the only client arithmetic the SOW
 * permits — with the plain-language read beneath and an 8-bucket neutral
 * rail of weekly load with the baseline as a ghost line through it. The
 * strongest size contrast in the family: one big numeral over a small rail.
 *
 * Status carries the delta and NOTHING else — success for a steady build,
 * warning above +10%/week (a big week is a choice, not a failure: never
 * danger red), muted for resting/easing; the rail stays neutral ink. A nil
 * baseline (first week ever) prints the week's own time on feet with "first
 * week" beneath and no percentage — no NaN, no +Infinity%. The zero-run week
 * renders "−100% · resting" with the last run stated and dated, never
 * promoted into this week's slot.
 */

import type { RunningView } from "@/lib/dashboard";
import { formatDuration } from "@/lib/format";
import { MiniCard } from "../mini-card";
import { loadStatus, loadStatusColor, signedPct, type LoadStatus } from "./shared";

const TITLE = "Training Load";

export function LoadRampCard({ section, href }: { section: RunningView; href: string }) {
  const { currentWeek, baseline, weeklyLoad } = section;

  // A zero-duration baseline cannot anchor a ramp — treated as no baseline.
  const baselineDuration =
    baseline?.durationSeconds != null && baseline.durationSeconds > 0
      ? baseline.durationSeconds
      : null;
  const deltaPct =
    baselineDuration === null
      ? null
      : ((currentWeek.durationSeconds - baselineDuration) / baselineDuration) * 100;
  const status = loadStatus(deltaPct ?? 0, currentWeek.runCount);
  const heroColor = deltaPct === null ? "var(--foreground)" : loadStatusColor(status);

  // Scale to max(weeklyLoad ∪ baseline) so the ghost line is always on canvas.
  const railMax = Math.max(
    ...weeklyLoad.map((p) => p.durationSeconds),
    baselineDuration ?? 0,
    currentWeek.durationSeconds,
    1,
  );

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color: heroColor }}
        >
          {deltaPct === null ? formatDuration(currentWeek.durationSeconds) : signedPct(deltaPct)}
        </span>
      </div>
      <p className="-mt-1 text-xs text-[var(--muted)]">
        {caption(section, deltaPct, baselineDuration, status)}
      </p>

      <div
        className="relative mt-1 flex h-8 items-end gap-[3px]"
        role="img"
        aria-label="Eight weeks of running load with your four-week average"
      >
        {weeklyLoad.map((p) => (
          <span
            key={p.weekStart}
            className="flex-1 rounded-[1px]"
            style={
              p.durationSeconds > 0
                ? {
                    // Floored so a light week is still a visible bar, not a sliver.
                    height: `${Math.max(10, Math.round((p.durationSeconds / railMax) * 100))}%`,
                    backgroundColor: "var(--faint)",
                  }
                : // A zero week is a REAL zero: a 2px stub, not a missing bar.
                  { height: "2px", backgroundColor: "var(--surface-2)" }
            }
          />
        ))}
        {baselineDuration !== null && (
          <span
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-[var(--muted)]"
            style={{ bottom: `${Math.min(98, Math.round((baselineDuration / railMax) * 100))}%` }}
          />
        )}
      </div>
    </MiniCard>
  );
}

/** Plain-language read under the hero — one honest line per SOW state. */
function caption(
  section: RunningView,
  deltaPct: number | null,
  baselineDuration: number | null,
  status: LoadStatus,
): string {
  const { currentWeek, latestRun, unit } = section;
  if (currentWeek.runCount === 0) {
    const last = latestRun
      ? ` · last run ${latestRun.distance} ${unit}, ${runDay(latestRun.startTime)}`
      : "";
    return `resting${last}`;
  }
  if (deltaPct === null || baselineDuration === null) {
    return "first week";
  }
  return `${status} · ${formatDuration(currentWeek.durationSeconds)} vs ${formatDuration(baselineDuration)} avg`;
}

/** Short dated label for the latest run ("Aug 1") — pure function of props. */
function runDay(startTime: string): string {
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
