/**
 * MorningLedgerCard — the `recovery_log` tile ("Recovery Log").
 *
 * Two unequal registers over a seam — the `band-rail-and-recent` idiom from
 * `dx/recovery-log-tile`:
 *
 *   1. THE RAIL — fourteen days as vertical bars, each one's height
 *      proportional to that morning's recovery score and its fill that
 *      morning's Whoop band colour, over a dashed neutral tick at the 30-day
 *      score average. A fortnight read against its own normal, so a bad weekend
 *      is a notch you see before you read a figure.
 *   2. THE SEAM — the 30-day baseline as `score · bpm · ms` on a hairline,
 *      doubling as the register divider.
 *   3. THE DETAIL ROWS — the three most recent mornings in full
 *      (weekday · score · band word · bpm · ms). This is where the tile's
 *      distinct job happens: the cross-metric reading — *the score was low and
 *      the resting HR was up* — is a sentence only this tile can make.
 *
 * Fourteen on the rail and three in detail is the idiom's argument, not a
 * budget. Seven identical rows give you a week you must read row by row; a rail
 * gives you a fortnight you read at a glance and detail only where detail is
 * used. It is also what survives a sparse fortnight, where a row-per-day tile
 * degrades into a column of *no reading*.
 *
 * An absent morning is a FULL-HEIGHT ghost column, never a short bar: a gap and
 * a catastrophic score differ in kind, not in degree, and a stub at the foot of
 * the rail sits a pixel away from a real score of 5.
 *
 * The tile paints NO HRV status. Its colour budget is spent, once, on the
 * recovery band — the rail's fill and one small word per row — which is the
 * resolution to the tension `readiness-verdict.tsx` names in its own docstring:
 * two traffic lights on one card is confusion.
 *
 * Nothing here recomputes a server figure. Naming which third of Whoop's fixed,
 * published 0–100 scale a score falls in is display formatting, and the only
 * other arithmetic is mapping an already-computed score onto a pixel height,
 * which is what a bar chart is.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { recoveryBand, recoveryBandColor, recoveryBandWord, round, weekday } from "./shared";

const TITLE = "Recovery Log";
/** Days on the rail, and mornings in the detail register. */
const RAIL_DAYS = 14;
const DETAIL_ROWS = 3;
/** The rail's height in px. `railY` maps a 0–100 score onto it. */
const RAIL_H = 40;
/**
 * How many scored mornings the server needs before it will emit an average.
 * The real value is the API's `min_baseline_days`; this is a client-side copy,
 * as the same 14 already is on the HRV tile and the readiness verdict.
 */
const MIN_BASELINE_DAYS = 14;

/**
 * Score (0–100) → bar height in px. The baseline TICK uses this same map, and
 * that is load-bearing: the rail's whole claim is that a fortnight reads
 * against its own normal, which is true only while a bar at the baseline's
 * value terminates exactly at the tick. The obvious future "improvement" —
 * rescaling the rail to the observed data range so a flat fortnight uses the
 * full height — breaks that silently, because the tick would still be drawn on
 * the 0–100 scale. Hence one exported, tested function rather than two inline
 * expressions.
 *
 * The 0–100 scale is also right on its own terms: the recovery score is a
 * percentage with meaningful absolute values, so a 29 should look short in
 * absolute terms and not merely short relative to a bad fortnight.
 */
export function railY(score: number): number {
  return (score / 100) * RAIL_H;
}

/**
 * The rail's text alternative, e.g. "14 days of recovery score, 12 with
 * readings, against a 30-day average of 58." Every bar and the tick are
 * `aria-hidden`, so without this the first register would be absent from the
 * accessibility tree with nothing standing in for it — and fourteen unlabelled
 * divs in the tree would be worse than one labelled group.
 */
function railLabel(rail: RecoveryDayPoint[], avg: number | null): string {
  const readings = rail.filter((d) => d.recoveryScore !== null).length;
  const window = `${rail.length} days of recovery score, ${readings} with readings`;
  return avg === null
    ? `${window}, with no 30-day average yet.`
    : `${window}, against a 30-day average of ${Math.round(avg)}.`;
}

