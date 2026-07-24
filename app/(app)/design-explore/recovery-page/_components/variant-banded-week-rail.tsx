"use client";

/**
 * IDIOM: banded-week-rail — draws on Whoop's trend calendar with
 * GitHub-contribution-cell energy.
 *
 * The organizing spine is a horizontal RAIL of band-colored day cells spanning
 * the window — the page's single densest color moment: thirty small cells in
 * greens, ambers and corals, hollow where a night is missing, today's cell
 * outlined-empty until data lands. Selecting a cell drives the detail panel
 * beneath (that day's three metrics vs baseline); the default selection when
 * today is empty is the WINDOW SUMMARY. Recovery becomes a *streak surface* you
 * scrub, not a stack you scroll.
 *
 * Distinct along: TYPE SCALE — uniform and compact, no hero numeral; the rail
 * is the focal object. COLOR LOGIC — virtually ALL color is concentrated in the
 * rail; everything below stays neutral. SPACING RHYTHM — even, metronomic,
 * grid-cell cadence.
 */

import { useMemo, useState } from "react";
import { recoveryBand } from "@/lib/recovery";
import {
  BAND_VAR,
  baselineDelta,
  descending,
  RECOVERY_30D,
  TODAY_ISO,
  weekdayDate,
  windowSummary,
  type WindowSummary,
} from "./fixtures";
import type { WhoopRecoveryDay } from "@/lib/api";

const PAGE_SIZE = 12;

