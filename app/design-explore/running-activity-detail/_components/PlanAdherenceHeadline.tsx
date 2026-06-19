"use client";

/**
 * VARIANT 4 / 5 — idiom: plan-adherence-headline   (reference: MacroFactor)
 *
 * Frames the whole page around DID YOU HIT THE PRESCRIPTION. The thin linkage
 * banner is promoted to the hero: a verdict block with a prescribed-vs-actual
 * readout — target reps/pace from run_details set against what the trace
 * actually delivered — in a balanced target | actual two-column rhythm. Raw
 * metrics and the chart support beneath.
 *
 * In-system encoding:
 *   • type scale  — MID; a verdict line + a steady two-column comparison grid,
 *     no oversized hero figure.
 *   • color logic — ADHERENCE is the encoded thing: desaturated success on a
 *     hit, danger on a miss; green-teal carries the discipline. The verdict
 *     spends the color budget; everything else stays neutral.
 *   • spacing     — paired target/actual columns; calm, balanced.
 *
 * Answers "the planned-vs-actual story is buried." Degrades to a plain activity
 * readout for an unlinked run (the whole verdict block is simply omitted —
 * see UnlinkedFallback note below).
 */

import {
  ADHERENCE,
  fmtClock,
  fmtPace,
  fmtPaceDelta,
  PLAN,
  RUN,
  RUN_HUE,
  WORK_BOUTS,
} from "../_fixtures";

export function PlanAdherenceHeadline() {
  const hitMost = ADHERENCE.repsOnPace >= ADHERENCE.repsPlanned - 1;
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-5 py-6">
      {/* Verdict hero */}
      <div
        className="overflow-hidden rounded-[var(--radius-card)] border"
        style={{ borderColor: "var(--border-strong)" }}
      >
        <div
          className="flex items-center justify-between gap-3 px-5 py-3.5"
          style={{ background: RUN_HUE.bg }}
        >
          <div>
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: RUN_HUE.fg }}
            >
              Planned session
            </p>
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
              {PLAN.name}
            </h2>
          </div>
          <span
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              color: "var(--success)",
              background: "color-mix(in srgb, var(--success) 14%, transparent)",
            }}
          >
            ✓ Completed
          </span>
        </div>
        <div className="px-5 py-4">
          <p className="text-base leading-relaxed text-[var(--foreground)]">
            <strong
              className="font-semibold"
              style={{ color: hitMost ? "var(--success)" : "var(--danger)" }}
            >
              {ADHERENCE.repsOnPace} of {ADHERENCE.repsPlanned} reps
            </strong>{" "}
            on pace · work avg{" "}
            <strong className="font-semibold">{fmtPace(ADHERENCE.avgWorkPace)}</strong> vs target{" "}
            {fmtPace(ADHERENCE.targetWorkPace)}{" "}
            <span style={{ color: ADHERENCE.paceDelta > 0 ? "var(--danger)" : "var(--success)" }}>
              ({fmtPaceDelta(ADHERENCE.paceDelta)})
            </span>
            {ADHERENCE.fadeRep && <> — strong through rep {ADHERENCE.fadeRep - 1}, then a fade.</>}
          </p>

          {/* Per-rep adherence dots */}
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">Reps</span>
            <div className="flex gap-1.5">
              {WORK_BOUTS.map((b) => {
                const ok = b.avgPace <= PLAN.targetWorkPace + ADHERENCE.onPaceTol;
                return (
                  <span
                    key={b.rep}
                    title={`Rep ${b.rep}: ${fmtPace(b.avgPace)} /mi`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums"
                    style={{
                      color: ok ? "var(--success)" : "var(--danger)",
                      background: `color-mix(in srgb, ${ok ? "var(--success)" : "var(--danger)"} 13%, transparent)`,
                    }}
                  >
                    {b.rep}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Prescribed vs actual — the balanced two-column comparison. */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
        <div className="grid grid-cols-[1fr_auto_auto] items-center bg-[var(--surface-2)] px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          <span>Dimension</span>
          <span className="w-28 text-right">Prescribed</span>
          <span className="w-28 text-right">Actual</span>
        </div>
        <CompareRow label="Work bouts" target="8 × 400m" actual={`${ADHERENCE.repsRun} run`} ok />
        <CompareRow
          label="On-pace reps"
          target={`${ADHERENCE.repsPlanned}`}
          actual={`${ADHERENCE.repsOnPace}`}
          ok={ADHERENCE.repsOnPace >= ADHERENCE.repsPlanned - 1}
        />
        <CompareRow
          label="Work pace"
          target={`${fmtPace(ADHERENCE.targetWorkPace)} /mi`}
          actual={`${fmtPace(ADHERENCE.avgWorkPace)} /mi`}
          ok={ADHERENCE.paceDelta <= ADHERENCE.onPaceTol}
          delta={fmtPaceDelta(ADHERENCE.paceDelta)}
        />
        <CompareRow label="Recovery" target="200m jog" actual="~9:25 /mi" ok />
        <CompareRow label="Volume" target="~5.0 mi" actual={`${RUN.distanceMi.toFixed(1)} mi`} ok />
      </div>

      {/* Supporting raw metrics. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            ["Duration", fmtClock(RUN.durationSec)],
            ["Avg pace", `${fmtPace(RUN.avgPace)} /mi`],
            ["Avg HR", `${RUN.avgHr} bpm`],
            ["Calories", String(RUN.calories)],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
          >
            <p className="text-lg font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--faint)]">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompareRow({
  label,
  target,
  actual,
  ok,
  delta,
}: {
  label: string;
  target: string;
  actual: string;
  ok: boolean;
  delta?: string;
}) {
  const tone = ok ? "var(--success)" : "var(--danger)";
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center border-t border-[var(--border)] bg-[var(--surface)] px-5 py-2.5 text-sm">
      <span className="flex items-center gap-2 text-[var(--foreground)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tone }} />
        {label}
      </span>
      <span className="w-28 text-right tabular-nums text-[var(--muted)]">{target}</span>
      <span className="w-28 text-right tabular-nums font-semibold">
        {actual}
        {delta && (
          <span className="ml-1.5 text-[11px] font-normal" style={{ color: tone }}>
            {delta}
          </span>
        )}
      </span>
    </div>
  );
}
