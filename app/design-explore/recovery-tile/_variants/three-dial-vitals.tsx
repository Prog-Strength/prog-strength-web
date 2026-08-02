/**
 * VARIANT — three-dial-vitals  ·  Proposed title: "Morning Vitals"
 * Idiom: HEROES THE THREE NUMBERS AS EQUALS. Draws on GARMIN CONNECT's
 * morning-snapshot stat grid — score, resting HR, and HRV as three equal,
 * compact tabular cells, each with a small "vs 30d avg" delta caption. No hero
 * figure; the grid IS the hierarchy, and the answer to "which number matters
 * today" is deliberately "all three."
 *
 * Type scale: even Manrope, three equal tabular columns, uniform weight — the
 * most restrained type on the grid. Color logic: near-monochrome with exactly
 * ONE status dot (beside HRV); neither three-state axis is painted at strength.
 * Spacing: gridded, symmetric, dense, three equal columns with hairline
 * dividers.
 *
 * Throwaway DX mockup — self-contained, no shared abstraction by design.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MockCard } from "../_shell";
import { hrvStatusColor, signed } from "../_util";

const TITLE = "Morning Vitals";

export function ThreeDialVitals({ view }: { view: RecoveryView }) {
  const { restingToday, recoveryScore, hrvToday, baseline, hrv } = view;

  if (!baseline || !hrv) {
    return (
      <MockCard title={TITLE}>
        <p className="text-sm text-[var(--muted)]">Vitals are calibrating.</p>
      </MockCard>
    );
  }

  const noReading = recoveryScore === null && restingToday === null && hrvToday === null;

  return (
    <MockCard title={TITLE}>
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
          value={hrvToday ?? null}
          baseline={baseline.hrvAvg}
          noReading={noReading}
          dot={hrvStatusColor(hrv.status)}
        />
      </div>
    </MockCard>
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
  // In the no-reading state the baseline becomes the primary figure so the cell
  // is a fact, not an em-dash. Otherwise today's value leads.
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
