/**
 * MorningVitalsCard — the `morning_vitals` tile ("Morning Vitals").
 *
 * Heroes the THREE NUMBERS AS EQUALS: score, resting HR, and HRV as three
 * equal tabular cells, each over a small "vs 30d ±n" baseline-delta caption.
 * No hero figure — the grid is the hierarchy. Exactly ONE status dot, beside
 * HRV, is the only interpretation offered; neither three-state color axis is
 * painted at strength.
 *
 * In the no-reading state each cell promotes its server baseline to the
 * primary figure ("30d avg" caption) so the card is three facts, not three
 * em-dashes. Deltas are today-value minus server baseline — nothing is
 * re-averaged client-side.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { hrvStatusColor, signed } from "./shared";

const TITLE = "Morning Vitals";

export function MorningVitalsCard({ section, href }: { section: RecoveryView; href: string }) {
  const { restingToday, recoveryScore, baseline, hrv } = section;
  const hrvToday = section.hrvToday ?? null;

  if (!baseline || !hrv) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">Vitals are calibrating.</p>
      </MiniCard>
    );
  }

  const noReading = recoveryScore === null && restingToday === null && hrvToday === null;

  return (
    <MiniCard title={TITLE} href={href}>
      {noReading && (
        <p className="text-[11px] text-[var(--muted)]">
          No reading yet today · your 30-day averages
        </p>
      )}
      <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
        <Cell
          label="Score"
          value={recoveryScore}
          baseline={baseline.recoveryScoreAvg}
          noReading={noReading}
        />
        <Cell
          label="Rest HR"
          unit="bpm"
          value={restingToday}
          baseline={baseline.restingHrAvg}
          digits={1}
          noReading={noReading}
        />
        <Cell
          label="HRV"
          unit="ms"
          value={hrvToday}
          baseline={baseline.hrvAvg}
          noReading={noReading}
          dot={hrvStatusColor(hrv.status)}
        />
      </div>
    </MiniCard>
  );
}

/** One equal stat cell. Uniform weight — the grid, not any one figure, leads. */
function Cell({
  label,
  value,
  baseline,
  unit,
  digits = 0,
  noReading,
  dot,
}: {
  label: string;
  value: number | null;
  baseline: number | null;
  unit?: string;
  digits?: number;
  noReading: boolean;
  dot?: string;
}) {
  const calibrating = baseline === null;
  // In the no-reading state the baseline is promoted to the primary figure so
  // the cell stays a fact; otherwise today's value leads.
  const primary = noReading ? baseline : value;
  const delta = value !== null && baseline !== null ? value - baseline : null;

  const primaryText =
    primary === null
      ? "—"
      : digits > 0 && !Number.isInteger(primary)
        ? primary.toFixed(digits)
        : String(Math.round(primary));

  const caption = calibrating
    ? "calibrating"
    : noReading
      ? "30d avg"
      : delta !== null
        ? `vs 30d ${signed(delta, digits)}`
        : "vs 30d —";

  return (
    <div className="flex flex-col items-center gap-0.5 px-1 py-1 text-center">
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">{label}</span>
        {dot && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: dot }}
          />
        )}
      </div>
      <span className="font-mono text-xl font-medium tracking-tight tabular-nums text-[var(--foreground)]">
        {primaryText}
        {primary !== null && unit && (
          <span className="ml-0.5 text-[10px] font-medium text-[var(--muted)]">{unit}</span>
        )}
      </span>
      <span className="font-mono text-[10px] tabular-nums text-[var(--muted)]">{caption}</span>
    </div>
  );
}
