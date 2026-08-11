/**
 * VARIANT 4 of 5 — idiom: `blotter-lines`.
 * "Read it like a log."
 *
 * Draws on **Bloomberg Terminal**'s conviction that a dense, uniform log line
 * beats a table when every entry has the same shape, and **Linear**'s
 * activity-feed line density.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — ONE SIZE FOR EVERYTHING. Every glyph on the card is 12px:
 *    weekday, band word, score, bpm, ms. The flattest scale in the spread and
 *    the deliberate opposite of `score-gutter`.
 *  - COLOUR LOGIC — the band is a single COLOURED WORD, one per line, doing
 *    double duty as the label the shipped tile never had. HRV status is reduced
 *    to a trailing glyph carrying `nightOpacity` as weight but no hue at all, so
 *    the count of coloured things per line is exactly one.
 *  - SPACING RHYTHM — no grid, no rules, no columns, no row padding. Text
 *    leading is the ENTIRE rhythm. A line costs a line rather than a row, which
 *    is why ten days fit where seven rows would not, and why an absent morning
 *    occupies exactly the same space as a real one — the reason this idiom
 *    survives `sparse` better than anything row-based.
 *
 * Type family is Manrope with tabular figures, per the system. Note the
 * consequence the ticket asks to be judged: the words are variable-width, so
 * the figures deliberately do NOT align down the column.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { nightOpacity } from "@/app/(app)/dashboard/_components/recovery/shared";
import {
  int,
  isMissing,
  ms,
  nightMark,
  recoveryBand,
  recoveryBandColor,
  recoveryBandWord,
  shortDay,
} from "../_shared";

const TITLE = "Recovery Log";
const DAYS = 10;

/** The line's own separator — faint, so it recedes into punctuation. */
function Dot() {
  return <span className="text-[var(--faint)]"> · </span>;
}

export function BlotterLinesVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">Log is calibrating.</p>
      </MiniCard>
    );
  }

  const calibrating = baseline.recoveryScoreAvg === null;
  const window = [...days.slice(-DAYS)].reverse();

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="text-[12px] leading-[1.35] tabular-nums tracking-[-0.01em]">
        {window.map((d, i) => (
          <Line
            key={d.date}
            day={d}
            mark={nightMark(days, days.length - 1 - i)}
            isToday={i === 0}
            calibrating={calibrating}
          />
        ))}

        {/* The yardstick, pinned as a last line in the same register — it reads
            as the log's summary row rather than as a header you stop seeing. */}
        <div className="mt-1.5 border-t border-[var(--border)] pt-1.5 text-[var(--faint)]">
          {calibrating ? (
            <>Base · calibrating · {baseline.hrvDays} of 14 nights</>
          ) : (
            <>
              Base · {int(baseline.recoveryScoreAvg)} · {int(baseline.restingHrAvg)} bpm ·{" "}
              {ms(baseline.hrvAvg)} ms
            </>
          )}
        </div>
      </div>
    </MiniCard>
  );
}

/** The glyph for one night's HRV status. Weight only — never a second hue. */
function statusGlyph(status: RecoveryDayPoint["status"]): string {
  switch (status) {
    case "elevated":
      return "▲";
    case "suppressed":
      return "▼";
    case "balanced":
      return "▬";
    default:
      return "·";
  }
}

function Line({
  day,
  mark,
  isToday,
  calibrating,
}: {
  day: RecoveryDayPoint;
  mark: ReturnType<typeof nightMark>;
  isToday: boolean;
  calibrating: boolean;
}) {
  const label = isToday ? "Today" : shortDay(day.date);

  if (isMissing(day)) {
    return (
      <div className="text-[var(--faint)]">
        {label}
        <Dot />
        no reading
      </div>
    );
  }

  const band = recoveryBand(day.recoveryScore);

  return (
    <div className="text-[var(--muted)]">
      <span className="text-[var(--faint)]">{label}</span>
      <Dot />
      <span style={{ color: recoveryBandColor(band) }}>{recoveryBandWord(band)}</span>{" "}
      <span className="text-[var(--foreground)]">{day.recoveryScore}</span>
      <Dot />
      {int(day.restingHr)} bpm
      <Dot />
      {ms(day.hrv)} ms{" "}
      {!calibrating && (
        <span
          className="text-[var(--faint)]"
          style={{ opacity: nightOpacity(mark) }}
          aria-hidden="true"
        >
          {statusGlyph(day.status)}
        </span>
      )}
    </div>
  );
}
