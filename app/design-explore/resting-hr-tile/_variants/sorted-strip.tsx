/**
 * VARIANT 5 of 5 — idiom: `sorted-strip`.
 * "Is this a good morning, for me?"
 *
 * RANKS THE MORNING INSTEAD OF DATING IT. The last 30 mornings are sorted low
 * to high, left to right, as a strip of thin vertical ticks. Today's tick is
 * filled and labelled with its value, the 30-day average is a second labelled
 * tick, and a caption reads `4th lowest of your last 30`. Beneath the strip the
 * three most recent mornings appear in date order, so chronology is not lost
 * entirely.
 *
 * Its argument: a user does not actually know whether 50 is good FOR THEM, and
 * no amount of dated history answers that as directly as showing them where
 * today falls among their own month — the same reasoning behind `hrv_balance`'s
 * distribution gauge, applied to the metric where an absolute number is least
 * interpretable.
 *
 * Draws on **Robinhood**'s 52-week range bar — one strip, the current position
 * marked against the period's extremes, almost no ink — and **Whoop**'s habit
 * of siting a reading within the user's own distribution rather than against a
 * population norm.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — one 20px figure over a 10px caption and 10px recent rows.
 *    Three sizes, closely spaced, with the hero doing the only shouting.
 *  - COLOUR LOGIC — POSITION IS THE MEANING. The strip is monochrome, and
 *    `--warning` appears only if today's tick falls in the upper third of the
 *    athlete's own month. Nothing else on the card takes colour, ever.
 *  - SPACING RHYTHM — a ~28px strip over a hairline over three ~18px rows. One
 *    wide graphic and a short list; no grid, no plot, no dated column.
 *
 * POLARITY (answer 3, SPATIALLY): sorted ascending means LEFT IS BETTER, which
 * is stated once — the strip's ends are labelled `47 lowest` and `59 highest` —
 * and is then true everywhere on the card. There is no axis to misread.
 *
 * NO AXIS, so no axis policy — but note what `flat-month` does here: the end
 * labels read `48 lowest` / `50 highest`, and a two-beat range is instantly
 * legible as "nothing is happening", without a single pixel of chart.
 *
 * THE DELIBERATE OUTLIER IN THIS SPREAD. It is the only variant that does not
 * primarily answer "over time", which is what the brief asked for. It is here
 * to test whether ranking is a better answer to the underlying question than
 * chronology is. Note also that it is the only variant whose main graphic
 * SURVIVES `calibrating` intact: a rank needs no baseline, only a distribution.
 *
 * On the arithmetic: counting how many of the athlete's own mornings sat below
 * today is POSITION, which the ticket licenses explicitly. No average is
 * recomputed and no threshold classifies anything — "upper third" is a position
 * in the athlete's own sorted month, not a verdict about a bpm value.
 */

import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { ABOVE, MIN_BASELINE_DAYS, bpm, lastDays, ordinal, shortDay } from "../_shared";

const TITLE = "Resting HR";
const WINDOW = 30;
const RECENT = 3;

