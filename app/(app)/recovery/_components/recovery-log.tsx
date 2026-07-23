import type { WhoopRecoveryDay } from "@/lib/api";
import { recoveryBand, recoveryBandColor } from "@/lib/recovery";

/**
 * Reverse-chronological day log of the fetched recovery rows — date, a
 * band-colored score chip, resting HR, HRV; em-dash for nulls. Plain list, no
 * accordion, no pagination (the rows are already fetched for the charts).
 */
export function RecoveryLog({ rows }: { rows: WhoopRecoveryDay[] }) {
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold tracking-tight">Day log</h3>
      <ul className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        {sorted.map((row) => (
          <li key={row.date} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-sm text-[var(--foreground)]">{formatRowDate(row.date)}</span>
            <div className="flex items-center gap-5">
              <ScoreChip score={row.recovery_score} />
              <Metric value={row.resting_heart_rate} unit="bpm" />
              <Metric value={row.hrv_rmssd_milli} unit="ms" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ScoreChip({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="w-10 text-right text-sm tabular-nums text-[var(--faint)]">—</span>;
  }
  const color = recoveryBandColor(recoveryBand(score));
  return (
    <span
      data-testid="recovery-log-chip"
      className="inline-flex min-w-10 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {score}
    </span>
  );
}

function Metric({ value, unit }: { value: number | null; unit: string }) {
  return (
    <span className="w-16 text-right text-sm tabular-nums text-[var(--muted)]">
      {value === null ? "—" : `${Math.round(value)} ${unit}`}
    </span>
  );
}

function formatRowDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
