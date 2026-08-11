/**
 * VARIANT 1 of 5 — idiom: `score-gutter`.
 * "The shipped tile, done properly."
 *
 * Draws on **Linear**'s coloured status rail — the 3px bar down the left of a
 * list row that makes the list scannable before a single word of it is read —
 * plus **Whoop**'s band vocabulary for what that colour means.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — the widest intra-row range in the spread: one ~20px numeral
 *    per row sitting over 9–10px furniture. The score is the only thing at
 *    reading size; everything else is a label.
 *  - COLOUR LOGIC — the band is TERRITORY. It lives in the gutter rule,
 *    saturated and continuous, so seven rules stack into a vertical stripe of
 *    the week and the bad weekend is a block of warm colour you see before you
 *    read a number. The score numeral itself stays neutral ink, precisely so the
 *    tile does not become seven coloured numbers. HRV status is demoted to a 1px
 *    underline on the ms figure at `nightOpacity`, and nothing more.
 *  - SPACING RHYTHM — seven even ~32px rows on hairlines. Generous, uniform,
 *    one row per day. THIS IS THE TALL VARIANT: it spends the height, and
 *    because `TileGrid` has no span support it costs the whole dashboard row.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { hrvStatusColor, nightOpacity } from "@/app/(app)/dashboard/_components/recovery/shared";
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
const DAYS = 7;

export function ScoreGutterVariant({ view, href }: { view: RecoveryView; href: string }) {
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

  return (
    <MiniCard title={TITLE} href={href}>
      {/* The yardstick, in brief order: score · bpm · ms. */}
      <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-1">
        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
          {calibrating ? "calibrating" : "30-day base"}
        </span>
        <span className="text-[11px] tabular-nums tracking-[-0.02em] text-[var(--muted)]">
          {calibrating ? (
            `${baseline.hrvDays} of 14 nights`
          ) : (
            <>
              {int(baseline.recoveryScoreAvg)}
              <span className="text-[var(--faint)]"> · </span>
              {int(baseline.restingHrAvg)}
              <span className="text-[var(--faint)]"> bpm · </span>
              {ms(baseline.hrvAvg)}
              <span className="text-[var(--faint)]"> ms</span>
            </>
          )}
        </span>
      </div>

      {/* Seven mornings, newest at the bottom so the gutter reads as a timeline. */}
      <div className="-mt-1.5 flex flex-col divide-y divide-[var(--border)]">
        {week.map((d, i) => (
          <GutterRow
            key={d.date}
            day={d}
            mark={nightMark(days, days.length - DAYS + i)}
            isToday={i === week.length - 1}
          />
        ))}
      </div>
    </MiniCard>
  );
}

function GutterRow({
  day,
  mark,
  isToday,
}: {
  day: RecoveryDayPoint;
  mark: ReturnType<typeof nightMark>;
  isToday: boolean;
}) {
  const band = recoveryBand(day.recoveryScore);
  const missing = isMissing(day);
  const label = isToday ? "Today" : shortDay(day.date);

  return (
    <div className="flex items-stretch gap-2.5 py-[1px]">
      {/* The rail. An absent morning takes the surface, never a band colour —
          absence is not a verdict, and a grey rule still stacks into the stripe. */}
      <div
        aria-hidden="true"
        className="w-[3px] shrink-0 rounded-full"
        style={{ background: missing ? "var(--surface-2)" : recoveryBandColor(band) }}
      />

      <span className="w-9 shrink-0 self-center text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
        {label}
      </span>

      {/* Hero. Neutral ink on purpose — the gutter is carrying the colour. */}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        {missing ? (
          <span className="text-[12px] text-[var(--faint)]">no reading</span>
        ) : (
          <>
            <span className="text-[20px] leading-none tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
              {day.recoveryScore}
            </span>
            <span className="mt-[1px] text-[9px] uppercase leading-none tracking-[0.08em] text-[var(--faint)]">
              {recoveryBandWord(band)}
            </span>
          </>
        )}
      </div>

      {!missing && (
        <div className="flex shrink-0 items-center gap-2.5 self-center font-mono text-[11px] tabular-nums text-[var(--muted)]">
          <span>
            {int(day.restingHr)}
            <span className="text-[var(--faint)]"> bpm</span>
          </span>
          {/* HRV status, fully demoted: a hairline under the figure, never a
              second saturated colour beside the score. */}
          <span
            style={{
              textDecoration: "underline",
              textDecorationThickness: "1px",
              textUnderlineOffset: "3px",
              textDecorationColor:
                day.hrv === null
                  ? "transparent"
                  : `color-mix(in srgb, ${hrvStatusColor(day.status)} ${Math.round(
                      nightOpacity(mark) * 100,
                    )}%, transparent)`,
            }}
          >
            {ms(day.hrv)}
            <span className="text-[var(--faint)]"> ms</span>
          </span>
        </div>
      )}
    </div>
  );
}
