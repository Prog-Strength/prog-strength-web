/**
 * Heart-rate zones widget for the running detail page. Presentational and
 * prop-driven over the response's `heart_rate_zones` block: a horizontal
 * stacked time-in-zone bar (one segment per zone, width = time_pct) above a
 * per-zone legend (swatch, name, bpm range, time, share). A quiet banner
 * shows while the backend's max-HR estimate is still calibrating.
 *
 * Built in the hand-rolled idiom of PaceStrip — tokens only (the periwinkle
 * --zone-1..5 ramp, design-system v0.4), no charting dependency, no raw hex.
 */

import type { HeartRateZones as HRZones } from "@/lib/api";
import { formatDuration, formatPercent } from "@/lib/format";

// Per-zone fill var, indexed by `zone.zone` (1-based). The fills are dynamic
// per row, so they're applied via inline style rather than a Tailwind class
// (matching PaceStrip's `stroke="var(...)"` approach).
function zoneVar(zone: number): string {
  return `var(--zone-${zone})`;
}

const CALIBRATING_COPY =
  "Calibrating — zones will sharpen as Prog Strength learns your heart rate.";

export function HeartRateZones({ zones }: { zones: HRZones | null | undefined }) {
  if (!zones || zones.zones.length === 0) return null;

  const calibrating = zones.reference_confidence !== "calibrated";

  const card =
    "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3";

  return (
    <div className={card}>
      <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--faint)]">
        Heart rate zones
      </div>

      {/* Stacked time-in-zone bar */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        {zones.zones.map((z) =>
          z.time_pct > 0 ? (
            <div
              key={z.zone}
              style={{ width: `${z.time_pct * 100}%`, backgroundColor: zoneVar(z.zone) }}
              aria-hidden="true"
            />
          ) : null,
        )}
      </div>

      {/* Legend */}
      <ul className="mt-3 flex flex-col gap-1.5">
        {zones.zones.map((z) => (
          <li key={z.zone} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: zoneVar(z.zone) }}
              aria-hidden="true"
            />
            <span className="font-medium text-[var(--foreground)]">{z.name}</span>
            <span className="text-[var(--muted)]">
              {z.min_bpm}–{z.max_bpm} bpm
            </span>
            <span className="ml-auto tabular-nums text-[var(--muted)]">
              {formatDuration(z.time_seconds)}
            </span>
            <span className="w-10 text-right tabular-nums font-medium text-[var(--foreground)]">
              {formatPercent(z.time_pct)}
            </span>
          </li>
        ))}
      </ul>

      {calibrating && (
        <p className="mt-3 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--muted)]">
          {CALIBRATING_COPY}
        </p>
      )}
    </div>
  );
}
