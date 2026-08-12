/**
 * RestingRankCard — the `resting_hr` tile ("Resting HR").
 *
 * Three tiles on this dashboard already print today's resting heart rate. None
 * of them answers *"is this a good morning, for me?"*, because the longest
 * resting-HR history anywhere else in the product is three days — and a resting
 * heart rate that has climbed from 48 to 56 and stayed there for five days is
 * invisible in any window that narrow. This card answers it by RANKING the
 * morning instead of dating it: a user does not actually know whether 50 is good
 * for them (a 50 is excellent for one athlete and elevated for another), and no
 * amount of dated history answers that as directly as showing them where today
 * falls in their own month.
 *
 * Four registers, top to bottom:
 *
 *   1. THE HERO — today's bpm at 20px, repeated at 9px over its own tick below.
 *      Deliberately modest: `morning_vitals` and `recovery` already own today's
 *      number, and if the biggest element here were today's figure the dashboard
 *      would carry a third today-card. This card's job is the MONTH, so the
 *      strip beneath is what the eye should land on.
 *   2. THE STRIP — the last thirty mornings as thin ticks, sorted ascending and
 *      evenly spaced BY RANK, so the strip encodes order and magnitude lives in
 *      the printed extremes. That is what makes a flat month legible without a
 *      chart: `48 lowest` / `50 highest` and no auto-scale to lie about it.
 *   3. THE CAPTION — `4th lowest of your last 30`, the line that makes the whole
 *      card make sense, with the calibrating progress on a permanently reserved
 *      second line.
 *   4. RECENT MORNINGS — the last three newest-first, so chronology is demoted
 *      but not discarded. A rank alone cannot say "and it has been climbing";
 *      `58 / 57 / 56` can.
 *
 * WHY RANKING IS POSITION AND NOT CLASSIFICATION. Resting HR has no band, no
 * z-score, no status and no trend on the wire — `recoverytrend.Compute` derives
 * all of that for HRV only. So this card may not classify a bpm value, and it
 * does not: its only arithmetic is counting how many of the athlete's own
 * mornings sat below today's, which is a POSITION. Nothing here re-averages a
 * series or invents a threshold.
 *
 * WHY THE AVERAGE TICK IS DASHED. It is a statistic, not a morning. It is also
 * computed over a different window from the strip's (30 days trailing excluding
 * today, against the strip's thirty including it), so it claims a position and
 * not membership — and the dash is what says so. Do not "fix" the discrepancy by
 * re-averaging the strip's values; that is the forbidden operation.
 *
 * WHY COLOUR IS GATED ON THE AVERAGE AND NOT THE UPPER THIRD. The DX's idiom
 * description says `--warning` appears only in the athlete's top third; its own
 * colour contract says a reading above the 30-day average is warm. They disagree
 * in a real band, and the contract wins here for one reason above the others:
 * THIS CARD DRAWS THE AVERAGE TICK. Under the upper-third rule today's tick can
 * sit visibly to the right of the dashed average tick and still be painted
 * neutral ink — the card contradicting its own graphic, which is the worst
 * failure available to a tile whose entire claim is that position is the
 * meaning. When there is no average, the card spends no colour at all rather
 * than inventing the verdict the server never made.
 *
 * The colour budget is two elements: today's tick and the caption's ordinal
 * phrase. No `--danger` (a resting HR has no published threshold and inventing
 * one is the forbidden classification), no green for a low morning (most
 * mornings are ordinary), no `--accent` (the periwinkle carries `elevated` HRV
 * elsewhere in this family and there is no equivalent state here).
 *
 * POLARITY. Every other tile on this dashboard means up-is-good; this one
 * inverts it, and it says so SPATIALLY and once — the strip is sorted ascending,
 * so left is better, stated by the endpoint labels and then true everywhere on
 * the card. The caption says `lowest`, never `best`: *lowest* is a fact about
 * the number, *best* is a judgement the server never made.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { MIN_BASELINE_DAYS, ordinal, round, weekday } from "./shared";
import {
  avgInsertPct,
  endpointRow,
  labelAnchor,
  rankOf,
  sortedMornings,
  STRIP_WINDOW,
  tickPct,
} from "./resting-strip";

const TITLE = "Resting HR";
/** Mornings in the recent register. Matches `recovery_log`, which may sit beside this tile. */
const RECENT_ROWS = 3;
/** The strip's height in px. Fixed, so the card's height cannot move with the data. */
const STRIP_H = 28;

/**
 * The one question colour is allowed to ask: is this morning above the
 * athlete's own 30-day mean? A DIRECTION, never a verdict — `+1` is coloured
 * exactly like `+9`, because both mean the one thing this card may say.
 *
 * Tested on the ROUNDED departure. Every figure here prints as an integer, so a
 * difference the card does not print is a difference the card does not colour.
 */
