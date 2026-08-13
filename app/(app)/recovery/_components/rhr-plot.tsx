"use client";

/**
 * The deck's resting-HR row: bars diverging from the trailing average the
 * server already sent.
 *
 * WHY THIS PLOT IS ALLOWED TO SUBTRACT. The standing house rule is that nothing
 * recomputes a server figure, and `restingHr − avg` is the page's only
 * arithmetic performed ON one. It survives because it is a COMPARISON, not a
 * re-derivation: `avg` is `baseline.restingHrAvg` exactly as received, no mean
 * is taken here, and the figure the bars diverge from is printed on the plot so
 * the reader can check the subtraction themselves. Nothing else on this page
 * touches a baseline number.
 *
 * WHY THE CAPTION IS WORDED THE WAY IT IS — correction 2. Two averages of the
 * same metric appear on this screen and they will print different numbers. The
 * window strip's `Resting HR · window avg` is a CLIENT mean over the rendered
 * window, today included. This caption's `baseline {n}d avg {v} bpm ·
 * excl. today` is the SERVER's trailing mean, today excluded, and it is also
 * this plot's zero line. At the 30d window the two are labelled almost
 * identically and computed differently, and a user who notices reads it as a
 * bug — they are right to. They are genuinely different figures and the page
 * keeps both, so the labels are what have to stop pretending otherwise: the
 * word `baseline`, the window it came from, and `excl. today` are all
 * load-bearing, and the strip's `window avg` is its counterpart. Changing
 * either string in isolation re-opens the confusion; `window-strip.test.tsx`
 * asserts both together for that reason.
 *
 * WHY ONLY ONE DIRECTION TAKES COLOUR. Resting HR has no band, no z-score and
 * no status anywhere on the wire — `recoverytrend.Compute` derives those for HRV
 * alone — so this plot may not classify a bpm value and does not. It says one
 * thing with ink: this morning was worse than my own normal. Above the average
 * takes `--warning` at 0.85; below takes `--muted` at 0.7, because most
 * mornings are ordinary and a low resting HR is not an event. Never `--danger`
 * — an elevated resting heart rate is information, not an emergency, which is
 * the same contract `resting-rank.tsx` and the HRV tiles keep. The one
 * deliberate exception in this family is the recovery SCORE, which is Whoop's
 * own red.
 *
 * Geometry is shared, not private: `xAt` and `columnWidth` from the page's
 * `shared.ts` are the same mapping the score plot and the crosshair use, so the
 * deck's three rows name one morning at one pixel.
 */

import type { RecoveryDayPoint } from "@/lib/dashboard";
import { MIN_BASELINE_DAYS, round } from "@/app/(app)/dashboard/_components/recovery/shared";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { columnWidth, xAt } from "./shared";

/**
 * The smallest half-height the scale will ever represent, in bpm.
 *
 * Without a floor the scale is `max|deviation|`, so a month in which the
 * athlete never moved more than a beat from their own average would be
 * stretched to the full height of the row and read as a mountain range. Four
 * beats is the point at which a departure is worth looking at — it is the same
 * whole-beat register the rest of the family reports departures in — so a genuinely
 * flat month renders as the small ripple it is.
 */
const MIN_SPAN_BPM = 4;

/** Pixels kept clear above and below the bars for the caption to sit in. */
const CAPTION_ROOM = 10;

export function RhrPlot({
  days,
  avg,
  windowDays,
  height,
}: {
  days: RecoveryDayPoint[];
  /** `baseline.restingHrAvg`, non-null — the caller renders `RhrCalibrating` otherwise. */
  avg: number;
  /** `baseline.windowDays` — how long the server's trailing window is. */
  windowDays: number;
  height: number;
}) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const n = days.length;

  // The one permitted subtraction, and it is a comparison against the server's
  // own average rather than a re-derivation of it: `avg` arrives computed and
  // is printed on the plot below. A morning with no reading yields `null` and
  // draws no bar — a gap is a gap, never a zero-height bar on the zero line,
  // which would read as "exactly average".
  const deviations = days.map((d) => (d.restingHr === null ? null : d.restingHr - avg));
  const magnitudes = deviations.filter((v): v is number => v !== null).map(Math.abs);

  const span = Math.max(MIN_SPAN_BPM, ...magnitudes);
  // The same width the score column above takes, from the one definition the
  // two rows share — the pair are read down the page as a single instrument,
  // and two bars a pixel apart in width would read as two charts.
  const colW = columnWidth(n, width);
  const mid = height / 2;
  const half = Math.max(1, mid - CAPTION_ROOM);

  return (
    // The height is reserved by the container, not by the SVG, so the row keeps
    // its place in the deck through the render before the width is measured.
    <div ref={ref} style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="block"
          role="img"
          aria-label={`${n} ${n === 1 ? "morning" : "mornings"} of resting heart rate, drawn above and below a ${windowDays}-day trailing average of ${round(avg)} bpm.`}
        >
          {deviations.map((dev, i) => {
            if (dev === null) return null;
            const above = dev > 0;
            const px = Math.max(1, (Math.abs(dev) / span) * half);
            return (
              <rect
                key={days[i].date}
                data-testid="rhr-bar"
                x={xAt(i, n, width) - colW / 2}
                y={above ? mid - px : mid}
                width={colW}
                height={px}
                fill={above ? "var(--warning)" : "var(--muted)"}
                opacity={above ? 0.85 : 0.7}
              />
            );
          })}

          {/* The zero line IS the server's average — full width, so every bar
              is read against it rather than against the row's edges. */}
          <line
            data-testid="rhr-zero-line"
            x1={0}
            x2={width}
            y1={mid}
            y2={mid}
            stroke="var(--border-strong)"
            strokeWidth={1}
          />

          <text
            data-testid="rhr-caption"
            x={width - 2}
            y={mid - 5}
            textAnchor="end"
            className="fill-[var(--faint)] font-mono text-[9px] tabular-nums"
          >
            baseline {windowDays}d avg {round(avg)} bpm · excl. today
          </text>
        </svg>
      )}
    </div>
  );
}

/**
 * The row when `baseline.restingHrAvg` is null.
 *
 * There is no zero line to diverge from, so there are no bars — drawing them
 * against a client-picked stand-in would be inventing the very figure this
 * component exists to compare against. The sentence says what is missing and
 * how many mornings are still owed, and `MIN_BASELINE_DAYS` is imported rather
 * than typed out, because it is the API's configurable `min_baseline_days` and
 * a hard-coded `14` here is how two surfaces start disagreeing about what
 * "calibrating" means.
 *
 * `nights` is `baseline.restingHrDays` — the count for THIS metric, never
 * another's; the server samples resting HR, HRV and score separately.
 */
export function RhrCalibrating({ nights }: { nights: number }) {
  return (
    <p data-testid="rhr-calibrating" className="py-4 text-[11px] text-[var(--faint)]">
      No trailing average yet —{" "}
      <span className="font-mono tabular-nums">
        {nights} of {MIN_BASELINE_DAYS}
      </span>{" "}
      mornings recorded. The diverging baseline appears once the rest are, and nothing is drawn
      against a number that does not exist.
    </p>
  );
}
