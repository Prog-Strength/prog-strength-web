"use client";

/**
 * IDIOM: readiness-command-hero — draws on Whoop's today screen.
 *
 * The band-stroked ring stays the emotional hero, but it NEVER empties: when
 * today's webhook hasn't landed it renders the window AVERAGE at reduced
 * emphasis — a dashed stroke in the average's band hue, a small "30-DAY AVG"
 * kicker where "recovery today" sits — swapping to a solid full-strength ring
 * the moment real data arrives. The hero band hue then PROPAGATES down the page
 * (chart emphasis, delta chips, log accents) so a yellow window *feels* yellow
 * everywhere.
 *
 * Distinct along: TYPE SCALE — dramatic contrast, one enormous numeral against
 * uniformly tiny everything-else. COLOR LOGIC — a single band hue floods the
 * page as tint. SPACING RHYTHM — airy, breathing top; denser stacked bottom.
 */

import { useState } from "react";
import { Area, AreaChart, ReferenceArea, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { recoveryBand } from "@/lib/recovery";
import {
  ascending,
  BAND_HEX,
  BAND_VAR,
  baselineDelta,
  descending,
  mostRecent,
  RECOVERY_30D,
  shortDate,
  weekdayDate,
  windowSummary,
  type RangeKey,
} from "./fixtures";

const RANGES: RangeKey[] = ["7", "30", "90"];
const PAGE_SIZE = 12;

export function ReadinessCommandHero() {
  const rows = RECOVERY_30D;
  const summary = windowSummary(rows);
  const band = summary.scoreBand ?? "warning";
  const hue = BAND_HEX[band];
  const hueVar = BAND_VAR[band];
  const chart = ascending(rows);
  const recent = mostRecent(rows);

  const [page, setPage] = useState(0);
  const log = descending(rows);
  const pageCount = Math.ceil(log.length / PAGE_SIZE);
  const visible = log.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12">
      {/* Hero — airy, one giant numeral, dashed average ring (no dead hero). */}
      <div className="flex flex-col items-center gap-7 pt-4">
        <AvgRing pct={summary.score ?? 0} hue={hue} />
        <div className="flex flex-col items-center gap-1.5">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.22em]"
            style={{ color: hueVar }}
          >
            30-Day Avg
          </span>
          <p className="text-[13px] text-[var(--muted)]">
            Today&apos;s recovery hasn&apos;t landed yet — your {summary.count}-day baseline.
          </p>
        </div>

        <div className="flex items-stretch gap-3">
          <BigStat label="Resting HR" value={summary.restingHr} unit="bpm" />
          <BigStat label="HRV" value={summary.hrv} unit="ms" />
        </div>

        {recent?.recovery_score != null && (
          <p className="text-[12px] text-[var(--faint)]">
            Last recorded <span className="text-[var(--muted)]">{weekdayDate(recent.date)}</span> ·{" "}
            <span style={{ color: BAND_VAR[recoveryBand(recent.recovery_score)] }}>
              {recent.recovery_score}
            </span>
          </p>
        )}
      </div>

      {/* Denser bottom — the band hue floods the trend area. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] font-semibold tracking-tight">Recovery trend</h3>
          <StaticRange />
        </div>
        <div
          className="rounded-[var(--radius-card)] border p-4"
          style={{
            borderColor: "var(--border)",
            background: `linear-gradient(180deg, color-mix(in srgb, ${hue} 6%, var(--surface)), var(--surface))`,
          }}
        >
          <div className="h-[190px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="rch-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hue} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={hue} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <ReferenceArea y1={67} y2={100} fill={BAND_HEX.success} fillOpacity={0.06} />
                <ReferenceArea y1={34} y2={66} fill={BAND_HEX.warning} fillOpacity={0.06} />
                <ReferenceArea y1={0} y2={33} fill={BAND_HEX.danger} fillOpacity={0.06} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fill: "#565a63", fontSize: 10 }}
                  minTickGap={26}
                  stroke="rgba(255,255,255,0.06)"
                />
                <YAxis
                  domain={[0, 100]}
                  width={30}
                  tick={{ fill: "#565a63", fontSize: 10 }}
                  stroke="rgba(255,255,255,0.06)"
                />
                <Area
                  dataKey="recovery_score"
                  stroke={hue}
                  strokeWidth={2.5}
                  fill="url(#rch-fill)"
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex justify-between gap-3 border-t border-[var(--border)] pt-3">
            <Delta
              label="Resting HR"
              value={summary.restingHr}
              baseline={summary.restingHr}
              unit="bpm"
            />
            <Delta label="HRV" value={summary.hrv} baseline={summary.hrv} unit="ms" />
          </div>
        </div>
      </div>

      {/* Compact paginated log — band accents propagate as a left edge. */}
      <div className="flex flex-col gap-2">
        <h3 className="text-[13px] font-semibold tracking-tight">Day log</h3>
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
          {visible.map((r) => {
            const b = r.recovery_score !== null ? recoveryBand(r.recovery_score) : null;
            return (
              <div
                key={r.date}
                className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-2 last:border-0"
                style={{ borderLeft: `2px solid ${b ? BAND_VAR[b] : "transparent"}` }}
              >
                <span className="text-[13px] text-[var(--foreground)]">{weekdayDate(r.date)}</span>
                <div className="flex items-center gap-5 text-[12px] tabular-nums">
                  <span
                    className="min-w-8 text-right font-semibold"
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
              </div>
            );
          })}
        </div>
        <Pager page={page} pageCount={pageCount} onPage={setPage} total={log.length} />
        <a
          href="/settings?tab=integrations"
          className="mt-1 self-end text-[12px] font-medium text-[var(--accent)] hover:underline"
        >
          Manage Whoop connection →
        </a>
      </div>
    </div>
  );
}

