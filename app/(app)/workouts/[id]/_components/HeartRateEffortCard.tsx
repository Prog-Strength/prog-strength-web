"use client";

import type { WorkoutEnrichment } from "@/lib/api";
import { StatTile } from "@/components/stat-tile";
import { HeartRateZones } from "@/components/activity-detail/HeartRateZones";
import { WorkoutHeartRateChart } from "./WorkoutHeartRateChart";

/** Formats a duration in seconds as "Hh Mm" / "Mm" for the Active-time tile. */
function formatActiveTime(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * The "Heart rate & effort" card — the self-contained surface for a workout's
 * Garmin-TCX enrichment. Four stat tiles (Avg HR, Max HR, Calories, Active
 * time) over a heart-rate-vs-elapsed-time chart, then the time-in-zone
 * breakdown. Rendered only when enrichment is present; inserted between the
 * numbers row and the exercise list, leaving the rest of the session-recap
 * layout untouched.
 *
 * The zones live INSIDE this card rather than as a sibling: a lift's HR story
 * is one story, and stacking a second bordered card would read as two. The
 * shared widget renders unframed here (`framed={false}`) since this card
 * already owns the border, background, and the section heading; the run and
 * hike pages, where zones lead their own section, keep the framed default.
 */
export function HeartRateEffortCard({ enrichment }: { enrichment: WorkoutEnrichment }) {
  const avgHr = enrichment.avg_heart_rate_bpm;
  const maxHr = enrichment.max_heart_rate_bpm;
  const calories = enrichment.total_calories;
  const trackpoints = enrichment.trackpoints ?? [];
  const zones = enrichment.heart_rate_zones;

  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        Heart rate &amp; effort
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile value={avgHr != null ? String(avgHr) : "—"} label="Avg HR" sub="bpm" />
        <StatTile value={maxHr != null ? String(maxHr) : "—"} label="Max HR" sub="bpm" />
        <StatTile
          value={calories != null ? calories.toLocaleString() : "—"}
          label="Calories"
          sub="kcal"
        />
        <StatTile value={formatActiveTime(enrichment.duration_seconds)} label="Active time" />
      </div>
      <div className="mt-5">
        <WorkoutHeartRateChart trackpoints={trackpoints} avgHr={avgHr} />
      </div>
      {zones && zones.zones.length > 0 && (
        <div className="mt-6 border-t border-[var(--border)] pt-5">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
            Time in zones
          </p>
          <HeartRateZones zones={zones} framed={false} />
        </div>
      )}
    </section>
  );
}
