/**
 * VARIANT 2 of 5 — idiom: `departure-area`.
 * "How far from normal, and for how long?"
 *
 * PLOTS THE GAP, NOT THE VALUE. The 30-day average is a horizontal rule
 * straight through the middle of the card, and the filled area between that
 * rule and each morning's reading is the entire chart. Nothing is plotted in
 * absolute terms at all — thirty-one days of pure DEPARTURE.
 *
 * Its argument: the absolute value of a resting heart rate is close to
 * meaningless — a 50 is excellent for one athlete and elevated for another —
 * while the departure from that athlete's own normal is the whole signal. So
 * draw the signal, and let the figures be a caption.
 *
 * Draws on **Garmin Connect**'s Resting Heart Rate card, which plots against a
 * shaded band of the athlete's own normal rather than an absolute scale, and
 * **Whoop**'s recovery-history strip.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — THE WIDEST RANGE IN THE SPREAD, and by a distance: one 28px
 *    numeral, and every other glyph on the card at 9px. Nothing in between.
 *  - COLOUR LOGIC — FILL, ABOVE THE RULE ONLY. A good month is a card with
 *    almost no colour on it; `creeping-up` is a warm wedge on the right. Below
 *    the rule the same area is filled in quiet neutral, never green: most
 *    mornings are ordinary and an ordinary month must not be the loudest card
 *    on a grid that also shows Steps and Weather.
 *  - SPACING RHYTHM — two unequal registers, a ~54px headline over a ~90px
 *    chart, separated by a hairline. Two registers exactly, never three.
 *
 * POLARITY (answer 1 — raw bpm, up is worse): the axis is unflipped, and the
 * warm fill ABOVE the rule is what teaches it, reinforced by the headline's own
 * wording (`+5 vs 30d · above your average`). No legend.
 *
 * AXIS POLICY — the departure scale has a FLOOR of ±6 bpm and grows only if the
 * month exceeds it. This is the concession this idiom has to make to survive
 * `flat-month`: fitted to its own range, ±1 bpm of noise would fill the card
 * edge to edge. With the floor, a flat month renders as a barely-visible ribbon
 * hugging the rule, which is the honest picture.
 */

import { useId } from "react";
import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { ABOVE, MIN_BASELINE_DAYS, bpm, delta, signed } from "../_shared";

const TITLE = "Resting HR";

/** Chart geometry. Stretched to the card's width; the rule is drawn in DOM. */
const H = 90;
const MID = H / 2;
const VB_W = 310;

/** The floor under the departure scale — the whole answer to `flat-month`. */
const MIN_HALF_SPAN = 6;

const WARM_FILL = "rgba(214, 184, 127, 0.30)";
const QUIET_FILL = "rgba(125, 129, 140, 0.20)";

export function DepartureAreaVariant({ view, href }: { view: RecoveryView; href: string }) {
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
  const todayDelta = delta(today.restingHr, avg);

  return (
    <MiniCard title={TITLE} href={href}>
      {/* Register 1 — the headline. One figure, one line of 9px caption. */}
      <div className="tabular-nums tracking-[-0.03em]">
        <p className="text-[28px] leading-[32px] text-[var(--foreground)]">
          {bpm(today.restingHr)}
          <span className="ml-1 text-[9px] tracking-normal text-[var(--muted)]">bpm</span>
        </p>
        <p className="mt-0.5 text-[9px] uppercase tracking-[0.09em] text-[var(--faint)]">
          {avg === null ? (
            <>
              no 30-day average yet · {baseline.restingHrDays} of {MIN_BASELINE_DAYS}
            </>
          ) : today.restingHr === null ? (
            <>no reading yet today</>
          ) : (
            <>
              <span style={{ color: todayDelta !== null && todayDelta > 0 ? ABOVE : undefined }}>
                {signed(todayDelta)} vs 30d
              </span>{" "}
              · {todayDelta !== null && todayDelta > 0 ? "above" : "below"} your average
            </>
          )}
        </p>
      </div>

      {/* Register 2 — the departure plot. */}
      <div className="border-t border-[var(--border)] pt-2">
        {avg === null ? (
          <NoBaseline days={days} restingHrDays={baseline.restingHrDays} />
        ) : (
          <DeparturePlot days={days} avg={avg} />
        )}
      </div>
    </MiniCard>
  );
}

