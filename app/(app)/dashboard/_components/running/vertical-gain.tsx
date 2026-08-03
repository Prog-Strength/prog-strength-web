/**
 * VerticalGainCard — the `running_vertical` tile ("Vertical Gain").
 *
 * Heroes CLIMBING: total gain as a large figure with a small unit suffix
 * over a full-width stepped silhouette — one column per outdoor run, height
 * by that run's gain — with the week's biggest climb called out
 * ("most: 702 ft · Sat"). The most horizontal composition of the four, so it
 * pairs cleanly beneath another tile.
 *
 * Color: SAGE fill (--discipline-run-dot). Hike clay is explicitly forbidden
 * — elevation is clay on the Hiking surfaces because activity type owns
 * activity color; a running tile drawing its climbing in clay would read as
 * a hike on the grid.
 *
 * Honesty: a nil-gain run (treadmill) contributes a hairline OUTLINE GAP,
 * never a zero column — nil elevation is not zero elevation — and the
 * caption states coverage ("3 of 4 runs"). The indoor-only week renders the
 * stated sentence "no outdoor runs this week", never an empty chart frame or
 * a fabricated "0 ft". Columns scale to the week's max gain with a floor so
 * a small climb is still a visible step beside a 700 ft one.
 */

import type { RunningView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { coverageCaption, weekdayLabel } from "./shared";

const TITLE = "Vertical Gain";
// Floor (% of rail height) so a 20 ft run is a visible step, not a sliver.
const COLUMN_FLOOR_PCT = 14;

export function VerticalGainCard({ section, href }: { section: RunningView; href: string }) {
  const { currentWeek, weekRuns } = section;

  if (currentWeek.runCount === 0) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">no runs this week</p>
      </MiniCard>
    );
  }

  const gainRuns = weekRuns.filter((r) => r.elevationGainMeters !== null);
  if (currentWeek.elevation === null || gainRuns.length === 0) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">no outdoor runs this week</p>
        <p className="text-[11px] text-[var(--faint)]">
          {currentWeek.runCount} {currentWeek.runCount === 1 ? "run" : "runs"}, all without altitude
          data
        </p>
      </MiniCard>
    );
  }

  const [value, suffix] = splitUnit(currentWeek.elevation);
  const maxGain = Math.max(...gainRuns.map((r) => r.elevationGainMeters as number), 1);
  const biggest = gainRuns.reduce((a, b) =>
    (b.elevationGainMeters as number) > (a.elevationGainMeters as number) ? b : a,
  );

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-3xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {value}
        </span>
        <span className="text-sm text-[var(--muted)]">{suffix}</span>
      </div>

      {/* The stepped silhouette: gain-bearing runs are sage columns scaled to
          the week's max; nil-gain runs are hairline outline gaps. */}
      <div
        className="flex h-9 items-end gap-[3px]"
        role="img"
        aria-label="Elevation gained per run this week"
      >
        {weekRuns.map((r) =>
          r.elevationGainMeters === null ? (
            <span
              key={r.activityId}
              data-testid="gain-gap"
              aria-label="indoor run, no altitude data"
              className="h-2 flex-1 rounded-[1px] border border-[var(--border)]"
            />
          ) : (
            <span
              key={r.activityId}
              data-testid="gain-column"
              className="flex-1 rounded-[1px]"
              style={{
                height: `${Math.max(COLUMN_FLOOR_PCT, Math.round((r.elevationGainMeters / maxGain) * 100))}%`,
                backgroundColor: "var(--discipline-run-dot)",
              }}
            />
          ),
        )}
      </div>

      <p className="text-[11px] text-[var(--faint)]">
        {`most: ${biggest.elevation} · ${weekdayLabel(biggest.localDate)}`}
        {currentWeek.elevationRuns < currentWeek.runCount &&
          ` · ${coverageCaption(currentWeek.elevationRuns, currentWeek.runCount)}`}
      </p>
    </MiniCard>
  );
}

/** "899 ft" → ["899", "ft"] so the unit renders as a small suffix. */
function splitUnit(display: string): [string, string] {
  const i = display.lastIndexOf(" ");
  if (i < 0) return [display, ""];
  return [display.slice(0, i), display.slice(i + 1)];
}
