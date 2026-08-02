/**
 * ReadinessVerdictCard — the rewritten `recovery` tile ("Recovery").
 *
 * Heroes the SENTENCE: a verdict line in the house voice over three quiet
 * contributor rows (score / resting HR / HRV), each with its value and a muted
 * baseline-delta chip. No chart, no giant numeral. The status color lands on
 * exactly ONE word (the verdict); the score row stays neutral — painting the
 * score's own green/yellow/red band here too would be the two-traffic-lights
 * failure the DX names.
 *
 * The no-reading branch is where this idiom earns its slot: a full true
 * sentence from the server baselines instead of em-dashes, and yesterday is
 * never promoted into today. The only client-side arithmetic is a signed
 * delta of a today-value against a server baseline (and its percentage) —
 * never a re-averaged series.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { hrvStatusColor, signed, statusWord } from "./shared";

const TITLE = "Recovery";

export function ReadinessVerdictCard({ section, href }: { section: RecoveryView; href: string }) {
  const { restingToday, recoveryScore, baseline, hrv } = section;
  const hrvToday = section.hrvToday ?? null;

  // Guard once: the derived blocks are typed optional. Absent blocks read as
  // calibrating — never a `!`-assert, never an empty frame.
  if (!baseline || !hrv) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-base leading-relaxed text-[var(--muted)]">Recovery is calibrating.</p>
      </MiniCard>
    );
  }

  const calibrating = baseline.hrvAvg === null;
  const noReading = hrvToday === null && recoveryScore === null && restingToday === null;

  return (
    <MiniCard title={TITLE} href={href}>
      <Verdict calibrating={calibrating} noReading={noReading} view={section} />
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
        <Contributor label="HRV" value={hrvToday} unit="ms" baseline={baseline.hrvAvg} />
      </div>
    </MiniCard>
  );
}

/** The verdict line — the hero. Exactly one colored word. */
function Verdict({
  calibrating,
  noReading,
  view,
}: {
  calibrating: boolean;
  noReading: boolean;
  view: RecoveryView;
}) {
  const { baseline, hrv } = view;
  const hrvToday = view.hrvToday ?? null;
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
    // A full, true sentence — the baselines are real and printable.
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

  // Calibrated with a reading: the verdict word plus one % figure vs baseline
  // (a signed delta of two server figures — hrvToday vs hrvAvg).
  const pct =
    hrvToday !== null && baseline.hrvAvg
      ? Math.round(((hrvToday - baseline.hrvAvg) / baseline.hrvAvg) * 100)
      : null;
  const tail =
    pct === null
      ? ""
      : pct <= -3
        ? `${Math.abs(pct)}% below your 30-day baseline`
        : pct >= 3
          ? `${pct}% above your 30-day baseline`
          : "right around your 30-day baseline";

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
