"use client";

/**
 * VARIANT: calm-canvas  ·  draws on Apple Health + Linear
 *
 * Idiom: the whole surface is ONE large, quiet chart. The four stat tiles
 * dissolve into on-plot annotations — min, max, average and the goal are
 * labelled directly on the curve where they occur, so the graph carries its
 * own legend and the page is mostly breathing room. The log folds into a
 * secondary drawer reached from the canvas.
 *
 * In-system: violet accent + slate ramp + Nunito; diverges on SPACING RHYTHM
 * (generous negative space, minimal chrome) and COLOR LOGIC (maximally
 * restrained — violet trend, faint slate readings, a single hairline goal
 * marker, no tiles, no fills). Subtraction, not a big numeral. Disposable.
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
import { ACCENT, AXIS_TEXT, GOAL_LINE, RAW_DOT, TOOLTIP_STYLE } from "../_chart";
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

const minDay = DAY_POINTS.reduce((a, b) => (b.avg < a.avg ? b : a));
const maxDay = DAY_POINTS.reduce((a, b) => (b.avg > a.avg ? b : a));

export function CalmCanvas() {
  const [drawer, setDrawer] = useState(false);
  const trend = ewmaTrend();
  const yMin = Math.floor(Math.min(minDay.avg, SUMMARY.goal) - 3);
  const yMax = Math.ceil(maxDay.avg + 4);

  return (
    <div className="relative flex flex-col gap-8 p-6 sm:p-12">
      {/* quietest possible header */}
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold tracking-tight text-[var(--muted)]">Bodyweight</h3>
          <p className="font-[family-name:var(--font-display)] text-3xl font-medium tracking-tight tabular-nums">
            {fmt(SUMMARY.average)}{" "}
            <span className="text-base font-normal text-[var(--muted)]">lb avg · 30 days</span>
          </p>
        </div>
        <button
          onClick={() => setDrawer(true)}
          className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--accent-line)] hover:text-[var(--foreground)]"
        >
          History & log →
        </button>
      </div>

      {/* the canvas: a single large chart that carries its own legend */}
      <div className="h-[360px] w-full sm:h-[440px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 24, right: 56, bottom: 8, left: 8 }}>
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              stroke="transparent"
              tick={{ fill: AXIS_TEXT, fontSize: 11 }}
              tickLine={false}
              tickFormatter={fmtTick}
              minTickGap={56}
            />
            <YAxis domain={[yMin, yMax]} hide />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              wrapperStyle={{ outline: "none" }}
              labelFormatter={(l) => fmtDayLong(Number(l))}
              formatter={(value) => [`${fmt(Number(value))} lb`, "Trend"]}
            />
            {/* faint raw readings */}
            <Scatter
              data={RAW_POINTS}
              dataKey="weight"
              fill={RAW_DOT}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
            {/* average — labelled directly on the plot, no tile */}
            <ReferenceLine
              y={SUMMARY.average}
              stroke={AXIS_TEXT}
              strokeDasharray="2 4"
              strokeOpacity={0.5}
              label={{
                value: `avg ${fmt(SUMMARY.average)}`,
                position: "left",
                fill: AXIS_TEXT,
                fontSize: 10,
              }}
            />
            {/* single hairline goal marker */}
            <ReferenceLine
              y={SUMMARY.goal}
              stroke={GOAL_LINE}
              strokeDasharray="6 4"
              label={{
                value: `goal ${SUMMARY.goal} · ${fmt(SUMMARY.toGo)} to go`,
                position: "right",
                fill: GOAL_LINE,
                fontSize: 10,
              }}
            />
            {/* the trend */}
            <Line
              type="monotone"
              dataKey="trend"
              stroke={ACCENT}
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
            />
            {/* min & max annotated where they occur */}
            <ReferenceDot
              x={minDay.t}
              y={minDay.avg}
              r={4}
              fill={ACCENT}
              stroke="var(--background)"
              strokeWidth={2}
              label={{
                value: `low ${fmt(minDay.avg)} · ${fmtMonthDay(minDay.month, minDay.day)}`,
                position: "bottom",
                fill: AXIS_TEXT,
                fontSize: 10,
              }}
            />
            <ReferenceDot
              x={maxDay.t}
              y={maxDay.avg}
              r={4}
              fill={ACCENT}
              stroke="var(--background)"
              strokeWidth={2}
              label={{
                value: `high ${fmt(maxDay.avg)} · ${fmtMonthDay(maxDay.month, maxDay.day)}`,
                position: "top",
                fill: AXIS_TEXT,
                fontSize: 10,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* one quiet line of supporting context, far apart */}
      <p className="text-center text-xs text-[var(--faint)]">
        {SUMMARY.readingCount} readings · trending {fmtSigned(SUMMARY.deltaLb)} lb over the range ·
        smoothed trend through the daily spread
      </p>

      {/* History drawer — the log folds away off the canvas */}
      {drawer && (
        <div className="absolute inset-0 z-10 flex justify-end">
          <button
            aria-label="Close"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/40"
          />
          <aside className="relative flex h-full w-full max-w-sm flex-col border-l border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <h4 className="text-sm font-bold">History</h4>
              <button
                onClick={() => setDrawer(false)}
                className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {[...RAW_POINTS].reverse().map((r, i) => {
                const dt = new Date(r.t);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-[var(--border)] py-2.5 text-sm last:border-b-0"
                  >
                    <span className="text-[var(--muted)]">
                      {fmtWeekday(dt.getUTCMonth(), dt.getUTCDate())}{" "}
                      {fmtMonthDay(dt.getUTCMonth(), dt.getUTCDate())}
                      <span className="ml-2 text-[var(--faint)]">{fmtTime(r.hour, r.minute)}</span>
                    </span>
                    <span className="font-semibold tabular-nums">{fmt(r.weight)} lb</span>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-[var(--border)] p-4">
              <button className="w-full rounded-full bg-[var(--accent)] py-2 text-sm font-bold text-[var(--accent-fg)]">
                + Log a reading
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
