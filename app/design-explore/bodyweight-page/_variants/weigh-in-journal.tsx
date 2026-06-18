"use client";

/**
 * VARIANT: weigh-in-journal  ·  editorial / log-first
 *
 * Idiom: the LOG is the star. Weigh-in history becomes a dated journal feed
 * instead of a four-column grid — each day is a soft entry showing the day's
 * value, a delta chip vs the prior day (down = accent, up = muted), and, when
 * there are two readings, the morning/evening pair grouped UNDER that day with
 * a tiny intra-day range. The chart shrinks to a slim strip across the top.
 *
 * In-system: violet accent + slate ramp + Nunito; diverges on SPACING RHYTHM
 * (comfortable editorial leading, lots of air between entries) and COLOR LOGIC
 * (the accent appears only on the down-delta chips). Disposable mockup.
 */

import { Area, AreaChart, ReferenceLine, ResponsiveContainer } from "recharts";
import { ACCENT, GOAL_LINE } from "../_chart";
import {
  DAY_POINTS,
  SUMMARY,
  ewmaTrend,
  fmt,
  fmtSigned,
  fmtMonthDay,
  fmtTime,
  fmtWeekday,
} from "../_data";

type JournalDay = (typeof DAY_POINTS)[number] & { delta: number | null };

export function WeighInJournal() {
  const trend = ewmaTrend();
  // newest first; delta is vs the previous (older) calendar day's average
  const journal: JournalDay[] = DAY_POINTS.map((d, i) => ({
    ...d,
    delta: i === 0 ? null : d.avg - DAY_POINTS[i - 1].avg,
  }))
    .slice()
    .reverse();

  return (
    <div className="flex flex-col">
      {/* Slim trend strip across the top — context, not the headline */}
      <div className="border-b border-[var(--border)] px-4 pb-4 pt-5 sm:px-8">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold tracking-tight">Trend</h3>
          <span className="text-xs text-[var(--muted)]">
            avg{" "}
            <span className="font-semibold text-[var(--foreground)]">{fmt(SUMMARY.average)}</span> ·{" "}
            {fmtSigned(SUMMARY.deltaLb)} lb / 30d · goal {SUMMARY.goal}
          </span>
        </div>
        <div className="h-[72px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="wij-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="trend"
                stroke={ACCENT}
                strokeWidth={2.5}
                fill="url(#wij-fill)"
                isAnimationActive={false}
              />
              <ReferenceLine y={SUMMARY.goal} stroke={GOAL_LINE} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* The journal feed */}
      <div className="flex items-center justify-between px-4 pt-5 sm:px-8">
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight">
          Weigh-in journal
        </h3>
        <button className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-bold text-[var(--accent-fg)]">
          + Log a reading
        </button>
      </div>

      <ol className="flex flex-col gap-1 px-4 py-4 sm:px-8">
        {journal.map((d) => (
          <li
            key={`${d.month}-${d.day}`}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-[var(--border)] py-4 last:border-b-0"
          >
            {/* date rail */}
            <div className="w-14 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--faint)]">
                {fmtWeekday(d.month, d.day)}
              </p>
              <p className="font-[family-name:var(--font-display)] text-2xl font-semibold leading-none tabular-nums">
                {d.day}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--faint)]">
                {fmtMonthDay(d.month, d.day).split(" ")[0]}
              </p>
            </div>

            {/* day value + intra-day readings */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-extrabold tracking-tight tabular-nums">
                  {fmt(d.avg)}
                </span>
                <span className="text-sm text-[var(--muted)]">lb</span>
                {d.readings.length > 1 && (
                  <span className="text-xs text-[var(--faint)]">day avg</span>
                )}
              </div>
              {d.readings.length > 1 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                  {d.readings.map((r, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span className="text-[var(--faint)]">{r.hour < 12 ? "AM" : "PM"}</span>
                      <span className="font-semibold tabular-nums text-[var(--foreground)]">
                        {fmt(r.weight)}
                      </span>
                      <span className="text-[var(--faint)]">{fmtTime(r.hour, r.minute)}</span>
                    </span>
                  ))}
                  <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--muted)]">
                    spread {fmt(d.spread)} lb
                  </span>
                </div>
              )}
            </div>

            {/* delta chip vs prior day */}
            <div className="justify-self-end">
              {d.delta === null ? (
                <span className="text-xs text-[var(--faint)]">—</span>
              ) : (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ${
                    d.delta <= 0
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : "bg-[var(--surface-2)] text-[var(--muted)]"
                  }`}
                >
                  <span className="leading-none">{d.delta <= 0 ? "↓" : "↑"}</span>
                  {fmt(Math.abs(d.delta))}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
