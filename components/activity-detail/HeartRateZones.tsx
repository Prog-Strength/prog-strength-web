/**
 * Heart-rate zones widget — the STANDARD time-in-zone surface for every
 * activity detail page that has heart rate, not a running-only one. Time in
 * zone is a property of the heart-rate stream, not of the sport, so a hike, a
 * TCX-enriched lift, and a run all render the identical widget; the API emits
 * `heart_rate_zones` on any activity carrying per-point HR. A new activity type
 * gets this for free — render it wherever the block is non-empty.
 *
 * Presentational and prop-driven over the response's `heart_rate_zones` block:
 * a ranked list of five horizontal zone bars (one per zone, ordered high→low so
 * the hardest effort leads), each with its zone name + bpm range, a full-width
 * track whose fill length = time_pct in that zone's color, and the time and
 * percent right-aligned in a fixed column. The bar *is* the legend — each fill
 * sits beside its own figures, so time-in-zone reads from the graphic itself.
 * A quiet banner shows while the backend's max-HR estimate is still calibrating.
 *
 * Built in the hand-rolled idiom of PaceStrip — tokens only (the separable
 * --zone-1..5 scale, design-system v0.4.2), no charting dependency, no raw hex.
 *
 * `framed` controls the card chrome. Default (true) is the standalone card the
 * run and hike pages drop into their own section. Pass `framed={false}` to nest
 * it inside a host card that already owns the border/background and the
 * section's heading — the workout page's "Heart rate & effort" card does this.
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

export function HeartRateZones({
  zones,
  framed = true,
}: {
  zones: HRZones | null | undefined;
  framed?: boolean;
}) {
  if (!zones || zones.zones.length === 0) return null;

  const calibrating = zones.reference_confidence !== "calibrated";

  // High→low: VO2max (Zone 5) on top, Recovery (Zone 1) at the bottom. Sort a
  // copy so the prop array is never mutated.
  const ranked = [...zones.zones].sort((a, b) => b.zone - a.zone);

  const card = framed
    ? "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
    : "";

  return (
    <div className={card}>
      {framed && (
        <div className="mb-3 text-[10px] uppercase tracking-wider text-[var(--faint)]">
          Heart rate zones
        </div>
      )}

      {/* Ranked time-in-zone bars, one row per zone (high→low). */}
      <ul className="flex flex-col gap-2.5">
        {ranked.map((z) => (
          <li key={z.zone} className="flex flex-col gap-1">
            {/* Label line: zone name + bpm range. */}
            <div className="flex items-baseline gap-2 text-xs">
              <span className="font-medium text-[var(--foreground)]">{z.name}</span>
              <span className="text-[var(--muted)]">
                {z.min_bpm}–{z.max_bpm} bpm
              </span>
            </div>

            {/* Bar line: full-width track with a time-proportional fill, then
                the time/percent pinned right in a fixed-width column. */}
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${z.time_pct * 100}%`, backgroundColor: zoneVar(z.zone) }}
                  aria-hidden="true"
                />
              </div>
              <div className="flex w-20 shrink-0 items-baseline justify-end gap-1.5 text-xs">
                <span className="tabular-nums text-[var(--muted)]">
                  {formatDuration(z.time_seconds)}
                </span>
                <span className="w-9 text-right tabular-nums font-medium text-[var(--foreground)]">
                  {formatPercent(z.time_pct)}
                </span>
              </div>
            </div>
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
