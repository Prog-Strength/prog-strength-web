"use client";

/**
 * IDIOM: ledger-plus-voice  (evolution, not revolution — the least disruptive pole)
 *
 * Keep today's SPLITS-LEDGER SPINE, Pace recap, and HR zones exactly where they
 * are. The only structural change is one INSERTED OVERVIEW BAND above the map
 * (the note + a quieter stat strip), plus HR and Elevation added as SIBLING
 * RECAPS to Pace — in the same editorial-area language, borrowing the shipped
 * Pace-recap accent treatment. The map stays in place.
 *
 * - Type scale: unchanged — the ledger's fine tabular type, the current header
 *   sizes. Nothing is re-scaled.
 * - Color logic: status pills for fastest/slowest only; the new HR/Elev traces
 *   borrow the Pace-recap --accent treatment (matching the shipped recap) rather
 *   than introducing per-series hues.
 * - Spacing rhythm: today's page rhythm (max-w-3xl, gap-6) with a single new
 *   overview block threaded in above the map.
 *
 * in-system: tokens only. Divergence is "minimal insertion", not palette.
 */

import type { RunSession } from "../_fixtures";
import { fmtClock, fmtDuration } from "../_fixtures";
import { AreaTrace, RouteMapMock, SplitsTable, ZoneBars, series, traceHasData } from "../_charts";

export function LedgerPlusVoice({ s, notesFilled }: { s: RunSession; notesFilled: boolean }) {
  const showHr = s.avgHr != null;
  const showElev = s.hasElevation && traceHasData(s.trace, "elev");

  // Quieter stat strip — a trimmed set, matching the current band's tabular type.
  const strip: [string, string][] = [
    ["Distance", `${s.distanceMi.toFixed(1)} mi`],
    ["Time", fmtDuration(s.durationSec)],
    ["Avg pace", `${fmtClock(s.avgPaceSecPerMi)} /mi`],
    ["Best", `${fmtClock(s.bestPaceSecPerMi)} /mi`],
  ];
  if (showHr) strip.push(["Avg HR", `${s.avgHr}`]);
  if (s.elevGainM != null) strip.push(["Elev", `${s.elevGainM} m`]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-6">
      {/* current-style header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">{s.name}</h1>
        <p className="text-xs text-[var(--muted)]">
          {s.startLabel} · {fmtDuration(s.durationSec)}
        </p>
      </div>

      {/* NEW overview band — note + quieter stats, inserted above the map */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4">
        {notesFilled ? (
          <p className="text-sm leading-relaxed text-[var(--foreground)]">{s.notesFilled}</p>
        ) : (
          <button className="w-fit rounded-md border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-sm italic text-[var(--faint)] transition hover:border-[var(--accent)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-line)]">
            How did this run feel?
          </button>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-3">
          {strip.map(([l, v]) => (
            <div key={l}>
              <p className="text-sm font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
                {v}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--faint)]">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* map stays where it is */}
      {s.hasRoute && <RouteMapMock height={230} />}

      {/* splits-ledger spine — unchanged */}
      <div className="flex flex-col gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          Splits
        </p>
        <SplitsTable splits={s.splits} showHr={showHr} showElev={showElev} />
      </div>

      {/* Pace recap (as shipped) + HR/Elev as sibling recaps in the same accent language */}
      <Recap
        title="Pace recap"
        subtitle={`Fastest ${fmtClock(s.paceFastestSecPerMi)} · slowest ${fmtClock(s.paceSlowestSecPerMi)} /mi · ${s.dropoutCount} GPS dropouts`}
        pill="Faster is higher"
      >
        <AreaTrace
          points={series(s.trace, "pace")}
          kind="pace"
          height={200}
          markExtreme
          color="var(--accent)"
        />
      </Recap>
      {showHr && (
        <Recap
          title="Heart rate recap"
          subtitle={`Avg ${s.avgHr} · max ${s.maxHr} bpm over distance`}
        >
          <AreaTrace points={series(s.trace, "hr")} kind="hr" height={170} color="var(--accent)" />
        </Recap>
      )}
      {showElev && (
        <Recap title="Elevation recap" subtitle={`${s.elevGainM} m gained across the trail`}>
          <AreaTrace
            points={series(s.trace, "elev")}
            kind="elev"
            height={160}
            color="var(--accent)"
          />
        </Recap>
      )}

      {/* HR zones — unchanged */}
      {s.zones && (
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[var(--faint)]">
            Heart rate zones
          </div>
          <ZoneBars zones={s.zones} />
        </div>
      )}
    </div>
  );
}

function Recap({
  title,
  subtitle,
  pill,
  children,
}: {
  title: string;
  subtitle: string;
  pill?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-5 py-5">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <h3 className="text-[22px] font-semibold leading-none tracking-[-0.02em] text-[var(--foreground)]">
            {title}
          </h3>
          <p className="mt-2 text-[13px] text-[var(--muted)]">{subtitle}</p>
        </div>
        {pill && (
          <span className="shrink-0 rounded-[var(--radius-pill)] border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-1 text-[12px] font-medium text-[var(--accent)]">
            {pill}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
