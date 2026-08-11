/**
 * VARIANT 3 of 5 — idiom: `band-rail-and-recent`.
 * "The shape of the fortnight, then this morning."
 *
 * Draws on **Whoop**'s recovery-history bar strip, which turns a fortnight of
 * scores into a shape you read in one glance rather than row by row, and
 * **Garmin Connect**'s summary-over-detail card structure — a compressed
 * overview register stacked above a few rows of real detail.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — no numeral above 13px anywhere on the card. The rail is the
 *    emphasis, not type; this is the only variant where the largest visual
 *    element is not a number.
 *  - COLOUR LOGIC — the band is MARK HEIGHT plus fill, spread across fourteen
 *    bars. The detail rows below spend almost no colour: one small
 *    band-coloured word beside each score, and the baseline tick stays neutral.
 *  - SPACING RHYTHM — two UNEQUAL stacked registers separated by a hairline:
 *    ~40px of rail over ~110px of detail, with the baseline's bpm and ms figures
 *    as a single 10px line in the seam. The only variant that shows more than a
 *    week (14 days), and the only one that does not give every day a row.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import {
  int,
  isMissing,
  ms,
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
  shortDay,
} from "../_shared";

const TITLE = "Recovery Log";
const RAIL_DAYS = 14;
const DETAIL_ROWS = 3;
const RAIL_H = 40;

export function BandRailAndRecentVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">Log is calibrating.</p>
      </MiniCard>
    );
  }

  const calibrating = baseline.recoveryScoreAvg === null;
  const rail = days.slice(-RAIL_DAYS);
  const recent = [...days.slice(-DETAIL_ROWS)].reverse();

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex flex-col gap-2">
        {/* REGISTER ONE — a fortnight as a shape, against its own normal. */}
        <div className="relative flex items-end gap-[2px]" style={{ height: RAIL_H }}>
          {!calibrating && baseline.recoveryScoreAvg !== null && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--border-strong)]"
              style={{ bottom: (baseline.recoveryScoreAvg / 100) * RAIL_H }}
            />
          )}
          {rail.map((d) => (
            <RailBar key={d.date} day={d} />
          ))}
        </div>

        {/* The seam: the two baseline figures the rail's tick cannot carry. */}
        <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
          <span>{calibrating ? "calibrating" : "30-day base"}</span>
          <span className="tabular-nums tracking-[-0.01em] normal-case">
            {calibrating ? (
              `${baseline.hrvDays} of 14 nights`
            ) : (
              <>
                {int(baseline.recoveryScoreAvg)} · {int(baseline.restingHrAvg)} bpm ·{" "}
                {ms(baseline.hrvAvg)} ms
              </>
            )}
          </span>
        </div>

        {/* REGISTER TWO — where the cross-metric reading actually happens. */}
        <div className="-mt-0.5 flex flex-col divide-y divide-[var(--border)]">
          {recent.map((d, i) => (
            <DetailRow key={d.date} day={d} isToday={i === 0} />
          ))}
        </div>
      </div>
    </MiniCard>
  );
}

/** One day of the fortnight. Height is the score; fill is its band. */
function RailBar({ day }: { day: RecoveryDayPoint }) {
  const score = day.recoveryScore;

  // An absent morning is a blank slot on the rail, not a zero-height day — a
  // bar of nothing would read as a catastrophic score rather than a gap.
  if (score === null) {
    return (
      <div
        className="flex-1 rounded-[1px] bg-[var(--surface-2)]"
        style={{ height: 2 }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="flex-1 rounded-[1px]"
      style={{
        height: Math.max(3, Math.round((score / 100) * RAIL_H)),
        background: recoveryBandColor(recoveryBand(score)),
      }}
      aria-hidden
    />
  );
}

/** One morning in full. Nothing here is larger than 13px. */
function DetailRow({ day, isToday }: { day: RecoveryDayPoint; isToday: boolean }) {
  const band = recoveryBand(day.recoveryScore);
  const label = isToday ? "Today" : shortDay(day.date);

  if (isMissing(day)) {
    return (
      <div className="flex items-baseline gap-2 py-[5px]">
        <span className="w-9 shrink-0 text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
          {label}
        </span>
        <span className="text-[12px] text-[var(--faint)]">no reading</span>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2 py-[5px]">
      <span className="w-9 shrink-0 text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
        {label}
      </span>
      <span className="text-[13px] tabular-nums leading-none tracking-[-0.03em] text-[var(--foreground)]">
        {day.recoveryScore}
      </span>
      <span
        className="text-[10px] uppercase tracking-[0.08em]"
        style={{ color: recoveryBandColor(band) }}
      >
        {recoveryBandWord(band)}
      </span>
      <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-[var(--muted)]">
        {int(day.restingHr)}
        <span className="text-[var(--faint)]"> bpm</span> · {ms(day.hrv)}
        <span className="text-[var(--faint)]"> ms</span>
      </span>
    </div>
  );
}
