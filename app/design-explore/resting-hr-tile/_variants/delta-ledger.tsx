/**
 * VARIANT 1 of 5 — idiom: `delta-ledger`.
 * "Just show me the numbers."
 *
 * PRINTS EVERYTHING, PLOTS NOTHING. Ten dated rows, newest-first, under a
 * pinned header carrying the 30-day average itself. No chart, no rail, no mark
 * of any kind — the tile is a table, and the deltas are the only colour on it.
 *
 * Its argument: resting HR is the one metric in this family whose numbers are
 * genuinely readable — always two digits, never wrapping, no unit drama — so
 * plotting it throws away the precision the user actually asked for.
 *
 * Draws on **Bloomberg Terminal**'s conviction that a dense, uniform dated row
 * beats a chart when every entry has the same shape, and **Apple Health**'s
 * "Show More Data" tables of dated values.
 *
 * DISTINCT ON:
 *  - TYPE SCALE — 13px figures over 11px deltas over 10px dates. A narrow range
 *    and NO HERO: today's number is the top row and is not one point bigger than
 *    the nine below it. The deliberate opposite of `departure-area`.
 *  - COLOUR LOGIC — THE DELTA'S SIGN, AND NOTHING ELSE. A column of warm `+n`s
 *    down the right edge IS the creeping-up signal, with no chart needed. The
 *    bpm figures themselves never take colour, at any value.
 *  - SPACING RHYTHM — ten rows on hairlines at ~15px each, strictly uniform. An
 *    absent morning costs exactly one row, like every other morning, which is
 *    why the ledger holds its shape on `sparse`.
 *
 * POLARITY (answer 1 — raw values, carried by wording): the column is captioned
 * `vs 30d` and a RISE is the only coloured thing on the card, so up-is-worse is
 * learned from where the colour lands rather than from a direction on an axis.
 *
 * NO AXIS, so no axis policy: `flat-month` renders as a column of `0`s and `±1`s
 * in muted ink, which is exactly as boring as that month deserves to look.
 */

import type { RecoveryDayPoint, RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import {
  ABOVE,
  MIN_BASELINE_DAYS,
  bpm,
  delta,
  isAbove,
  lastDays,
  shortDay,
  signed,
} from "../_shared";

const TITLE = "Resting HR";
const ROWS = 10;

export function DeltaLedgerVariant({ view, href }: { view: RecoveryView; href: string }) {
  const { days, baseline } = view;

  // Guard once, at the top. Never `!`-assert an optional.
  if (!days || !baseline) {
    return (
      <MiniCard title={TITLE} href={href}>
        <p className="text-sm text-[var(--muted)]">No readings yet.</p>
      </MiniCard>
    );
  }

  const avg = baseline.restingHrAvg;
  // Gated on RESTING HR's own sample and nothing else — never on hrvDays.
  const calibrating = avg === null;
  const window = [...lastDays(days, ROWS)].reverse();

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="tabular-nums tracking-[-0.02em]">
        {/* The yardstick, pinned above the ledger so the deltas below always
            have their reference in view. */}
        <div className="flex items-baseline justify-between gap-2 border-b border-[var(--border)] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em]">
          <span className="text-[var(--faint)]">
            30-day base ·{" "}
            {calibrating ? (
              <span className="text-[var(--muted)]">calibrating</span>
            ) : (
              <span className="text-[var(--foreground)]">{bpm(avg)} bpm</span>
            )}
          </span>
          <span className="shrink-0 text-[var(--faint)]">
            {calibrating ? `${baseline.restingHrDays} / ${MIN_BASELINE_DAYS}` : "vs 30d"}
          </span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {window.map((d, i) => (
            <Row key={d.date} day={d} avg={avg} isToday={i === 0} />
          ))}
        </div>
      </div>
    </MiniCard>
  );
}

function Row({
  day,
  avg,
  isToday,
}: {
  day: RecoveryDayPoint;
  avg: number | null;
  isToday: boolean;
}) {
  const label = isToday ? "Today" : shortDay(day.date);
  const d = delta(day.restingHr, avg);
  const warm = isAbove(day.restingHr, avg);

  return (
    <div className="grid grid-cols-[38px_1fr_auto] items-baseline leading-[15px]">
      <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--faint)]">{label}</span>

      {day.restingHr === null ? (
        <span className="text-[11px] text-[var(--faint)]">
          {isToday ? "no reading yet" : "no reading"}
        </span>
      ) : (
        <span className="text-[13px] text-[var(--foreground)]">
          {bpm(day.restingHr)}
          <span className="ml-0.5 text-[10px] text-[var(--muted)]">bpm</span>
        </span>
      )}

      {/* The entire colour budget of this variant: one signed figure, warm only
          when the morning ran over the athlete's own average. */}
      <span className="text-right text-[11px]" style={{ color: warm ? ABOVE : "var(--muted)" }}>
        {d === null ? "" : signed(d)}
      </span>
    </div>
  );
}
