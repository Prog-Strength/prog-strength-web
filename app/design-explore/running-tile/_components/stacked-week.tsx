/**
 * DX variant — idiom: `stacked-week` · proposed title: `Running` · DEFAULT CANDIDATE.
 * THROWAWAY MOCKUP — never promote as-is.
 *
 * Heroes TOTAL DISTANCE, but decomposes it: the familiar 32px weekly figure
 * over a single full-width segmented bar — one segment per run, widths
 * proportional to distance — so "21.3 mi" visibly resolves into one long run
 * and three short ones. A hairline ghost mark sits at the 4-week baseline,
 * turning "+25%" into a spatial fact. Borrows Strava's weekly-total header
 * with the segment decomposition it never does.
 *
 * Type scale: one big numeral over a 20px bar over a small meta row — today's
 * vertical rhythm, undisturbed. Color logic: sage carries everything; segments
 * stepped by ALPHA on --discipline-run-dot (longest most opaque), baseline
 * mark in faint ink, no status colour. Spacing: airy, three stacked bands.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import {
  formatDistanceValue,
  formatPaceValue,
  type DistanceUnit,
} from "@/lib/distance-unit-context";
import { weekdayShort, type DxRunningFixture } from "./fixtures";

const HREF = "/activities?view=running";
// Longest run most opaque, shakeouts fainter — an alpha step on the run dot,
// NOT an invented --discipline-run-1..4 ramp (the system has no run ramp).
const SEGMENT_ALPHA = [0.95, 0.6, 0.42, 0.3, 0.24, 0.2];

export function StackedWeekCard({ data, unit }: { data: DxRunningFixture; unit: DistanceUnit }) {
  const { currentWeek: wk, baseline } = data;

  // One linear scale for bar and ghost mark: whichever of (week, baseline)
  // is larger sets the ceiling, with a little headroom so neither pins the edge.
  const weekMeters = wk.distanceMeters;
  const baseMeters = baseline?.distanceMeters ?? null;
  const ceiling = Math.max(weekMeters, baseMeters ?? 0) * 1.08;
  const pct = (m: number) => (ceiling > 0 ? (m / ceiling) * 100 : 0);

  // Alpha by distance rank — longest run reads first.
  const rankByDistance = [...data.weekRuns]
    .map((r, i) => ({ i, d: r.distanceMeters }))
    .sort((a, b) => b.d - a.d)
    .reduce<Record<number, number>>((acc, r, rank) => ({ ...acc, [r.i]: rank }), {});

  const deltaVsBaseline =
    baseMeters !== null && baseMeters > 0
      ? Math.round(((weekMeters - baseMeters) / baseMeters) * 100)
      : null;

  if (wk.runCount === 0) {
    // Zero-run week: no fake 0.0 headline over a dead chart. The baseline mark
    // stays (the yardstick is still true) and the meta says what IS known —
    // never promoting last week's numbers into this week's slot.
    return (
      <MiniCard title="Running" href={HREF}>
        <p className="text-sm font-medium text-[var(--muted)]">No runs yet this week</p>
        <Bar segments={[]} baselinePct={baseMeters !== null ? pct(baseMeters) : null} />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          {data.latestRun && (
            <span className="text-[var(--muted)]">
              last run {weekdayShort(data.latestRun.localDate)}{" "}
              <span className="font-mono tabular-nums text-[var(--foreground)]">
                {formatDistanceValue(data.latestRun.distanceMeters, unit)} {unit}
              </span>
            </span>
          )}
          {baseMeters !== null && (
            <>
              <span className="text-[var(--faint)]">·</span>
              <span className="text-[var(--muted)]">
                4-wk avg{" "}
                <span className="font-mono tabular-nums text-[var(--foreground)]">
                  {formatDistanceValue(baseMeters, unit)} {unit}
                </span>
              </span>
            </>
          )}
        </div>
      </MiniCard>
    );
  }

  return (
    <MiniCard title="Running" href={HREF}>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {formatDistanceValue(weekMeters, unit)}
        </span>
        <span className="text-xs font-medium text-[var(--muted)]">{unit} this week</span>
      </div>

      <Bar
        segments={data.weekRuns.map((r, i) => ({
          widthPct: pct(r.distanceMeters),
          alpha: SEGMENT_ALPHA[Math.min(rankByDistance[i], SEGMENT_ALPHA.length - 1)],
          label: `${weekdayShort(r.localDate)} ${formatDistanceValue(r.distanceMeters, unit)} ${unit}`,
        }))}
        baselinePct={baseMeters !== null ? pct(baseMeters) : null}
      />

      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        <span className="text-[var(--muted)]">
          runs{" "}
          <span className="font-mono tabular-nums text-[var(--foreground)]">{wk.runCount}</span>
        </span>
        <span className="text-[var(--faint)]">·</span>
        <span className="text-[var(--muted)]">
          wk pace{" "}
          <span className="font-mono tabular-nums text-[var(--foreground)]">
            {formatPaceValue(wk.avgPaceSecPerKm, unit)}
          </span>
        </span>
        {deltaVsBaseline !== null ? (
          <>
            <span className="text-[var(--faint)]">·</span>
            <span className="text-[var(--muted)]">
              vs 4-wk{" "}
              <span className="font-mono tabular-nums text-[var(--foreground)]">
                {deltaVsBaseline >= 0 ? "+" : ""}
                {deltaVsBaseline}%
              </span>
            </span>
          </>
        ) : (
          <>
            <span className="text-[var(--faint)]">·</span>
            <span className="text-[var(--muted)]">first week of running</span>
          </>
        )}
      </div>
    </MiniCard>
  );
}

/** The segmented week bar: proportional run segments over a quiet track,
 * with the 4-week baseline as a hairline ghost mark. */
function Bar({
  segments,
  baselinePct,
}: {
  segments: { widthPct: number; alpha: number; label: string }[];
  baselinePct: number | null;
}) {
  return (
    <div
      className="relative h-5 w-full overflow-hidden rounded-md bg-[var(--surface-2)]"
      role="img"
      aria-label="This week's runs as proportional segments against the four-week average"
    >
      <div className="absolute inset-0 flex items-stretch gap-px">
        {segments.map((s, i) => (
          <div
            key={i}
            title={s.label}
            className="h-full rounded-[3px]"
            style={{
              width: `${Math.max(s.widthPct, 1.5)}%`,
              backgroundColor: "var(--discipline-run-dot)",
              opacity: s.alpha,
            }}
          />
        ))}
      </div>
      {baselinePct !== null && (
        <div
          aria-hidden="true"
          title="4-week average"
          className="absolute inset-y-0 w-px bg-[var(--faint)]"
          style={{ left: `${baselinePct}%` }}
        />
      )}
    </div>
  );
}
