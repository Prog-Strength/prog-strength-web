"use client";

/**
 * The ledger backbone: a "Splits" label, a miles↔intervals segmented toggle,
 * and the two tables it flips between. Pure and prop-driven over the
 * `running-splits` derivation output. The toggle is gated on detected
 * intervals — when `intervals` is null the surface degrades to a miles-only
 * view with no toggle. The miles table tints the pace column with the
 * green-teal discipline-run hue and tags the fastest/slowest full splits; the
 * intervals table adds a vs-target column for work bouts.
 *
 * Tokens only (design-system v0.4): accent only on the active toggle segment,
 * discipline-run for pace/work dot, success/danger for tags and vs-target.
 */

import { useState } from "react";
import { formatDuration } from "@/lib/format";
import type { IntervalSegment, Split } from "@/lib/running-splits";

type Mode = "miles" | "intervals";

/** Format a pace in sec/unit as `m:ss`; `—` when null. */
function fmtPaceUnit(secPerUnit: number | null): string {
  if (secPerUnit == null || !Number.isFinite(secPerUnit)) return "—";
  const total = Math.round(secPerUnit);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format a signed pace delta in sec/unit as `+m:ss` (slower) / `−m:ss` (faster). */
function fmtPaceDelta(deltaSec: number): string {
  const sign = deltaSec < 0 ? "−" : "+";
  const abs = Math.abs(Math.round(deltaSec));
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${sign}${m}:${String(s).padStart(2, "0")}`;
}

export function SplitsSpine({
  splits,
  intervals,
  unitLabel,
  formatDistance,
  hasTargetColumn,
  targetPaceSecPerUnit,
}: {
  splits: Split[];
  intervals: IntervalSegment[] | null;
  unitLabel: "mi" | "km";
  formatDistance: (meters: number) => string;
  hasTargetColumn: boolean;
  targetPaceSecPerUnit: number | null;
}) {
  const [mode, setMode] = useState<Mode>("miles");
  // The toggle only renders when intervals exist; force miles otherwise.
  const effectiveMode: Mode = intervals == null ? "miles" : mode;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          Splits
        </p>
        {intervals != null && (
          <div className="flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-[11px] font-medium">
            {(["miles", "intervals"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full px-3 py-1 capitalize transition ${
                  effectiveMode === m
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {effectiveMode === "miles" ? (
        <MilesTable splits={splits} unitLabel={unitLabel} formatDistance={formatDistance} />
      ) : (
        <IntervalsTable
          intervals={intervals!}
          formatDistance={formatDistance}
          hasTargetColumn={hasTargetColumn}
          targetPaceSecPerUnit={targetPaceSecPerUnit}
        />
      )}
    </div>
  );
}

function MilesTable({
  splits,
  unitLabel,
  formatDistance,
}: {
  splits: Split[];
  unitLabel: "mi" | "km";
  formatDistance: (meters: number) => string;
}) {
  const distLabel = unitLabel === "mi" ? "Mi" : "Km";
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
      <table className="w-full text-right text-[13px] tabular-nums tracking-[-0.03em]">
        <thead>
          <Th cols={["Split", "Dist", "Time", "Pace", "Avg HR", "Elev Δ"]} />
        </thead>
        <tbody>
          {splits.map((s) => (
            <tr
              key={s.index}
              className="border-t border-[var(--border)] odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40"
            >
              <td className="px-3 py-2 text-left text-[var(--muted)]">
                {s.partial
                  ? `${formatDistance(s.distanceMeters)} ${unitLabel}`
                  : `${distLabel} ${s.index + 1}`}
              </td>
              <td className="px-3 py-2">{formatDistance(s.distanceMeters)}</td>
              <td className="px-3 py-2">{formatDuration(s.durationSec)}</td>
              <td className="px-3 py-2 font-semibold text-[var(--discipline-run-fg)]">
                {fmtPaceUnit(s.avgPaceSecPerUnit)}
                {s.fastest && <Tag tone="success">fastest</Tag>}
                {s.slowest && <Tag tone="danger">slowest</Tag>}
              </td>
              <td className="px-3 py-2 text-[var(--muted)]">
                {s.avgHr != null ? Math.round(s.avgHr) : "—"}
              </td>
              <td className="px-3 py-2 text-[var(--faint)]">{fmtElevDelta(s.elevDeltaMeters)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IntervalsTable({
  intervals,
  formatDistance,
  hasTargetColumn,
  targetPaceSecPerUnit,
}: {
  intervals: IntervalSegment[];
  formatDistance: (meters: number) => string;
  hasTargetColumn: boolean;
  targetPaceSecPerUnit: number | null;
}) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
      <table className="w-full text-right text-[13px] tabular-nums tracking-[-0.03em]">
        <thead>
          <Th cols={["Segment", "Dist", "Time", "Pace", "HR", "vs target"]} />
        </thead>
        <tbody>
          {intervals.map((seg, i) => {
            const work = seg.kind === "work";
            const showDelta =
              work &&
              hasTargetColumn &&
              targetPaceSecPerUnit != null &&
              seg.avgPaceSecPerUnit != null;
            const delta = showDelta ? seg.avgPaceSecPerUnit! - targetPaceSecPerUnit! : null;
            return (
              <tr
                key={i}
                className="border-t border-[var(--border)] odd:bg-[var(--surface)] even:bg-[var(--surface-2)]/40"
              >
                <td className="px-3 py-2 text-left">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{
                        background: work ? "var(--discipline-run-dot)" : "var(--faint)",
                      }}
                    />
                    <span className={work ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
                      {seg.label}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2">{formatDistance(seg.distanceMeters)}</td>
                <td className="px-3 py-2">{formatDuration(seg.durationSec)}</td>
                <td
                  className={`px-3 py-2 font-semibold ${
                    work ? "text-[var(--discipline-run-fg)]" : "text-[var(--muted)]"
                  }`}
                >
                  {fmtPaceUnit(seg.avgPaceSecPerUnit)}
                </td>
                <td className="px-3 py-2 text-[var(--muted)]">
                  {seg.avgHr != null ? Math.round(seg.avgHr) : "—"}
                </td>
                <td className="px-3 py-2">
                  {delta == null ? (
                    <span className="text-[var(--faint)]">—</span>
                  ) : (
                    <span style={{ color: delta <= 0 ? "var(--success)" : "var(--danger)" }}>
                      {fmtPaceDelta(delta)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Signed elevation change, e.g. `+12 m` / `−4 m`; `—` when no data. */
function fmtElevDelta(meters: number | null): string {
  if (meters == null) return "—";
  const rounded = Math.round(meters);
  if (rounded === 0) return "0 m";
  const sign = rounded < 0 ? "−" : "+";
  return `${sign}${Math.abs(rounded)} m`;
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
