/**
 * IDIOM: consistency-heatmap — The Overview as a *show-up record* (Oura trends).
 *
 * Spread axes (within the design system — palette/accent/type are fixed):
 *  · Type scale  — SMALL and exact; the grid does the talking, figures are
 *                  quiet captions around it.
 *  · Color logic — STRUCTURAL. The lift steel-blue intensity ramp and the run
 *                  green-teal tint the heatmap cells BY INTENSITY; everything
 *                  else is muted near-monochrome. (A "both" day reads accent.)
 *  · Spacing     — generous and even around one dominant visual.
 * Promotes: the "did I show up?" emotional core, made the centerpiece.
 */
import {
  consistency,
  headline,
  heatmap,
  running,
  split,
  avgDailySteps,
  fmtHm,
  fmtPace,
  type HeatCell,
} from "../_data";

// Lift intensity ramp (design-system tokens) keyed by level 2–4.
const LIFT_RAMP: Record<number, string> = {
  2: "var(--discipline-lift-2)",
  3: "var(--discipline-lift-3)",
  4: "var(--discipline-lift-4)",
};
const RUN_OPACITY: Record<number, number> = { 2: 0.5, 3: 0.75, 4: 1 };

function cellColor(c: HeatCell): string {
  if (c.level === 0) return "var(--surface-2)";
  if (c.disc === "lift") return LIFT_RAMP[c.level] ?? "var(--discipline-lift-4)";
  if (c.disc === "run")
    return `color-mix(in srgb, var(--discipline-run-dot) ${RUN_OPACITY[c.level] * 100}%, var(--surface-2))`;
  return "var(--accent)"; // both
}

export default function ConsistencyHeatmap() {
  // Bucket the 90 cells into GitHub-style week columns (rows = weekday, Mon-top).
  const firstWeekday = (heatmap[0].date.getDay() + 6) % 7;
  const columns: (HeatCell | null)[][] = [];
  heatmap.forEach((cell, i) => {
    const pos = firstWeekday + i;
    const col = Math.floor(pos / 7);
    const row = pos % 7;
    if (!columns[col]) columns[col] = Array(7).fill(null);
    columns[col][row] = cell;
  });

  const liftPct = Math.round((split.liftMin / (split.liftMin + split.runMin)) * 100);

  return (
    <div className="mx-auto max-w-2xl px-2 py-4">
      {/* The readout — show-up record, prominent but exact (not huge). */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)]">
          <span className="tabular-nums">{consistency.daysActive}</span>
          <span className="text-[var(--muted)]"> of {consistency.totalDays} days active</span>
        </p>
        <p className="text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--accent)] tabular-nums">
            {consistency.currentStreak}-day
          </span>{" "}
          current streak · {consistency.longestStreak}-day best
        </p>
      </div>
      <p className="mt-1 text-[13px] text-[var(--muted)]">
        {headline.windowLabel} — a clustered block with a visible rest week near May 25.
      </p>

      {/* THE HERO — calendar heatmap, the single dominant visual. */}
      <div className="mt-7 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="overflow-x-auto">
          <div className="flex gap-[3px]">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map((cell, ri) => (
                  <div
                    key={ri}
                    className="h-3.5 w-3.5 rounded-[3px]"
                    title={cell ? `${cell.date.toDateString()} — ${cell.disc ?? "rest"}` : ""}
                    style={{
                      background: cell ? cellColor(cell) : "transparent",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Legend — structural color, kept quiet. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[var(--muted)]">
          <Legend swatch="var(--discipline-lift-dot)" label="Lifting" />
          <Legend swatch="var(--discipline-run-dot)" label="Running" />
          <Legend swatch="var(--accent)" label="Both" />
          <div className="ml-auto flex items-center gap-1.5">
            <span>Less</span>
            <span className="h-3 w-3 rounded-[3px] bg-[var(--surface-2)]" />
            <span className="h-3 w-3 rounded-[3px] bg-[var(--discipline-lift-2)]" />
            <span className="h-3 w-3 rounded-[3px] bg-[var(--discipline-lift-3)]" />
            <span className="h-3 w-3 rounded-[3px] bg-[var(--discipline-lift-4)]" />
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Demoted totals — a quiet supporting strip beneath the hero. */}
      <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-[var(--border)] pt-5 sm:grid-cols-4">
        <Quiet k="Total time" v={fmtHm(headline.totalMinutes)} />
        <Quiet k="Sessions" v={`${headline.sessions}`} />
        <Quiet k="Mileage" v={`${running.mileageMi} mi`} />
        <Quiet k="Avg pace" v={`${fmtPace(running.avgPaceSecPerMi)} /mi`} />
        <Quiet k="Avg HR" v={`${running.avgHrBpm} bpm`} />
        <Quiet k="Elevation" v={`${running.elevationFt.toLocaleString()} ft`} />
        <Quiet k="Lift / run" v={`${liftPct}/${100 - liftPct}%`} />
        <Quiet k="Avg steps" v={avgDailySteps.toLocaleString()} />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[3px]" style={{ background: swatch }} />
      <span>{label}</span>
    </div>
  );
}

function Quiet({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">{k}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--foreground)]">{v}</p>
    </div>
  );
}
