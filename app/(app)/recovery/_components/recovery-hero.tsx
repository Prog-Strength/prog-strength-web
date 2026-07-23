import type { WhoopRecoveryDay } from "@/lib/api";
import { recoveryBand, recoveryBandColor } from "@/lib/recovery";

/**
 * Today's readiness at a glance: a band-colored score ring (filled to
 * score/100) with resting-HR and HRV MiniStats beside it. When `today` is null
 * the ring is unfilled with a "no data yet today" caption and the stats read
 * em-dashes — the parent decides what "today" is (never promoting an older
 * row), this component only renders it.
 */
export function RecoveryHero({ today }: { today: WhoopRecoveryDay | null }) {
  const score = today?.recovery_score ?? null;
  const band = score !== null ? recoveryBand(score) : null;
  const stroke = band !== null ? recoveryBandColor(band) : null;

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="flex flex-col items-center gap-2 pt-2">
        <Ring pct={score} stroke={stroke} />
        <p className="text-center text-[13px] text-[var(--muted)]">
          {score !== null ? "recovery today" : "no data yet today"}
        </p>
      </div>

      <div className="flex w-full max-w-sm items-stretch justify-center gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] text-center">
        <MiniStat label="Resting HR" value={fmt(today?.resting_heart_rate ?? null, "bpm")} />
        <MiniStat label="HRV" value={fmt(today?.hrv_rmssd_milli ?? null, "ms")} />
      </div>
    </div>
  );
}

/** The score ring: fills to score/100 in the band color; unfilled when null. */
function Ring({ pct, stroke }: { pct: number | null; stroke: string | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(Math.max(pct, 0), 100) / 100;
  return (
    <div className="relative grid h-[148px] w-[148px] place-items-center sm:h-[180px] sm:w-[180px]">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="11" />
        {pct !== null && stroke !== null && (
          <circle
            data-testid="recovery-ring-fill"
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          data-testid="recovery-score"
          className="text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums sm:text-[42px]"
        >
          {pct !== null ? Math.round(pct) : "—"}
        </span>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 bg-[var(--background)] px-3 py-3">
      <div className="text-[16px] font-semibold tabular-nums text-[var(--foreground)]">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </div>
    </div>
  );
}

/** Rounds a nullable metric to a whole number with a unit suffix; null → em-dash. */
function fmt(value: number | null, unit: string): string {
  return value === null ? "—" : `${Math.round(value)} ${unit}`;
}
