"use client";

/**
 * IDIOM: traces-lab-stack
 *
 * The ANALYTICAL STACK IS THE HERO. Pace + HR + Elevation render as three EQUAL
 * editorial area charts sharing one distance axis and a single crosshair (the
 * lab column reads as one synchronized instrument). The overview is minimal —
 * title + notes + a 4-number strip — the map is demoted to a secondary slot,
 * and the splits sit UNDER the lab.
 *
 * - Type scale: tabular, tight tracking on axis labels; the title is not
 *   oversized — the charts carry the page, not the headline.
 * - Color logic: the series encoding IS the story — pace in run-fg, HR in the
 *   warm zone tone, elevation in muted teal; no competing tile chrome.
 * - Spacing rhythm: dense stacked charts with hairline rules between panes; the
 *   overview is compressed to a single tight band.
 *
 * in-system: tokens only. Divergence is the analysis-first composition.
 */

import type { RunSession } from "../_fixtures";
import { fmtClock, fmtDuration } from "../_fixtures";
import { AreaTrace, RouteMapMock, SplitsTable, ZoneBars, series, traceHasData } from "../_charts";

// A fixed crosshair distance so all three panes read the same slice — the
// mile-4 climb where HR peaks and pace sags.
const CROSSHAIR_MI = 4.2;

export function TracesLabStack({ s, notesFilled }: { s: RunSession; notesFilled: boolean }) {
  const showHr = s.avgHr != null;
  const showElev = s.hasElevation && traceHasData(s.trace, "elev");

  const strip: [string, string][] = [
    ["Dist", `${s.distanceMi.toFixed(1)} mi`],
    ["Time", fmtDuration(s.durationSec)],
    ["Avg pace", `${fmtClock(s.avgPaceSecPerMi)}`],
  ];
  if (showHr) strip.push(["Avg HR", `${s.avgHr}`]);
  else if (s.elevGainM != null) strip.push(["Elev", `${s.elevGainM} m`]);

  const panes = [
    { kind: "pace" as const, label: "Pace", unit: "/mi", show: true },
    { kind: "hr" as const, label: "Heart rate", unit: "bpm", show: showHr },
    { kind: "elev" as const, label: "Elevation", unit: "m", show: showElev },
  ].filter((p) => p.show);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-7">
      {/* compressed overview band */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            {s.name}
          </h1>
          <span className="text-xs text-[var(--muted)]">{s.startLabel}</span>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-1 border-y border-[var(--border)] py-2.5">
          {strip.map(([l, v]) => (
            <div key={l} className="flex items-baseline gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-[var(--faint)]">{l}</span>
              <span className="text-sm font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
                {v}
              </span>
            </div>
          ))}
        </div>
        {notesFilled ? (
          <p className="text-[13px] leading-relaxed text-[var(--muted)]">{s.notesFilled}</p>
        ) : (
          <button className="w-fit text-[13px] italic text-[var(--faint)] underline decoration-dotted underline-offset-4 transition hover:text-[var(--muted)] focus:text-[var(--muted)] focus:outline-none">
            How did this run feel?
          </button>
        )}
      </div>

      {/* THE LAB — three equal panes, shared axis + crosshair */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        {panes.map((p, i) => {
          const last = i === panes.length - 1;
          return (
            <div key={p.kind} className={i > 0 ? "border-t border-[var(--border)]" : ""}>
              <div className="flex items-baseline justify-between px-4 pt-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                  {p.label}
                </span>
                <span className="text-[11px] tabular-nums text-[var(--muted)]">{p.unit}</span>
              </div>
              <div className="px-2 pb-1">
                <AreaTrace
                  points={series(s.trace, p.kind)}
                  kind={p.kind}
                  height={140}
                  compact
                  hideXAxis={!last}
                  crosshairX={CROSSHAIR_MI}
                  markExtreme={p.kind === "pace"}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* secondary: map + splits side by side on xl, stacked otherwise */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {s.hasRoute && (
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
              Route
            </span>
            <RouteMapMock height={220} />
          </div>
        )}
        <div className={`flex flex-col gap-2 ${s.hasRoute ? "" : "lg:col-span-2"}`}>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
            Splits
          </span>
          <SplitsTable splits={s.splits} showHr={showHr} showElev={showElev} compact />
        </div>
      </div>

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