function isAbove(value: number | null, avg: number | null): boolean {
  if (value === null || avg === null) return false;
  return Math.round(value - avg) > 0;
}

/**
 * The strip's text alternative. Every tick is `aria-hidden` — they are
 * decoration, and the meaning is in the caption and the recent rows, which are
 * real text — so without this the register would be absent from the
 * accessibility tree with nothing standing in for it. Follows `morning-ledger`'s
 * `railLabel` precedent.
 *
 * The two degenerate forms are spelled out rather than interpolated, because a
 * sentence with an em-dash in the middle of it is not a sentence.
 */
function stripLabel(
  today: number | null,
  rank: number | null,
  n: number,
  lowest: number,
  highest: number,
  avg: number | null,
): string {
  const against =
    avg === null ? "with no 30-day average yet." : `against a 30-day average of ${round(avg)}.`;
  if (today === null || rank === null) {
    return `No resting heart rate reading yet today. Your last ${n} mornings ranged from ${lowest} to ${highest} bpm, ${against}`;
  }
  return `Today's resting heart rate of ${round(today)} bpm is the ${ordinal(rank)} lowest of your last ${n} mornings, which ranged from ${lowest} to ${highest} bpm, ${against}`;
}

/** The card body used whenever there is no distribution to rank within. */
function MutedBody({ href, message }: { href: string; message: string }) {
  return (
    <MiniCard title={TITLE} href={href}>
      <p className="text-sm text-[var(--muted)]">{message}</p>
    </MiniCard>
  );
}