export function MorningLedgerCard({ section, href }: { section: RecoveryView; href: string }) {
  const { days, baseline } = section;

  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">Log is calibrating.</p>
      </MiniCard>
    );
  }

  // Gate on the metric this card actually DRAWS. The score average is the
  // tick's own input, and without it the rail has no normal to be read against.
  // (The shipped tile gated on `hrvAvg`, which was right for a tile whose only
  // coloured element was an HRV delta and is wrong for this one.)
  const calibrating = baseline.recoveryScoreAvg === null;
  // `days` is date-aligned with nulls preserved, so the slice is a true calendar
  // fortnight and the bar pitch is a day. Never `spark` — it omits missing days
  // and destroys the alignment the rail's whole shape depends on.
  const rail = days.slice(-RAIL_DAYS);
  const recent = days.slice(-DETAIL_ROWS).reverse();

  return (
    <MiniCard title={TITLE} href={href}>
      {/* One child, not three: MiniCard lays its children out on gap-3, and the
          registers want a tighter 8px seam than that. The whole body is ~154px,
          under the shipped tile's ~180 — this redesign costs the row no height. */}
      <div className="flex flex-col gap-2">
        <div
          role="img"
          aria-label={railLabel(rail, baseline.recoveryScoreAvg)}
          className="relative flex items-end gap-[2px]"
          style={{ height: RAIL_H }}
        >
          {baseline.recoveryScoreAvg !== null && (
            /* Drawn ABOVE the bars — an absolutely-positioned element paints
               over its non-positioned flex siblings whatever the DOM order —
               and in `--muted` at half strength rather than the
               `--border-strong` hairline: composited over a full-strength
               `--success` bar that hairline reaches only 1.10:1 contrast —
               invisible, and invisible exactly when the fortnight is good,
               which is when the register's "against its own normal" argument
               matters most. `--muted` at 0.5 reads 1.28:1 over the bar and
               2.09:1 over `--surface`. A structural datum is not chrome. */
            <div
              aria-hidden="true"
              data-testid="rail-tick"
              className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--muted)] opacity-50"
              style={{ bottom: railY(baseline.recoveryScoreAvg) }}
            />
          )}
          {rail.map((d) => (
            <RailBar key={d.date} day={d} />
          ))}
        </div>

        <div className="flex items-baseline justify-between border-t border-[var(--border)] pt-1.5 text-[10px] uppercase tracking-[0.08em] text-[var(--faint)]">
          <span>{calibrating ? "calibrating" : "30-day base"}</span>
          {/* Each figure guards on its own: `restingHrAvg` or `hrvAvg` may be
              null while `recoveryScoreAvg` is not, and the seam keeps its shape
              rather than collapsing when one average is missing. */}
          <span className="tabular-nums normal-case tracking-[-0.01em]">
            {calibrating
              ? `${baseline.recoveryScoreDays} of ${MIN_BASELINE_DAYS} mornings`
              : `${round(baseline.recoveryScoreAvg)} · ${round(baseline.restingHrAvg)} bpm · ${round(baseline.hrvAvg)} ms`}
          </span>
        </div>

        <div className="-mt-0.5 flex flex-col divide-y divide-[var(--border)]">
          {recent.map((d, i) => (
            <DetailRow key={d.date} day={d} isToday={i === 0} />
          ))}
        </div>
      </div>
    </MiniCard>
  );
}

/** One day's mark on the rail. */
function RailBar({ day }: { day: RecoveryDayPoint }) {
  const score = day.recoveryScore;

  // An absent morning is a ghost slot running the full height of the rail — an
  // empty position in a rack, not a very short bar. Differing in KIND rather
  // than in height is what keeps a strap-off day from reading as a score of 2,
  // and it is what makes a sparse fortnight look intentional rather than broken.
  if (score === null) {
    return (
      <div
        aria-hidden="true"
        data-testid="rail-ghost"
        className="h-full flex-1 rounded-[1px] bg-[var(--surface-2)] opacity-60"
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="rail-bar"
      className="flex-1 rounded-[1px]"
      style={{
        // The 2px floor bites only below a score of 5, where it can never
        // approach a plausible baseline tick; it is there so a genuine
        // near-zero morning still renders a mark.
        height: Math.max(2, railY(score)),
        backgroundColor: recoveryBandColor(recoveryBand(score)),
      }}
    />
  );
}

/** One morning in full: recovery, then resting HR, then HRV. */
function DetailRow({ day, isToday }: { day: RecoveryDayPoint; isToday: boolean }) {
  // Positional, by the payload's contract that `days` ends on the local today.
  const label = isToday ? "Today" : weekday(day.date);
  const missing = day.recoveryScore === null && day.restingHr === null && day.hrv === null;
  const band = recoveryBand(day.recoveryScore);

  return (
    <div data-testid="detail-row" className="flex items-baseline gap-2 py-1">
      {/* A width on the LABEL, which holds "Today" and cannot wrap, so the three
          scores line up in a column. The fixed widths this redesign deletes were
          on the VALUE cells (w-16 / w-14 / w-6), which is what made a five-decimal
          millisecond reading break onto a second line. */}
      <span className="w-10 shrink-0 text-[10px] text-[var(--faint)]">{label}</span>
      {missing ? (
        /* A morning the webhook never delivered. At 7am this is today's own row,
           and "Today · no reading" is the true and useful answer to "has my
           morning landed?" — so it is never suppressed. */
        <span className="text-[11px] italic text-[var(--faint)]">no reading</span>
      ) : (
        <>
          <span className="text-[13px] tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
            {round(day.recoveryScore)}
          </span>
          {/* A missing score has no band, and the honest rendering of that is
              silence — not the words "No reading" beside two live figures. */}
          {band !== "none" && (
            <span
              className="text-[10px] uppercase tracking-[0.08em]"
              style={{ color: recoveryBandColor(band) }}
            >
              {recoveryBandWord(band)}
            </span>
          )}
          {/* No fixed width: the group sizes to its content, so a three-digit
              figure plus its unit cannot wrap. */}
          <span
            data-testid="detail-figures"
            className="ml-auto whitespace-nowrap font-mono text-[11px] tabular-nums text-[var(--foreground)]"
          >
            {round(day.restingHr)}
            <span className="text-[var(--faint)]"> bpm</span>
            {" · "}
            {round(day.hrv)}
            <span className="text-[var(--faint)]"> ms</span>
          </span>
        </>
      )}
    </div>
  );
}
