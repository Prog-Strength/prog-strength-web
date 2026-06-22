/**
 * IDIOM: command-strip-dense — The Overview as a *glanceable console* (Whoop
 * today screen).
 *
 * Spread axes (within the design system — palette/accent/type are fixed):
 *  · Type scale  — COMPACT and UNIFORM. Every KPI is the same small size;
 *                  hierarchy comes from POSITION and DENSITY, not from size.
 *  · Color logic — near-colorless field; the periwinkle accent and desaturated
 *                  status tints appear only on the few cells that warrant them
 *                  (streak = accent, rest-week note = muted), sparingly.
 *  · Spacing     — TIGHT, gridded, hairline-divided; maximally informative.
 * Promotes: the data-dense "everything at a glance" end of the spread.
 */
import { avgDailySteps, consistency, headline, running, weeks, fmtHm, fmtPace } from "../_data";

type Kpi = { k: string; v: string; accent?: boolean };

export default function CommandStripDense() {
  const strip: Kpi[] = [
    { k: "Time", v: fmtHm(headline.totalMinutes) },
    { k: "Sessions", v: String(headline.sessions) },
    { k: "Lifts", v: String(headline.workouts) },
    { k: "Runs", v: String(headline.runs) },
    { k: "Avg pace", v: `${fmtPace(running.avgPaceSecPerMi)}` },
    { k: "Mileage", v: `${running.mileageMi}mi` },
    { k: "Avg HR", v: `${running.avgHrBpm}` },
    { k: "Max HR", v: `${running.maxHrBpm}` },
    { k: "Elev", v: `${(running.elevationFt / 1000).toFixed(1)}k ft` },
    { k: "Days", v: `${consistency.daysActive}/${consistency.totalDays}` },
    { k: "Streak", v: `${consistency.currentStreak}d`, accent: true },
    { k: "Steps", v: `${(avgDailySteps / 1000).toFixed(1)}k` },
  ];

  const secondary: Kpi[] = [
    { k: "Best pace", v: `${fmtPace(running.bestPaceSecPerMi)} /mi` },
    { k: "Avg session", v: fmtHm(headline.avgSessionMinutes) },
    { k: "Longest streak", v: `${consistency.longestStreak}d` },
    { k: "Manual runs", v: `${running.manualRuns}` },
    { k: "Lift share", v: "59%" },
    { k: "Run share", v: "41%" },
    { k: "Avg run", v: "4.7 mi" },
    { k: "Active wks", v: "12/13" },
  ];

  return (
    <div className="px-2 py-4">
      {/* Dense KPI strip — many metric-label-value triplets, hairline-gridded. */}
      <div className="grid grid-cols-3 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-4 lg:grid-cols-6">
        {strip.map((m) => (
          <div
            key={m.k}
            className="border-b border-[var(--border)] px-3 py-2.5 [&:nth-child(3n)]:border-r-0 sm:[&:nth-child(3n)]:border-r sm:[&:nth-child(4n)]:border-r-0 lg:[&:nth-child(4n)]:border-r lg:[&:nth-child(6n)]:border-r-0"
            style={{ borderRight: "1px solid var(--border)" }}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
              {m.k}
            </p>
            <p
              className={`mt-0.5 text-[15px] font-semibold tabular-nums tracking-[-0.03em] ${
                m.accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"
              }`}
            >
              {m.v}
            </p>
          </div>
        ))}
      </div>

      {/* Weekly chart — a compact dual mini-bar matrix, console-flat. */}
      <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
            Weekly load · lift / run minutes
          </p>
          <span className="text-[9px] uppercase tracking-wider text-[var(--muted)]">
            rest wk near May 25
          </span>
        </div>
        <WeeklyBars />
      </div>

      {/* Dense secondary grid. */}
      <div className="mt-3 grid grid-cols-2 gap-x-px gap-y-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
        {secondary.map((m) => (
          <div key={m.k} className="bg-[var(--surface)] px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
              {m.k}
            </p>
            <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
              {m.v}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Compact paired bars per week — uniform, position-encoded, no axes. */
function WeeklyBars() {
  const max = Math.max(...weeks.flatMap((w) => [w.liftMin, w.runMin]), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: 64 }}>
      {weeks.map((w, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-14 w-full items-end justify-center gap-[2px]">
            <span
              className="w-1/2 rounded-sm"
              style={{
                height: `${(w.liftMin / max) * 100}%`,
                background: "var(--discipline-lift-dot)",
                minHeight: w.liftMin > 0 ? 2 : 0,
              }}
            />
            <span
              className="w-1/2 rounded-sm"
              style={{
                height: `${(w.runMin / max) * 100}%`,
                background: "var(--discipline-run-dot)",
                minHeight: w.runMin > 0 ? 2 : 0,
              }}
            />
          </div>
          <span className="text-[8px] tabular-nums text-[var(--faint)]">
            {w.label.split(" ")[1]}
          </span>
        </div>
      ))}
    </div>
  );
}
