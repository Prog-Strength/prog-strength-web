"use client";

/**
 * IDIOM: session-recap-parity
 *
 * Make the run page READ LIKE WORKOUT DETAIL. Uppercase date kicker → large
 * session title → the run's note as first-class prose → a QUIET inline metric
 * line (Distance · Time · Avg pace · Elev, not eight equal tiles) → map → a
 * section titled in the "The Work" register ("The Miles") for splits → Pace /
 * HR / Elev recaps → zones.
 *
 * - Type scale: workout-parity — big 4xl title, tiny wide-tracked kicker,
 *   prose-sized note. The title leads; numbers whisper.
 * - Color logic: run-discipline hue on the pace stroke and section cues; zone
 *   tokens live only inside the zones widget; --accent reserved for the edit
 *   affordance (focus chrome only).
 * - Spacing rhythm: editorial, generous — big vertical gaps between overview →
 *   map → work → traces (Whoop/Athletic calm, never Garmin density).
 *
 * in-system: tokens only (near-black ramp, periwinkle accent as chrome,
 * --discipline-run-*, --zone-1..5, Manrope). Divergence is layout/type/spacing.
 */

import type { RunSession } from "../_fixtures";
import { fmtClock, fmtDuration } from "../_fixtures";
import { AreaTrace, RouteMapMock, SplitsTable, ZoneBars, series, traceHasData } from "../_charts";

export function SessionRecapParity({ s, notesFilled }: { s: RunSession; notesFilled: boolean }) {
  const showHr = s.avgHr != null;
  const showElev = s.hasElevation && traceHasData(s.trace, "elev");

  const strip: [string, string][] = [
    ["Distance", `${s.distanceMi.toFixed(1)} mi`],
    ["Time", fmtDuration(s.durationSec)],
    ["Avg pace", `${fmtClock(s.avgPaceSecPerMi)} /mi`],
  ];
  if (s.elevGainM != null) strip.push(["Elev gain", `${s.elevGainM} m`]);
  if (showHr) strip.push(["Avg HR", `${s.avgHr}`]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-12 px-6 py-10">
      {/* Editorial lead — kicker, title, note as prose */}
      <div className="flex flex-col gap-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          {s.kicker}
        </p>
        <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-[var(--foreground)]">
          {s.name}
        </h1>

        {notesFilled ? (
          <p className="max-w-xl whitespace-pre-wrap text-lg leading-[1.7] text-[var(--foreground)]">
            {s.notesFilled}
          </p>
        ) : (
          <button
            type="button"
            className="w-fit rounded-md border border-dashed border-[var(--border-strong)] px-3 py-2 text-base italic leading-relaxed text-[var(--faint)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-line)]"
          >
            How did this run feel?
          </button>
        )}

        {/* quiet inline strip — numbers support, not lead */}
        <dl className="mt-1 flex flex-wrap gap-x-10 gap-y-4 border-y border-[var(--border)] py-5">
          {strip.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* map, when a route exists */}
      {s.hasRoute && <RouteMapMock height={260} />}

      {/* The Miles — splits in the "The Work" register */}
      <section className="flex flex-col gap-4">
        <SectionKicker>The Miles</SectionKicker>
        <SplitsTable splits={s.splits} showHr={showHr} showElev={showElev} />
      </section>

      {/* traces — Pace / HR / Elev as sibling recaps, generous gaps */}
      <section className="flex flex-col gap-10">
        <Recap
          title="Pace recap"
          subtitle={`Fastest ${fmtClock(s.paceFastestSecPerMi)} · slowest ${fmtClock(s.paceSlowestSecPerMi)} /mi · ${s.dropoutCount} GPS dropouts`}
        >
          <AreaTrace points={series(s.trace, "pace")} kind="pace" height={190} markExtreme />
        </Recap>
        {showHr && (
          <Recap title="Heart rate" subtitle={`Avg ${s.avgHr} · max ${s.maxHr} bpm over distance`}>
            <AreaTrace points={series(s.trace, "hr")} kind="hr" height={170} />
          </Recap>
        )}
        {showElev && (
          <Recap title="Elevation" subtitle={`${s.elevGainM} m gained over the trail`}>
            <AreaTrace points={series(s.trace, "elev")} kind="elev" height={150} />
          </Recap>
        )}
      </section>

      {/* zones */}
      {s.zones && (
        <section className="flex flex-col gap-4">
          <SectionKicker>Time in heart-rate zones</SectionKicker>
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
            <ZoneBars zones={s.zones} />
          </div>
        </section>
      )}
    </div>
  );
}

function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
      {children}
    </p>
  );
}

function Recap({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-2xl font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
          {title}
        </h3>
        <p className="mt-2 text-[13px] text-[var(--muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
