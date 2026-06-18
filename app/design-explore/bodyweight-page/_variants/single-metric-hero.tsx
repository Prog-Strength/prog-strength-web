"use client";

/**
 * VARIANT: single-metric-hero  ·  draws on Whoop / Oura
 *
 * Idiom: the page opens with a big, confident HERO. The current weight sits
 * in the Oswald-style condensed display face at a huge size, a direction
 * arrow + range delta beside it, and "X lb to go" as a quiet sub-line — the
 * half-second "where am I at" hit. A compact trend sparkline rides under the
 * hero; the full chart and a calm log live below.
 *
 * In-system: violet accent + slate ramp + Nunito/Oswald; diverges on TYPE
 * SCALE (dramatic contrast — one enormous numeral, everything else small) and
 * COLOR LOGIC (the accent marks direction / goal-progress only). Disposable.
 */

import {
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ACCENT, AXIS_TEXT, GOAL_LINE, GRID, RAW_DOT, TOOLTIP_STYLE } from "../_chart";
import {
  DAY_POINTS,
  RAW_POINTS,
  SUMMARY,
  ewmaTrend,
  fmt,
  fmtSigned,
  fmtDayLong,
  fmtMonthDay,
  fmtTick,
  fmtTime,
  fmtWeekday,
} from "../_data";

const HERO = 185.0; // latest reading — the "where am I at" number
const down = SUMMARY.deltaLb <= 0;

export function SingleMetricHero() {
  const trend = ewmaTrend();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-8">
      {/* HERO — Oswald numeral at a huge size, the emotional headline */}
      <div className="flex flex-col items-center gap-3 pt-2 text-center sm:pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--faint)]">
          Current weight
        </p>
        <div className="flex items-start justify-center gap-2">
          <span className="font-[family-name:var(--font-display)] text-[88px] font-semibold leading-[0.85] tracking-tight tabular-nums sm:text-[128px]">
            {fmt(HERO)}
          </span>
          <span className="mt-3 font-[family-name:var(--font-display)] text-2xl font-medium text-[var(--muted)] sm:mt-5 sm:text-3xl">
            lb
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              down
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "bg-[var(--surface-2)] text-[var(--muted)]"
            }`}
          >
            <span className="text-base leading-none">{down ? "↓" : "↑"}</span>
            {fmtSigned(SUMMARY.deltaLb)} lb · {fmtSigned(SUMMARY.deltaPct)}%
            <span className="font-medium opacity-70">/ {SUMMARY.rangeLabel}</span>
          </span>
        </div>
        <p className="text-sm text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">{fmt(SUMMARY.toGo)} lb</span> to
          your <span className="font-semibold text-[var(--foreground)]">{SUMMARY.goal} lb</span>{" "}
          goal
        </p>

        {/* Sparkline directly under the hero (hand-rolled SVG, axis-free) */}
        <Sparkline />
      </div>

      {/* Full chart, calm, below the hero */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">Last 30 days</h3>
          <span className="text-xs text-[var(--faint)]">avg {fmt(SUMMARY.average)} lb</span>
        </div>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke={GRID}
                tick={{ fill: AXIS_TEXT, fontSize: 10 }}
                tickFormatter={fmtTick}
                minTickGap={44}
              />
              <YAxis
                domain={[(min: number) => Math.floor(min - 2), (max: number) => Math.ceil(max + 2)]}
                stroke={GRID}
                tick={{ fill: AXIS_TEXT, fontSize: 10 }}
                width={30}
                tickFormatter={(v: number) => `${Math.round(v)}`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                wrapperStyle={{ outline: "none" }}
                labelFormatter={(l) => fmtDayLong(Number(l))}
                formatter={(value) => [`${fmt(Number(value))} lb`, "Trend"]}
              />
              <Scatter
                data={RAW_POINTS}
                dataKey="weight"
                fill={RAW_DOT}
                fillOpacity={0.4}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke={ACCENT}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine y={SUMMARY.goal} stroke={GOAL_LINE} strokeDasharray="5 5" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Calm recent log — not a spreadsheet, just the last few weigh-ins */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold tracking-tight">Recent</h3>
          <button className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-bold text-[var(--accent-fg)]">
            + Log
          </button>
        </div>
        {RAW_POINTS.slice(-5)
          .reverse()
          .map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-[var(--surface)] px-4 py-2.5"
            >
              <span className="text-sm text-[var(--muted)]">
                {fmtWeekday(new Date(r.t).getUTCMonth(), new Date(r.t).getUTCDate())}{" "}
                {fmtMonthDay(new Date(r.t).getUTCMonth(), new Date(r.t).getUTCDate())} ·{" "}
                <span className="text-[var(--faint)]">{fmtTime(r.hour, r.minute)}</span>
              </span>
              <span className="font-semibold tabular-nums">{fmt(r.weight)} lb</span>
            </div>
          ))}
      </div>
    </div>
  );
}

/** Axis-free sparkline of the smoothed trend, drawn straight as an SVG path. */
function Sparkline() {
  const pts = DAY_POINTS.map((d) => d.avg);
  const w = 280;
  const h = 56;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const stepX = w / (pts.length - 1);
  const coords = pts.map((p, i) => {
    const x = i * stepX;
    const y = h - 6 - ((p - min) / span) * (h - 12);
    return [x, y] as const;
  });
  const d = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const [lx, ly] = coords[coords.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="mt-1 max-w-full">
      <defs>
        <linearGradient id="smh-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${h} L0,${h} Z`} fill="url(#smh-fade)" />
      <path
        d={d}
        fill="none"
        stroke={ACCENT}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r={3.5} fill={ACCENT} />
    </svg>
  );
}
