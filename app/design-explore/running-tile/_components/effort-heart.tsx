/**
 * DX variant — idiom: `effort-heart` · proposed title: `Run Effort`.
 * THROWAWAY MOCKUP — never promote as-is.
 *
 * Heroes HEART RATE. The week's duration-weighted average bpm with its
 * baseline delta, over a ZONE RAIL: each run a dot on a horizontal bpm axis,
 * coloured by the --zone-1..5 scale, sized by duration. Borrows Garmin
 * Connect's zone rail and Whoop's single-number intensity framing.
 *
 * Honesty constraints from the ticket: runs are classified by their AVERAGE
 * HR against a max-HR reference (no trackpoint scan — real time-in-zone is
 * too expensive for a dashboard render), so the language says "mostly zone 3
 * runs", never minutes-in-zone. Coverage is always stated ("3 of 4 runs").
 *
 * Type scale: a medium bpm numeral over a rail; the dots do the work.
 * Color logic: the ONLY variant that spends --zone-1..5, and it spends it
 * nowhere else — NO sage on this card at all, which is exactly what makes it
 * not look like its siblings. Spacing: rail-dominant, generous breathing room.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { weekdayShort, type DxRunningFixture, type DxWeekRun } from "./fixtures";
import type { DistanceUnit } from "@/lib/distance-unit-context";

const HREF = "/activities?view=running";

// Mockup stand-in for the same max-HR reference the run-detail zone widget
// classifies against (the downstream SOW reads the user's real value).
const MAX_HR_REF = 190;
// Zone lower bounds as fractions of max HR — Z1 below 60%, Z5 at 90%+.
const ZONE_BOUNDS = [0.6, 0.7, 0.8, 0.9];
const ZONE_TOKENS = [
  "var(--zone-1)",
  "var(--zone-2)",
  "var(--zone-3)",
  "var(--zone-4)",
  "var(--zone-5)",
];

// The rail's bpm window: from a floor under Z1's practical range to max.
const RAIL_LO = Math.round(MAX_HR_REF * 0.5);
const RAIL_HI = MAX_HR_REF;

function zoneIndex(bpm: number): number {
  const frac = bpm / MAX_HR_REF;
  let z = 0;
  for (const bound of ZONE_BOUNDS) if (frac >= bound) z += 1;
  return z; // 0..4
}

export function EffortHeartCard({ data }: { data: DxRunningFixture; unit: DistanceUnit }) {
  const { currentWeek: wk, baseline } = data;
  const hrRuns = data.weekRuns.filter(
    (r): r is DxWeekRun & { avgHeartRateBpm: number } => r.avgHeartRateBpm !== null,
  );

  const deltaVsBaseline =
    wk.avgHeartRateBpm !== null && baseline?.avgHeartRateBpm != null
      ? wk.avgHeartRateBpm - baseline.avgHeartRateBpm
      : null;

  // "Mostly zone N" = the zone holding the most run TIME among HR-bearing
  // runs — a per-run average classification, not minutes-in-zone.
  const zoneDurations = new Array(5).fill(0) as number[];
  for (const r of hrRuns) zoneDurations[zoneIndex(r.avgHeartRateBpm)] += r.durationSeconds;
  const dominantZone = hrRuns.length ? zoneDurations.indexOf(Math.max(...zoneDurations)) + 1 : null;

  // Dot radius by duration — sqrt so the long run reads bigger without
  // flattening the shakeouts into pinpricks.
  const maxDur = hrRuns.length ? Math.max(...hrRuns.map((r) => r.durationSeconds)) : 1;
  const radius = (sec: number) => 4 + Math.sqrt(sec / maxDur) * 4;
  const xPct = (bpm: number) =>
    Math.min(100, Math.max(0, ((bpm - RAIL_LO) / (RAIL_HI - RAIL_LO)) * 100));

  return (
    <MiniCard title="Run Effort" href={HREF}>
      <div className="flex items-baseline gap-2">
        {wk.avgHeartRateBpm !== null ? (
          <>
            <span className="font-mono text-xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {wk.avgHeartRateBpm}
              <span className="ml-1 text-xs font-medium text-[var(--muted)]">bpm avg</span>
            </span>
            {deltaVsBaseline !== null && (
              <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
                {deltaVsBaseline >= 0 ? "+" : ""}
                {deltaVsBaseline} vs 4-wk
              </span>
            )}
          </>
        ) : (
          <span className="text-sm text-[var(--muted)]">
            {wk.runCount === 0 ? "No runs yet this week" : "No heart-rate data this week"}
          </span>
        )}
      </div>

      {/* The zone rail: five faint zone segments, one dot per HR-bearing run. */}
      <div
        className="relative h-12 w-full"
        role="img"
        aria-label="This week's runs by average heart rate on the five-zone scale"
      >
        <div className="absolute inset-x-0 top-1/2 flex h-1.5 -translate-y-1/2 gap-px">
          {ZONE_TOKENS.map((token, i) => (
            <div
              key={i}
              className="h-full flex-1 first:rounded-l-full last:rounded-r-full"
              style={{ backgroundColor: token, opacity: 0.22 }}
            />
          ))}
        </div>
        {hrRuns.map((r, i) => {
          const rad = radius(r.durationSeconds);
          return (
            <div
              key={i}
              title={`${weekdayShort(r.localDate)} · ${r.avgHeartRateBpm} bpm avg`}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--background)]"
              style={{
                left: `${xPct(r.avgHeartRateBpm)}%`,
                width: rad * 2,
                height: rad * 2,
                backgroundColor: ZONE_TOKENS[zoneIndex(r.avgHeartRateBpm)],
              }}
            />
          );
        })}
      </div>

      {/* Coverage is stated, never hidden. */}
      <p className="text-[11px] text-[var(--faint)]">
        {wk.runCount === 0 ? (
          baseline?.avgHeartRateBpm != null ? (
            <>
              4-wk avg{" "}
              <span className="font-mono tabular-nums text-[var(--muted)]">
                {baseline.avgHeartRateBpm} bpm
              </span>
            </>
          ) : (
            <>effort appears once you log a run with heart rate</>
          )
        ) : hrRuns.length === 0 ? (
          <>0 of {wk.runCount} runs carried heart rate</>
        ) : (
          <>
            mostly zone {dominantZone} runs
            {wk.heartRateRuns < wk.runCount && (
              <>
                {" "}
                ·{" "}
                <span className="font-mono tabular-nums text-[var(--muted)]">
                  {wk.heartRateRuns} of {wk.runCount}
                </span>{" "}
                runs with HR
              </>
            )}
          </>
        )}
      </p>
    </MiniCard>
  );
}
