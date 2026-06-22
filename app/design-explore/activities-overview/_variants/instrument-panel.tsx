/**
 * IDIOM: instrument-panel — The Overview as a *panel of trends* (Strava "your
 * stats" / multi-chart).
 *
 * Spread axes (within the design system — palette/accent/type are fixed):
 *  · Type scale  — SMALL labels; the charts are the hero, numbers are second.
 *  · Color logic — discipline hues per chart (lift steel-blue / run green-teal),
 *                  one periwinkle accent for emphasis (the KPI row + steps).
 *  · Spacing     — a tight, EVEN chart grid of small framed instruments.
 * Promotes: the most VISUAL, trend-forward direction — graphs first.
 */
import { consistency, headline, running, split, steps, weeks, fmtHm, fmtPace } from "../_data";

export default function InstrumentPanel() {
  const kpis = [
    { k: "Time", v: fmtHm(headline.totalMinutes) },
    { k: "Sessions", v: String(headline.sessions) },
    { k: "Mileage", v: `${running.mileageMi} mi` },
    { k: "Avg pace", v: `${fmtPace(running.avgPaceSecPerMi)}` },
    { k: "Days active", v: `${consistency.daysActive}/${consistency.totalDays}` },
  ];

  return (
    <div className="px-2 py-4">
      {/* Minimal KPI row — small, ceding the page to the charts below. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
        {kpis.map((m) => (
          <div key={m.k}>
            <p className="text-lg font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
              {m.v}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
              {m.k}
            </p>
          </div>
        ))}
      </div>

      {/* The grid of small framed instruments — charts first. */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Instrument title="Weekly activity" sub="lift / run minutes" className="lg:col-span-2">
          <DualLine />
        </Instrument>

        <Instrument title="Time split" sub="lift vs run">
          <SplitDonut />
        </Instrument>

        <Instrument title="Avg pace" sub="per week · /mi">
          <PaceSparkline />
        </Instrument>

        <Instrument title="Mileage" sub="per week · mi">
          <MileageBars />
        </Instrument>

        <Instrument title="Daily steps" sub="90-day trend">
          <StepsBars />
        </Instrument>
      </div>
    </div>
  );
}

function Instrument({
  title,
  sub,
  children,
  className = "",
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 ${className}`}
    >
      <div className="mb-2.5 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
        <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{sub}</span>
      </div>
      {children}
    </section>
  );
}

function DualLine() {
  const w = 480;
  const h = 120;
  const lift = weeks.map((x) => x.liftMin);
  const run = weeks.map((x) => x.runMin);
  const max = Math.max(...lift, ...run, 1);
  const X = (i: number) => (i / (weeks.length - 1)) * w;
  const Y = (v: number) => h - (v / max) * (h - 10) - 5;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" height={120}>
      <line x1={0} y1={h - 5} x2={w} y2={h - 5} stroke="var(--border)" />
      <path d={path(lift)} fill="none" stroke="var(--discipline-lift-dot)" strokeWidth={1.5} />
      <path d={path(run)} fill="none" stroke="var(--discipline-run-dot)" strokeWidth={1.5} />
    </svg>
  );
}

function SplitDonut() {
  const liftPct = split.liftMin / (split.liftMin + split.runMin);
  const r = 42;
  const c = 2 * Math.PI * r;
  const liftLen = liftPct * c;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 110 110" width={104} height={104} className="shrink-0">
        <g transform="rotate(-90 55 55)">
          <circle
            cx={55}
            cy={55}
            r={r}
            fill="none"
            stroke="var(--discipline-run-dot)"
            strokeWidth={12}
          />
          <circle
            cx={55}
            cy={55}
            r={r}
            fill="none"
            stroke="var(--discipline-lift-dot)"
            strokeWidth={12}
            strokeDasharray={`${liftLen} ${c - liftLen}`}
          />
        </g>
        <text
          x={55}
          y={52}
          textAnchor="middle"
          className="fill-[var(--foreground)]"
          style={{ fontSize: 17, fontWeight: 600 }}
        >
          {Math.round(liftPct * 100)}%
        </text>
        <text
          x={55}
          y={68}
          textAnchor="middle"
          className="fill-[var(--faint)]"
          style={{ fontSize: 9 }}
        >
          LIFT
        </text>
      </svg>
      <div className="flex flex-col gap-2 text-[12px]">
        <Legend color="var(--discipline-lift-dot)" label={`Lifting ${fmtHm(split.liftMin)}`} />
        <Legend color="var(--discipline-run-dot)" label={`Running ${fmtHm(split.runMin)}`} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2 text-[var(--muted)]">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function PaceSparkline() {
  // Rest week has null pace (no runs) — drop it, lower = faster so invert.
  const pts = weeks.map((x, i) => ({ i, p: x.paceSecPerMi })).filter((d) => d.p !== null) as {
    i: number;
    p: number;
  }[];
  const w = 220;
  const h = 96;
  const min = Math.min(...pts.map((d) => d.p));
  const max = Math.max(...pts.map((d) => d.p));
  const span = max - min || 1;
  const X = (i: number) => (i / (weeks.length - 1)) * w;
  const Y = (p: number) => 8 + ((p - min) / span) * (h - 16); // faster = higher
  const line = pts
    .map((d, k) => `${k === 0 ? "M" : "L"}${X(d.i).toFixed(1)},${Y(d.p).toFixed(1)}`)
    .join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" height={96}>
        <path d={line} fill="none" stroke="var(--discipline-run-dot)" strokeWidth={1.5} />
        {pts.map((d, k) => (
          <circle key={k} cx={X(d.i)} cy={Y(d.p)} r={1.8} fill="var(--discipline-run-dot)" />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        Best {fmtPace(running.bestPaceSecPerMi)} · trending faster
      </p>
    </div>
  );
}

function MileageBars() {
  const max = Math.max(...weeks.map((x) => x.mileageMi), 1);
  return (
    <div className="flex items-end gap-[3px]" style={{ height: 96 }}>
      {weeks.map((x, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-sm"
          title={`${x.label}: ${x.mileageMi} mi`}
          style={{
            height: `${(x.mileageMi / max) * 100}%`,
            minHeight: x.mileageMi > 0 ? 2 : 0,
            background: "var(--discipline-run-dot)",
            opacity: 0.85,
          }}
        />
      ))}
    </div>
  );
}

function StepsBars() {
  // Downsample the 90-day series into ~30 bars; gap days render as a void.
  const buckets: (number | null)[] = [];
  for (let i = 0; i < steps.length; i += 3) {
    const slice = steps.slice(i, i + 3).map((s) => s.steps);
    const valid = slice.filter((v): v is number => v !== null);
    buckets.push(valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null);
  }
  const max = Math.max(...buckets.filter((v): v is number => v !== null), 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height: 96 }}>
      {buckets.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-sm"
          style={{
            height: v === null ? "100%" : `${(v / max) * 100}%`,
            minHeight: 2,
            background: v === null ? "var(--surface-2)" : "var(--accent)",
            opacity: v === null ? 0.5 : 0.8,
          }}
        />
      ))}
    </div>
  );
}
