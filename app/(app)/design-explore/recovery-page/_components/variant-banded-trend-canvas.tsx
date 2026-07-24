"use client";

/**
 * IDIOM: banded-trend-canvas — draws on Apple Health's single-metric detail.
 *
 * The score CHART is the page: full-width and tall, the three band zones as
 * unmistakable translucent color FIELDS behind the line (the page's color
 * arrives as *background*, not marks), the window average as a labeled on-plot
 * line, the latest point ringed and annotated. Resting HR and HRV compress to
 * small-multiple strips beneath; the hero is a compact band-tinted header stat
 * row (window avg + latest).
 *
 * Distinct along: TYPE SCALE — quiet and uniform, no hero numeral; the plot is
 * the focal point. COLOR LOGIC — bands become the CANVAS itself (large
 * translucent fields), the opposite pole from command-hero's single-hue flood.
 * SPACING RHYTHM — generous whitespace, minimal chrome, one big surface.
 */

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import { recoveryBand } from "@/lib/recovery";
import {
  ascending,
  BAND_HEX,
  BAND_VAR,
  descending,
  mostRecent,
  RECOVERY_30D,
  shortDate,
  weekdayDate,
  windowSummary,
} from "./fixtures";

const PAGE_SIZE = 12;

export function BandedTrendCanvas() {
  const rows = RECOVERY_30D;
  const summary = windowSummary(rows);
  const chart = ascending(rows);
  const recent = mostRecent(rows);
  const recentBand = recent?.recovery_score != null ? recoveryBand(recent.recovery_score) : null;

  const [page, setPage] = useState(0);
  const log = descending(rows);
  const pageCount = Math.ceil(log.length / PAGE_SIZE);
  const visible = log.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {/* Compact header stat row — band-tinted, no ring */}
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex items-end gap-6">
          <HeaderStat
            kicker={`${summary.count}-day average`}
            value={summary.score}
            tint={summary.scoreBand ? BAND_VAR[summary.scoreBand] : undefined}
          />
          <HeaderStat
            kicker={recent ? `Latest · ${shortDate(recent.date)}` : "Latest"}
            value={recent?.recovery_score ?? null}
            tint={recentBand ? BAND_VAR[recentBand] : undefined}
            small
          />
          <div className="flex flex-col gap-1 pb-1 text-[12px] text-[var(--muted)]">
            <span>{summary.restingHr} bpm resting</span>
            <span>{summary.hrv} ms HRV</span>
          </div>
        </div>
        <span className="pb-1 text-[12px] text-[var(--faint)]">
          Today&apos;s recovery hasn&apos;t landed yet
        </span>
      </div>

      {/* The canvas — bands as background fields */}
      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: BAND_HEX.success, opacity: 0.5 }}
            />
            67–100
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: BAND_HEX.warning, opacity: 0.5 }}
            />
            34–66
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: BAND_HEX.danger, opacity: 0.5 }}
            />
            0–33
          </span>
        </div>
        <div className="h-[300px] w-full sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 10, right: 44, bottom: 4, left: -10 }}>
              <ReferenceArea y1={67} y2={100} fill={BAND_HEX.success} fillOpacity={0.16} />
              <ReferenceArea y1={34} y2={66} fill={BAND_HEX.warning} fillOpacity={0.16} />
              <ReferenceArea y1={0} y2={33} fill={BAND_HEX.danger} fillOpacity={0.16} />
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fill: "#565a63", fontSize: 11 }}
                minTickGap={30}
                stroke="rgba(255,255,255,0.08)"
              />
              <YAxis
                domain={[0, 100]}
                width={34}
                tick={{ fill: "#565a63", fontSize: 11 }}
                stroke="rgba(255,255,255,0.08)"
              />
              {summary.score !== null && (
                <ReferenceLine
                  y={summary.score}
                  stroke="#c8cad0"
                  strokeOpacity={0.5}
                  strokeDasharray="5 4"
                  label={{
                    value: `avg ${summary.score}`,
                    position: "right",
                    fill: "#7d818c",
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                dataKey="recovery_score"
                stroke="#e6e7ea"
                strokeWidth={2.25}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />
              {recent?.recovery_score != null && recentBand && (
                <ReferenceDot
                  x={recent.date}
                  y={recent.recovery_score}
                  r={5}
                  fill={BAND_HEX[recentBand]}
                  stroke="var(--background)"
                  strokeWidth={2}
                  label={{
                    value: `${recent.recovery_score}`,
                    position: "top",
                    fill: BAND_HEX[recentBand],
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Small-multiple strips */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StripChart
          title="Resting heart rate"
          unit="bpm"
          data={chart}
          dataKey="resting_heart_rate"
          avg={summary.restingHr}
        />
        <StripChart
          title="HRV"
          unit="ms"
          data={chart}
          dataKey="hrv_rmssd_milli"
          avg={summary.hrv}
        />
      </div>

      {/* Log — compact & paginated, low chrome */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          Day log
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 sm:gap-x-8">
          {visible.map((r) => {
            const b = r.recovery_score !== null ? recoveryBand(r.recovery_score) : null;
            return (
              <div
                key={r.date}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2 text-[13px]"
              >
                <span className="text-[var(--muted)]">{weekdayDate(r.date)}</span>
                <div className="flex items-center gap-4 tabular-nums">
                  <span
                    className="w-7 text-right font-semibold"
                    style={{ color: b ? BAND_VAR[b] : "var(--faint)" }}
                  >
                    {r.recovery_score ?? "—"}
                  </span>
                  <span className="w-12 text-right text-[var(--faint)]">
                    {r.resting_heart_rate ?? "—"}
                  </span>
                  <span className="w-12 text-right text-[var(--faint)]">
                    {r.hrv_rmssd_milli ?? "—"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex items-center justify-between text-[12px] text-[var(--muted)]">
          <span>
            {log.length} days · page {page + 1}/{pageCount}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 disabled:opacity-40"
            >
              ‹
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
        <a
          href="/settings?tab=integrations"
          className="mt-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </a>
      </div>
    </div>
  );
}

function HeaderStat({
  kicker,
  value,
  tint,
  small,
}: {
  kicker: string;
  value: number | null;
  tint?: string;
  small?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        {kicker}
      </span>
      <span
        className={`font-semibold leading-none tracking-[-0.04em] tabular-nums ${small ? "text-[32px]" : "text-[52px]"}`}
        style={{ color: tint ?? "var(--foreground)" }}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function StripChart({
  title,
  unit,
  data,
  dataKey,
  avg,
}: {
  title: string;
  unit: string;
  data: { date: string; resting_heart_rate: number | null; hrv_rmssd_milli: number | null }[];
  dataKey: "resting_heart_rate" | "hrv_rmssd_milli";
  avg: number | null;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[12px] font-medium text-[var(--foreground)]">{title}</span>
        <span className="text-[12px] tabular-nums text-[var(--faint)]">
          avg {avg ?? "—"} {unit}
        </span>
      </div>
      <div className="h-[92px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -28 }}>
            {avg !== null && (
              <ReferenceLine y={avg} stroke="#565a63" strokeDasharray="4 4" strokeWidth={1} />
            )}
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} hide />
            <Line
              dataKey={dataKey}
              stroke="#9ca0aa"
              strokeWidth={1.75}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
