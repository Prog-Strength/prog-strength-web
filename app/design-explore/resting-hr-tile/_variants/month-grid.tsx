/**
 * VARIANT 3 of 5 — idiom: `month-grid`.
 * "The whole month, every number, at once."
 *
 * THE MONTH AS A CALENDAR, WITH EVERY NUMBER IN IT. Weeks run down, weekdays
 * run across, and each cell prints that morning's bpm over a background tinted
 * by its distance above the 30-day average.
 *
 * Its argument: a month of resting HR has WEEKLY structure that a linear series
 * hides — weekends run high, the day after a hard session runs high — and a
 * calendar is the only layout in which that pattern is visible at all. It is
 * also the densest possible answer to "actual values over time": every value,
 * every date, one screenful.
 *
 * Draws on **Oura**'s calendar-style month views, where a metric is read as a
 * field of days rather than a line, and **Garmin Connect**'s dense summary tables.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — DEAD FLAT. 10px figures, 9px column heads, nothing else and
 *    nothing bigger. Today's number is the same size as a morning three weeks
 *    ago. The deliberate opposite of `departure-area`'s 28px-over-9px.
 *  - COLOUR LOGIC — TINT AS TERRITORY, graded around the ~13% macro-tint alpha,
 *    so the month reads as a field of warm and plain blocks before a single
 *    digit is read. Ink never takes colour; only the ground does.
 *  - SPACING RHYTHM — a strict 7-column grid at `gap-[2px]` with NO rules
 *    anywhere. Alignment does all the separating.
 *
 * POLARITY (answer 3 — no axis at all): there is no direction on this card for
 * a user to misread, so the question never arises. Warmth alone carries it, and
 * because every cell prints its own figure beside a printed average, "warm
 * means the bigger number" is self-teaching without a legend.
 *
 * DELIBERATE DEVIATION FROM THE TICKET, worth a look at selection: the ticket
 * specifies 7×4 = 28 days. But "weeks running down and weekdays running across"
 * only means anything if the columns are TRUE weekdays, and 28 consecutive days
 * ending on a Wednesday cannot start on a Monday — that layout's column heads
 * come out `T F S S M T W`, with two ambiguous T's and two ambiguous S's, which
 * destroys the weekend-structure argument the idiom exists for. So this renders
 * whole Mon–Sun weeks: 5 rows covering the full 31-day window, with the days
 * after today left blank the way a calendar leaves the rest of the month blank.
 * That is MORE numbers than the ticket asked for, in the same ~140px.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { MIN_BASELINE_DAYS, addDays, bpm, delta, warmTint, weekdayIndex } from "../_shared";

const TITLE = "Resting HR";
const HEADS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * Tint as territory. Graded so a `+1` morning and a `+8` morning are not the
 * same block of colour, centred on the ~13% macro-tint alpha the system uses
 * for a field. At or below the average is UNTINTED — a low morning is never
 * painted green, because most mornings are ordinary and an ordinary month must
 * not be the loudest card on the grid.
 *
 * The tint tracks the ROUNDED departure, for the reason `isAbove` gives: this
 * variant's first build tinted a 49 against a 48.9 average, which turned the
 * whole `flat-month` fixture into a warm checkerboard and cried wolf on the one
 * month that should have looked calmest. A departure the cell does not print is
 * a departure the cell does not colour.
 */
function tint(dep: number | null): string {
  if (dep === null) return "transparent";
  const d = Math.round(dep);
  if (d <= 0) return "transparent";
  if (d <= 1) return warmTint(0.07);
  if (d <= 2) return warmTint(0.12);
  if (d <= 4) return warmTint(0.17);
  return warmTint(0.22);
}

export function MonthGridVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">No readings yet.</p>
      </MiniCard>
    );
  }

  const avg = baseline.restingHrAvg;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = days[days.length - 1].date;

  // Pad the window out to whole Mon–Sun weeks. Leading pad only happens if the
  // window doesn't already start on a Monday; trailing pad is the rest of the
  // current week, which is simply the future.
  const gridStart = addDays(days[0].date, -weekdayIndex(days[0].date));
  const gridEnd = addDays(today, 6 - weekdayIndex(today));
  const cells: (RecoveryDayPoint | null)[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    cells.push(byDate.get(d) ?? null);
  }

  return (
    <MiniCard title={TITLE} href={href}>
      <div>
        <div className="grid grid-cols-7 gap-[2px] text-center">
          {HEADS.map((h, i) => (
            <span
              key={i}
              className="pb-[3px] text-[9px] uppercase leading-none text-[var(--faint)]"
            >
              {h}
            </span>
          ))}

          {cells.map((d, i) => (
            <Cell key={d?.date ?? `pad-${i}`} day={d} avg={avg} isToday={d?.date === today} />
          ))}
        </div>

        {/* The yardstick, in one line, in the same flat register as everything else. */}
        <p className="mt-2 text-[9px] uppercase tracking-[0.09em] leading-none text-[var(--faint)]">
          {avg === null ? (
            <>
              calibrating · {baseline.restingHrDays} of {MIN_BASELINE_DAYS} mornings
            </>
          ) : (
            <>
              30-day avg{" "}
              <span className="tabular-nums text-[var(--foreground)]">{bpm(avg)} bpm</span> ·{" "}
              {baseline.restingHrDays} days
            </>
          )}
        </p>
      </div>
    </MiniCard>
  );
}

function Cell({
  day,
  avg,
  isToday,
}: {
  day: RecoveryDayPoint | null;
  avg: number | null;
  isToday: boolean;
}) {
  // Outside the window — the rest of the calendar month. Not an absence.
  if (!day) return <span className="h-[19px]" />;

  const missing = day.restingHr === null;

  return (
    <span
      className="flex h-[19px] items-center justify-center rounded-[2px] text-[10px] tabular-nums leading-none tracking-[-0.02em]"
      style={{
        // An absent morning is a filled block of --surface-2: a gap you can
        // see, rather than a hole you mistake for a rendering failure.
        background: missing ? "var(--surface-2)" : tint(delta(day.restingHr, avg)),
        color: missing ? "var(--faint)" : "var(--foreground)",
        // Today is marked by a hairline, never by colour — colour is reserved
        // for the one thing it means here, which is "above your average".
        boxShadow: isToday ? "inset 0 0 0 1px var(--border-strong)" : undefined,
      }}
    >
      {missing ? "·" : bpm(day.restingHr)}
    </span>
  );
}
