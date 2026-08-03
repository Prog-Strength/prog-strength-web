/**
 * DX variant — idiom: `week-log` · proposed title: `Runs This Week`.
 * THROWAWAY MOCKUP — never promote as-is.
 *
 * Heroes THE RUNS THEMSELVES. No headline numeral at all — a dense blotter of
 * this week's runs as dated rows (day · distance · pace · HR) under a quiet
 * caption header. Borrows Strava's activity-feed row and Robinhood's list
 * density. A treadmill run carries a small indoor glyph; a run with no HR
 * shows an em-dash in that column only.
 *
 * Type scale: small functional tabular rows, mono figures, NO numeral above
 * 14px — the flattest type on the grid and the strongest contrast with
 * today's BigNum card. Color logic: near-monochrome ink; sage is spent
 * entirely on the per-row pace figure — bright when that run beat the 4-week
 * baseline pace, faint when it did not. Spacing: tight vertical rhythm,
 * hairline row separation, near-zero gutters.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { formatDuration } from "@/lib/format";
import {
  formatDistanceValue,
  formatPaceValue,
  type DistanceUnit,
} from "@/lib/distance-unit-context";
import { weekdayShort, type DxRunningFixture, type DxWeekRun } from "./fixtures";

const HREF = "/activities?view=running";
const MAX_ROWS = 4; // beyond this the oldest collapse into "+N earlier"

export function WeekLogCard({ data, unit }: { data: DxRunningFixture; unit: DistanceUnit }) {
  const { currentWeek: wk, baseline } = data;
  const baselinePace = baseline?.avgPaceSecPerKm ?? null;

  // Newest first — the row you just ran is the row you came to see.
  const rows = [...data.weekRuns].reverse();
  const shown = rows.slice(0, MAX_ROWS);
  const earlier = rows.length - shown.length;

  return (
    <MiniCard title="Runs This Week" href={HREF}>
      {/* Quiet week-total header — the total is a caption here, not a hero. */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">this week</span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
          {wk.runCount === 0 ? (
            baseline?.distanceMeters != null ? (
              <>
                4-wk avg {formatDistanceValue(baseline.distanceMeters, unit)} {unit}
              </>
            ) : (
              <>no runs yet</>
            )
          ) : (
            <>
              {formatDistanceValue(wk.distanceMeters, unit)} {unit} · {wk.runCount}{" "}
              {wk.runCount === 1 ? "run" : "runs"} · {formatDuration(wk.durationSeconds)}
            </>
          )}
        </span>
      </div>

      {wk.runCount === 0 ? (
        <div className="flex flex-col gap-1 py-1">
          <span className="text-xs italic text-[var(--faint)]">no runs yet this week</span>
          {data.latestRun && (
            <span className="font-mono text-xs tabular-nums text-[var(--muted)]">
              last run {weekdayShort(data.latestRun.localDate)} ·{" "}
              {formatDistanceValue(data.latestRun.distanceMeters, unit)} {unit}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {shown.map((r) => (
            <LogRow
              key={r.localDate + r.distanceMeters}
              run={r}
              unit={unit}
              baselinePace={baselinePace}
            />
          ))}
          {earlier > 0 && (
            <div className="py-1 text-[11px] text-[var(--faint)]">+{earlier} earlier</div>
          )}
        </div>
      )}
    </MiniCard>
  );
}

/** One run row: day · distance · pace · HR. Sage lives ONLY on the pace. */
function LogRow({
  run,
  unit,
  baselinePace,
}: {
  run: DxWeekRun;
  unit: DistanceUnit;
  baselinePace: number | null;
}) {
  const beatBaseline =
    run.avgPaceSecPerKm !== null && baselinePace !== null
      ? run.avgPaceSecPerKm < baselinePace // lower sec/km = faster
      : null;
  const paceColor =
    beatBaseline === null
      ? "var(--muted)"
      : beatBaseline
        ? "var(--discipline-run-fg)"
        : "var(--discipline-run-dot)";

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="flex w-14 items-center gap-1 font-mono text-xs text-[var(--muted)]">
        {weekdayShort(run.localDate)}
        {run.environment === "indoor" && (
          <>
            <span aria-hidden="true" title="indoor" className="text-[var(--faint)]">
              ⌂
            </span>
            <span className="sr-only">indoor</span>
          </>
        )}
      </span>
      <div className="flex items-center font-mono text-xs tabular-nums">
        <span className="w-16 text-right text-[var(--foreground)]">
          {formatDistanceValue(run.distanceMeters, unit)} {unit}
        </span>
        <span
          className="w-14 text-right"
          style={{ color: paceColor, opacity: beatBaseline === false ? 0.66 : 1 }}
        >
          {formatPaceValue(run.avgPaceSecPerKm, unit)}
        </span>
        <span className="w-10 text-right text-[var(--muted)]">
          {run.avgHeartRateBpm !== null ? run.avgHeartRateBpm : "—"}
        </span>
      </div>
    </div>
  );
}
