/**
 * VARIANT 4 of 5 — idiom: `true-scale-marks`.
 * "How much does this actually move?"
 *
 * REFUSES TO AMPLIFY. Thirty-one marks on a raw bpm axis whose bounds are
 * FIXED TO A PLAUSIBLE HUMAN RANGE (40–70) rather than fitted to the data, with
 * the athlete's 30-day average drawn as a labelled rule — and, deliberately,
 * THE AXIS IS INVERTED so lower sits higher, making better-is-up true on this
 * card the way it is true on every other card in the grid.
 *
 * Its argument is a direct rebuttal of `departure-area`: a chart that rescales
 * itself to its own noise is a chart that cannot tell you NOTHING IS HAPPENING,
 * and for a metric this stable that is the most common true answer. On
 * `flat-month` this renders an almost perfectly straight line across the middle
 * of the card. On `creeping-up` the line visibly descends toward the floor.
 *
 * Draws on **Oura**'s resting-heart-rate graph — a fixed, calm vertical scale
 * with the lowest point marked, so an ordinary month looks ordinary — and
 * **Apple Health**'s fixed-range daily plots.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — modest and even. A 20px figure for today, 9px axis labels,
 *    and NOTHING BETWEEN. Half `departure-area`'s hero, twice `month-grid`'s cell.
 *  - COLOUR LOGIC — NEAR-MONOCHROME. The line and every mark are `--muted`
 *    throughout; `--warning` is spent only on the marks sitting above the
 *    average rule. On a good month the card has no colour on it at all.
 *  - SPACING RHYTHM — ONE register, not two: a single full-bleed plot with a
 *    fixed vertical scale, the figure overlaid in its top-left rather than
 *    stacked above it, and two hairline axis labels. No internal divider.
 *
 * POLARITY (answer 2 — INVERT THE AXIS; alone in the spread): the inverted axis
 * is the thing being tested here, and whether it reads as intuitive or as the
 * chart lying to you about which way a number went is exactly what the
 * comparison is for. The axis endpoints are labelled `40 lower` / `70 higher`
 * so the inversion is stated on the axis itself rather than in a legend.
 *
 * AXIS POLICY — FIXED at 40–70 bpm, always, on every fixture. Never fitted,
 * never auto-scaled, never nice-numbered to the data. That IS the idiom.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { ABOVE, MIN_BASELINE_DAYS, bpm, delta, isAbove, signed } from "../_shared";

const TITLE = "Resting HR";

/** The fixed, plausible human range. Not derived from the data — ever. */
const LO = 40;
const HI = 70;
const H = 118;

export function TrueScaleMarksVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">No readings yet.</p>
      </MiniCard>
    );
  }

  const avg = baseline.restingHrAvg;
  const today = days[days.length - 1];
  const n = days.length;

  // Inverted: 40 bpm maps to the TOP of the box, 70 to the bottom.
  const y = (v: number) => ((Math.max(LO, Math.min(HI, v)) - LO) / (HI - LO)) * H;
  const x = (i: number) => (i / (n - 1)) * 100;

  // The month's lowest morning — Oura's lowest-point marker. Picking a minimum
  // out of a series is a selection, not a recomputation; no average is derived.
  const readings = days.filter((d) => d.restingHr !== null);
  const lowest = readings.length
    ? readings.reduce((a, b) => ((b.restingHr as number) < (a.restingHr as number) ? b : a))
    : null;

  // Break the line at every gap, so a strap-off stretch is a hole rather than
  // a confident straight line drawn across mornings that never happened.
  const runs: number[][] = [];
  let run: number[] = [];
  days.forEach((d, i) => {
    if (d.restingHr === null) {
      if (run.length > 1) runs.push(run);
      run = [];
    } else {
      run.push(i);
    }
  });
  if (run.length > 1) runs.push(run);

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="relative" style={{ height: H }}>
        <svg
          viewBox={`0 0 100 ${H}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {runs.map((idx, k) => (
            <polyline
              key={k}
              points={idx.map((i) => `${x(i)},${y(days[i].restingHr as number)}`).join(" ")}
              fill="none"
              stroke="var(--muted)"
              strokeWidth="1"
              strokeOpacity="0.55"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {/* The average rule. Absent on `calibrating` — there is no average to
            draw, and drawing one would mean inventing what the server withheld. */}
        {avg !== null && (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 h-px bg-[var(--border-strong)]"
              style={{ top: y(avg) }}
            />
            <span
              className="pointer-events-none absolute right-0 text-[9px] tabular-nums leading-none text-[var(--faint)]"
              style={{ top: y(avg) + 3 }}
            >
              {bpm(avg)} avg
            </span>
          </>
        )}

        {/* The marks. Drawn in DOM rather than in the stretched viewBox so a
            dot stays a dot at any tile width. */}
        {days.map((d, i) =>
          d.restingHr === null ? null : (
            <Mark
              key={d.date}
              day={d}
              left={x(i)}
              top={y(d.restingHr)}
              warm={isAbove(d.restingHr, avg)}
              isLowest={lowest !== null && d.date === lowest.date}
              isToday={i === n - 1}
            />
          ),
        )}

        {/* The figure, overlaid in the plot's own top-left — one register. The
            delta sits INLINE beside it rather than stacked beneath: on
            `creeping-up` the month opens around 48 bpm, which on this fixed
            scale is exactly where a second line would have been, and the marks
            drew straight through it. One line clears the plot at every fixture. */}
        <p className="pointer-events-none absolute left-0 top-0 flex items-baseline gap-1 tabular-nums tracking-[-0.03em]">
          <span className="text-[20px] leading-[22px] text-[var(--foreground)]">
            {bpm(today.restingHr)}
            <span className="ml-1 text-[9px] tracking-normal text-[var(--muted)]">bpm</span>
          </span>
          <span className="text-[9px] uppercase tracking-[0.09em] text-[var(--faint)]">
            {avg === null ? (
              <>
                {baseline.restingHrDays} of {MIN_BASELINE_DAYS}
              </>
            ) : today.restingHr === null ? (
              <>not in yet</>
            ) : (
              <>{signed(delta(today.restingHr, avg))} vs 30d</>
            )}
          </span>
        </p>

        {/* The fixed scale's endpoints — and the only statement of the
            inversion the card makes. Nine pixels, twice, no legend. */}
        <span className="pointer-events-none absolute right-0 top-0 text-[9px] tabular-nums leading-none text-[var(--faint)]">
          {LO} lower
        </span>
        <span className="pointer-events-none absolute bottom-0 right-0 text-[9px] tabular-nums leading-none text-[var(--faint)]">
          {HI} higher
        </span>
      </div>
    </MiniCard>
  );
}

function Mark({
  day,
  left,
  top,
  warm,
  isLowest,
  isToday,
}: {
  day: RecoveryDayPoint;
  left: number;
  top: number;
  warm: boolean;
  isLowest: boolean;
  isToday: boolean;
}) {
  // Today and the month's lowest morning are marked by SIZE, not by a second
  // hue — the card's only colour is "this morning ran over your average".
  const size = isToday || isLowest ? 5 : 3;
  return (
    <span
      className="pointer-events-none absolute rounded-full"
      title={`${day.date} · ${bpm(day.restingHr)} bpm`}
      style={{
        left: `${left}%`,
        top,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: warm ? ABOVE : isToday || isLowest ? "var(--foreground)" : "var(--muted)",
      }}
    />
  );
}
