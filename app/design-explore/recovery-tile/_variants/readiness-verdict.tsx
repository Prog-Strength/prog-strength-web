/**
 * VARIANT — readiness-verdict  ·  Proposed title: "Recovery"
 * Idiom: HEROES THE SENTENCE. No chart at all. Draws on THE ATHLETIC's authored
 * headline-sentence framing — a verdict in the house voice sits at the top in
 * generous leading, with the supporting figures demoted to three quiet
 * contributor rows, each carrying its value and a baseline-delta chip.
 *
 * This is the only variant that is NEVER mostly em-dashes: the no-reading state
 * degrades to a full true sentence ("No reading yet today. Your 30-day baseline
 * is 68 · 52 bpm · 91 ms") where every other treatment shows blanks.
 *
 * Type scale: dramatic big/small editorial contrast — the verdict large-ish,
 * everything else small; no giant numeral anywhere. Color logic: near-mono ink,
 * status color on EXACTLY ONE word (the verdict); delta chips stay muted.
 * Spacing: airy, editorial, generous line height — the calmest card on the grid.
 *
 * Throwaway DX mockup — self-contained, no shared abstraction by design.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard } from "../_shell";
import { hrvStatusColor, statusWord, signed } from "../_util";

const TITLE = "Recovery";

export function ReadinessVerdict({ view }: { view: RecoveryView }) {
  const { restingToday, recoveryScore, hrvToday, baseline, hrv } = view;

  if (!baseline || !hrv) {
    return (
      <MockCard title={TITLE}>
        <p className="text-base leading-relaxed text-[var(--muted)]">Recovery is calibrating.</p>
      </MockCard>
    );
  }

  const calibrating = baseline.hrvAvg === null;
  const noReading = hrvToday === null && recoveryScore === null && restingToday === null;

  return (
    <MockCard title={TITLE}>
      {/* The verdict — the hero, in generous leading. */}
      <Verdict calibrating={calibrating} noReading={noReading} view={view} />

      {/* Three quiet contributor rows: value · baseline-delta chip. */}
      <div className="mt-1 flex flex-col divide-y divide-[var(--border)]">
        <Contributor
          label="Recovery"
          value={recoveryScore}
          unit=""
          baseline={baseline.recoveryScoreAvg}
        />
        <Contributor
          label="Resting HR"
          value={restingToday}
          unit="bpm"
          baseline={baseline.restingHrAvg}
          digits={1}
        />
        <Contributor label="HRV" value={hrvToday ?? null} unit="ms" baseline={baseline.hrvAvg} />
      </div>
    </MockCard>
  );
}

function Verdict({
  calibrating,
  noReading,
  view,
}: {
  calibrating: boolean;
  noReading: boolean;
  view: RecoveryView;
}) {
  const { baseline, hrv, hrvToday } = view;
  if (!baseline || !hrv) return null;

  if (calibrating) {
    return (
      <p className="text-lg font-medium leading-snug text-[var(--foreground)]">
        <span style={{ color: hrvStatusColor("unknown") }}>Calibrating</span> — {baseline.hrvDays}{" "}
        of 14 nights in. Your baseline lands in a few more mornings.
      </p>
    );
  }

  if (noReading) {
    // A full, true sentence — never em-dashes. Baseline is real and printable.
    return (
      <p className="text-lg font-medium leading-snug text-[var(--foreground)]">
        No reading yet today. Your 30-day baseline is{" "}
        <span className="font-mono tabular-nums">
          {baseline.recoveryScoreAvg !== null ? Math.round(baseline.recoveryScoreAvg) : "—"}
        </span>{" "}
        ·{" "}
        <span className="font-mono tabular-nums">
          {baseline.restingHrAvg !== null ? baseline.restingHrAvg.toFixed(1) : "—"} bpm
        </span>{" "}
        ·{" "}
        <span className="font-mono tabular-nums">
          {baseline.hrvAvg !== null ? Math.round(baseline.hrvAvg) : "—"} ms
        </span>
        , trending {hrv.trend === "unknown" ? "flat" : hrv.trend}.
      </p>
    );
  }

  // Calibrated + has a reading: a verdict with one % figure vs baseline.
  const pct =
    hrvToday != null && baseline.hrvAvg
      ? Math.round(((hrvToday - baseline.hrvAvg) / baseline.hrvAvg) * 100)
      : null;
  const relWord =
    pct === null
      ? ""
      : pct <= -3
        ? `${Math.abs(pct)}% below`
        : pct >= 3
          ? `${pct}% above`
          : "right around";
  const tail =
    pct === null
      ? ""
      : relWord === "right around"
        ? "right around your 30-day baseline"
        : `${relWord} your 30-day baseline`;

  return (
    <p className="text-lg font-medium leading-snug text-[var(--foreground)]">
      <span style={{ color: hrvStatusColor(hrv.status) }}>{statusWord(hrv.status)}</span>
      {tail ? <> — HRV is {tail}.</> : "."}
    </p>
  );
}

/** One contributor row: label, value, and a muted baseline-delta chip. */
function Contributor({
  label,
  value,
  unit,
  baseline,
  digits = 0,
}: {
  label: string;
  value: number | null;
  unit: string;
  baseline: number | null;
  digits?: number;
}) {
  const delta = value !== null && baseline !== null ? value - baseline : null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-sm tabular-nums text-[var(--foreground)]">
          {value !== null ? value : "—"}
          {value !== null && unit ? <span className="text-[var(--muted)]"> {unit}</span> : null}
        </span>
        <span className="rounded-full bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-[var(--muted)]">
          {delta !== null ? signed(delta, digits) : "vs base —"}
        </span>
      </div>
    </div>
  );
}
