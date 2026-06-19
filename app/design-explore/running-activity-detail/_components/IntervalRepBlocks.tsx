"use client";

/**
 * VARIANT 1 / 5 — idiom: interval-rep-blocks   (reference: TrainingPeaks)
 *
 * The workout's STRUCTURE is the page. The pace trace is segmented into its
 * work/recovery bouts and stacked as a rhythmic sequence of blocks — warm-up,
 * 8 work intervals each trailed by its recovery, cool-down. Each work bout is a
 * card sized/tinted by effort, read against the prescription that rides above.
 *
 * In-system encoding:
 *   • type scale  — MID; uniform block figures, no editorial headline.
 *   • color logic — run green-teal fills the work bouts; recoveries are calm
 *     neutral; status tones (success/danger) appear ONLY where a rep clearly
 *     beat/missed the target. The accent is never used as a status slot.
 *   • spacing     — repeating vertical cadence; the blocks ARE the rhythm.
 *
 * Answers "the structure is invisible" by making the reps literal.
 * Degrades: an easy/threshold or unlinked run has no work bouts → the stack
 * falls back to plain mile segments (not shown here; this fixture is intervals).
 */

import {
  ADHERENCE,
  fmtClock,
  fmtPace,
  fmtPaceDelta,
  PLAN,
  RUN,
  RUN_HUE,
  SEGMENTS,
  WORK_BOUTS,
  type Segment,
} from "../_fixtures";

const fastestWork = Math.min(...WORK_BOUTS.map((b) => b.avgPace));
const slowestWork = Math.max(...WORK_BOUTS.map((b) => b.avgPace));

export function IntervalRepBlocks() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-5 py-6">
      <Header />
      <Prescription />
      <div className="flex flex-col gap-2.5">
        {SEGMENTS.map((seg, i) =>
          seg.kind === "work" ? (
            <WorkBlock key={i} seg={seg} />
          ) : seg.kind === "recovery" ? (
            <RecoveryRow key={i} seg={seg} />
          ) : (
            <BookendBlock key={i} seg={seg} />
          ),
        )}
      </div>
    </div>
  );
}

function Header() {
  // Summary tiles compressed to a thin inline header strip.
  const items: [string, string][] = [
    ["Distance", `${RUN.distanceMi.toFixed(1)} mi`],
    ["Duration", fmtClock(RUN.durationSec)],
    ["Avg pace", `${fmtPace(RUN.avgPace)} /mi`],
    ["Avg HR", `${RUN.avgHr} bpm`],
    ["Cal", String(RUN.calories)],
  ];
  return (
    <div>
      <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--foreground)]">
        {RUN.name}
      </h2>
      <p className="mt-0.5 text-xs text-[var(--muted)]">{RUN.start}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold tabular-nums tracking-[-0.03em]">{value}</span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Prescription() {
  return (
    <div
      className="rounded-[var(--radius-card)] border-l-2 px-4 py-2.5"
      style={{ borderColor: RUN_HUE.dot, background: RUN_HUE.bg }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color: RUN_HUE.fg }}
      >
        Prescription · {PLAN.name}
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--foreground)]">{PLAN.details}</p>
      <p className="mt-1.5 text-xs text-[var(--muted)]">
        {ADHERENCE.repsOnPace} of {ADHERENCE.repsPlanned} work bouts on pace · avg work{" "}
        <span style={{ color: RUN_HUE.fg }}>{fmtPace(ADHERENCE.avgWorkPace)}</span> vs target{" "}
        {fmtPace(ADHERENCE.targetWorkPace)}
      </p>
    </div>
  );
}

function WorkBlock({ seg }: { seg: Segment }) {
  const onPace = seg.avgPace <= (seg.targetPace ?? Infinity) + ADHERENCE.onPaceTol;
  const delta = seg.avgPace - (seg.targetPace ?? seg.avgPace);
  // Effort bar: faster bout → longer green fill. Maps [slowest..fastest] → [40%..100%].
  const span = slowestWork - fastestWork || 1;
  const fill = 40 + ((slowestWork - seg.avgPace) / span) * 60;
  return (
    <div
      className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] pl-4"
      style={{ borderLeft: `3px solid ${RUN_HUE.dot}` }}
    >
      {/* Effort fill behind the row — green-teal, intensity by speed. */}
      <div
        className="absolute inset-y-0 left-0 -z-0 opacity-[0.10]"
        style={{ width: `${fill}%`, background: RUN_HUE.dot }}
        aria-hidden
      />
      <div className="relative flex items-center gap-4 px-3 py-3">
        <div className="w-12 shrink-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
            Rep
          </p>
          <p
            className="text-xl font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: RUN_HUE.fg }}
          >
            {seg.rep}
          </p>
        </div>
        <div className="flex flex-1 items-baseline gap-1">
          <span className="text-2xl font-semibold tabular-nums tracking-[-0.03em]">
            {fmtPace(seg.avgPace)}
          </span>
          <span className="text-xs text-[var(--muted)]">/mi</span>
        </div>
        <Stat value={`${seg.avgHr}`} unit="bpm" />
        <Stat value={fmtClock(seg.durationSec)} unit="time" />
        <DeltaChip onPace={onPace} delta={delta} />
      </div>
    </div>
  );
}

function RecoveryRow({ seg }: { seg: Segment }) {
  return (
    <div className="ml-12 flex items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)]">
      <span className="uppercase tracking-wider text-[var(--faint)]">Recovery</span>
      <span className="tabular-nums">{fmtPace(seg.avgPace)} /mi</span>
      <span className="text-[var(--faint)]">·</span>
      <span className="tabular-nums">{seg.avgHr} bpm</span>
      <span className="text-[var(--faint)]">·</span>
      <span className="tabular-nums">{fmtClock(seg.durationSec)}</span>
    </div>
  );
}

function BookendBlock({ seg }: { seg: Segment }) {
  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5">
      <span className="w-12 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {seg.label}
      </span>
      <span className="flex-1 text-base font-semibold tabular-nums tracking-[-0.03em]">
        {fmtPace(seg.avgPace)} <span className="text-xs font-normal text-[var(--muted)]">/mi</span>
      </span>
      <Stat value={`${seg.avgHr}`} unit="bpm" />
      <Stat value={`${seg.distanceMi.toFixed(2)}`} unit="mi" />
      <Stat value={fmtClock(seg.durationSec)} unit="time" />
    </div>
  );
}

function Stat({ value, unit }: { value: string; unit: string }) {
  return (
    <div className="hidden w-16 shrink-0 text-right sm:block">
      <p className="text-sm font-semibold tabular-nums tracking-[-0.03em]">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{unit}</p>
    </div>
  );
}

function DeltaChip({ onPace, delta }: { onPace: boolean; delta: number }) {
  // Status tone ONLY here, where a rep clearly hit or missed target.
  const color = onPace ? "var(--success)" : "var(--danger)";
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums"
      style={{ color, borderColor: `color-mix(in srgb, ${color} 40%, transparent)` }}
    >
      {fmtPaceDelta(delta)}
    </span>
  );
}
