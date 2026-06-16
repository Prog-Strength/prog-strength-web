"use client";

import { useDistanceUnit } from "@/lib/distance-unit-context";
import { weekStreakCopy } from "@/components/calendar/derivations";

/**
 * Per-week consistency summary shown as the footer of each week panel. The
 * month grid is six Monday-started weeks; one streak strip sits beneath each
 * week's seven day cells, reframing the old right-column rollup as a coaching
 * line: seven trained/untrained dots, "You trained N of M days" (or a gentle
 * rest-week line), and compact lift/run/steps metric labels.
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
 * One week's streak strip. Trained/total are derived from the in-month days
 * in `week.days` (out-of-month leading/trailing days don't count toward the
 * total and read de-emphasized). The current week gets a warm-accent border.
 */
export function WeekStreakStrip({ week, isCurrent }: { week: WeeklyStat; isCurrent: boolean }) {
  const { formatDistance, unitLabel } = useDistanceUnit();
  const trained = week.days.filter((d) => d.inMonth && d.trained).length;
  const total = week.days.filter((d) => d.inMonth).length;

  const metrics: string[] = [];
  if (week.liftMinutes > 0) metrics.push(`🏋 ${formatTotalDuration(week.liftMinutes)}`);
  if (week.runMeters > 0) metrics.push(`🏃 ${formatDistance(week.runMeters)} ${unitLabel}`);
  if (week.steps > 0) metrics.push(`👟 ${formatSteps(week.steps)}`);

  const borderClass = isCurrent ? "border-[var(--warm-accent)]" : "border-[var(--border)]";

  return (
    <div
      data-testid="week-streak-strip"
      data-current={isCurrent ? "true" : undefined}
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border ${borderClass} bg-[var(--surface)]/60 px-3 py-2.5`}
    >
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {week.days.map((d, i) => (
          <span
            key={i}
            data-testid="streak-dot"
            data-trained={d.inMonth && d.trained ? "true" : undefined}
            className={`h-2.5 w-2.5 rounded-full ${
              d.inMonth && d.trained
                ? "bg-[var(--warm-accent)]"
                : d.inMonth
                  ? "border border-[var(--border)] bg-transparent"
                  : "border border-[var(--border)]/40 bg-transparent opacity-40"
            }`}
          />
        ))}
      </div>
      <span
        className={`text-xs font-medium ${
          trained > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"
        }`}
      >
        {weekStreakCopy(trained, total)}
      </span>
      {metrics.length > 0 && (
        <span className="ml-auto text-xs tabular-nums text-[var(--muted)]">
          {metrics.join("  ·  ")}
        </span>
      )}
    </div>
  );
}
