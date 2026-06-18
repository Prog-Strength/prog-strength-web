"use client";

/**
 * VARIANT: split-control-room  ·  draws on Linear
 *
 * Idiom: a denser TWO-PANE working surface. The chart + trend stats occupy
 * one column and the full weigh-in ledger stays permanently visible in the
 * other, so trajectory and history sit side by side instead of stacked behind
 * a scroll. Multi-per-day is handled with grouped sub-rows; hovering a ledger
 * row highlights its point on the chart.
 *
 * In-system: violet accent + slate ramp + Nunito; diverges on SPACING RHYTHM
 * (gridded, efficient, power-user density) and COLOR LOGIC (structural — the
 * accent marks the active/selected reading and the trend, neutrals do the
 * rest). Disposable mockup.
 */

import { useState } from "react";
import {
  ComposedChart,
  Line,
  ReferenceDot,
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
  trendSummary,
} from "../_data";

export function SplitControlRoom() {
  const [activeT, setActiveT] = useState<number | null>(null);
  const trend = ewmaTrend();
  const { ratePerWeek } = trendSummary();
  const active = DAY_POINTS.find((d) => d.t === activeT) ?? null;
  const yMin = Math.floor(Math.min(SUMMARY.min.weight, SUMMARY.goal) - 2);
  const yMax = Math.ceil(SUMMARY.max.weight + 2);
  const ledger = [...DAY_POINTS].reverse();

  return (
    <div className="grid grid-cols-1 gap-px bg-[var(--border)] lg:grid-cols-[1.25fr_1fr]">
      {/* LEFT: chart + dense trend stat grid */}
      <div className="flex flex-col gap-4 bg-[var(--background)] p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {["30d", "60d", "90d", "All"].map((r, i) => (
              <span
                key={r}
                className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  i === 0
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {r}
              </span>
            ))}
          </div>
          <span className="font-mono text-[11px] text-[var(--faint)]">
            {SUMMARY.endLabel.toUpperCase()}
          </span>
        </div>

        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="t"
                type="number"
                domain={["dataMin", "dataMax"]}
                stroke={GRID}
                tick={{ fill: AXIS_TEXT, fontSize: 10 }}
                tickFormatter={fmtTick}
                minTickGap={40}
              />
              <YAxis
                domain={[yMin, yMax]}
                stroke={GRID}
                tick={{ fill: AXIS_TEXT, fontSize: 10 }}
                width={28}
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
                fillOpacity={0.45}
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
              {/* selected reading lights up on the chart */}
              {active && (
                <>
                  <ReferenceLine x={active.t} stroke={ACCENT} strokeOpacity={0.4} />
                  <ReferenceDot
                    x={active.t}
                    y={active.avg}
                    r={5}
                    fill={ACCENT}
                    stroke="var(--background)"
                    strokeWidth={2}
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* dense stat grid */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--border)]">
          <Stat label="Average" value={`${fmt(SUMMARY.average)}`} unit="lb" />
          <Stat
            label="Range Δ"
            value={fmtSigned(SUMMARY.deltaLb)}
            unit={`${fmtSigned(SUMMARY.deltaPct)}%`}
            accent
          />
          <Stat label="Rate" value={fmtSigned(ratePerWeek)} unit="lb/wk" accent />
          <Stat label="Min" value={`${fmt(SUMMARY.min.weight)}`} unit={SUMMARY.min.label} />
          <Stat label="Max" value={`${fmt(SUMMARY.max.weight)}`} unit={SUMMARY.max.label} />
          <Stat label="Goal" value={`${SUMMARY.goal}`} unit={`${fmt(SUMMARY.toGo)} to go`} />
        </div>
      </div>

      {/* RIGHT: full weigh-in ledger, always visible */}
      <div className="flex flex-col bg-[var(--background)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
            Ledger · {SUMMARY.readingCount} readings
          </h3>
          <button className="rounded bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[var(--accent-fg)]">
            + Log
          </button>
        </div>
        <div className="max-h-[520px] flex-1 overflow-y-auto">
          {ledger.map((d) => {
            const isActive = d.t === activeT;
            return (
              <div
                key={`${d.month}-${d.day}`}
                onMouseEnter={() => setActiveT(d.t)}
                onMouseLeave={() => setActiveT(null)}
                className={`border-b border-[var(--border)] px-4 py-2 transition ${
                  isActive ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-baseline gap-2">
                    <span
                      className={`font-mono text-[11px] ${isActive ? "text-[var(--accent)]" : "text-[var(--faint)]"}`}
                    >
                      {fmtWeekday(d.month, d.day).toUpperCase()} {fmtMonthDay(d.month, d.day)}
                    </span>
                    {d.readings.length > 1 && (
                      <span className="rounded bg-[var(--surface-2)] px-1.5 text-[10px] font-semibold text-[var(--muted)]">
                        ×{d.readings.length}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmt(d.avg)} <span className="text-[11px] text-[var(--faint)]">lb</span>
                  </span>
                </div>
                {/* grouped sub-rows for multi-per-day */}
                {d.readings.length > 1 && (
                  <div className="mt-1 flex flex-col gap-0.5 border-l border-[var(--accent-line)] pl-2">
                    {d.readings.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-[11px] text-[var(--muted)]"
                      >
                        <span className="font-mono text-[var(--faint)]">
                          {fmtTime(r.hour, r.minute)}
                        </span>
                        <span className="tabular-nums">{fmt(r.weight)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-[var(--background)] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--faint)]">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span
          className={`text-lg font-bold tabular-nums ${accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"}`}
        >
          {value}
        </span>
        <span className="text-[10px] text-[var(--faint)]">{unit}</span>
      </p>
    </div>
  );
}
