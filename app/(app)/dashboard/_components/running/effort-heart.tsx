/**
 * EffortHeartCard — the `running_effort` tile ("Run Effort").
 *
 * Heroes HEART RATE: the week's duration-weighted bpm as a medium numeral
 * with "+3 vs 4-wk" beside it (a signed delta of two server figures), over a
 * horizontal rail of one dot per HR-bearing run — positioned by bpm, colored
 * by the server-classified HeartRateZone (the ONLY surface in the family
 * spending --zone-1..5; no sage on this card at all, which is what stops it
 * looking like its siblings), and sized by duration with a clamped legible
 * minimum so the long run reads bigger without turning shakeouts into dust.
 *
 * Honesty rules: coverage is stated ("3 of 4 runs") whenever a run lacks HR;
 * the copy says "mostly zone N runs" and NEVER claims minutes-in-zone (the
 * classification is per-run average HR, not a trackpoint scan); nil zones
 * (engine unwired / reference read failed) degrade to neutral-ink dots with
 * the bpm figures intact.
 */

import type { RunningView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { coverageCaption, signed, zoneToken } from "./shared";

const TITLE = "Run Effort";
const DOT_MIN_PX = 8;
const DOT_MAX_PX = 16;

export function EffortHeartCard({ section, href }: { section: RunningView; href: string }) {
  const { currentWeek, weekRuns, baseline } = section;

  if (currentWeek.runCount === 0) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">no runs this week</p>
        {baseline?.avgHeartRate != null && (
          <p className="text-[11px] text-[var(--faint)]">
            4-wk average <span className="font-mono tabular-nums">{baseline.avgHeartRate}</span> bpm
          </p>
        )}
      </MiniCard>
    );
  }

  const hrRuns = weekRuns.filter((r) => r.avgHeartRate !== null);
  if (currentWeek.avgHeartRate === null || hrRuns.length === 0) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">
          {currentWeek.runCount} {currentWeek.runCount === 1 ? "run" : "runs"}
        </p>
        <p className="text-[11px] text-[var(--faint)]">no heart-rate data this week</p>
      </MiniCard>
    );
  }

  const delta =
    baseline?.avgHeartRate != null ? currentWeek.avgHeartRate - baseline.avgHeartRate : null;

  const bpms = hrRuns.map((r) => r.avgHeartRate as number);
  const minBpm = Math.min(...bpms);
  const bpmSpan = Math.max(1, Math.max(...bpms) - minBpm);
  const maxDur = Math.max(...hrRuns.map((r) => r.durationSeconds), 1);

  const zones = hrRuns.map((r) => r.heartRateZone).filter((z): z is number => z !== null);
  // "mostly" needs at least two classified runs — n = 1 must not imply a
  // distribution (SOW state matrix).
  const modalZone = zones.length > 1 ? mode(zones) : null;

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {currentWeek.avgHeartRate}
        </span>
        <span className="text-xs text-[var(--muted)]">bpm avg</span>
        {delta !== null && (
          <span className="font-mono text-sm tabular-nums text-[var(--muted)]">
            {signed(delta)} vs 4-wk
          </span>
        )}
      </div>

      {/* One dot per HR-bearing run on a bpm axis; a single run sits centered. */}
      <div
        className="relative mt-2 h-5 border-b border-[var(--border)]"
        role="img"
        aria-label="This week's runs by average heart rate"
      >
        {hrRuns.map((r) => {
          const bpm = r.avgHeartRate as number;
          const left = hrRuns.length === 1 ? 50 : 8 + ((bpm - minBpm) / bpmSpan) * 84;
          const size =
            DOT_MIN_PX + Math.round((r.durationSeconds / maxDur) * (DOT_MAX_PX - DOT_MIN_PX));
          return (
            <span
              key={r.activityId}
              data-testid="effort-dot"
              className="absolute bottom-0 translate-x-[-50%] rounded-full"
              style={{
                left: `${left}%`,
                width: `${size}px`,
                height: `${size}px`,
                backgroundColor: zoneToken(r.heartRateZone),
              }}
            />
          );
        })}
      </div>

      <p className="text-[11px] text-[var(--faint)]">
        {modalZone !== null ? `mostly zone ${modalZone} runs · ` : ""}
        {currentWeek.heartRateRuns < currentWeek.runCount
          ? coverageCaption(currentWeek.heartRateRuns, currentWeek.runCount)
          : `${currentWeek.runCount} ${currentWeek.runCount === 1 ? "run" : "runs"}`}
      </p>
    </MiniCard>
  );
}

/** Most frequent value; ties resolve to the highest zone seen among the tied.
 * Caller contract: `xs` must be non-empty (only called when zones.length > 1). */
function mode(xs: number[]): number {
  const counts = new Map<number, number>();
  for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
  let best = xs[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount || (count === bestCount && value > best)) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}
