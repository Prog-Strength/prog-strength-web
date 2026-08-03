/**
 * DX variant — idiom: `pace-band` · proposed title: `Running Pace`.
 * THROWAWAY MOCKUP — never promote as-is.
 *
 * Heroes PACE against the athlete's own normal. A mid-size pace clock (this
 * week's aggregate — labelled, because the 30-day figure beside it is a
 * DIFFERENT number) over a horizontal sage band: the 4-week baseline pace as
 * a centre line, one tick per run positioned by that run's pace, faster to
 * the left. Borrows Oura's "your normal range" band, applied to pace.
 *
 * Type scale: a medium pace clock as the only prominent figure, everything
 * else caption-size — restrained, no giant numeral. Color logic: the band is
 * sage, ticks are neutral ink except the fastest run of the week; nothing
 * else is coloured. Spacing: chart-dominant, the band running nearly
 * full-bleed within the padding.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { formatPaceValue, type DistanceUnit } from "@/lib/distance-unit-context";
import { weekdayShort, type DxRunningFixture } from "./fixtures";

const HREF = "/activities?view=running";

export function PaceBandCard({ data, unit }: { data: DxRunningFixture; unit: DistanceUnit }) {
  const { currentWeek: wk, baseline } = data;
  const baselinePace = baseline?.avgPaceSecPerKm ?? null;
  const runPaces = data.weekRuns
    .map((r) => ({ pace: r.avgPaceSecPerKm, day: weekdayShort(r.localDate) }))
    .filter((r): r is { pace: number; day: string } => r.pace !== null);

  // Domain: the runs plus the baseline, padded ~20 s/km each side so ticks
  // never pin to the frame. Faster (lower sec/km) sits LEFT.
  const anchors = [
    ...runPaces.map((r) => r.pace),
    ...(baselinePace !== null ? [baselinePace] : []),
  ];
  const pad = 20;
  const lo = anchors.length ? Math.min(...anchors) - pad : 0;
  const hi = anchors.length ? Math.max(...anchors) + pad : 1;
  const span = hi - lo || 1;
  const xPct = (pace: number) => ((pace - lo) / span) * 100;
  const fastest = runPaces.length ? Math.min(...runPaces.map((r) => r.pace)) : null;

  return (
    <MiniCard title="Running Pace" href={HREF}>
      {/* This week's aggregate pace — NOT the 30-day figure, which sits beside
          it as a faint, explicitly-labelled reference. */}
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {formatPaceValue(wk.avgPaceSecPerKm, unit)}
          <span className="ml-1 text-xs font-medium text-[var(--muted)]">/{unit} this week</span>
        </span>
        {data.recentAvgPaceSecPerKm !== null && (
          <span className="font-mono text-[11px] tabular-nums text-[var(--faint)]">
            30-day {formatPaceValue(data.recentAvgPaceSecPerKm, unit)}
          </span>
        )}
      </div>

      {/* The band. Sage track, baseline centre line, one tick per run. */}
      {anchors.length > 0 ? (
        <div
          className="relative h-9 w-full"
          role="img"
          aria-label="This week's run paces against your four-week baseline; faster sits left"
        >
          <div
            className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: "var(--discipline-run-dot)", opacity: 0.16 }}
          />
          {baselinePace !== null && (
            <div
              aria-hidden="true"
              title="4-week baseline pace"
              className="absolute top-1/2 h-7 w-px -translate-y-1/2 bg-[var(--muted)]"
              style={{ left: `${xPct(baselinePace)}%` }}
            />
          )}
          {runPaces.map((r, i) => (
            <div
              key={i}
              title={`${r.day} ${formatPaceValue(r.pace, unit)}`}
              className="absolute top-1/2 h-4 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${xPct(r.pace)}%`,
                backgroundColor:
                  r.pace === fastest ? "var(--discipline-run-fg)" : "var(--foreground)",
                opacity: r.pace === fastest ? 1 : 0.75,
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex h-9 items-center">
          <span className="text-xs italic text-[var(--faint)]">
            {wk.runCount > 0 ? "no pace data this week" : "no runs yet this week"}
          </span>
        </div>
      )}

      {/* Caption: spell out what the marks mean — never a bare chart. */}
      <p className="text-[11px] text-[var(--faint)]">
        {runPaces.length > 1 && fastest !== null && (
          <>
            fastest{" "}
            <span className="font-mono tabular-nums text-[var(--muted)]">
              {formatPaceValue(fastest, unit)}
            </span>{" "}
            ·{" "}
          </>
        )}
        {runPaces.length === 1 && <>one run this week · </>}
        {baselinePace !== null ? (
          <>
            4-wk baseline{" "}
            <span className="font-mono tabular-nums text-[var(--muted)]">
              {formatPaceValue(baselinePace, unit)}
            </span>
          </>
        ) : (
          <>your baseline appears after a few weeks of running</>
        )}
      </p>
    </MiniCard>
  );
}
