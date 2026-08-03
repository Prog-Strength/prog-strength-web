/**
 * WeekLogCard — the `running_log` tile ("Runs This Week").
 *
 * Heroes the RUNS THEMSELVES: no numeral above 14px — the flattest type on
 * the grid and the strongest possible contrast with the old BigNum card. A
 * quiet caption header (total · runs · time) over dated tabular rows,
 * hairline-divided, mono figures. Sage is spent ENTIRELY on the per-row pace
 * — brighter when that run beat the 4-week baseline pace (a comparison of
 * two server figures), faint when it did not. An indoor run carries a glyph
 * rather than a blank column; a run with no HR shows an em-dash in that
 * column only. More than four runs collapses the oldest into "+N earlier"
 * rather than growing the card. Zero runs renders the last run's row under a
 * "no runs this week" caption, short-dated so last week is never mistaken
 * for this one.
 */

import type { RunningView, RunningWeekRunView } from "@/lib/dashboard";
import { formatDuration } from "@/lib/format";
import { MiniCard } from "../mini-card";
import { weekdayLabel } from "./shared";

const TITLE = "Runs This Week";
// Row ceiling keeping a heavy week inside the ~180px budget (SOW OQ 7).
const MAX_ROWS = 4;

export function WeekLogCard({ section, href }: { section: RunningView; href: string }) {
  const { currentWeek, weekRuns, baseline, latestRun, unit } = section;

  if (weekRuns.length === 0) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-xs text-[var(--muted)]">no runs this week</p>
        {latestRun ? (
          <div className="flex items-baseline gap-2 border-t border-[var(--border)] pt-1.5 font-mono text-xs tabular-nums">
            <span className="text-[var(--muted)]">{shortDate(latestRun.startTime)}</span>
            <span className="flex-1 text-[var(--foreground)]">
              {latestRun.distance} {unit}
            </span>
            <span className="text-[10px] text-[var(--faint)]">last run</span>
          </div>
        ) : (
          <p className="text-xs text-[var(--faint)]">Log a run to fill this in.</p>
        )}
      </MiniCard>
    );
  }

  const newestFirst = [...weekRuns].reverse();
  const visible = newestFirst.slice(0, MAX_ROWS);
  const earlier = newestFirst.length - visible.length;

  return (
    <MiniCard title={TITLE} href={href}>
      <p className="text-xs text-[var(--muted)]">
        {`${currentWeek.distance} ${unit} · ${currentWeek.runCount} ${
          currentWeek.runCount === 1 ? "run" : "runs"
        } · ${formatDuration(currentWeek.durationSeconds)}`}
      </p>
      <div className="flex flex-col">
        {visible.map((r) => (
          <Row
            key={r.activityId}
            run={r}
            unit={unit}
            baselinePace={baseline?.paceSecPerKm ?? null}
          />
        ))}
        {earlier > 0 && (
          <p className="pt-1 font-mono text-[10px] text-[var(--faint)]">+{earlier} earlier</p>
        )}
      </div>
    </MiniCard>
  );
}

function Row({
  run,
  unit,
  baselinePace,
}: {
  run: RunningWeekRunView;
  unit: string;
  baselinePace: number | null;
}) {
  return (
    <div className="flex items-baseline gap-2 border-t border-[var(--border)] py-1 font-mono text-xs tabular-nums first:border-t-0">
      <span className="w-8 shrink-0 text-[var(--muted)]">{weekdayLabel(run.localDate)}</span>
      <span className="flex-1 text-[var(--foreground)]">
        {run.distance} {unit}
      </span>
      {run.indoor && (
        <span aria-label="indoor run" title="indoor" className="text-[10px] text-[var(--faint)]">
          ⌂
        </span>
      )}
      <span style={{ color: paceColor(run, baselinePace) }}>{run.pace}</span>
      <span className="w-7 shrink-0 text-right text-[var(--muted)]">{run.avgHeartRate ?? "—"}</span>
    </div>
  );
}

/** Sage lives here and only here: brighter when the run beat the baseline. */
function paceColor(run: RunningWeekRunView, baselinePace: number | null): string {
  if (run.paceSecPerKm === null) return "var(--discipline-run-dot)";
  if (baselinePace !== null && run.paceSecPerKm < baselinePace) {
    return "var(--discipline-run-fg)";
  }
  return "var(--discipline-run-dot)";
}

/** Short local date ("Aug 1") for the zero-week last-run row. */
function shortDate(startTime: string): string {
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
