"use client";

/**
 * VARIANT 2 / 5 — idiom: splits-ledger-spine   (reference: Runalyze / Garmin)
 *
 * The run as a LOG OF SEGMENTS. The per-distance splits table is the backbone;
 * the page reads top-to-bottom as a ledger. A segmented toggle flips the spine
 * between per-mile splits and the detected work/recovery intervals. Charts
 * demote to a thin supporting strip beneath the table.
 *
 * In-system encoding:
 *   • type scale  — UNIFORM, fine, tabular figures; hierarchy from ALIGNMENT,
 *     not size. No hero number anywhere.
 *   • color logic — restrained, color-as-state only: green-teal tints the pace
 *     column; success/danger mark the fastest/slowest standout rows. Elevation
 *     Δ is a dash (no barometric data) rather than a fake zero.
 *   • spacing     — dense, gridded, maximally informative; hairline row rules.
 *
 * Answers "I read my run as numbers in rows." Degrades cleanly: an unlinked run
 * just drops the Intervals tab; missing HR shows a dash column.
 */

import { useState } from "react";
import {
  fmtClock,
  fmtPace,
  fmtPaceDelta,
  PACE_CLAMP_MAX,
  PLAN,
  RUN,
  RUN_HUE,
  SEGMENTS,
  SPLITS,
  TRACE,
  type Segment,
} from "../_fixtures";

type Mode = "miles" | "intervals";

export function SplitsLedgerSpine() {
  const [mode, setMode] = useState<Mode>("miles");
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-6">
      <HeaderRow />
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          Splits
        </p>
        <SegToggle mode={mode} onChange={setMode} />
      </div>
      {mode === "miles" ? <MilesTable /> : <IntervalsTable />}
      <PaceStrip />
    </div>
  );
}

function HeaderRow() {
  // Summary tiles fold into a compact gridded header band.
  const cells: [string, string][] = [
    ["Distance", `${RUN.distanceMi.toFixed(1)} mi`],
    ["Time", fmtClock(RUN.durationSec)],
    ["Avg pace", `${fmtPace(RUN.avgPace)}`],
    ["Best", `${fmtPace(RUN.bestPace)}`],
    ["Avg HR", `${RUN.avgHr}`],
    ["Max HR", `${RUN.maxHr}`],
    ["Calories", String(RUN.calories)],
    ["Elev", "—"],
  ];
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-[-0.02em]">{RUN.name}</h2>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ background: RUN_HUE.bg, color: RUN_HUE.fg }}
        >
          ✓ {PLAN.name}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{RUN.start}</p>
      <div className="mt-3 grid grid-cols-4 divide-x divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] sm:grid-cols-8">
        {cells.map(([label, value]) => (
          <div key={label} className="bg-[var(--surface)] px-3 py-2">
            <p className="text-sm font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--faint)]">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SegToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  // Design-system segmented control: surface track, accent-filled active seg.
  return (
    <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px] font-medium">
      {(["miles", "intervals"] as Mode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-full px-3 py-1 capitalize transition ${
            mode === m
              ? "bg-[var(--accent)] text-[var(--accent-fg)]"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function MilesTable() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
      <table className="w-full text-right text-[13px] tabular-nums">
        <thead>
          <Th cols={["Split", "Dist", "Time", "Pace", "Avg HR", "Elev Δ"]} />
        </thead>
        <tbody>
          {SPLITS.map((s, i) => (
            <tr
              key={i}
              className="border-t border-[var(--border)] odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40"
            >
              <td className="px-3 py-2 text-left text-[var(--muted)]">{s.label}</td>
              <td className="px-3 py-2">{s.distanceMi.toFixed(2)}</td>
              <td className="px-3 py-2">{fmtClock(s.durationSec)}</td>
              <td className="px-3 py-2 font-semibold" style={{ color: RUN_HUE.fg }}>
                {fmtPace(s.avgPace)}
                {s.fastest && <Tag tone="success">fastest</Tag>}
                {s.slowest && <Tag tone="danger">slowest</Tag>}
              </td>
              <td className="px-3 py-2 text-[var(--muted)]">{s.avgHr}</td>
              <td className="px-3 py-2 text-[var(--faint)]">—</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntervalsTable() {
  const rows = SEGMENTS.filter((s) => s.kind === "work" || s.kind === "recovery");
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
      <table className="w-full text-right text-[13px] tabular-nums">
        <thead>
          <Th cols={["Segment", "Dist", "Time", "Pace", "HR", "vs target"]} />
        </thead>
        <tbody>
          {rows.map((seg, i) => (
            <IntervalRow key={i} seg={seg} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntervalRow({ seg }: { seg: Segment }) {
  const work = seg.kind === "work";
  const delta = work && seg.targetPace != null ? seg.avgPace - seg.targetPace : null;
  const onPace = delta != null && delta <= PLAN.targetWorkPace * 0 + 8;
  return (
    <tr className="border-t border-[var(--border)] odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40">
      <td className="px-3 py-2 text-left">
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: work ? RUN_HUE.dot : "var(--faint)" }}
          />
          <span className={work ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
            {seg.label}
          </span>
        </span>
      </td>
      <td className="px-3 py-2">{seg.distanceMi.toFixed(2)}</td>
      <td className="px-3 py-2">{fmtClock(seg.durationSec)}</td>
      <td className="px-3 py-2 font-semibold" style={{ color: work ? RUN_HUE.fg : "var(--muted)" }}>
        {fmtPace(seg.avgPace)}
      </td>
      <td className="px-3 py-2 text-[var(--muted)]">{seg.avgHr}</td>
      <td className="px-3 py-2">
        {delta == null ? (
          <span className="text-[var(--faint)]">—</span>
        ) : (
          <span style={{ color: onPace ? "var(--success)" : "var(--danger)" }}>
            {fmtPaceDelta(delta)}
          </span>
        )}
      </td>
    </tr>
  );
}

function Th({ cols }: { cols: string[] }) {
  return (
    <tr className="bg-[var(--surface-2)] text-[10px] uppercase tracking-wider text-[var(--faint)]">
      {cols.map((c, i) => (
        <th key={c} className={`px-3 py-2 font-semibold ${i === 0 ? "text-left" : "text-right"}`}>
          {c}
        </th>
      ))}
    </tr>
  );
}

function Tag({ tone, children }: { tone: "success" | "danger"; children: React.ReactNode }) {
  const color = tone === "success" ? "var(--success)" : "var(--danger)";
  return (
    <span
      className="ml-2 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

/** Demoted supporting strip: a hand-rolled winsorized pace sparkline.
 *  Faster pace sits HIGHER so a rising line never reads as slowing down. */
function PaceStrip() {
  const W = 720;
  const H = 64;
  const pts = TRACE.filter((p) => p.paceClean != null) as { mi: number; paceClean: number }[];
  const paces = pts.map((p) => Math.min(p.paceClean, PACE_CLAMP_MAX));
  const lo = Math.min(...paces);
  const hi = Math.max(...paces);
  const x = (mi: number) => (mi / RUN.distanceMi) * W;
  // invert: fast (lo) → top (small y)
  const y = (pace: number) =>
    ((Math.min(pace, PACE_CLAMP_MAX) - lo) / (hi - lo || 1)) * (H - 8) + 4;
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${x(p.mi).toFixed(1)},${y(p.paceClean).toFixed(1)}`)
    .join(" ");
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wider text-[var(--faint)]">
        <span>Pace trace · faster ↑</span>
        <span>dropout bridged</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" preserveAspectRatio="none">
        <path
          d={d}
          fill="none"
          stroke={RUN_HUE.dot}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
