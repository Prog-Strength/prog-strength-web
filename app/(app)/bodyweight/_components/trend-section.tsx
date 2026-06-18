"use client";

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BodyweightEntry, BodyweightGoal } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  buildDayPoints,
  computeStats,
  convertWeight,
  ewmaTrend,
  trendSummary,
  type Stats,
} from "@/lib/bodyweight-trend";
import { CHART_COLORS } from "@/lib/bodyweight-chart-colors";

const EWMA_ALPHA = 0.25;

/**
 * The trend-band-analyst visualization region: a hero readout (TREND NOW
 * overline → condensed-display current value → rate pill → legend), the
 * layered Recharts ComposedChart (±spread band → demoted slate readings →
 * violet EWMA trend → quiet dashed goal), and a compact caption strip. All
 * SVG colors come from CHART_COLORS (the design-system tokens mirrored for
 * SVG); page chrome uses the CSS-variable tokens directly.
 */
export function TrendSection({
  entries,
  displayUnit,
  goal,
  isMobile,
}: {
  entries: BodyweightEntry[];
  displayUnit: "lb" | "kg";
  goal: BodyweightGoal | null;
  isMobile: boolean;
}) {
  const derived = useMemo(() => {
    const dayPoints = buildDayPoints(entries, displayUnit);
    const trend = ewmaTrend(dayPoints, EWMA_ALPHA);
    const summary = trendSummary(trend);
    const stats = computeStats(entries, displayUnit);
    const rawPoints = entries.map((e) => ({
      t: new Date(e.measured_at).getTime(),
      weight: convertWeight(e.weight, e.unit, displayUnit),
    }));
    // The Area consumes `band: [lo, hi]` as a tuple to render a range.
    const trendData = trend.map((p) => ({
      t: p.t,
      trend: p.trend,
      band: [p.lo, p.hi] as [number, number],
    }));
    return { dayCount: dayPoints.length, summary, stats, rawPoints, trendData };
  }, [entries, displayUnit]);

  // Goal projected into the display unit, so the y-domain and the goal line
  // read off the same number. Null when no goal is set.
  const goalInDisplayUnit =
    goal && goal.weight > 0 ? convertWeight(goal.weight, goal.unit, displayUnit) : null;

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
        No readings in this range.
      </div>
    );
  }

  const { summary, stats, rawPoints, trendData, dayCount } = derived;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      {/* Trend hero readout */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
            Trend now
          </span>
          <div className="flex items-end gap-2">
            <span className="font-display text-5xl font-bold leading-none tabular-nums text-[var(--foreground)]">
              {summary.current !== null ? formatNumber(summary.current) : "—"}
            </span>
            <span className="pb-1 text-sm font-semibold text-[var(--muted)]">{displayUnit}</span>
          </div>
        </div>
        {summary.hasRate && summary.ratePerWeek !== null && (
          <RatePill rate={summary.ratePerWeek} unit={displayUnit} />
        )}
      </div>

      <TrendLegend
        goalLabel={goalInDisplayUnit !== null ? formatNumber(goalInDisplayUnit) : null}
        unit={displayUnit}
      />

      {/* The chart — the hero. Layered back to front: ±band, raw readings,
          EWMA trend, goal. */}
      <div className="h-[300px] w-full sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 12, right: isMobile ? 8 : 16, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="bw-band-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.bandTop} />
                <stop offset="100%" stopColor={CHART_COLORS.bandBottom} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              minTickGap={isMobile ? 24 : 12}
              tickFormatter={(v: number) => {
                const d = new Date(v);
                if (isMobile) return `${d.getMonth() + 1}/${d.getDate()}`;
                return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
              }}
            />
            <YAxis
              stroke={CHART_COLORS.axis}
              tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
              domain={[
                (dataMin: number) =>
                  Math.floor(
                    goalInDisplayUnit !== null
                      ? Math.min(dataMin, goalInDisplayUnit) - 2
                      : dataMin - 2,
                  ),
                (dataMax: number) =>
                  Math.ceil(
                    goalInDisplayUnit !== null
                      ? Math.max(dataMax, goalInDisplayUnit) + 2
                      : dataMax + 2,
                  ),
              ]}
              width={isMobile ? 32 : 48}
              tickFormatter={(v: number) => `${Math.round(v)}`}
            />
            <Tooltip
              cursor={{ stroke: CHART_COLORS.axis, strokeWidth: 1 }}
              wrapperStyle={{ outline: "none" }}
              content={<TrendTooltip displayUnit={displayUnit} />}
            />
            <Area
              data={trendData}
              dataKey="band"
              stroke="none"
              fill="url(#bw-band-gradient)"
              isAnimationActive={false}
              activeDot={false}
            />
            <Scatter
              data={rawPoints}
              dataKey="weight"
              fill={CHART_COLORS.rawDot}
              fillOpacity={0.5}
              isAnimationActive={false}
            />
            <Line
              data={trendData}
              type="monotone"
              dataKey="trend"
              stroke={CHART_COLORS.trend}
              strokeWidth={3.5}
              dot={trendData.length === 1 ? { fill: CHART_COLORS.trend, r: 4 } : false}
              isAnimationActive={false}
            />
            {goalInDisplayUnit !== null && (
              <ReferenceLine
                y={goalInDisplayUnit}
                stroke={CHART_COLORS.goal}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: isMobile
                    ? `${formatNumber(goalInDisplayUnit)} ${displayUnit}`
                    : `Goal ${formatNumber(goalInDisplayUnit)} ${displayUnit}`,
                  position: isMobile ? "insideTopRight" : "right",
                  fill: CHART_COLORS.goal,
                  fontSize: 10,
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <CaptionStrip
        stats={stats}
        goalInDisplayUnit={goalInDisplayUnit}
        displayUnit={displayUnit}
        dayCount={dayCount}
      />
    </div>
  );
}

