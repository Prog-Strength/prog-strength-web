/**
 * DX variant — idiom: `vertical-gain` · proposed title: `Vertical Gain`.
 * THROWAWAY MOCKUP — never promote as-is.
 *
 * Heroes CLIMBING — the dimension the running tile has never shown despite
 * carrying gain on every outdoor run. Total gain this week as the figure,
 * over a stepped silhouette: one column per run, height by that run's gain,
 * biggest climb called out. Borrows Strava's elevation profile reduced to a
 * per-run summary.
 *
 * The awkward states ARE the test: a treadmill run contributes no column and
 * no zero — it contributes a hairline-outlined gap, and the caption says
 * "3 of 4 runs" rather than pretending the fourth was flat. The indoor-only
 * runner gets a stated "no outdoor runs this week", not an empty chart.
 *
 * Type scale: a large figure with a small unit suffix over a short
 * silhouette — closest of the six to today's proportions, deliberately, so
 * it pairs cleanly beneath a default. Color logic: sage fill on the
 * silhouette — hike clay explicitly FORBIDDEN (activity type owns activity
 * colour; clay would read as a hike on the grid); gaps are hairline
 * outlines, not filled columns. Spacing: figure over a full-width landform,
 * no columns of text — the most horizontal of the six.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { formatElevationValue, type DistanceUnit } from "@/lib/distance-unit-context";
import { weekdayShort, type DxRunningFixture, type DxWeekRun } from "./fixtures";

const HREF = "/activities?view=running";

export function VerticalGainCard({ data, unit }: { data: DxRunningFixture; unit: DistanceUnit }) {
  const { currentWeek: wk, baseline } = data;
  const outdoor = data.weekRuns.filter(
    (r): r is DxWeekRun & { elevationGainMeters: number } => r.elevationGainMeters !== null,
  );
  const maxGain = outdoor.length ? Math.max(...outdoor.map((r) => r.elevationGainMeters)) : 0;
  const biggest = outdoor.length
    ? outdoor.reduce((a, b) => (b.elevationGainMeters > a.elevationGainMeters ? b : a))
    : null;

  // Indoor-only week: a stated fact, not an empty chart frame.
  if (wk.runCount > 0 && outdoor.length === 0) {
    return (
      <MiniCard title="Vertical Gain" href={HREF}>
        <div className="flex flex-1 flex-col justify-center gap-1 py-1">
          <p className="text-sm font-medium text-[var(--muted)]">No outdoor runs this week</p>
          <p className="text-[11px] text-[var(--faint)]">
            {wk.runCount} treadmill {wk.runCount === 1 ? "run carries" : "runs carry"} no altitude —
            climbing appears when you run outside
          </p>
        </div>
      </MiniCard>
    );
  }

  if (wk.runCount === 0) {
    return (
      <MiniCard title="Vertical Gain" href={HREF}>
        <div className="flex flex-1 flex-col justify-center gap-1 py-1">
          <p className="text-sm font-medium text-[var(--muted)]">No runs yet this week</p>
          <p className="text-[11px] text-[var(--faint)]">
            {baseline?.elevationGainMeters != null ? (
              <>
                you climb about{" "}
                <span className="font-mono tabular-nums text-[var(--muted)]">
                  {formatElevationValue(baseline.elevationGainMeters, unit)}
                </span>{" "}
                a week
              </>
            ) : (
              <>climbing appears with your first outdoor run</>
            )}
          </p>
        </div>
      </MiniCard>
    );
  }

  return (
    <MiniCard title="Vertical Gain" href={HREF}>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {formatElevationValue(wk.elevationGainMeters, unit)}
        </span>
        <span className="text-xs font-medium text-[var(--muted)]">this week</span>
      </div>

      {/* The stepped silhouette: one column per run in week order. A treadmill
          run is a dashed outline gap — absent altitude, never a zero column. */}
      <div
        className="flex h-12 w-full items-end gap-[3px]"
        role="img"
        aria-label="Elevation gain per run this week; dashed outlines are indoor runs with no altitude data"
      >
        {data.weekRuns.map((r, i) =>
          r.elevationGainMeters === null ? (
            <div
              key={i}
              title={`${weekdayShort(r.localDate)} · indoor, no altitude`}
              className="h-3 flex-1 rounded-t-sm border border-dashed border-[var(--border-strong)]"
            />
          ) : (
            <div
              key={i}
              title={`${weekdayShort(r.localDate)} · ${formatElevationValue(r.elevationGainMeters, unit)}`}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${maxGain > 0 ? Math.max((r.elevationGainMeters / maxGain) * 100, 6) : 6}%`,
                backgroundColor: "var(--discipline-run-dot)",
                opacity: 0.85,
              }}
            />
          ),
        )}
      </div>

      <p className="text-[11px] text-[var(--faint)]">
        {biggest && (
          <>
            most{" "}
            <span className="font-mono tabular-nums text-[var(--muted)]">
              {formatElevationValue(biggest.elevationGainMeters, unit)}
            </span>{" "}
            · {weekdayShort(biggest.localDate)}
          </>
        )}
        {wk.elevationRuns < wk.runCount && (
          <>
            {" "}
            ·{" "}
            <span className="font-mono tabular-nums text-[var(--muted)]">
              {wk.elevationRuns} of {wk.runCount}
            </span>{" "}
            runs carried altitude
          </>
        )}
      </p>
    </MiniCard>
  );
}