/** Enumerate the inclusive local-date span [start, end], newest last. */
function enumerateSpan(startIso: string, endIso: string): string[] {
  const [ys, ms, ds] = startIso.split("-").map(Number);
  const [ye, me, de] = endIso.split("-").map(Number);
  const out: string[] = [];
  const cur = new Date(ys, ms - 1, ds);
  const end = new Date(ye, me - 1, de);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export function BandedWeekRail() {
  const rows = RECOVERY_30D;
  const summary = windowSummary(rows);
  const byDate = useMemo(() => new Map(rows.map((r) => [r.date, r] as const)), [rows]);
  const span = useMemo(() => enumerateSpan("2026-06-24", TODAY_ISO), []);

  const [selected, setSelected] = useState<string | null>(null); // null → window summary
  const [page, setPage] = useState(0);
  const log = descending(rows);
  const pageCount = Math.ceil(log.length / PAGE_SIZE);
  const visible = log.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const selectedRow = selected ? (byDate.get(selected) ?? null) : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          30-day recovery streak · today pending
        </span>
        <a
          href="/settings?tab=integrations"
          className="text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </a>
      </div>

      {/* THE RAIL — the page's whole color story */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap gap-1.5">
          {span.map((iso) => {
            const row = byDate.get(iso);
            const isToday = iso === TODAY_ISO;
            const score = row?.recovery_score ?? null;
            const band = score !== null ? recoveryBand(score) : null;
            const isSelected = selected === iso || (selected === null && isToday);
            const dayNum = Number(iso.split("-")[2]);

            let style: React.CSSProperties;
            if (isToday && score === null) {
              style = {
                border: "1.5px dashed var(--faint)",
                background: "transparent",
                color: "var(--muted)",
              };
            } else if (band) {
              style = {
                background: `color-mix(in srgb, ${BAND_VAR[band]} 40%, var(--surface))`,
                border: `1px solid color-mix(in srgb, ${BAND_VAR[band]} 60%, transparent)`,
                color: "var(--foreground)",
              };
            } else {
              // Missing night — hollow
              style = {
                border: "1px dashed var(--border-strong)",
                background: "transparent",
                color: "var(--faint)",
              };
            }

            return (
              <button
                type="button"
                key={iso}
                onClick={() => setSelected(isToday ? null : iso)}
                aria-label={`${weekdayDate(iso)}${score !== null ? ` · ${score}` : row ? "" : " · no data"}`}
                className="grid h-9 w-9 place-items-center rounded-[7px] text-[11px] font-medium tabular-nums transition"
                style={{
                  ...style,
                  outline: isSelected ? "2px solid var(--accent)" : "none",
                  outlineOffset: "1px",
                }}
              >
                {dayNum}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 pt-1 text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
          <Legend swatch={BAND_VAR.success} label="67+" />
          <Legend swatch={BAND_VAR.warning} label="34–66" />
          <Legend swatch={BAND_VAR.danger} label="0–33" />
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-[4px] border border-dashed border-[var(--border-strong)]" />
            missing
          </span>
        </div>
      </div>

      {/* DETAIL PANEL — neutral; the color already lives in the rail */}
      {selectedRow ? (
        <DayDetail row={selectedRow} summary={summary} />
      ) : (
        <SummaryDetail summary={summary} isTodayPending={selected === null} />
      )}

      {/* Compact paginated log strip */}
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
          Day log
        </span>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
          {visible.map((r) => {
            const b = r.recovery_score !== null ? recoveryBand(r.recovery_score) : null;
            return (
              <button
                type="button"
                key={r.date}
                onClick={() => setSelected(r.date)}
                className={`flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2 text-left text-[12px] transition last:border-0 hover:bg-[var(--surface-2)] ${
                  selected === r.date ? "bg-[var(--accent-soft)]" : ""
                }`}
              >
                <span className="text-[var(--muted)]">{weekdayDate(r.date)}</span>
                <div className="flex items-center gap-5 tabular-nums">
                  <span
                    className="w-7 text-right font-semibold"
                    style={{ color: b ? BAND_VAR[b] : "var(--faint)" }}
                  >
                    {r.recovery_score ?? "—"}
                  </span>
                  <span className="w-14 text-right text-[var(--muted)]">
                    {r.resting_heart_rate ?? "—"} bpm
                  </span>
                  <span className="w-14 text-right text-[var(--muted)]">
                    {r.hrv_rmssd_milli ?? "—"} ms
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[12px] text-[var(--muted)]">
          <span>
            {log.length} days · page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="rounded-md border border-[var(--border)] px-2 py-0.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-[4px]" style={{ background: swatch, opacity: 0.7 }} />
      {label}
    </span>
  );
}

function SummaryDetail({
  summary,
  isTodayPending,
}: {
  summary: WindowSummary;
  isTodayPending: boolean;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">
          {isTodayPending ? "Today · Thu Jul 23" : "Window summary"}
        </span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
          {isTodayPending ? "Awaiting tonight's sync" : `${summary.count}-day baseline`}
        </span>
      </div>
      <p className="text-[13px] leading-relaxed text-[var(--muted)]">
        Today&apos;s recovery hasn&apos;t landed yet — showing your {summary.count}-day baseline.
        Select any cell above to scrub to that day.
      </p>
      <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
        <DetailStat
          label="Avg score"
          value={summary.score}
          tint={summary.scoreBand ? BAND_VAR[summary.scoreBand] : undefined}
        />
        <DetailStat label="Avg resting HR" value={summary.restingHr} unit="bpm" />
        <DetailStat label="Avg HRV" value={summary.hrv} unit="ms" />
      </div>
    </div>
  );
}

function DayDetail({ row, summary }: { row: WhoopRecoveryDay; summary: WindowSummary }) {
  const band = row.recovery_score !== null ? recoveryBand(row.recovery_score) : null;
  return (
    <div className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">{weekdayDate(row.date)}</span>
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--faint)]">
          vs {summary.count}-day baseline
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
        <DetailStat
          label="Score"
          value={row.recovery_score}
          tint={band ? BAND_VAR[band] : undefined}
          delta={baselineDelta(row.recovery_score, summary.score)}
        />
        <DetailStat
          label="Resting HR"
          value={row.resting_heart_rate}
          unit="bpm"
          delta={baselineDelta(row.resting_heart_rate, summary.restingHr)}
          invert
        />
        <DetailStat
          label="HRV"
          value={row.hrv_rmssd_milli}
          unit="ms"
          delta={baselineDelta(row.hrv_rmssd_milli, summary.hrv)}
        />
      </div>
    </div>
  );
}

function DetailStat({
  label,
  value,
  unit,
  tint,
  delta,
  invert,
}: {
  label: string;
  value: number | null;
  unit?: string;
  tint?: string;
  delta?: number | null;
  invert?: boolean;
}) {
  const good = delta != null && delta !== 0 && (invert ? delta < 0 : delta > 0);
  const bad = delta != null && delta !== 0 && !good;
  const deltaColor = bad ? "var(--danger)" : good ? "var(--success)" : "var(--faint)";
  return (
    <div className="flex flex-col gap-1 px-4 first:pl-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
        {label}
      </span>
      <span
        className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
        style={{ color: tint ?? "var(--foreground)" }}
      >
        {value ?? "—"}
        {unit && value !== null && (
          <span className="ml-1 text-[11px] font-normal text-[var(--faint)]">{unit}</span>
        )}
      </span>
      {delta !== undefined && (
        <span className="text-[11px] tabular-nums" style={{ color: deltaColor }}>
          {delta === null
            ? "—"
            : delta === 0
              ? "at baseline"
              : `${delta > 0 ? "+" : ""}${delta} vs avg`}
        </span>
      )}
    </div>
  );
}
