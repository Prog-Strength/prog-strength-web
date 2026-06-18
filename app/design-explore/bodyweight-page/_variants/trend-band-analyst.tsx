"use client";

/**
 * VARIANT: trend-band-analyst  ·  draws on TrendWeight / Libra
 *
 * Idiom: the trend WINS, decisively. A smoothed EWMA curve in the violet
 * accent is the unmistakable subject — thick and confident, wrapped in a
 * faint ±spread band — while the raw morning/evening readings drop to small,
 * low-contrast slate dots in the background. A rate-of-change readout
 * ("−0.4 lb/wk") annotates the curve. The chart is enlarged to own the page;
 * the four stats compress into a single thin caption strip beneath it.
 *
 * In-system: violet accent + slate ramp + Nunito; diverges on COMPOSITION
 * (one giant analytical chart) and COLOR LOGIC (one accent on neutral — the
 * trend is the only saturated thing on screen). Disposable mockup.
 */

import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ACCENT, ACCENT_BAND, AXIS_TEXT, GOAL_LINE, GRID, RAW_DOT, TOOLTIP_STYLE } from "../_chart";
import {
  DAY_POINTS,
  RAW_POINTS,
  SUMMARY,
  ewmaTrend,
  fmt,
  fmtSigned,
  fmtDayLong,
  fmtTick,
  trendSummary,
} from "../_data";

const RANGES = ["30 days", "60 days", "90 days", "All"];

export function TrendBandAnalyst() {
  // Precompute the ±band as a [lo, hi] tuple per point so the range Area
  // reads it straight off `band` (no function accessor).
  const trend = ewmaTrend().map((p) => ({ ...p, band: [p.lo, p.hi] as [number, number] }));
  const { current, ratePerWeek } = trendSummary();
  const yMin = Math.floor(Math.min(SUMMARY.min.weight, SUMMARY.goal) - 2);
  const yMax = Math.ceil(SUMMARY.max.weight + 2);

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-7">
      {/* Range tabs — quiet, since the chart is the headline */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
          {RANGES.map((r, i) => (
            <span
              key={r}
              className={
                i === 0
                  ? "rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-fg)]"
                  : "rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)]"
              }
            >
              {r}
            </span>
          ))}
        </div>
        <span className="hidden text-xs text-[var(--faint)] sm:block">
          {SUMMARY.readingCount} readings · ending {SUMMARY.endLabel}
        </span>
      </div>

      {/* Trend hero readout above the giant chart */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--faint)]">
            Trend now
          </p>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="font-[family-name:var(--font-display)] text-5xl font-semibold tabular-nums text-[var(--foreground)]">
              {fmt(current)}
            </span>
            <span className="text-base font-semibold text-[var(--muted)]">lb</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-sm font-bold text-[var(--accent)]">
              {ratePerWeek <= 0 ? "↓" : "↑"} {fmtSigned(ratePerWeek)} lb/wk
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <LegendDot label="EWMA trend" kind="line" />
          <LegendDot label="±spread band" kind="band" />
          <LegendDot label="readings" kind="dot" />
          <LegendDot label={`goal ${SUMMARY.goal}`} kind="goal" />
        </div>
      </div>

      {/* The chart owns the page */}
      <div className="h-[300px] w-full sm:h-[400px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="tba-band" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                <stop offset="100%" stopColor={ACCENT} stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke={GRID}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              tickFormatter={fmtTick}
              minTickGap={36}
            />
            <YAxis
              domain={[yMin, yMax]}
              stroke={GRID}
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v)}`}
              width={36}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              wrapperStyle={{ outline: "none" }}
              labelFormatter={(l) => fmtDayLong(Number(l))}
              formatter={(value, name) => {
                if (name === "band") return [null, null] as unknown as [string, string];
                return [`${fmt(Number(value))} lb`, "Trend"];
              }}
            />
            {/* faint ±spread band — context, not headline */}
            <Area
              type="monotone"
              dataKey="band"
              name="band"
              stroke="none"
              fill="url(#tba-band)"
              fillOpacity={1}
              isAnimationActive={false}
              activeDot={false}
              legendType="none"
            />
            {/* raw readings: small, low-contrast, in the background */}
            <Scatter
              data={RAW_POINTS}
              dataKey="weight"
              fill={RAW_DOT}
              fillOpacity={0.5}
              shape="circle"
              isAnimationActive={false}
              legendType="none"
            />
            {/* the subject: a thick, confident violet trend curve */}
            <Line
              type="monotone"
              dataKey="trend"
              stroke={ACCENT}
              strokeWidth={3.5}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine
              y={SUMMARY.goal}
              stroke={GOAL_LINE}
              strokeDasharray="5 5"
              strokeWidth={1.25}
              label={{
                value: `Goal ${SUMMARY.goal}`,
                position: "right",
                fill: GOAL_LINE,
                fontSize: 10,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats compressed to a thin caption strip beneath the chart */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-sm">
        <Cap label="Average" value={`${fmt(SUMMARY.average)} lb`} />
        <Cap
          label="Range Δ"
          value={`${fmtSigned(SUMMARY.deltaLb)} lb (${fmtSigned(SUMMARY.deltaPct)}%)`}
          accent
        />
        <Cap label="Low" value={`${fmt(SUMMARY.min.weight)} · ${SUMMARY.min.label}`} />
        <Cap label="High" value={`${fmt(SUMMARY.max.weight)} · ${SUMMARY.max.label}`} />
        <Cap label="To goal" value={`${fmt(SUMMARY.toGo)} lb`} />
        <span className="ml-auto text-xs text-[var(--faint)]">
          {DAY_POINTS.length} days · trend smoothed (EWMA α0.25)
        </span>
      </div>
    </div>
  );
}

function Cap({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </span>
      <span
        className={`font-semibold tabular-nums ${accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
      >
        {value}
      </span>
    </span>
  );
}

function LegendDot({ label, kind }: { label: string; kind: "line" | "band" | "dot" | "goal" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[var(--muted)]">
      {kind === "line" && (
        <span className="h-0.5 w-5 rounded-full" style={{ background: ACCENT }} />
      )}
      {kind === "band" && (
        <span className="h-3 w-5 rounded-sm" style={{ background: ACCENT_BAND }} />
      )}
      {kind === "dot" && <span className="h-2 w-2 rounded-full" style={{ background: RAW_DOT }} />}
      {kind === "goal" && (
        <span className="h-0 w-5 border-t border-dashed" style={{ borderColor: GOAL_LINE }} />
      )}
      {label}
    </span>
  );
}
