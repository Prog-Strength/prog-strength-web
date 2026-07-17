"use client";

/**
 * IDIOM: strava-overview-split
 *
 * A TWO-COLUMN OVERVIEW on wide viewports: left holds identity — title,
 * "Add notes" / filled note, a compact 2×3 key-stat grid; right holds the map.
 * Below the fold it goes full-bleed: the splits table as the primary mid-page
 * beat, then the analysis traces and zones.
 *
 * - Type scale: medium social-feed hierarchy — a strong (not oversized) title,
 *   stats in a small card grid with fewer cells than today's eight.
 * - Color logic: minimal decoration — run-dot only on the map stroke and the
 *   fastest split; the pace column stays neutral. Zones keep their scale.
 * - Spacing rhythm: Strava card gaps — a tidy overview band, a clear break into
 *   splits, then a distinct analysis block.
 *
 * in-system: tokens only. Divergence is the split-overview composition.
 */

import type { RunSession } from "../_fixtures";
import { fmtClock, fmtDuration } from "../_fixtures";
import { AreaTrace, RouteMapMock, SplitsTable, ZoneBars, series, traceHasData } from "../_charts";

export function StravaOverviewSplit({ s, notesFilled }: { s: RunSession; notesFilled: boolean }) {
  const showHr = s.avgHr != null;
  const showElev = s.hasElevation && traceHasData(s.trace, "elev");

  const stats: [string, string][] = [
    ["Distance", `${s.distanceMi.toFixed(1)} mi`],
    ["Moving time", fmtDuration(s.durationSec)],
    ["Avg pace", `${fmtClock(s.avgPaceSecPerMi)} /mi`],
  ];
  if (s.elevGainM != null) stats.push(["Elevation", `${s.elevGainM} m`]);
  if (showHr) stats.push(["Avg HR", `${s.avgHr} bpm`]);
  if (s.calories != null) stats.push(["Calories", `${s.calories}`]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-8">
      {/* Overview band — identity left, map right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-medium text-[var(--muted)]">{s.startLabel}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
              {s.name}
            </h1>
          </div>

          {notesFilled ? (
            <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{s.notesFilled}</p>
            </div>
          ) : (
            <button className="flex items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-4 py-3 text-left text-sm text-[var(--muted)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none">
              <span className="text-lg leading-none text-[var(--faint)]">+</span> Add private notes
              — how did this run feel?
            </button>
          )}

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3">
            {stats.map(([l, v]) => (
              <div key={l} className="bg-[var(--surface)] px-3 py-3">
                <p className="text-lg font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
                  {v}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--faint)]">
                  {l}
                </p>
              </div>
            ))}
          </div>
        </div>

        {s.hasRoute ? (
          <RouteMapMock height={300} stroke="var(--discipline-run-dot)" />
        ) : (
          <div className="flex h-full min-h-[160px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border)] text-xs text-[var(--faint)]">
            Indoor run — no route recorded
          </div>
        )}
      </div>

      {/* Splits — the primary mid-page beat */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Splits</h2>
        <SplitsTable splits={s.splits} showHr={showHr} showElev={showElev} paceTint={false} />
      </section>

      {/* Analysis */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">Analysis</h2>
        <Panel
          title="Pace recap"
          meta={`Fastest ${fmtClock(s.paceFastestSecPerMi)} · slowest ${fmtClock(s.paceSlowestSecPerMi)} /mi · ${s.dropoutCount} dropouts`}
        >
          <AreaTrace points={series(s.trace, "pace")} kind="pace" height={170} markExtreme />
        </Panel>
        {showHr && (
          <Panel title="Heart rate" meta={`Avg ${s.avgHr} · max ${s.maxHr} bpm`}>
            <AreaTrace points={series(s.trace, "hr")} kind="hr" height={150} />
          </Panel>
        )}
        {showElev && (
          <Panel title="Elevation" meta={`${s.elevGainM} m gain`}>
            <AreaTrace points={series(s.trace, "elev")} kind="elev" height={140} />
          </Panel>
        )}
        {s.zones && (
          <Panel title="Heart rate zones" meta="time in zone">
            <ZoneBars zones={s.zones} />
          </Panel>
        )}
      </section>
    </div>
  );
}

function Panel({
  title,
  meta,
  children,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--foreground)]">{title}</h3>
        <span className="text-[11px] text-[var(--muted)]">{meta}</span>
      </div>
      {children}
    </div>
  );
}
