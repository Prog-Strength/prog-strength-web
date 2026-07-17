"use client";

/**
 * IDIOM: map-hero-garmin
 *
 * The MAP IS THE FIRST HERO. A compact header (title + one-line meta + inline
 * notes affordance) sits above a large route map; headline stats compress into
 * a thin strip laid directly on the bottom of the map (Garmin overview
 * compression). Splits follow, then a TIGHT SYNCHRONIZED STACK of Pace / HR /
 * Elevation sharing one distance axis — only the bottom chart prints the axis.
 *
 * - Type scale: small, dense — modest title, tiny label chrome packed onto the
 *   map and into the chart gutters.
 * - Color logic: route drawn in --accent on the basemap (app-chrome as the
 *   wayfinding line); chart series in run-fg / zone-5 / muted teal.
 * - Spacing rhythm: map-dominant first viewport; the chart stack is packed with
 *   shared gutters and hairline rules (Garmin Connect density).
 *
 * in-system: tokens only. Divergence is composition + density, not palette.
 */

import type { RunSession } from "../_fixtures";
import { fmtClock, fmtDuration } from "../_fixtures";
import { AreaTrace, RouteMapMock, SplitsTable, ZoneBars, series, traceHasData } from "../_charts";

export function MapHeroGarmin({ s, notesFilled }: { s: RunSession; notesFilled: boolean }) {
  const showHr = s.avgHr != null;
  const showElev = s.hasElevation && traceHasData(s.trace, "elev");

  const stat: [string, string][] = [
    ["Dist", `${s.distanceMi.toFixed(1)} mi`],
    ["Time", fmtDuration(s.durationSec)],
    ["Avg", `${fmtClock(s.avgPaceSecPerMi)}`],
    ["Best", `${fmtClock(s.bestPaceSecPerMi)}`],
  ];
  if (showHr) {
    stat.push(["HR", `${s.avgHr}`]);
    stat.push(["Max", `${s.maxHr}`]);
  }
  if (s.elevGainM != null) stat.push(["Elev", `${s.elevGainM} m`]);
  if (s.calories != null) stat.push(["Cal", `${s.calories}`]);

  const stackKinds = [
    "pace",
    ...(showHr ? (["hr"] as const) : []),
    ...(showElev ? (["elev"] as const) : []),
  ] as const;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-6 py-6">
      {/* compact header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {s.name}
          </h1>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            {s.startLabel} · {s.distanceMi.toFixed(1)} mi · {fmtDuration(s.durationSec)}
          </p>
        </div>
        {notesFilled ? (
          <p className="max-w-md text-xs italic leading-snug text-[var(--muted)]">
            “{s.notesFilled}”
          </p>
        ) : (
          <button className="rounded-full border border-[var(--border-strong)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none">
            + How did this run feel?
          </button>
        )}
      </div>

      {/* map hero with a thin stat strip laid on the bottom edge */}
      {s.hasRoute ? (
        <RouteMapMock height={340} stroke="var(--accent)">
          <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-x-6 gap-y-1 border-t border-[var(--border-strong)] bg-[var(--background)]/80 px-4 py-2.5 backdrop-blur-sm">
            {stat.map(([l, v]) => (
              <div key={l} className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
                  {l}
                </span>
                <span className="text-sm font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
                  {v}
                </span>
              </div>
            ))}
          </div>
        </RouteMapMock>
      ) : (
        // Indoor / no route: no map slot — the strip stands alone, unframed.
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          {stat.map(([l, v]) => (
            <div key={l} className="flex items-baseline gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{l}</span>
              <span className="text-sm font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
                {v}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* splits */}
      <SplitsTable splits={s.splits} showHr={showHr} showElev={showElev} compact />

      {/* synchronized chart stack — shared x-axis printed once at the bottom */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          Pace · Heart rate · Elevation — over distance
        </div>
        {stackKinds.map((k, i) => {
          const last = i === stackKinds.length - 1;
          return (
            <div key={k} className={i > 0 ? "border-t border-[var(--border)]" : ""}>
              <div className="flex items-center justify-between px-4 pt-2">
                <span className="text-[11px] font-medium text-[var(--muted)]">
                  {k === "pace" ? "Pace /mi" : k === "hr" ? "Heart rate bpm" : "Elevation m"}
                </span>
              </div>
              <div className="px-2 pb-1">
                <AreaTrace
                  points={series(s.trace, k)}
                  kind={k}
                  height={k === "pace" ? 130 : 110}
                  compact
                  hideXAxis={!last}
                  markExtreme={k === "pace"}
                  showArea={k !== "hr"}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* zones */}
      {s.zones && (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[var(--faint)]">
            Heart rate zones
          </div>
          <ZoneBars zones={s.zones} compact />
        </div>
      )}
    </div>
  );
}
