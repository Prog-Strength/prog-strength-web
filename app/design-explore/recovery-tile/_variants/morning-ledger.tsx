/**
 * VARIANT — morning-ledger  ·  Proposed title: "Recovery Log"
 * Idiom: HEROES THE LOG. Draws on ROBINHOOD's sparkline-list rows and WHOOP's
 * own daily-log density — a compact stack of the most recent mornings as dated
 * rows (`Fri · 74 ms ▼ · 51 bpm · 58`), under a quiet baseline header. Missing
 * mornings appear as a "no reading" row rather than vanishing: the gap is data.
 *
 * Type scale: small functional tabular rows, mono figures, NO headline numeral;
 * the column alignment does the work. Color logic: accent + status spent
 * ENTIRELY on the per-row HRV delta signs; rows are otherwise neutral ink.
 * Spacing: dense blotter, tight vertical rhythm, hairline row separation.
 *
 * Throwaway DX mockup — self-contained, no shared abstraction by design.
 */

import type { RecoveryView, RecoveryDayPoint } from "@/lib/dashboard";
import { MockCard } from "../_shell";
import { weekday } from "../_util";

const TITLE = "Recovery Log";
const ROWS = 4;

export function MorningLedger({ view }: { view: RecoveryView }) {
  const { days, baseline } = view;

  if (!days || !baseline) {
    return (
      <MockCard title={TITLE}>
        <p className="text-sm text-[var(--muted)]">Log is calibrating.</p>
      </MockCard>
    );
  }

  const calibrating = baseline.hrvAvg === null;
  const recent = days.slice(-ROWS);

  return (
    <MockCard title={TITLE}>
      {/* Quiet baseline header — the yardstick every row is read against. */}
      <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
          {calibrating ? "calibrating" : "30-day baseline"}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--muted)]">
          {calibrating ? (
            <>{baseline.hrvDays} of 14 nights</>
          ) : (
            <>
              {baseline.hrvAvg !== null ? Math.round(baseline.hrvAvg) : "—"} ms ·{" "}
              {baseline.restingHrAvg !== null ? Math.round(baseline.restingHrAvg) : "—"} bpm ·{" "}
              {baseline.recoveryScoreAvg !== null ? Math.round(baseline.recoveryScoreAvg) : "—"}
            </>
          )}
        </span>
      </div>

      {/* Dense blotter of dated mornings, newest first. */}
      <div className="flex flex-col divide-y divide-[var(--border)]">
        {[...recent].reverse().map((d, i) => (
          <LedgerRow key={d.date} day={d} baselineHrv={baseline.hrvAvg} isToday={i === 0} />
        ))}
      </div>
    </MockCard>
  );
}

/** One morning row. The only color on the row is the HRV delta sign. */
function LedgerRow({
  day,
  baselineHrv,
  isToday,
}: {
  day: RecoveryDayPoint;
  baselineHrv: number | null;
  isToday: boolean;
}) {
  const label = isToday ? "Today" : weekday(day.date);
  const missing = day.hrv === null && day.restingHr === null && day.recoveryScore === null;

  if (missing) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="w-12 font-mono text-xs text-[var(--muted)]">{label}</span>
        <span className="text-xs italic text-[var(--faint)]">no reading</span>
      </div>
    );
  }

  // Delta sign vs baseline — the row's only splash of meaning-color.
  let sign: { glyph: string; color: string } | null = null;
  if (day.hrv !== null && baselineHrv !== null) {
    const d = day.hrv - baselineHrv;
    if (d <= -3) sign = { glyph: "▼", color: "var(--warning)" };
    else if (d >= 3) sign = { glyph: "▲", color: "var(--success)" };
    else sign = { glyph: "▬", color: "var(--muted)" };
  }

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="w-12 font-mono text-xs text-[var(--muted)]">{label}</span>
      <div className="flex items-center gap-3 font-mono text-xs tabular-nums text-[var(--foreground)]">
        <span className="inline-flex w-16 items-center justify-end gap-1">
          {day.hrv !== null ? `${day.hrv} ms` : "— ms"}
          {sign && (
            <span aria-hidden="true" style={{ color: sign.color }}>
              {sign.glyph}
            </span>
          )}
        </span>
        <span className="w-14 text-right text-[var(--muted)]">
          {day.restingHr !== null ? `${day.restingHr} bpm` : "—"}
        </span>
        <span className="w-6 text-right">
          {day.recoveryScore !== null ? day.recoveryScore : "—"}
        </span>
      </div>
    </div>
  );
}