export function RestingRankCard({ section, href }: { section: RecoveryView; href: string }) {
  const { days, baseline } = section;

  // One guard at the top for the legacy payload with no derived blocks, exactly
  // as the other four family tiles do. Never `!`-assert the optionals.
  if (!days || !baseline || days.length === 0) {
    return <MutedBody href={href} message="Resting HR is calibrating." />;
  }

  // Today comes from the same array the rank is computed over, so the hero, the
  // filled tick and the caption cannot end up describing different mornings.
  // `days` is date-aligned with nulls preserved and ends on the local today;
  // `spark` omits missing mornings and must never be drawn from.
  const todayValue = days[days.length - 1].restingHr;
  const sorted = sortedMornings(days, STRIP_WINDOW);
  const recent = days.slice(-RECENT_ROWS).reverse();

  // Guard before dividing by `n`. A month with no readings at all is a real
  // payload, and a zero-width strip is not the honest rendering of it.
  if (sorted.length === 0) {
    return <MutedBody href={href} message="No resting heart rate readings yet." />;
  }

  const n = sorted.length;
  const avg = baseline.restingHrAvg;
  const rank = rankOf(sorted, todayValue);
  const avgPct = avgInsertPct(sorted, avg);
  const { avgLabelPct, showLowest, showHighest } = endpointRow(avgPct);
  const warm = isAbove(todayValue, avg);
  const todayPct = rank === null ? null : tickPct(rank - 1, n);
  const lowest = sorted[0];
  const highest = sorted[n - 1];

  return (
    <MiniCard title={TITLE} href={href}>
      {/* One child, not four: MiniCard lays its children out on gap-3, and these
          registers want a tighter 6px seam. The whole body is ~183px, inside the
          DX's ~180px budget and well under its 260px whole-card ceiling. */}
      <div className="flex flex-col gap-1.5">
        <p
          data-testid="rhr-hero"
          className="text-[20px] leading-[22px] tabular-nums tracking-[-0.03em] text-[var(--foreground)]"
        >
          {round(todayValue)}
          <span className="ml-1 text-[10px] tracking-normal text-[var(--muted)]">bpm</span>
        </p>

        <div className="flex flex-col">
          {/* Today's value, repeated over its own tick. Its anchor SWITCHES near
              the ends rather than clamping, so it stays both on the card and
              adjacent to the tick it names. */}
          <div className="relative h-[12px]">
            {todayPct !== null && (
              <span
                data-testid="rhr-today-label"
                className="absolute bottom-0 whitespace-nowrap text-[9px] leading-[11px] tabular-nums text-[var(--foreground)]"
                style={labelAnchor(todayPct)}
              >
                {round(todayValue)}
              </span>
            )}
          </div>

          <div
            role="img"
            aria-label={stripLabel(todayValue, rank, n, lowest, highest, avg)}
            data-testid="rhr-strip"
            className="relative"
            style={{ height: STRIP_H }}
          >
            {sorted.map((value, i) => {
              const isToday = rank !== null && i === rank - 1;
              return (
                <div
                  key={i}
                  aria-hidden="true"
                  data-testid={isToday ? "rhr-tick-today" : "rhr-tick"}
                  data-tick-value={value}
                  className="absolute bottom-0 w-px"
                  style={{
                    left: `${tickPct(i, n)}%`,
                    transform: "translateX(-50%)",
                    // Today is full-height and filled; every other morning is a
                    // shorter hairline, so the strip reads as one marked
                    // position in a field rather than as thirty equal bars.
                    height: isToday ? "100%" : "62%",
                    backgroundColor: isToday
                      ? warm
                        ? "var(--warning)"
                        : "var(--foreground)"
                      : "var(--border-strong)",
                  }}
                />
              );
            })}
            {avgPct !== null && (
              /* DASHED, and drawn at its TRUE position even when its label is
                 clamped — the geometry never lies just because the caption was
                 nudged. Dashed because the average is a statistic and not one of
                 the athlete's mornings. */
              <div
                aria-hidden="true"
                data-testid="rhr-avg-tick"
                className="absolute bottom-0 h-full w-px"
                style={{
                  left: `${avgPct}%`,
                  transform: "translateX(-50%)",
                  background:
                    "repeating-linear-gradient(to bottom, var(--muted) 0 2px, transparent 2px 4px)",
                }}
              />
            )}
          </div>

          {/* The endpoint register. The avg label yields to the card edges and
              wins against the endpoint captions: it is the more informative
              figure, and the extremes stay visible as the outermost ticks even
              without their words. */}
          <div className="relative h-[12px] text-[9px] leading-[11px] tabular-nums text-[var(--faint)]">
            {showLowest && (
              <span data-testid="rhr-lowest-label" className="absolute left-0 top-0">
                {lowest} lowest
              </span>
            )}
            {avgLabelPct !== null && avg !== null && (
              <span
                data-testid="rhr-avg-label"
                className="absolute top-0 whitespace-nowrap text-[var(--muted)]"
                style={{ left: `${avgLabelPct}%`, transform: "translateX(-50%)" }}
              >
                {round(avg)} avg
              </span>
            )}
            {showHighest && (
              <span data-testid="rhr-highest-label" className="absolute right-0 top-0">
                {highest} highest
              </span>
            )}
          </div>
        </div>

        {/* The caption's second line is reserved UNCONDITIONALLY. Appending the
            calibrating progress inline wraps at a one-third desktop cell and
            grows the card by a line exactly when the user's dashboard is
            newest; an empty reserved line is invisible and a 12px jump is not.
            `TileGrid` has no span support, so a tile that changes height moves
            its whole row, including unrelated tiles. */}
        <div data-testid="rhr-caption" className="flex min-h-[28px] flex-col gap-[2px]">
          <p className="text-[10px] leading-[13px] text-[var(--muted)]">
            {rank === null ? (
              // Yesterday is never promoted into today. The recent rows carry
              // the last actual reading one register below, which is where it
              // belongs — a hero that silently changes what it means is how a
              // user learns to distrust a figure.
              "No reading yet today"
            ) : (
              <>
                {/* `lowest`, never `best`: one is a fact about the number, the
                    other is a judgement the server never made. */}
                <span
                  data-testid="rhr-rank-phrase"
                  style={{ color: warm ? "var(--warning)" : "var(--foreground)" }}
                >
                  {ordinal(rank)} lowest
                </span>{" "}
                of your last {n}
              </>
            )}
          </p>
          <p className="min-h-[13px] text-[10px] leading-[13px] text-[var(--faint)]">
            {avg === null
              ? `no avg yet, ${baseline.restingHrDays} of ${MIN_BASELINE_DAYS} mornings`
              : ""}
          </p>
        </div>

        <div className="flex flex-col divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {recent.map((day, i) => (
            <RecentRow key={day.date} day={day} isToday={i === 0} />
          ))}
        </div>
      </div>
    </MiniCard>
  );
}

/** One recent morning. Newest-first, matching `recovery_log`'s same register. */
function RecentRow({ day, isToday }: { day: RecoveryDayPoint; isToday: boolean }) {
  // Positional, by the payload's contract that `days` ends on the local today.
  const label = isToday ? "Today" : weekday(day.date);
  return (
    <div data-testid="rhr-recent-row" className="flex items-baseline justify-between py-1">
      <span className="text-[10px] text-[var(--faint)]">{label}</span>
      {day.restingHr === null ? (
        // The row has space for the word, and a sparse month should read as
        // intentional rather than as a column of em-dashes.
        <span className="text-[10px] italic text-[var(--faint)]">no reading</span>
      ) : (
        <span className="text-[10px] tabular-nums tracking-[-0.01em] text-[var(--foreground)]">
          {round(day.restingHr)}
          <span className="text-[var(--faint)]"> bpm</span>
        </span>
      )}
    </div>
  );
}
