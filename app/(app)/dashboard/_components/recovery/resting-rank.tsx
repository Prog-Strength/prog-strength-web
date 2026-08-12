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
 *   1. THE HERO — today's bpm at 20px. Deliberately modest: `morning_vitals`
 *      and `recovery` already own today's number, and if the biggest element
 *      here were today's figure the dashboard would carry a third today-card.
 *      This card's job is the MONTH, so the strip beneath is what the eye
 *      should land on.
 *   2. THE STRIP — the last thirty mornings as thin ticks with today's filled,
 *      today's bpm repeated at 9px over its own tick, and beneath them the
 *      endpoint row: `47 lowest · 53 avg · 59 highest`. That row is the densest
 *      line on the card and it is not decoration — the ticks are spaced by
 *      RANK, so the strip carries order and the endpoint row is the only place
 *      magnitude appears at all. `resting-strip.ts` owns why the spacing works
 *      that way and where every mark lands; this file only places them.
 *   3. THE CAPTION — `4th lowest of your last 29`, the line that makes the whole
 *      card make sense. `29`, not `30`: the count is the mornings actually
 *      behind the rank, so a sparse month says so. The calibrating progress
 *      goes on a permanently reserved second line.
 *   4. RECENT MORNINGS — the last three newest-first, so chronology is demoted
 *      but not discarded. A rank alone cannot say "and it has been climbing";
 *      `58 / 57 / 56` can.
 *
 * WHY RANKING IS POSITION AND NOT CLASSIFICATION. Resting HR has no band, no
 * z-score, no status and no trend on the wire — `recoverytrend.Compute` derives
 * all of that for HRV only. So this card may not classify a bpm value, and it
 * does not: its only arithmetic is counting how many of the athlete's own
 * mornings sat below today's, which is a POSITION. Nothing here re-averages a
 * series or invents a threshold — including the dashed average tick, whose
 * window genuinely differs from the strip's and whose docstring in
 * `resting-strip.ts` explains why that must not be "fixed".
 *
 * WHY COLOUR IS GATED ON THE AVERAGE AND NOT THE UPPER THIRD. The DX's idiom
 * description says `--warning` appears only in the athlete's top third; its own
 * colour contract says a reading above the 30-day average is warm. They disagree
 * in a real band, and the contract wins here for one reason above the others:
 * THIS CARD DRAWS THE AVERAGE TICK. Under the upper-third rule a morning several
 * beats over the mean but still mid-strip sits visibly to the right of the dash
 * and is painted neutral ink anyway — the card contradicting its own graphic,
 * which is the worst failure available to a tile whose entire claim is that
 * position is the meaning.
 *
 * Gating on the average removes that large and common version of the
 * contradiction. It does not remove every version, and pretending otherwise
 * would be the wrong note to leave here: `isAbove` tests the ROUNDED departure,
 * so a morning less than half a beat above the average — 53.8 against 53.4 —
 * draws its tick to the right of the dash and stays neutral. That residue is
 * deliberate and it is the smaller error. The departure the ink would be
 * reporting rounds to `±0`, which is exactly what the tiles printing `vs 30d`
 * show for the same morning, and a tile that paints an event where its
 * neighbours print zero is the disagreement this contract was chosen to avoid.
 * When there is no average at all, the card spends no colour rather than
 * inventing the verdict the server never made.
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
 * Tested on the ROUNDED departure, so a sub-half-beat move takes no ink: this
 * family reports departures in whole beats, and colouring one that its
 * neighbours print as `±0` turns an ordinary morning into an event.
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
 * Takes `sorted` rather than a run of loose figures: the count, the lowest and
 * the highest are all properties of that one array, and passing three `number`s
 * in a row invites a call site that transposes two of them and still compiles.
 *
 * The two degenerate forms are spelled out rather than interpolated, because a
 * sentence with an em-dash in the middle of it is not a sentence.
 */
