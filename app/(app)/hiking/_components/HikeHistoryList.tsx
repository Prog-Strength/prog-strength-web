"use client";

import { useMemo } from "react";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatHours, formatWeekRangeFromMonday } from "@/lib/chart-format";
import {
  groupRunsByMonthAndWeek,
  monthLabel,
  weekLabel,
  type RunMonthGroup,
  type RunWeekGroup,
} from "@/lib/run-history-grouping";
import type { RunningSession } from "@/lib/api";
import { HikeListRow } from "./HikeListRow";

/**
 * The hike-history list, mirroring the Running view's month/week-grouped
 * history but tuned for hikes: the per-week/-month totals surface distance
 * and time (the hike-relevant rollups), and each week's rows show vertical
 * gain instead of pace. Grouping reuses the shared `run-history-grouping`
 * helpers — the data model is the unified `RunningSession`, so hikes bucket
 * by Monday-anchored week and (multi-month windows) month exactly as runs do.
 */
export function HikeHistoryList({ sessions }: { sessions: RunningSession[] }) {
  const months = useMemo(() => groupRunsByMonthAndWeek(sessions), [sessions]);
  // Only divide by month once the window actually spans more than one.
  const showMonths = months.length > 1;

  return (
    <div className="flex flex-col gap-10">
      {months.map((month) => (
        <div key={month.monthKey} className="flex flex-col gap-6">
          {showMonths && <MonthDivider group={month} />}
          <div className="flex flex-col gap-8">
            {month.weeks.map((week) => (
              <WeekSection key={week.mondayKey} group={week} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MonthDivider({ group }: { group: RunMonthGroup }) {
  const { formatDistance, unitLabel } = useDistanceUnit();
  return (
    <div className="flex items-center gap-3">
      <h2 className="shrink-0 text-sm font-semibold tracking-tight">
        {monthLabel(group.monthStart)}
      </h2>
      <span className="text-xs tabular-nums text-[var(--muted)]">
        {formatDistance(group.meters)} {unitLabel} · {formatHours(group.durationSec / 60)} ·{" "}
        {group.count} {group.count === 1 ? "hike" : "hikes"}
      </span>
      <span className="h-px flex-1 bg-[var(--border)]" aria-hidden="true" />
    </div>
  );
}

function WeekSection({ group }: { group: RunWeekGroup }) {
  return (
    <section className="flex flex-col gap-3">
      <WeekHeader group={group} />
      <ul className="flex flex-col gap-2">
        {group.runs.map((s) => (
          <HikeListRow key={s.id} session={s} />
        ))}
      </ul>
    </section>
  );
}

function WeekHeader({ group }: { group: RunWeekGroup }) {
  const { formatDistance, unitLabel } = useDistanceUnit();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-tight">{weekLabel(group.monday)}</h3>
        <span className="text-xs text-[var(--muted)]">
          {formatWeekRangeFromMonday(group.monday)}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Distance" value={`${formatDistance(group.meters)} ${unitLabel}`} />
        <StatTile label="Time" value={formatHours(group.durationSec / 60)} />
        <StatTile label="Hikes" value={String(group.count)} />
      </div>
    </div>
  );
}

// Local label/value tile — matches RunHistoryList's week-header tile.
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}
