"use client";

import { useDistanceUnit } from "@/lib/distance-unit-context";

/**
 * Per-week rollups shown beside the calendar grid. The month grid is six
 * Monday-started weeks; this column places one compact tile next to each
 * week row (at md+) so a user can read "what did this week look like"
 * without scanning the cells. On narrow screens the same data renders as
 * a single-line chip above each week instead (see WeeklyChip / the page).
 */
export type WeeklyStat = {
  weekStart: Date;
  activities: number;
  liftMinutes: number;
  runMeters: number;
  steps: number;
};

/** Thousands-separated step count, e.g. 52340 → "52,340". */
function formatSteps(steps: number): string {
  return steps.toLocaleString("en-US");
}

/**
 * Total duration as `Xh Ym`, `Xh`, or `Ym`; "0h" for non-positive.
 * keep in sync with page.tsx (formatTotalDuration there) — page.tsx
 * doesn't export it, so this private copy mirrors its logic exactly.
 */
function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return "0h";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Local-date key in `YYYY-M-D` form. Mirrors localDateKey in page.tsx so
 * the "is this the current week" check buckets days the same way the grid
 * does — local-tz, since the user's notion of "today" is local.
 */
function weekKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Compact card summarizing one week, meant to sit beside a calendar week
 * row. Sessions always shows; lift/run rows are omitted when zero so a
 * lift-only or run-only week doesn't carry empty lines.
 */
export function WeeklyTile({ week, isCurrent }: { week: WeeklyStat; isCurrent: boolean }) {
  const { formatDistance, unitLabel } = useDistanceUnit();
  const borderClass = isCurrent ? "border-[var(--accent)]" : "border-[var(--border)]";
  return (
    <div
      data-testid="weekly-tile"
      data-current={isCurrent ? "true" : undefined}
      className={`flex min-h-[88px] flex-col gap-0.5 rounded-md border ${borderClass} bg-[var(--surface)] px-2 py-1.5 text-xs`}
    >
      <WeeklyRow
        label="Sessions"
        value={`${week.activities} ${week.activities === 1 ? "activity" : "activities"}`}
      />
      {week.liftMinutes > 0 && (
        <WeeklyRow label="Lift" value={formatTotalDuration(week.liftMinutes)} />
      )}
      {week.runMeters > 0 && (
        <WeeklyRow label="Run" value={`${formatDistance(week.runMeters)} ${unitLabel}`} />
      )}
      {week.steps > 0 && <WeeklyRow label="Steps" value={formatSteps(week.steps)} />}
    </div>
  );
}

function WeeklyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</span>
      <span className="tabular-nums text-[var(--foreground)]">{value}</span>
    </div>
  );
}

/**
 * Single-line horizontal summary of a week, used above each week row on
 * small screens where the side column is hidden. Same data as WeeklyTile,
 * omitting zero values, joined inline with a middle dot.
 */
export function WeeklyChip({ week, isCurrent }: { week: WeeklyStat; isCurrent: boolean }) {
  const { formatDistance, unitLabel } = useDistanceUnit();
  const parts: string[] = [
    `${week.activities} ${week.activities === 1 ? "activity" : "activities"}`,
  ];
  if (week.liftMinutes > 0) parts.push(formatTotalDuration(week.liftMinutes));
  if (week.runMeters > 0) parts.push(`${formatDistance(week.runMeters)} ${unitLabel}`);
  if (week.steps > 0) parts.push(`${formatSteps(week.steps)} steps`);
  const toneClass = isCurrent
    ? "border-[var(--accent)] text-[var(--accent)]"
    : "border-[var(--border)] text-[var(--muted)]";
  return (
    <div
      data-testid="weekly-chip"
      data-current={isCurrent ? "true" : undefined}
      className={`rounded-md border ${toneClass} bg-[var(--surface)] px-2 py-1 text-xs tabular-nums`}
    >
      {parts.join(" · ")}
    </div>
  );
}

/**
 * Vertical stack of WeeklyTile, one per week, aligned beside the grid at
 * md+. Hidden below md — the chip variant is rendered separately by the
 * page for `<md`. A week is "current" when todayKey matches any of its
 * seven local-date keys.
 */
export function WeeklyOverviewColumn({
  weeks,
  todayKey,
}: {
  weeks: WeeklyStat[];
  todayKey: string;
}) {
  return (
    <div className="hidden md:flex md:flex-col md:gap-1">
      {weeks.map((week) => {
        let isCurrent = false;
        for (let i = 0; i < 7; i++) {
          const d = new Date(
            week.weekStart.getFullYear(),
            week.weekStart.getMonth(),
            week.weekStart.getDate() + i,
          );
          if (weekKey(d) === todayKey) {
            isCurrent = true;
            break;
          }
        }
        return <WeeklyTile key={weekKey(week.weekStart)} week={week} isCurrent={isCurrent} />;
      })}
    </div>
  );
}