export function SortedStripVariant({ view, href }: { view: RecoveryView; href: string }) {
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
  const todayValue = today.restingHr;

  const window = lastDays(days, WINDOW);
  const values = window
    .map((d) => d.restingHr)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const n = values.length;

  if (n === 0) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">No mornings recorded yet.</p>
      </MiniCard>
    );
  }

  // Position, not classification: how many of the athlete's own mornings sat
  // strictly below today's. Ties share the lower rank, so two identical 48s
  // are both "1st lowest" rather than arbitrarily ordered.
  const rank = todayValue === null ? null : values.filter((v) => v < todayValue).length + 1;
  const upperThird = rank !== null && rank > (n * 2) / 3;

  // Tick centres are evenly spaced by RANK — the strip encodes order, not
  // magnitude. The extremes are printed instead, which is where magnitude lives.
  const tickX = (i: number) => ((i + 0.5) / n) * 100;
  const todayIndex = rank === null ? null : rank - 1;
  // The average sits at the boundary it would insert into, not on a tick.
  const avgX = avg === null ? null : (values.filter((v) => v < avg).length / n) * 100;

  const recent = [...lastDays(days, RECENT)];

  return (
    <MiniCard title={TITLE} href={href}>
      <div>
        {/* The hero. */}
        <p className="tabular-nums tracking-[-0.03em] text-[20px] leading-[22px] text-[var(--foreground)]">
          {bpm(todayValue)}
          <span className="ml-1 text-[10px] tracking-normal text-[var(--muted)]">bpm</span>
        </p>

        {/* Today's value, sited over its own tick. */}
        <div className="relative mt-2 h-[11px]">
          {todayIndex !== null && (
            <span
              className="absolute whitespace-nowrap text-[9px] tabular-nums leading-none text-[var(--foreground)]"
              style={{ left: `${tickX(todayIndex)}%`, transform: "translateX(-50%)" }}
            >
              {bpm(todayValue)}
            </span>
          )}
        </div>

        {/* The strip. Monochrome by construction — the only thing it says is
            where you are, and the only colour it can spend is on that. */}
        <div className="relative h-[28px]">
          {values.map((v, i) => {
            const isToday = i === todayIndex;
            return (
              <span
                key={i}
                className="absolute top-0 w-px"
                style={{
                  left: `${tickX(i)}%`,
                  height: isToday ? 28 : 20,
                  marginTop: isToday ? 0 : 4,
                  background: isToday
                    ? upperThird
                      ? ABOVE
                      : "var(--foreground)"
                    : "var(--border-strong)",
                  width: isToday ? 2 : 1,
                  marginLeft: isToday ? -1 : 0,
                }}
              />
            );
          })}

          {/* The average — a second labelled tick, dashed so it never reads as
              one of the athlete's own mornings. */}
          {avgX !== null && (
            <span
              className="absolute top-0 h-[28px] w-px"
              style={{
                left: `${avgX}%`,
                backgroundImage:
                  "repeating-linear-gradient(to bottom, var(--muted) 0 2px, transparent 2px 4px)",
              }}
            />
          )}
        </div>

        {/* Robinhood's range endpoints — and the one statement that left is
            better. Everything else on the card follows from it. */}
        <div className="relative mt-1 h-[11px]">
          <span className="absolute left-0 text-[9px] tabular-nums leading-none text-[var(--faint)]">
            {bpm(values[0])} lowest
          </span>
          {avgX !== null && (
            <span
              className="absolute whitespace-nowrap text-[9px] tabular-nums leading-none text-[var(--muted)]"
              style={{ left: `${avgX}%`, transform: "translateX(-50%)" }}
            >
              {bpm(avg)} avg
            </span>
          )}
          <span className="absolute right-0 text-[9px] tabular-nums leading-none text-[var(--faint)]">
            {bpm(values[n - 1])} highest
          </span>
        </div>

        {/* The caption that makes the whole card make sense. */}
        <p className="mt-1.5 text-[10px] leading-none text-[var(--muted)]">
          {rank === null ? (
            <span className="text-[var(--faint)]">No reading yet today</span>
          ) : (
            <>
              <span style={{ color: upperThird ? ABOVE : "var(--foreground)" }}>
                {ordinal(rank)} lowest
              </span>{" "}
              of your last {n}
            </>
          )}
          {avg === null && (
            <span className="text-[var(--faint)]">
              {" "}
              · no avg yet, {baseline.restingHrDays}/{MIN_BASELINE_DAYS}
            </span>
          )}
        </p>

        {/* Chronology, demoted but not discarded. */}
        <div className="mt-2 border-t border-[var(--border)] pt-1">
          {recent.map((d, i) => (
            <div
              key={d.date}
              className="flex items-baseline justify-between py-[2px] text-[10px] leading-[14px] tabular-nums"
            >
              <span className="uppercase tracking-[0.06em] text-[var(--faint)]">
                {i === recent.length - 1 ? "Today" : shortDay(d.date)}
              </span>
              <span
                className={
                  d.restingHr === null ? "text-[var(--faint)]" : "text-[var(--foreground)]"
                }
              >
                {d.restingHr === null ? "no reading" : `${bpm(d.restingHr)} bpm`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </MiniCard>
  );
}
