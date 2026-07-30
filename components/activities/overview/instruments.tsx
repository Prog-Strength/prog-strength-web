"use client";

/**
 * Small-multiple instruments for the Activities → Overview instrument-panel.
 *
 * Each is a tiny framed chart — the page's "graphs first, numbers second"
 * idiom (Strava "your stats"). They mirror the DX mockup's hand-rolled
 * SVG/div charts but are wired to the derived `OverviewStats` and the
 * design-system tokens (`--discipline-run-*` / `--discipline-lift-*` per
 * chart, `--accent` only on the steps trend; the headline accent emphasis
 * lives on the KPI row's consistency readout). Hand-rolled rather than
 * recharts because these are glance instruments where a full axis/tooltip
 * stack is heavier than the read they need; the carried-over weekly
 * Lifting/Running line keeps using recharts via ActivitiesCombinedChart.
 *
 * Nullability is honored visually: a week with no run is a gap (not a zero
 * bar), an unlogged steps day is a void, and an all-null instrument shows a
 * calm "—" line rather than a broken frame.
 */

import type { DistanceUnit } from "@/lib/distance-unit-context";
import {
  formatDistanceValue,
  formatElevationValue,
  formatPaceValue,
} from "@/lib/distance-unit-context";
import {
  formatHm,
  type DisciplineSplit,
  type EffortStats,
  type StepPoint,
  type WeekPoint,
} from "@/lib/activities-overview-stats";

const KM_PER_MILE = 1.609344;

/** Convert a canonical sec/mi pace to the active unit and format as m:ss. */
function paceLabel(secPerMi: number | null, unit: DistanceUnit): string {
  const secPerKm = secPerMi == null ? null : secPerMi / KM_PER_MILE;
  return formatPaceValue(secPerKm, unit);
}

