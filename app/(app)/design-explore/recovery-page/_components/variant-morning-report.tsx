"use client";

/**
 * IDIOM: morning-report — draws on Oura's readiness briefing.
 *
 * The page reads as a DAILY REPORT, not a dashboard: a date kicker, a one-line
 * coaching verdict in the house voice, then CONTRIBUTOR ROWS (score, resting
 * HR, HRV) — each with its value, a baseline-delta arrow, and a whisper of
 * sparkline. The no-data state is a briefing too: "While today's recovery lands,
 * here's your 30-day baseline." This is the only idiom that makes the baselines
 * a first-class product voice.
 *
 * Distinct along: TYPE SCALE — medium, editorial, no giant numeral; language
 * carries the page. COLOR LOGIC — the most restrained of the five: band DOTS
 * and delta arrows only, everything else neutral. SPACING RHYTHM — generous
 * leading, airy vertical prose rhythm.
 */

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { recoveryBand, type RecoveryBand } from "@/lib/recovery";
import {
  ascending,
  BAND_VAR,
  baselineDelta,
  descending,
  mostRecent,
  RECOVERY_30D,
  weekdayDate,
  windowSummary,
} from "./fixtures";

const PAGE_SIZE = 10;

export function MorningReport() {
  const rows = RECOVERY_30D;
  const summary = windowSummary(rows);
  const chart = ascending(rows);
  const recent = mostRecent(rows);
  const [page, setPage] = useState(0);
  const log = descending(rows);
  const pageCount = Math.ceil(log.length / PAGE_SIZE);
  const visible = log.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const verdict = useMemo(
    () => buildVerdict(summary.scoreBand, summary.hrv, recent?.hrv_rmssd_milli ?? null),
    [summary, recent],
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-10">
      {/* Editorial header */}
      <div className="flex flex-col gap-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--faint)]">
          Thursday · Jul 23 · Morning report
        </span>
        <p className="text-[22px] font-medium leading-[1.4] tracking-[-0.01em] text-[var(--foreground)]">
          {verdict}
        </p>
        <p className="text-[14px] leading-relaxed text-[var(--muted)]">
          Today&apos;s recovery hasn&apos;t landed yet. While it does, here&apos;s where your last{" "}
          {summary.count} days sit —{" "}
          <span className="text-[var(--foreground)]">{summary.score}</span> ·{" "}
          <span className="text-[var(--foreground)]">{summary.restingHr} bpm</span> ·{" "}
          <span className="text-[var(--foreground)]">{summary.hrv} ms</span>.
        </p>
      </div>

      {/* Contributor rows */}
      <div className="flex flex-col divide-y divide-[var(--border)] border-y border-[var(--border)]">
        <Contributor
          label="Recovery score"
          value={summary.score}
          unit=""
          band={summary.scoreBand}
          recent={recent?.recovery_score ?? null}
          baseline={summary.score}
          series={chart.map((r) => r.recovery_score)}
          higherIsBetter
        />
        <Contributor
          label="Resting heart rate"
          value={summary.restingHr}
          unit="bpm"
          band={null}
          recent={recent?.resting_heart_rate ?? null}
          baseline={summary.restingHr}
          series={chart.map((r) => r.resting_heart_rate)}
          higherIsBetter={false}
        />
        <Contributor
          label="Heart-rate variability"
          value={summary.hrv}
          unit="ms"
          band={null}
          recent={recent?.hrv_rmssd_milli ?? null}
          baseline={summary.hrv}
          series={chart.map((r) => r.hrv_rmssd_milli)}
          higherIsBetter
        />
      </div>

      {/* Log — a quiet paginated appendix to the briefing */}
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
          Recent mornings
        </span>
        <div className="flex flex-col">
          {visible.map((r) => {
            const b = r.recovery_score !== null ? recoveryBand(r.recovery_score) : null;
            return (
              <div
                key={r.date}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] py-2.5 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: b ? BAND_VAR[b] : "var(--surface-3)" }}
                  />
                  <span className="text-[13px] text-[var(--foreground)]">
                    {weekdayDate(r.date)}
                  </span>
                </div>
                <div className="flex items-center gap-6 text-[13px] tabular-nums text-[var(--muted)]">
                  <span className="w-8 text-right text-[var(--foreground)]">
                    {r.recovery_score ?? "—"}
                  </span>
                  <span className="w-14 text-right">{r.resting_heart_rate ?? "—"} bpm</span>
                  <span className="w-14 text-right">{r.hrv_rmssd_milli ?? "—"} ms</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[12px] text-[var(--muted)]">
          <span>
            {log.length} mornings · page {page + 1} of {pageCount}
          </span>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="text-[var(--accent)] disabled:text-[var(--faint)] disabled:opacity-50"
            >
              ← Newer
            </button>
            <button
              type="button"
              disabled={page >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              className="text-[var(--accent)] disabled:text-[var(--faint)] disabled:opacity-50"
            >
              Older →
            </button>
          </div>
        </div>
        <a
          href="/settings?tab=integrations"
          className="text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </a>
      </div>
    </div>
  );
}

function Contributor({
  label,
  value,
  unit,
  band,
  recent,
  baseline,
  series,
  higherIsBetter,
}: {
  label: string;
  value: number | null;
  unit: string;
  band: RecoveryBand | null;
  recent: number | null;
  baseline: number | null;
  series: (number | null)[];
  higherIsBetter: boolean;
}) {
  const delta = baselineDelta(recent, baseline);
  // Restrained color: the arrow is neutral unless the move is meaningfully
  // good/bad — a whisper of state, never a stoplight.
  const good = delta !== null && (higherIsBetter ? delta >= 0 : delta <= 0);
  const arrowColor =
    delta === null || delta === 0 ? "var(--faint)" : good ? "var(--success)" : "var(--danger)";
  return (
    <div className="flex items-center justify-between gap-4 py-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {band && <span className="h-2 w-2 rounded-full" style={{ background: BAND_VAR[band] }} />}
          <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
            {label}
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[32px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
            {value ?? "—"}
          </span>
          {unit && <span className="text-[13px] text-[var(--faint)]">{unit}</span>}
        </div>
        <span className="text-[12px] tabular-nums" style={{ color: arrowColor }}>
          {delta === null
            ? "no recent reading"
            : delta === 0
              ? "→ at your baseline"
              : `${good ? "↑" : "↓"} ${delta > 0 ? "+" : ""}${delta}${unit ? ` ${unit}` : ""} vs baseline`}
        </span>
      </div>
      <div className="h-[40px] w-[128px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series.map((v, i) => ({ i, v }))}>
            <Line
              dataKey="v"
              stroke="var(--muted)"
              strokeWidth={1.5}
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

/** Coaching-voice verdict from the window band and the HRV trend. */
function buildVerdict(
  band: RecoveryBand | null,
  hrvBaseline: number | null,
  recentHrv: number | null,
): string {
  const lead =
    band === "success"
      ? "Strong month — your recovery has been trending green."
      : band === "danger"
        ? "You've been running low — recovery has sat in the red band."
        : "Steady month — your recovery is averaging in the yellow band.";
  if (hrvBaseline === null || recentHrv === null) return lead;
  const pct = Math.round(((recentHrv - hrvBaseline) / hrvBaseline) * 100);
  if (pct === 0) return `${lead} HRV is right on your 30-day baseline.`;
  return `${lead} HRV is ${Math.abs(pct)}% ${pct > 0 ? "above" : "below"} your 30-day baseline.`;
}
