/**
 * VARIANT 2 of 5 — idiom: `week-columns`.
 * "Show me the week as a grid."
 *
 * Draws on **Garmin Connect**'s dense weekly summary table — days across,
 * metrics down, the yardstick pinned as a column at the edge — and **Oura**'s
 * weekly readiness strip, seven tinted cells that read as a week before they
 * read as numbers.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — flat and dense, no hero at all: 15px tabular score figures,
 *    12px bpm/ms, 10px uppercase column and row labels. The deliberate opposite
 *    of `score-gutter`'s 20px-over-9px range.
 *  - COLOUR LOGIC — the band is a FILLED CELL at the ~13%-alpha macro-tint
 *    weight, so the week's shape is a row of seven tinted blocks read
 *    left-to-right. Only the score row is filled; bpm and ms are unpainted. A
 *    missing day is an empty cell with a faint dash — an absence, not a grey
 *    block, which would read as a fourth band.
 *  - SPACING RHYTHM — a strict 9-column grid (label gutter · seven days ·
 *    `BASE`) with `gap-1` and NO row rules. Alignment does all the separating.
 *    Fits a full week inside today's ~180px because each figure is printed once
 *    and no day pays for a label or a row of padding.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { nightOpacity } from "@/app/(app)/dashboard/_components/recovery/shared";
import {
  dayInitial,
  int,
  isMissing,
  ms,
  nightMark,
  recoveryBand,
  recoveryBandTint,
} from "../_shared";

const TITLE = "Recovery Log";
const DAYS = 7;

/** label gutter · seven equal days · the hairline-separated BASE column. */
const GRID = "grid grid-cols-[3.25rem_repeat(7,minmax(0,1fr))_2.5rem] items-center gap-1";
const LABEL = "text-[10px] uppercase leading-none tracking-[0.08em] text-[var(--faint)]";

export function WeekColumnsVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">Log is calibrating.</p>
      </MiniCard>
    );
  }

  const calibrating = baseline.recoveryScoreAvg === null;
  const week = days.slice(-DAYS);
  const marks = week.map((_, i) => nightMark(days, days.length - DAYS + i));

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex flex-col gap-1.5">
        {/* Column heads. Today is the rightmost day and reads as the current one. */}
        <div className={GRID}>
          <span />
          {week.map((d, i) => (
            <span
              key={d.date}
              className={`text-center text-[10px] uppercase leading-none tracking-[0.08em] ${
                i === week.length - 1 ? "text-[var(--accent)]" : "text-[var(--faint)]"
              }`}
            >
              {dayInitial(d.date)}
            </span>
          ))}
          <span className="border-l border-[var(--border)] pl-1.5 text-right text-[10px] uppercase leading-none tracking-[0.08em] text-[var(--faint)]">
            base
          </span>
        </div>

        {/* Score — the only painted row. */}
        <div className={GRID}>
          <span className={LABEL}>Recovery</span>
          {week.map((d) => (
            <ScoreCell key={d.date} day={d} />
          ))}
          <BaseCell value={int(baseline.recoveryScoreAvg)} size="text-[15px]" />
        </div>

        {/* Resting HR — the corroborating figure, unpainted. */}
        <div className={GRID}>
          <span className={LABEL}>Rest HR</span>
          {week.map((d) => (
            <PlainCell key={d.date} text={d.restingHr === null ? null : int(d.restingHr)} />
          ))}
          <BaseCell value={int(baseline.restingHrAvg)} size="text-[12px]" />
        </div>

        {/* HRV — context, not headline. Status appears only as weight. */}
        <div className={GRID}>
          <span className={LABEL}>HRV</span>
          {week.map((d, i) => (
            <PlainCell
              key={d.date}
              text={d.hrv === null ? null : ms(d.hrv)}
              opacity={calibrating ? 1 : nightOpacity(marks[i])}
            />
          ))}
          <BaseCell value={ms(baseline.hrvAvg)} size="text-[12px]" />
        </div>

        {calibrating && (
          <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
            baseline calibrating · {baseline.hrvDays} of 14 nights
          </p>
        )}
      </div>
    </MiniCard>
  );
}

/** The tinted block. The tint IS the band; the numeral stays plain ink. */
function ScoreCell({ day }: { day: RecoveryDayPoint }) {
  if (isMissing(day)) return <EmptyCell />;
  return (
    <span
      className="rounded-[3px] py-[3px] text-center text-[15px] tabular-nums leading-none tracking-[-0.03em] text-[var(--foreground)]"
      style={{ background: recoveryBandTint(recoveryBand(day.recoveryScore)) }}
    >
      {day.recoveryScore ?? "–"}
    </span>
  );
}

function PlainCell({ text, opacity = 1 }: { text: string | null; opacity?: number }) {
  if (text === null) return <EmptyCell />;
  return (
    <span
      className="text-center text-[12px] tabular-nums leading-none tracking-[-0.02em] text-[var(--muted)]"
      style={{ opacity }}
    >
      {text}
    </span>
  );
}

/** Absence: a faint dash in an unfilled cell, the same size as a real one. */
function EmptyCell() {
  return <span className="text-center text-[12px] leading-none text-[var(--faint)]">–</span>;
}

/** The yardstick column — hairline-separated so it reads as base, not an 8th day. */
function BaseCell({ value, size }: { value: string; size: string }) {
  return (
    <span
      className={`border-l border-[var(--border)] py-[3px] pl-1.5 text-right ${size} tabular-nums leading-none tracking-[-0.02em] text-[var(--faint)]`}
    >
      {value}
    </span>
  );
}
