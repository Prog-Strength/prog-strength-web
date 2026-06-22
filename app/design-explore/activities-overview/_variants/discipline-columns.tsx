/**
 * IDIOM: discipline-columns — The Overview as *parity across disciplines*
 * (Garmin Connect "In Focus").
 *
 * Spread axes (within the design system — palette/accent/type are fixed):
 *  · Type scale  — EVEN. Each column carries the same per-card hierarchy
 *                  (lead metric → supporting figures → sparkline); no single
 *                  hero figure dominates the page.
 *  · Color logic — DISCIPLINE-HUE-LED. The lift steel-blue and run green-teal
 *                  tonal hues tint each column's chrome; the periwinkle accent
 *                  is used only for cross-cutting chrome (the bridging split).
 *  · Spacing     — balanced three-up grid; columns are equal-weight cards.
 * Promotes: per-domain PARITY — running finally gets equal real estate.
 */
import { avgDailySteps, running, split, steps, weeks, fmtHm, fmtPace } from "../_data";

export default function DisciplineColumns() {
  const splitTotal = split.liftMin + split.runMin;
  const liftPct = Math.round((split.liftMin / splitTotal) * 100);

  return (
    <div className="px-2 py-4">
      {/* Bridging discipline time-split bar — the one cross-cutting element. */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          <span>Where the time went</span>
          <span className="tabular-nums text-[var(--muted)]">{fmtHm(splitTotal)} active</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div style={{ width: `${liftPct}%`, background: "var(--discipline-lift-dot)" }} />
          <div style={{ width: `${100 - liftPct}%`, background: "var(--discipline-run-dot)" }} />
        </div>
      </div>

      {/* Three equal-weight discipline columns. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Lifting */}
        <Column
          title="Lifting"
          accent="var(--discipline-lift-dot)"
          fg="var(--discipline-lift-fg)"
          bg="var(--discipline-lift-bg)"
          lead={{ value: fmtHm(split.liftMin), label: "Time lifted" }}
          rows={[
            { k: "Workouts", v: "21" },
            { k: "Share of time", v: `${liftPct}%` },
            { k: "Avg session", v: "62m" },
          ]}
          series={weeks.map((w) => w.liftMin)}
          caption="Weekly minutes"
        />

        {/* Running — promoted with pace, mileage trend and HR. */}
        <Column
          title="Running"
          accent="var(--discipline-run-dot)"
          fg="var(--discipline-run-fg)"
          bg="var(--discipline-run-bg)"
          lead={{ value: `${fmtPace(running.avgPaceSecPerMi)}`, label: "Avg pace /mi" }}
          rows={[
            { k: "Mileage", v: `${running.mileageMi} mi` },
            { k: "Avg HR", v: `${running.avgHrBpm} bpm` },
            { k: "Elevation", v: `${running.elevationFt.toLocaleString()} ft` },
            { k: "Best pace", v: `${fmtPace(running.bestPaceSecPerMi)} /mi` },
          ]}
          series={weeks.map((w) => w.mileageMi)}
          caption="Weekly mileage"
          note={`${running.manualRuns} manual runs — pace/HR averaged only over runs that report it`}
        />

        {/* Steps */}
        <Column
          title="Steps"
          accent="var(--accent-2)"
          fg="var(--foreground)"
          bg="var(--surface-2)"
          lead={{ value: avgDailySteps.toLocaleString(), label: "Avg daily" }}
          rows={[
            { k: "Logged days", v: "88" },
            { k: "Trend", v: "Flat → up" },
          ]}
          series={steps.map((s) => s.steps ?? 0)}
          caption="Daily steps"
        />
      </div>
    </div>
  );
}

function Column({
  title,
  accent,
  fg,
  bg,
  lead,
  rows,
  series,
  caption,
  note,
}: {
  title: string;
  accent: string;
  fg: string;
  bg: string;
  lead: { value: string; label: string };
  rows: { k: string; v: string }[];
  series: number[];
  caption: string;
  note?: string;
}) {
  return (
    <section
      className="flex flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4"
      style={{ borderTop: `2px solid ${accent}` }}
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: fg }}>
          {title}
        </h3>
      </div>

      {/* Per-column lead metric. */}
      <div className="mt-4">
        <p className="text-3xl font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
          {lead.value}
        </p>
        <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          {lead.label}
        </p>
      </div>

      {/* Supporting figures. */}
      <dl className="mt-4 flex flex-col gap-1.5 text-[13px]">
        {rows.map((r) => (
          <div key={r.k} className="flex items-center justify-between">
            <dt className="text-[var(--muted)]">{r.k}</dt>
            <dd className="font-semibold tabular-nums text-[var(--foreground)]">{r.v}</dd>
          </div>
        ))}
      </dl>

      {/* Sparkline + caption. */}
      <div className="mt-auto pt-5">
        <Sparkline values={series} color={accent} fill={bg} />
        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          {caption}
        </p>
        {note && <p className="mt-1.5 text-[11px] leading-snug text-[var(--muted)]">{note}</p>}
      </div>
    </section>
  );
}

function Sparkline({ values, color, fill }: { values: number[]; color: string; fill: string }) {
  const w = 220;
  const h = 44;
  const max = Math.max(...values, 1);
  const x = (i: number) => (i / (values.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 6) - 3;
  const line = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" height={h}>
      <path d={area} fill={fill} opacity={0.6} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} />
    </svg>
  );
}