/** Shared framed-panel wrapper: 14px radius, hairline border, quiet label. */
export function Instrument({
  title,
  sub,
  className = "",
  children,
}: {
  title: string;
  sub?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 ${className}`}
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-tight text-[var(--foreground)]">{title}</h3>
        {sub && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{sub}</span>
        )}
      </div>
      {children}
    </section>
  );
}

/** Calm empty line for an instrument with no data to show. */
function EmptyLine({ label }: { label: string }) {
  return (
    <div className="flex h-[96px] items-center justify-center text-xs text-[var(--muted)]">
      {label}
    </div>
  );
}

/**
 * Weekly avg-pace sparkline (run hue). Faster = higher (pace is inverted).
 * Weeks with no pace-carrying run are gaps: their points are simply absent,
 * so the line spans the weeks that have data without dropping to a false 0.
 */
export function PaceSparkline({
  weekly,
  bestPaceSecPerMi,
  distanceUnit,
}: {
  weekly: WeekPoint[];
  bestPaceSecPerMi: number | null;
  distanceUnit: DistanceUnit;
}) {
  const pts = weekly
    .map((w, i) => ({ i, p: w.paceSecPerMi }))
    .filter((d): d is { i: number; p: number } => d.p !== null);

  const paceUnit = distanceUnit === "mi" ? "/mi" : "/km";

  if (pts.length === 0) {
    return <EmptyLine label={`— ${paceUnit} · no pace data`} />;
  }

  const w = 220;
  const h = 96;
  const min = Math.min(...pts.map((d) => d.p));
  const max = Math.max(...pts.map((d) => d.p));
  const span = max - min || 1;
  const denom = weekly.length > 1 ? weekly.length - 1 : 1;
  const X = (i: number) => (i / denom) * w;
  const Y = (p: number) => 8 + ((p - min) / span) * (h - 16); // faster = higher
  const line = pts
    .map((d, k) => `${k === 0 ? "M" : "L"}${X(d.i).toFixed(1)},${Y(d.p).toFixed(1)}`)
    .join(" ");

  const trendLabel =
    bestPaceSecPerMi != null
      ? `Weekly average pace trend, best ${paceLabel(bestPaceSecPerMi, distanceUnit)} ${paceUnit}`
      : "Weekly average pace trend";

  return (
    <div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        preserveAspectRatio="none"
        height={96}
        role="img"
        aria-label={trendLabel}
      >
        {pts.length > 1 && (
          <path d={line} fill="none" stroke="var(--discipline-run-dot)" strokeWidth={1.5} />
        )}
        {pts.map((d) => (
          <circle key={d.i} cx={X(d.i)} cy={Y(d.p)} r={2} fill="var(--discipline-run-dot)" />
        ))}
      </svg>
      <p className="mt-1 text-[10px] text-[var(--muted)]">
        {bestPaceSecPerMi != null
          ? `Best ${paceLabel(bestPaceSecPerMi, distanceUnit)} ${paceUnit}`
          : "Per-week trend"}
      </p>
    </div>
  );
}

/**
 * Weekly mileage bars (run hue). A week with no run renders as a gap (an
 * empty slot keeping the timeline aligned), never a zero-height bar.
 */
export function MileageBars({
  weekly,
  distanceUnit,
}: {
  weekly: WeekPoint[];
  distanceUnit: DistanceUnit;
}) {
  const values = weekly.map((w) => w.mileageMeters);
  const max = Math.max(...values.filter((v): v is number => v !== null), 1);

  if (values.every((v) => v === null)) {
    return <EmptyLine label="No runs in this window" />;
  }

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 96 }}>
      {weekly.map((wk, i) => {
        if (wk.mileageMeters === null) {
          // Gap week: keep the slot so the timeline stays aligned.
          return <span key={i} className="flex-1" aria-hidden />;
        }
        const label = `${formatDistanceValue(wk.mileageMeters, distanceUnit)} ${distanceUnit}`;
        return (
          <span
            key={i}
            className="flex-1 rounded-t-sm"
            title={label}
            style={{
              // A non-null mileage week always carries a positive distance
              // (zero-run weeks are gaps above), so every drawn bar is visible.
              height: `${(wk.mileageMeters / max) * 100}%`,
              minHeight: 2,
              background: "var(--discipline-run-dot)",
              opacity: 0.85,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Discipline time-split donut (lift steel-blue vs run green-teal). A
 * single-modality window degrades to a clean 100/0 ring; an empty window
 * shows the calm empty line rather than a broken donut.
 */
export function SplitDonut({ split }: { split: DisciplineSplit }) {
  const total = split.liftSeconds + split.runSeconds;
  if (total <= 0) {
    return <EmptyLine label="No activity yet" />;
  }
  const liftPct = split.liftSeconds / total;
  const r = 42;
  const c = 2 * Math.PI * r;
  const liftLen = liftPct * c;
  // Center reads the dominant discipline's share, so a single-modality
  // window shows "100% RUN" rather than the awkward "0% LIFT".
  const liftLeads = split.liftSeconds >= split.runSeconds;
  const dominantPct = Math.round((liftLeads ? liftPct : 1 - liftPct) * 100);
  const dominantLabel = liftLeads ? "LIFT" : "RUN";
  const ariaLabel = `Time split: lifting ${Math.round(liftPct * 100)}%, running ${Math.round(
    (1 - liftPct) * 100,
  )}%`;

  return (
    <div className="flex items-center gap-4">
      <svg
        viewBox="0 0 110 110"
        width={104}
        height={104}
        className="shrink-0"
        role="img"
        aria-label={ariaLabel}
      >
        <g transform="rotate(-90 55 55)">
          {/* Run ring underneath; lift arc drawn over it by its share. */}
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
          {dominantPct}%
        </text>
        <text
          x={55}
          y={68}
          textAnchor="middle"
          className="fill-[var(--faint)]"
          style={{ fontSize: 9 }}
        >
          {dominantLabel}
        </text>
      </svg>
      <div className="flex flex-col gap-2 text-[12px]">
        <Legend
          color="var(--discipline-lift-dot)"
          label={`Lifting ${formatHm(split.liftSeconds)}`}
        />
        <Legend color="var(--discipline-run-dot)" label={`Running ${formatHm(split.runSeconds)}`} />
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

/**
 * Daily-steps trend. Downsamples the continuous day axis into ~30 buckets;
 * unlogged days inside a bucket are skipped, and a bucket with no logged day
 * renders as a faint void — never a zero-step bar. Steps are neither lift nor
 * run, so the bars use `--success` (matching the Steps tab) rather than the
 * `--accent`, which stays app chrome reserved for the KPI consistency readout.
 */
export function StepsBars({ series }: { series: StepPoint[] }) {
  if (series.length === 0) {
    return <EmptyLine label="No steps logged" />;
  }
  const bucketCount = Math.min(30, series.length);
  const size = Math.ceil(series.length / bucketCount);
  const buckets: (number | null)[] = [];
  for (let i = 0; i < series.length; i += size) {
    const slice = series.slice(i, i + size);
    const valid = slice.map((s) => s.steps).filter((v): v is number => v !== null);
    buckets.push(valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null);
  }
  const max = Math.max(...buckets.filter((v): v is number => v !== null), 1);

  return (
    <div className="flex items-end gap-[2px]" style={{ height: 96 }}>
      {buckets.map((v, i) => (
        <span
          key={i}
          className="flex-1 rounded-t-sm"
          title={v === null ? "No steps logged" : `${Math.round(v).toLocaleString()} avg steps`}
          style={{
            height: v === null ? "100%" : `${(v / max) * 100}%`,
            minHeight: 2,
            background: v === null ? "var(--surface-3)" : "var(--success)",
            opacity: v === null ? 0.5 : 0.85,
          }}
        />
      ))}
    </div>
  );
}

/**
 * HR / elevation effort readout. Each figure is "—" when no run reports it;
 * the whole instrument shows a calm empty line when none do.
 */
export function EffortReadout({
  effort,
  distanceUnit,
}: {
  effort: EffortStats;
  distanceUnit: DistanceUnit;
}) {
  const allNull =
    effort.avgHrBpm === null && effort.maxHrBpm === null && effort.elevationGainMeters === null;
  if (allNull) {
    return <EmptyLine label="No HR or elevation data" />;
  }

  const elevation = formatElevationValue(effort.elevationGainMeters, distanceUnit);

  const figures = [
    {
      label: "Avg HR",
      value: effort.avgHrBpm === null ? "—" : `${Math.round(effort.avgHrBpm)} bpm`,
    },
    {
      label: "Max HR",
      value: effort.maxHrBpm === null ? "—" : `${Math.round(effort.maxHrBpm)} bpm`,
    },
    { label: "Elevation", value: elevation },
  ];

  return (
    <div className="flex h-[96px] flex-col justify-center gap-2.5">
      {figures.map((f) => (
        <div key={f.label} className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
            {f.label}
          </span>
          <span className="text-base font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
            {f.value}
          </span>
        </div>
      ))}
    </div>
  );
}