function DeparturePlot({ days, avg }: { days: RecoveryDayPoint[]; avg: number }) {
  // The comparison route renders every variant twice (side-by-side, then in a
  // context row), so the clip ids have to be per-instance or they collide.
  const uid = useId();
  const clipAbove = `dep-above-${uid}`;
  const clipBelow = `dep-below-${uid}`;
  const n = days.length;
  const step = VB_W / (n - 1);
  const departures = days.map((d) => delta(d.restingHr, avg));

  // The axis floor. Grows past ±6 only when the month genuinely leaves it.
  const half = Math.max(
    MIN_HALF_SPAN,
    Math.ceil(Math.max(...departures.map((d) => (d === null ? 0 : Math.abs(d))))),
  );

  const x = (i: number) => i * step;
  const y = (dep: number) => MID - Math.max(-1, Math.min(1, dep / half)) * MID;

  // Contiguous runs of real readings, so a gap is a genuine hole in the area
  // rather than a straight line drawn optimistically across missing mornings.
  const runs: number[][] = [];
  let run: number[] = [];
  departures.forEach((dep, i) => {
    if (dep === null) {
      if (run.length) runs.push(run);
      run = [];
    } else {
      run.push(i);
    }
  });
  if (run.length) runs.push(run);

  const areas = runs.map((idx) => {
    // A lone morning between two gaps has no area to fill — give it a narrow
    // column instead, so `sparse` shows its three readings rather than nothing.
    if (idx.length === 1) {
      const i = idx[0];
      const w = step * 0.55;
      const yy = y(departures[i] as number);
      return `M ${x(i) - w / 2} ${MID} L ${x(i) - w / 2} ${yy} L ${x(i) + w / 2} ${yy} L ${x(i) + w / 2} ${MID} Z`;
    }
    const pts = idx.map((i) => `L ${x(i)} ${y(departures[i] as number)}`).join(" ");
    return `M ${x(idx[0])} ${MID} ${pts} L ${x(idx[idx.length - 1])} ${MID} Z`;
  });

  return (
    <div className="relative" style={{ height: H }}>
      <svg
        viewBox={`0 0 ${VB_W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipAbove}>
            <rect x="0" y="0" width={VB_W} height={MID} />
          </clipPath>
          <clipPath id={clipBelow}>
            <rect x="0" y={MID} width={VB_W} height={MID} />
          </clipPath>
        </defs>

        {/* An absent morning is an absence, not a zero: a quiet column of
            --surface-2 rather than a reading sitting on the average. */}
        {departures.map((dep, i) =>
          dep === null ? (
            <rect
              key={days[i].date}
              x={Math.max(0, x(i) - step * 0.3)}
              y="0"
              width={step * 0.6}
              height={H}
              fill="var(--surface-2)"
            />
          ) : null,
        )}

        {/* The same area, twice, clipped to each side of the rule — so colour
            is spent only where the month departed UPWARD. */}
        <g clipPath={`url(#${clipAbove})`}>
          {areas.map((d, i) => (
            <path key={`a${i}`} d={d} fill={WARM_FILL} />
          ))}
        </g>
        <g clipPath={`url(#${clipBelow})`}>
          {areas.map((d, i) => (
            <path key={`b${i}`} d={d} fill={QUIET_FILL} />
          ))}
        </g>
      </svg>

      {/* The rule itself, in DOM so its hairline survives the stretched viewBox. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-[var(--border-strong)]" />

      {/* The zero line, labelled at its left end. Without this the whole chart
          is a shape with no anchor. */}
      <span className="pointer-events-none absolute left-0 top-1/2 mt-[2px] bg-[var(--surface)] pr-1 text-[9px] tabular-nums leading-none text-[var(--faint)]">
        {bpm(avg)} avg
      </span>

      {/* The scale's own extents, so the axis is never a mystery. Knocked out
          of the surface, because on `creeping-up` the warm wedge reaches the
          top-right corner and swallowed them. */}
      <span className="pointer-events-none absolute right-0 top-0 bg-[var(--surface)] px-[2px] text-[9px] tabular-nums leading-none text-[var(--faint)]">
        +{half}
      </span>
      <span className="pointer-events-none absolute bottom-0 right-0 bg-[var(--surface)] px-[2px] text-[9px] tabular-nums leading-none text-[var(--faint)]">
        −{half}
      </span>
    </div>
  );
}

/**
 * `calibrating` — the fixture that most endangers this idiom. There is no
 * average, so there is NO DEPARTURE TO DRAW, and drawing one anyway would mean
 * inventing the baseline the server withheld. Instead the register shows which
 * mornings have landed: honest presence, an honest n-of-14, and no empty frame.
 */
function NoBaseline({ days, restingHrDays }: { days: RecoveryDayPoint[]; restingHrDays: number }) {
  return (
    <div className="flex flex-col justify-end" style={{ height: H }}>
      <div className="flex items-end gap-[2px]">
        {days.map((d) => (
          <div
            key={d.date}
            className="h-3 flex-1 rounded-[1px]"
            style={{ background: d.restingHr === null ? "var(--surface-2)" : "var(--muted)" }}
          />
        ))}
      </div>
      <p className="mt-2 text-[9px] uppercase tracking-[0.09em] leading-[13px] text-[var(--faint)]">
        {restingHrDays} of {MIN_BASELINE_DAYS} mornings.
        <br />
        Departure needs an average to depart from.
      </p>
    </div>
  );
}