// --- Hero bits ----------------------------------------------------

// Rate-of-change chip. The arrow AND the sign carry direction — not color
// alone — so it reads without relying on the accent fill.
function RatePill({ rate, unit }: { rate: number; unit: string }) {
  const down = rate < 0;
  const arrow = down ? "↓" : "↑";
  const sign = down ? "−" : "+";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
      <span className="tabular-nums">
        <span aria-hidden>{arrow}</span> {sign}
        {formatNumber(Math.abs(rate))} {unit}/wk
      </span>
    </span>
  );
}

function TrendLegend({ goalLabel, unit }: { goalLabel: string | null; unit: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--muted)]">
      <LegendItem
        swatch={
          <span
            className="inline-block h-[3px] w-5 rounded-full"
            style={{ background: CHART_COLORS.trend }}
          />
        }
        label="EWMA trend"
      />
      <LegendItem
        swatch={
          <span
            className="inline-block h-2.5 w-5 rounded-sm"
            style={{ background: CHART_COLORS.bandLegend }}
          />
        }
        label="±spread band"
      />
      <LegendItem
        swatch={
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: CHART_COLORS.rawDot, opacity: 0.6 }}
          />
        }
        label="Readings"
      />
      {goalLabel !== null && (
        <LegendItem
          swatch={
            <span
              className="inline-block w-5 border-t-2 border-dashed"
              style={{ borderColor: CHART_COLORS.goal }}
            />
          }
          label={`Goal ${goalLabel} ${unit}`}
        />
      )}
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden>{swatch}</span>
      {label}
    </span>
  );
}

// --- Caption strip ------------------------------------------------

function CaptionStrip({
  stats,
  goalInDisplayUnit,
  displayUnit,
  dayCount,
}: {
  stats: Stats;
  goalInDisplayUnit: number | null;
  displayUnit: "lb" | "kg";
  dayCount: number;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2 border-t border-[var(--border)] pt-3 text-xs">
      <Caption
        label="Average"
        value={stats.avg !== null ? `${formatNumber(stats.avg)} ${displayUnit}` : "—"}
      />
      <Caption
        label="Range Δ"
        accent
        value={
          stats.delta !== null
            ? `${stats.delta >= 0 ? "+" : "−"}${formatNumber(Math.abs(stats.delta))} ${displayUnit}`
            : "—"
        }
      />
      <Caption
        label="Low"
        value={
          stats.min !== null
            ? `${formatNumber(stats.min.weight)} ${displayUnit} · ${formatShortDate(stats.min.date)}`
            : "—"
        }
      />
      <Caption
        label="High"
        value={
          stats.max !== null
            ? `${formatNumber(stats.max.weight)} ${displayUnit} · ${formatShortDate(stats.max.date)}`
            : "—"
        }
      />
      {goalInDisplayUnit !== null && stats.avg !== null && (
        <Caption
          label="To goal"
          value={`${formatNumber(Math.abs(goalInDisplayUnit - stats.avg))} ${displayUnit}`}
        />
      )}
      <span className="ml-auto self-center text-[10px] text-[var(--faint)]">
        {dayCount} day{dayCount === 1 ? "" : "s"} · trend smoothed (EWMA α0.25)
      </span>
    </div>
  );
}

function Caption({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="inline-flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </span>
      <span
        className={`tabular-nums font-semibold ${
          accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"
        }`}
      >
        {value}
      </span>
    </span>
  );
}

// --- Tooltip ------------------------------------------------------

type TooltipPayloadItem = { dataKey?: string | number; value?: number | number[] | string };

/**
 * Custom chart tooltip. Formats the hovered WEIGHT (via formatNumber),
 * labels the day with a day-long formatter, and EXCLUDES the band series —
 * so the band's noon timestamp can never be rendered as a value. This is the
 * fix for the DX-flagged `Daily avg : 1780150948286 lb` bug. Exported so the
 * regression test can target it directly without recharts layout.
 */
export function TrendTooltip({
  active,
  payload,
  label,
  displayUnit,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: number | string;
  displayUnit: "lb" | "kg";
}) {
  if (!active || !payload || payload.length === 0) return null;
  const rows = payload
    .filter((p) => p.dataKey === "trend" || p.dataKey === "weight")
    .map((p) => ({
      name: p.dataKey === "trend" ? "Trend" : "Reading",
      value: typeof p.value === "number" ? p.value : Number(p.value),
    }))
    .filter((r) => Number.isFinite(r.value));
  if (rows.length === 0) return null;

  return (
    <div
      style={{
        backgroundColor: CHART_COLORS.tooltipSurface,
        border: `1px solid ${CHART_COLORS.tooltipBorder}`,
        borderRadius: "0.5rem",
        padding: "8px 10px",
        fontSize: "12px",
      }}
    >
      <p className="mb-1 text-[var(--muted)]">{formatTooltipDay(label)}</p>
      {rows.map((r) => (
        <p key={r.name} className="tabular-nums text-[var(--foreground)]">
          <span className="text-[var(--muted)]">{r.name}: </span>
          {formatNumber(r.value)} {displayUnit}
        </p>
      ))}
    </div>
  );
}

function formatTooltipDay(label: number | string | undefined): string {
  const v = typeof label === "number" ? label : Number(label);
  if (!Number.isFinite(v)) return "";
  return new Date(v).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
