"use client";

import { useDistanceUnit } from "@/lib/distance-unit-context";

/**
 * Slim per-week rollup cell — the 8th column of each week row in the
 * `true-month-grid` calendar. Where the surface used to carry a full-width
 * coaching strip beneath every week, the rollup now collapses into a compact
 * ~84px column carrying the same {@link WeeklyStat}: a trained-days indicator
 * plus that week's session count, lift time, run distance, and steps. The
 * coaching sentence is demoted (it now lives in the day detail and modals);
 * here the data reads at a glance, near-monochrome slate.
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
 * One week's slim rollup column. Trained/total are derived from the in-month
 * days in `week.days` (out-of-month leading/trailing days don't count toward
 * the total). Metrics with a zero value are omitted so an empty week reads as
 * intentional rest rather than a wall of zeroes. The current week gets a quiet
 * stronger hairline — never violet, which is reserved for today/selected.
 */
export function WeekColumn({ week, isCurrent }: { week: WeeklyStat; isCurrent: boolean }) {
  const { formatDistance, unitLabel } = useDistanceUnit();
  const trained = week.days.filter((d) => d.inMonth && d.trained).length;
  const total = week.days.filter((d) => d.inMonth).length;

  const metrics: { key: string; label: string }[] = [];
  if (week.liftMinutes > 0)
    metrics.push({ key: "lift", label: `🏋 ${formatTotalDuration(week.liftMinutes)}` });
  if (week.runMeters > 0)
    metrics.push({ key: "run", label: `🏃 ${formatDistance(week.runMeters)} ${unitLabel}` });
  if (week.steps > 0) metrics.push({ key: "steps", label: `👟 ${formatSteps(week.steps)}` });

  const borderClass = isCurrent ? "border-[var(--border-strong)]" : "border-[var(--border)]";

  return (
    <div
      data-testid="week-column"
      data-current={isCurrent ? "true" : undefined}
      aria-label={`Week of ${week.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })}: trained ${trained} of ${total} days`}
      className={`flex flex-col gap-1 border-l ${borderClass} bg-[var(--surface-2)]/30 px-2 py-1.5 text-[10px] leading-tight`}
    >
      <span
        className={`font-semibold tabular-nums ${
          trained > 0 ? "text-[var(--foreground)]" : "text-[var(--muted)]"
        }`}
        title={`Trained ${trained} of ${total} days`}
      >
        {trained}/{total}
      </span>
      {week.activities > 0 && (
        <span className="tabular-nums text-[var(--muted)]">
          {week.activities} {week.activities === 1 ? "session" : "sessions"}
        </span>
      )}
      {metrics.map((m) => (
        <span key={m.key} className="truncate tabular-nums text-[var(--muted)]" title={m.label}>
          {m.label}
        </span>
      ))}
    </div>
  );
}
