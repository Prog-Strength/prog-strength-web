"use client";

/**
 * VARIANT 3 / 5 — idiom: effort-trace-hero   (reference: Whoop)
 *
 * The TRACE is the hero. One enlarged, near-full-bleed effort chart dominates
 * the surface: pace and HR synced on a shared distance axis, with the detected
 * interval boundaries drawn as green-teal bands BEHIND the line so the surges
 * and recoveries read as the shape of the session. The eight stat tiles
 * collapse to a thin caption rail; numbers become marginalia.
 *
 * This is the variant that most directly TAMES THE DROPOUT: pace is winsorized
 * to a readable clamp and the line is broken at the mile-2 glitch (a small
 * marker calls it out) so one garbage sample never squashes the plot.
 *
 * In-system encoding:
 *   • type scale  — BIG-CHART hierarchy: the plot is the page, figures shrink
 *     to axis annotations / a caption rail.
 *   • color logic — a single delicate stroke per series; green-teal interval
 *     bands; the accent is reserved for the hovered cursor only.
 *   • spacing     — generous; the chart claims the page.
 *
 * Pace axis is INVERTED (faster = higher) so a rising line always means effort.
 * Degrades: no interval bands for an easy/unlinked run → just the two traces.
 */

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtClock, fmtPace, PACE_CLAMP_MAX, RUN, RUN_HUE, SEGMENTS, TRACE } from "../_fixtures";

const DROPOUT_MI = TRACE.find((p) => p.isDropout)?.mi ?? 2.0;

const chartData = TRACE.map((p) => ({
  mi: p.mi,
  pace: p.paceClean != null ? Math.min(p.paceClean, PACE_CLAMP_MAX) : null,
  hr: p.hr,
}));

const workBands = SEGMENTS.filter((s) => s.kind === "work");

// Clamp the pace domain to the real signal, ignoring the broken glitch sample.
const cleanPaces = chartData.map((d) => d.pace).filter((v): v is number => v != null);
const paceMin = Math.min(...cleanPaces) - 8;
const paceMax = Math.max(...cleanPaces) + 8;

export function EffortTraceHero() {
  return (
    <div className="flex w-full flex-col gap-4 px-6 py-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.02em]">{RUN.name}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {RUN.start} · {fmtClock(RUN.durationSec)}
          </p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ background: RUN_HUE.bg, color: RUN_HUE.fg }}
        >
          ✓ W7 D2 — Interval Run
        </span>
      </div>

      {/* HERO: the effort trace claims the page. */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center gap-5 text-[11px] uppercase tracking-wider">
          <Legend color={RUN_HUE.dot} label="Pace · faster ↑" />
          <Legend color="var(--foreground)" dashed label="Heart rate" />
          <Legend color={RUN_HUE.fg} swatch label="Work bout" />
        </div>
        <div className="h-[420px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 44, bottom: 18, left: 4 }}>
              <defs>
                <linearGradient id="paceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={RUN_HUE.dot} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={RUN_HUE.dot} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Interval bands behind the line. */}
              {workBands.map((b, i) => (
                <ReferenceArea
                  key={i}
                  x1={b.startMi}
                  x2={b.endMi}
                  fill={RUN_HUE.dot}
                  fillOpacity={0.08}
                  ifOverflow="extendDomain"
                />
              ))}

              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="mi"
                type="number"
                domain={[0, RUN.distanceMi]}
                stroke="var(--faint)"
                tick={{ fill: "var(--faint)", fontSize: 11 }}
                tickFormatter={(v: number) => `${v.toFixed(0)} mi`}
                tickLine={false}
              />
              {/* Pace axis — reversed so faster (lower sec) sits at the TOP. */}
              <YAxis
                yAxisId="pace"
                reversed
                domain={[paceMin, paceMax]}
                width={48}
                stroke="var(--faint)"
                tick={{ fill: RUN_HUE.fg, fontSize: 11 }}
                tickFormatter={(v: number) => fmtPace(v)}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="hr"
                orientation="right"
                domain={[120, 200]}
                width={40}
                stroke="var(--faint)"
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                tickFormatter={(v: number) => String(Math.round(v))}
                tickLine={false}
                axisLine={false}
              />

              <ReferenceLine
                yAxisId="hr"
                y={RUN.avgHr}
                stroke="var(--faint)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              {/* Dropout marker — the glitch is annotated, not plotted. */}
              <ReferenceLine
                yAxisId="pace"
                x={DROPOUT_MI}
                stroke="var(--warning)"
                strokeDasharray="3 3"
                strokeWidth={1}
                label={{
                  value: "device dropout",
                  position: "insideTopRight",
                  fill: "var(--warning)",
                  fontSize: 10,
                }}
              />

              <Area
                yAxisId="pace"
                dataKey="pace"
                stroke="none"
                fill="url(#paceFill)"
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="pace"
                dataKey="pace"
                stroke={RUN_HUE.dot}
                strokeWidth={2}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="hr"
                dataKey="hr"
                stroke="var(--foreground)"
                strokeOpacity={0.5}
                strokeWidth={1.25}
                strokeDasharray="3 3"
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--accent)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelFormatter={(v) => `${Number(v).toFixed(2)} mi`}
                formatter={(value, name) =>
                  name === "pace"
                    ? [`${fmtPace(Number(value))} /mi`, "Pace"]
                    : [`${Math.round(Number(value))} bpm`, "HR"]
                }
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Caption rail — the eight tiles, demoted to marginalia. */}
      <div className="flex flex-wrap gap-x-8 gap-y-2 px-1">
        {(
          [
            ["Distance", `${RUN.distanceMi.toFixed(1)} mi`],
            ["Duration", fmtClock(RUN.durationSec)],
            ["Avg pace", `${fmtPace(RUN.avgPace)} /mi`],
            ["Best pace", `${fmtPace(RUN.bestPace)} /mi`],
            ["Avg HR", `${RUN.avgHr} bpm`],
            ["Max HR", `${RUN.maxHr} bpm`],
            ["Calories", String(RUN.calories)],
            ["Elevation", "no data"],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
              {label}
            </span>
            <span className="text-sm font-semibold tabular-nums tracking-[-0.03em]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({
  color,
  label,
  dashed,
  swatch,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  swatch?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[var(--muted)]">
      {swatch ? (
        <span
          className="inline-block h-2.5 w-3.5 rounded-sm"
          style={{ background: color, opacity: 0.25 }}
        />
      ) : (
        <span
          className="inline-block h-0 w-4 border-t-2"
          style={{ borderColor: color, borderStyle: dashed ? "dashed" : "solid" }}
        />
      )}
      {label}
    </span>
  );
}