/** The command ring — dashed when showing an average, huge centered numeral. */
function AvgRing({ pct, hue }: { pct: number; hue: string }) {
  const r = 78;
  const c = 2 * Math.PI * r;
  const frac = Math.min(Math.max(pct, 0), 100) / 100;
  return (
    <div className="relative grid h-[248px] w-[248px] place-items-center">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="100" cy="100" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={r}
          fill="none"
          stroke={hue}
          strokeOpacity={0.85}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(c * frac) / 40} 7`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-[92px] font-semibold leading-none tracking-[-0.05em] tabular-nums"
          style={{ color: hue }}
        >
          {Math.round(pct)}
        </span>
      </div>
    </div>
  );
}

function BigStat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="min-w-[128px] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-center">
      <div className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]">
        {value ?? "—"}
        <span className="ml-1 text-[12px] font-normal text-[var(--faint)]">{unit}</span>
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

function Delta({
  label,
  value,
  baseline,
  unit,
}: {
  label: string;
  value: number | null;
  baseline: number | null;
  unit: string;
}) {
  const d = baselineDelta(value, baseline);
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </span>
      <span className="text-[14px] font-semibold tabular-nums">
        {value ?? "—"} <span className="text-[11px] font-normal text-[var(--faint)]">{unit}</span>
        {d !== null && (
          <span className="ml-1.5 text-[11px] font-normal text-[var(--muted)]">
            {d === 0 ? "at baseline" : `${d > 0 ? "+" : ""}${d} vs avg`}
          </span>
        )}
      </span>
    </div>
  );
}

/** Static, non-interactive range display — 30d fixed for the mockup. */
function StaticRange() {
  return (
    <div className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5">
      {RANGES.map((r) => (
        <span
          key={r}
          className={`rounded-full px-3 py-1 text-[11px] font-medium ${
            r === "30" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-[var(--muted)]"
          }`}
        >
          {r}d
        </span>
      ))}
    </div>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
  total,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
  total: number;
}) {
  return (
    <div className="flex items-center justify-between px-1 text-[12px] text-[var(--muted)]">
      <span>
        {total} days · page {page + 1} of {pageCount}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onPage(Math.max(0, page - 1))}
          className="rounded-md border border-[var(--border)] px-2 py-1 disabled:opacity-40 enabled:hover:bg-[var(--surface-2)]"
        >
          Prev
        </button>
        <button
          type="button"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(Math.min(pageCount - 1, page + 1))}
          className="rounded-md border border-[var(--border)] px-2 py-1 disabled:opacity-40 enabled:hover:bg-[var(--surface-2)]"
        >
          Next
        </button>
      </div>
    </div>
  );
}
