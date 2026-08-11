/**
 * VARIANT 5 of 5 — idiom: `baseline-lanes`.
 * "Where did each metric sit, relative to normal?"
 *
 * Draws on **Garmin Connect**'s deviation-from-baseline plotting, where a
 * metric's position against a fixed tick is the datum rather than its printed
 * value, and **Oura**'s contributor lanes stacked one per metric.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — 10px lane labels and NOTHING ELSE. No numerals in the plot at
 *    all. Every other variant in this spread prints figures; this one prints
 *    none, which is the trade it is here to be judged on.
 *  - COLOUR LOGIC — the band colours the MARK, and only in the recovery lane:
 *    colour appears in one lane out of three, so the bpm and ms lanes are
 *    near-monochrome and the eye lands on Recovery first by saturation rather
 *    than by size.
 *  - SPACING RHYTHM — three equal horizontal lanes on hairlines. No rows, no
 *    columns, no per-day cell. The baseline is STRUCTURAL: it is the centre tick
 *    each lane is built around and the value printed in each lane's own label,
 *    rather than a header line above the card.
 *
 * Every other variant prints numbers you must mentally subtract from a baseline
 * printed somewhere else; this one does the subtraction in space. Resting HR is
 * inverted so that "better" is always the same direction — up — across all three
 * lanes. THE DELIBERATE OUTLIER IN THE SPREAD.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { int, ms, recoveryBand, recoveryBandColor } from "../_shared";

const TITLE = "Recovery Log";
const DAYS = 14;
const LANE_H = 34;

export function BaselineLanesVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">Log is calibrating.</p>
      </MiniCard>
    );
  }

  const window = days.slice(-DAYS);
  const calibrating = baseline.recoveryScoreAvg === null;

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex flex-col divide-y divide-[var(--border)]">
        <Lane
          name="Recovery"
          base={baseline.recoveryScoreAvg}
          baseText={int(baseline.recoveryScoreAvg)}
          span={30}
          days={window}
          value={(d) => d.recoveryScore}
          colorOf={(d) => recoveryBandColor(recoveryBand(d.recoveryScore))}
        />
        <Lane
          name="Rest HR"
          base={baseline.restingHrAvg}
          baseText={int(baseline.restingHrAvg)}
          span={10}
          invert
          days={window}
          value={(d) => d.restingHr}
          colorOf={() => "var(--muted)"}
        />
        <Lane
          name="HRV"
          base={baseline.hrvAvg}
          baseText={ms(baseline.hrvAvg)}
          span={30}
          days={window}
          value={(d) => d.hrv}
          colorOf={() => "var(--muted)"}
        />
      </div>

      {calibrating && (
        <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
          no baseline yet · {baseline.hrvDays} of 14 nights · nothing is being compared
        </p>
      )}
    </MiniCard>
  );
}

function Lane({
  name,
  base,
  baseText,
  span,
  invert = false,
  days,
  value,
  colorOf,
}: {
  name: string;
  /** The 30-day average this lane is built around; null while calibrating. */
  base: number | null;
  baseText: string;
  /** Full-scale deviation, in the metric's own units, at the lane's edges. */
  span: number;
  /** Resting HR only: lower is better, so it plots upward like the others. */
  invert?: boolean;
  days: RecoveryDayPoint[];
  value: (d: RecoveryDayPoint) => number | null;
  colorOf: (d: RecoveryDayPoint) => string;
}) {
  return (
    <div className="flex items-center gap-2 py-[5px]">
      {/* The yardstick as structure: named, and carrying its own value. */}
      <div className="w-[6.25rem] shrink-0 whitespace-nowrap text-[10px] uppercase leading-none tracking-[0.08em] text-[var(--faint)]">
        {name} <span className="text-[var(--muted)]">· base {base === null ? "—" : baseText}</span>
      </div>

      <div className="relative min-w-0 flex-1" style={{ height: LANE_H }}>
        {/* The centre tick. Dashed while there is no baseline to sit on. */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-1/2 border-t ${
            base === null ? "border-dashed border-[var(--border)]" : "border-[var(--border-strong)]"
          }`}
        />
        <div className="absolute inset-0 flex">
          {days.map((d, i) => {
            const v = value(d);
            // No reading, or no baseline to measure against — the slot stays
            // empty. A mark parked on the tick would claim "exactly normal".
            if (v === null || base === null) return <div key={d.date} className="flex-1" />;

            const dev = invert ? base - v : v - base;
            const frac = Math.max(-1, Math.min(1, dev / span));
            const isToday = i === days.length - 1;
            const color = colorOf(d);

            return (
              <div key={d.date} className="relative flex-1">
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    top: `${50 - frac * 40}%`,
                    background: isToday ? color : "transparent",
                    border: `1px solid ${color}`,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