function stripLabel(
  sorted: number[],
  today: number | null,
  rank: number | null,
  avg: number | null,
): string {
  const n = sorted.length;
  const lowest = sorted[0];
  const highest = sorted[n - 1];
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
          registers want a tighter 6px seam. The body measures ~192px — hero 22,
          strip block 52 (12 + 28 + 12), caption 28, recent rows 72 (a 1px rule,
          three 23px rows, two 1px dividers) — plus three 6px gaps, which puts
          the whole card at ~252px once `p-4`'s 32, the 16px title and `gap-3`'s
          12 are added. The DX's ceiling is 260px, so roughly 8px is left. Read
          that as FULL: a fifth register, or a second line anywhere, has to take
          its height from something already here — the recent rows are 23px
          each and are the only cheap source. */}
      <div className="flex flex-col gap-1.5">
        <p
          data-testid="rhr-hero"
          className="text-[20px] leading-[22px] tabular-nums tracking-[-0.03em] text-[var(--foreground)]"
        >
          {round(todayValue)}
          <span className="ml-1 text-[10px] tracking-normal text-[var(--muted)]">bpm</span>
        </p>

        <div className="flex flex-col">
          {/* Today's value, repeated over its own tick — and `aria-hidden`,
              because it is a visual repeat of the hero two lines above and the
              strip's own label already says it in a sentence. Positioned by
              `labelAnchor`, which switches anchor near the ends rather than
              clamping; its docstring argues why. */}
          <div className="relative h-[12px]">
            {todayPct !== null && (
              <span
                aria-hidden="true"
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
            aria-label={stripLabel(sorted, todayValue, rank, avg)}
            data-testid="rhr-strip"
            className="relative"
            style={{ height: STRIP_H }}
          >
            {sorted.map((value, i) => (
              // `key={i}` deliberately: bpm values repeat, so no value is an
              // identity, and the strip is rebuilt whole in sorted order on
              // every render — there is nothing here to reorder or preserve.
              <Tick
                key={i}
                value={value}
                pct={tickPct(i, n)}
                isToday={rank !== null && i === rank - 1}
                warm={warm}
              />
            ))}
            {avgPct !== null && (
              /* Drawn at its TRUE `avgPct` even when its label is clamped, and
                 dashed because the average is a statistic and not one of the
                 athlete's mornings. `avgInsertPct` argues both. */
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

          {/* The endpoint register, laid out by `endpointRow`: the avg label
              yields to the card edges and wins against the endpoint captions. */}
          <div className="relative h-[12px] text-[9px] leading-[11px] tabular-nums text-[var(--faint)]">
            {showLowest && (
              <span data-testid="rhr-lowest-label" className="absolute left-0 top-0">
                {lowest} lowest
              </span>
            )}
            {avgLabelPct !== null && (
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

        {/* The caption's second line is reserved UNCONDITIONALLY: the second
            `<p>` renders in every state, empty when there is nothing to say, and
            `min-h-[28px]` on this block is what gives that empty line its
            height — an empty block box is zero-high on its own, so the two
            together are one mechanism and not two. Appending the calibrating
            progress inline instead wraps at a one-third desktop cell and grows
            the card by a line exactly when the user's dashboard is newest; an
            empty reserved line is invisible and a 12px jump is not. `TileGrid`
            has no span support, so a tile that changes height moves its whole
            row, including unrelated tiles. */}
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
          <p className="text-[10px] leading-[13px] text-[var(--faint)]">
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

/** One morning's mark on the strip — this tile's `RailBar`. */
function Tick({
  value,
  pct,
  isToday,
  warm,
}: {
  value: number;
  pct: number;
  isToday: boolean;
  warm: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      data-testid={isToday ? "rhr-tick-today" : "rhr-tick"}
      data-tick-value={value}
      className="absolute bottom-0 w-px"
      style={{
        left: `${pct}%`,
        transform: "translateX(-50%)",
        // Today is full-height and filled; every other morning is a shorter
        // hairline, so the strip reads as one marked position in a field rather
        // than as thirty equal bars.
        height: isToday ? "100%" : "62%",
        // Half of the card's whole colour budget, and the only place `warm` is
        // spent on the graphic: today's tick, warm only when today is above the
        // 30-day average. Every other morning is neutral `--border-strong`.
        backgroundColor: isToday
          ? warm
            ? "var(--warning)"
            : "var(--foreground)"
          : "var(--border-strong)",
      }}
    />
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
