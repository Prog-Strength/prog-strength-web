"use client";

import { useDistanceUnit } from "@/lib/distance-unit-context";

/**
 * Slim per-week rollup cell — one row of the weekly rail that sits BESIDE the
 * calendar card, not inside it. The rail is its own bordered card separated by
 * a real gutter, because as an 8th column of the month grid the rollup read as
 * an eighth weekday; the gap is the whole point of the treatment. Row alignment
 * with the calendar survives the split because both cards are row-spanning
 * children of one outer grid using `grid-template-rows: subgrid`, so a week row
 * that grows taller takes its rollup with it.
 *
 * Each cell carries that week's session count, run distance, lift time, and
 * steps as label/value pairs. The labels are words, not pictographs: an earlier
 * cut leaned on emoji as the label, which read as tacky and left the numbers
 * ambiguous the moment the emoji were removed. The trained-days ratio is gone
 * too — the calendar beside it already shows which days were trained, so the
 * ratio was restating its neighbour.
 */

/** One day's marks within a week: whether it's in the cursor month and trained. */
export type DayMark = { inMonth: boolean; trained: boolean };

export type WeeklyStat = {
  weekStart: Date;
  activities: number;
  liftMinutes: number;
  runMeters: number;
  steps: number;
  /** Seven entries, Monday→Sunday, aligned with the week's day cells. */
  days: DayMark[];
};

/** Thousands-separated step count, e.g. 52340 → "52,340". */
function formatSteps(steps: number): string {
  return steps.toLocaleString("en-US");
}

/**
 * Total duration as `Xh Ym`, `Xh`, or `Ym`; "0h" for non-positive. Kept in
 * sync with page.tsx's formatTotalDuration (page.tsx doesn't export it).
 */
export function formatTotalDuration(minutes: number): string {
  if (minutes <= 0) return "0h";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * One week's rollup cell. Metrics with a zero value are omitted so a rest week
 * reads as intentional rest rather than a wall of zeroes; a week with nothing at
 * all collapses to an em dash. Steps are shown independently of session count —
 * a day of passive walking with no logged session is still a real number.
 *
 * The separating rule lives on each cell's top edge (not on a row wrapper),
 * because the cells are flat children of a subgrid rail with no per-row element
 * to hang a border on. The current week gets a quiet stronger hairline — never
 * violet, which is reserved for today/selected.
 */
export function WeekColumn({ week, isCurrent }: { week: WeeklyStat; isCurrent: boolean }) {
  const { formatDistance, unitLabel } = useDistanceUnit();

  const sessions =
    week.activities > 0
      ? `${week.activities} ${week.activities === 1 ? "session" : "sessions"}`
      : null;

  const metrics: { key: string; label: string; value: string }[] = [];
  if (week.runMeters > 0)
    metrics.push({
      key: "run",
      label: "Run",
      value: `${formatDistance(week.runMeters)} ${unitLabel}`,
    });
  if (week.liftMinutes > 0)
    metrics.push({ key: "lift", label: "Lift", value: formatTotalDuration(week.liftMinutes) });
  if (week.steps > 0)
    metrics.push({ key: "steps", label: "Steps", value: formatSteps(week.steps) });

  const empty = sessions === null && metrics.length === 0;
  const borderClass = isCurrent ? "border-[var(--border-strong)]" : "border-[var(--border)]";

  // Screen readers get the same facts as one sentence rather than a column of
  // orphaned label/value fragments.
  const spoken = empty
    ? "no activity"
    : [sessions, ...metrics.map((m) => `${m.label} ${m.value}`)].filter(Boolean).join(", ");

  return (
    <div
      data-testid="week-column"
      data-current={isCurrent ? "true" : undefined}
      aria-label={`Week of ${week.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}: ${spoken}`}
      className={`flex flex-col gap-1 border-t ${borderClass} px-2.5 py-2 text-[10px] leading-tight`}
    >
      {empty ? (
        <span className="text-[var(--faint)]">—</span>
      ) : (
        <>
          {sessions && (
            <span className="font-semibold tabular-nums text-[var(--foreground)]">{sessions}</span>
          )}
          {metrics.map((m) => (
            <div key={m.key} className="flex items-baseline justify-between gap-1.5">
              <span className="text-[var(--muted)]">{m.label}</span>
              <span className="truncate tabular-nums text-[var(--foreground)]">{m.value}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
