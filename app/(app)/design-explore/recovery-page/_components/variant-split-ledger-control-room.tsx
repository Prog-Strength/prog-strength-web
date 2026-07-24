"use client";

/**
 * IDIOM: split-ledger-control-room — draws on Linear's composure + Garmin
 * Connect's respect for tabular history.
 *
 * A dense TWO-PANE working surface: charts and a compact hero strip in one
 * column, the day LEDGER permanently visible in the other — tight tabular rows
 * (date · banded score cell · bpm · ms), paginated at 15, and hovering a row
 * highlights its point on the chart. This is the idiom that takes "the log is
 * half the surface" most seriously — the ledger stops being an afterthought
 * below the fold.
 *
 * Distinct along: TYPE SCALE — crisp, small, uniform; no hero numeral at all.
 * COLOR LOGIC — structural: band color as a thin row edge / score-cell fill,
 * accent reserved strictly for the active row + pager. SPACING RHYTHM — gridded,
 * high-density, the tightest of the five.
 */

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
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
  RECOVERY_30D,
  shortDate,
  weekdayDate,
  windowSummary,
} from "./fixtures";

const PAGE_SIZE = 15;

export function SplitLedgerControlRoom() {
  const rows = RECOVERY_30D;
  const summary = windowSummary(rows);
  const chart = ascending(rows);
  const log = descending(rows);
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const pageCount = Math.ceil(log.length / PAGE_SIZE);
  const visible = log.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const hoverRow = hover ? (rows.find((r) => r.date === hover) ?? null) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          Recovery · control room · today pending
        </span>
        <a
          href="/settings?tab=integrations"
          className="text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_1fr]">
        {/* LEFT — hero strip + charts */}
        <div className="flex flex-col gap-4">
          {/* Gridded hero strip */}
          <div className="grid grid-cols-3 divide-x divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
            <StripCell
              label={`${summary.count}d avg`}
              value={summary.score}
              tint={summary.scoreBand ? BAND_VAR[summary.scoreBand] : undefined}
            />
            <StripCell label="Resting HR" value={summary.restingHr} unit="bpm" />
            <StripCell label="HRV" value={summary.hrv} unit="ms" />
          </div>

          {/* Score chart with band zones + hover highlight */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-[12px] font-medium">Recovery score</span>
              <span className="text-[11px] tabular-nums text-[var(--faint)]">
                {hoverRow
                  ? `${weekdayDate(hoverRow.date)} · ${hoverRow.recovery_score ?? "—"}`
                  : `avg ${summary.score}`}
              </span>
            </div>
            <div className="h-[176px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
                  <ReferenceArea y1={67} y2={100} fill={BAND_HEX.success} fillOpacity={0.08} />
                  <ReferenceArea y1={34} y2={66} fill={BAND_HEX.warning} fillOpacity={0.08} />
                  <ReferenceArea y1={0} y2={33} fill={BAND_HEX.danger} fillOpacity={0.08} />
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={{ fill: "#565a63", fontSize: 10 }}
                    minTickGap={24}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <YAxis
                    domain={[0, 100]}
                    width={28}
                    tick={{ fill: "#565a63", fontSize: 10 }}
                    stroke="rgba(255,255,255,0.08)"
                  />
                  <Line
                    dataKey="recovery_score"
                    stroke="#d3d5da"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {hoverRow?.recovery_score != null && (
                    <ReferenceDot
                      x={hoverRow.date}
                      y={hoverRow.recovery_score}
                      r={5}
                      fill="var(--accent)"
                      stroke="var(--background)"
                      strokeWidth={2}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Two tight metric strips */}
          <div className="grid grid-cols-2 gap-4">
            <MiniLine
              title="Resting HR"
              unit="bpm"
              data={chart}
              dataKey="resting_heart_rate"
              hover={hoverRow?.date ?? null}
            />
            <MiniLine
              title="HRV"
              unit="ms"
              data={chart}
              dataKey="hrv_rmssd_milli"
              hover={hoverRow?.date ?? null}
            />
          </div>
        </div>

        {/* RIGHT — permanent dense ledger */}
        <div className="flex flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b border-[var(--border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
            <span>Date</span>
            <span className="w-9 text-right">Score</span>
            <span className="w-12 text-right">RHR</span>
            <span className="w-12 text-right">HRV</span>
          </div>
          <div className="flex flex-col">
            {visible.map((r) => {
              const b = r.recovery_score !== null ? recoveryBand(r.recovery_score) : null;
              const active = hover === r.date;
              return (
                <button
                  type="button"
                  key={r.date}
                  onMouseEnter={() => setHover(r.date)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(r.date)}
                  onBlur={() => setHover(null)}
                  className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 border-b border-[var(--border)] px-3 py-[7px] text-left text-[12px] tabular-nums transition-colors last:border-0 ${
                    active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
                  }`}
                  style={{
                    borderLeft: `2px solid ${active ? "var(--accent)" : b ? BAND_VAR[b] : "transparent"}`,
                  }}
                >
                  <span className={active ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
                    {weekdayDate(r.date)}
                  </span>
                  <span className="w-9 text-right">
                    {r.recovery_score !== null && b ? (
                      <span
                        className="inline-block min-w-8 rounded px-1.5 py-0.5 font-semibold"
                        style={{
                          color: BAND_VAR[b],
                          background: `color-mix(in srgb, ${BAND_VAR[b]} 16%, transparent)`,
                        }}
                      >
                        {r.recovery_score}
                      </span>
                    ) : (
                      <span className="text-[var(--faint)]">—</span>
                    )}
                  </span>
                  <span className="w-12 text-right text-[var(--muted)]">
                    {r.resting_heart_rate ?? "—"}
                  </span>
                  <span className="w-12 text-right text-[var(--muted)]">
                    {r.hrv_rmssd_milli ?? "—"}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] px-3 py-2 text-[11px] text-[var(--muted)]">
            <span>
              {log.length} rows · {page + 1}/{pageCount}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--accent)] disabled:text-[var(--faint)] disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                className="rounded border border-[var(--border)] px-2 py-0.5 text-[var(--accent)] disabled:text-[var(--faint)] disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StripCell({
  label,
  value,
  unit,
  tint,
}: {
  label: string;
  value: number | null;
  unit?: string;
  tint?: string;
}) {
  return (
    <div className="px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
        {label}
      </div>
      <div
        className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-[-0.03em]"
        style={{ color: tint ?? "var(--foreground)" }}
      >
        {value ?? "—"}
        {unit && <span className="ml-1 text-[11px] font-normal text-[var(--faint)]">{unit}</span>}
      </div>
    </div>
  );
}

function MiniLine({
  title,
  unit,
  data,
  dataKey,
  hover,
}: {
  title: string;
  unit: string;
  data: { date: string; resting_heart_rate: number | null; hrv_rmssd_milli: number | null }[];
  dataKey: "resting_heart_rate" | "hrv_rmssd_milli";
  hover: string | null;
}) {
  const hoverRow = hover ? (data.find((d) => d.date === hover) ?? null) : null;
  const hv = hoverRow?.[dataKey] ?? null;
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] font-medium text-[var(--muted)]">{title}</span>
        <span className="text-[11px] tabular-nums text-[var(--faint)]">
          {hv !== null ? `${hv} ${unit}` : ""}
        </span>
      </div>
      <div className="h-[64px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -34 }}>
            <XAxis dataKey="date" hide />
            <YAxis domain={["auto", "auto"]} hide />
            <Line
              dataKey={dataKey}
              stroke="#9ca0aa"
              strokeWidth={1.5}
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            {hoverRow && hv !== null && (
              <ReferenceDot x={hoverRow.date} y={hv} r={3.5} fill="var(--accent)" stroke="none" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
