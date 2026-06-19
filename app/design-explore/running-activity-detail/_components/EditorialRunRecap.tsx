"use client";

/**
 * VARIANT 5 / 5 — idiom: editorial-run-recap   (reference: The Athletic / Oura)
 *
 * Tells the run as a SHORT STORY. A real headline + a one-or-two-sentence recap
 * lead; a few standout figures are pulled large as supporting stats; the effort
 * chart is a single supporting figure with a caption; the splits sit as a quiet
 * appendix below the fold.
 *
 * In-system encoding:
 *   • type scale  — EDITORIAL contrast within Manrope: a large, light-weight
 *     headline against small body copy. The only place a true display scale
 *     appears across the five variants.
 *   • color logic — calm, near-monochrome; green-teal and a SINGLE status tone
 *     reserved for the one fact worth emphasizing (the fade over the last reps).
 *   • spacing     — airy, reading-document rhythm; a narrow measure.
 *
 * Answers "the page has no point of view." Degrades: for an unlinked / easy run
 * the recap simply narrates distance, pace and effort with no prescription beat.
 */

import {
  ADHERENCE,
  fmtClock,
  fmtPace,
  fmtPaceDelta,
  PACE_CLAMP_MAX,
  RUN,
  RUN_HUE,
  SEGMENTS,
  SPLITS,
  TRACE,
} from "../_fixtures";

export function EditorialRunRecap() {
  return (
    <div className="mx-auto flex max-w-xl flex-col px-6 py-10">
      {/* Kicker */}
      <p
        className="text-[11px] font-semibold uppercase tracking-[0.18em]"
        style={{ color: RUN_HUE.fg }}
      >
        Interval session · W7 D2
      </p>

      {/* Editorial headline — large, light, tight tracking. */}
      <h2 className="mt-3 text-[2.1rem] font-light leading-[1.12] tracking-[-0.02em] text-[var(--foreground)]">
        Eight by four hundred —{" "}
        <span className="font-medium">strong through six, then a fade.</span>
      </h2>

      <p className="mt-3 text-xs text-[var(--muted)]">
        {RUN.start} · {RUN.distanceMi.toFixed(1)} mi · {fmtClock(RUN.durationSec)}
      </p>

      {/* Lede */}
      <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[var(--foreground)]">
        <p>
          A mile to warm in, then the work: eight 400s at{" "}
          <span className="font-semibold" style={{ color: RUN_HUE.fg }}>
            {fmtPace(ADHERENCE.avgWorkPace)}
          </span>{" "}
          pace against a {fmtPace(ADHERENCE.targetWorkPace)} target. The first six landed clean —
          heart rate climbing through the 180s, recoveries shrinking — before the last two slipped
          off the back{" "}
          <span className="font-semibold" style={{ color: "var(--danger)" }}>
            ({fmtPaceDelta(ADHERENCE.paceDelta)} overall)
          </span>
          .
        </p>
        <p className="text-[var(--muted)]">
          The {fmtPace(RUN.avgPace)} average reads slow — that&apos;s the jog recoveries and a brief
          GPS dropout near mile 2 doing their work, not the legs. Effort tells the truer story.
        </p>
      </div>

      {/* Standout figures pulled large. */}
      <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[var(--border)] py-6 sm:grid-cols-4">
        <PullStat value="8" label="work reps" hue />
        <PullStat value={fmtPace(ADHERENCE.avgWorkPace)} label="avg work pace" />
        <PullStat value={`${RUN.maxHr}`} label="max bpm" />
        <PullStat value={`${ADHERENCE.repsOnPace}/8`} label="reps on pace" />
      </div>

      {/* Single supporting figure: the effort trace, captioned. */}
      <figure className="mt-8">
        <EffortFigure />
        <figcaption className="mt-2 text-xs text-[var(--muted)]">
          Pace over distance — faster runs higher; green bands mark the eight work bouts. The mile-2
          dropout is bridged, not plotted.
        </figcaption>
      </figure>

      {/* Quiet appendix: splits below the fold. */}
      <div className="mt-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
          Splits
        </p>
        <dl className="mt-3 divide-y divide-[var(--border)]">
          {SPLITS.map((s, i) => (
            <div key={i} className="flex items-baseline justify-between py-2 text-sm">
              <dt className="text-[var(--muted)]">{s.label}</dt>
              <dd className="flex items-baseline gap-4 tabular-nums">
                <span className="font-semibold">{fmtPace(s.avgPace)}</span>
                <span className="w-12 text-right text-[var(--muted)]">{s.avgHr} bpm</span>
                <span className="w-12 text-right text-[var(--faint)]">
                  {fmtClock(s.durationSec)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-[var(--faint)]">No elevation recorded on this device.</p>
      </div>
    </div>
  );
}

function PullStat({ value, label, hue }: { value: string; label: string; hue?: boolean }) {
  return (
    <div>
      <p
        className="text-3xl font-light tabular-nums tracking-[-0.03em]"
        style={hue ? { color: RUN_HUE.fg } : undefined}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-wider text-[var(--faint)]">{label}</p>
    </div>
  );
}

/** Hand-rolled calm SVG figure: winsorized pace (faster ↑) over work bands. */
function EffortFigure() {
  const W = 560;
  const H = 150;
  const pad = { t: 10, r: 8, b: 10, l: 8 };
  const pts = TRACE.filter((p) => p.paceClean != null).map((p) => ({
    mi: p.mi,
    pace: Math.min(p.paceClean as number, PACE_CLAMP_MAX),
  }));
  const lo = Math.min(...pts.map((p) => p.pace));
  const hi = Math.max(...pts.map((p) => p.pace));
  const x = (mi: number) => pad.l + (mi / RUN.distanceMi) * (W - pad.l - pad.r);
  const y = (pace: number) => pad.t + ((pace - lo) / (hi - lo || 1)) * (H - pad.t - pad.b);
  const line = pts
    .map((p, i) => `${i ? "L" : "M"}${x(p.mi).toFixed(1)},${y(p.pace).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(pts[pts.length - 1].mi).toFixed(1)},${H - pad.b} L${x(pts[0].mi).toFixed(1)},${H - pad.b} Z`;
  const bands = SEGMENTS.filter((s) => s.kind === "work");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]"
    >
      <defs>
        <linearGradient id="recapFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={RUN_HUE.dot} stopOpacity={0.18} />
          <stop offset="100%" stopColor={RUN_HUE.dot} stopOpacity={0} />
        </linearGradient>
      </defs>
      {bands.map((b, i) => (
        <rect
          key={i}
          x={x(b.startMi)}
          y={pad.t}
          width={x(b.endMi) - x(b.startMi)}
          height={H - pad.t - pad.b}
          fill={RUN_HUE.dot}
          opacity={0.07}
        />
      ))}
      <path d={area} fill="url(#recapFill)" />
      <path
        d={line}
        fill="none"
        stroke={RUN_HUE.dot}
        strokeWidth={1.75}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
