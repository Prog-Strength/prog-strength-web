/**
 * IDIOM: stat-ledger — "the summary-led list."
 *
 * Draws on TrendWeight's table-plus-summary and Copilot Money's account
 * header band. A compact summary BAND sits atop the region — this-week
 * average, the week-over-week delta, a logged-day streak, and "X to go"
 * pulled from the goal — and the list below is stripped to the essentials
 * (day, value, a quiet delta). The contrast is the point: big band
 * numerals carry the accent and the meaning, then small calm rows list
 * the days underneath. It answers "spreadsheet-y" by giving the log a
 * headline instead of a header row, so the region opens with meaning
 * before it lists data.
 *
 * Differentiation axes:
 *   · type scale  — the sharpest contrast of the five: huge band numerals
 *                   over deliberately small, quiet rows
 *   · color logic — the accent lives on the BAND (hero delta); rows stay
 *                   fully neutral
 *   · spacing     — a prominent band, then tight calm rows beneath it
 */
"use client";

import {
  type Goal,
  type Reading,
  fmtDelta,
  fmtNum,
  fmtDayShort,
  fmtWeekday,
  groupByDay,
  summarize,
} from "../_data";
import { PlusIcon, TargetIcon } from "../_icons";

export function StatLedger({ readings, goal }: { readings: Reading[]; goal: Goal }) {
  const days = groupByDay(readings);
  const s = summarize(days, goal);

  return (
    <div className="@container">
      <Toolbar goal={goal} />

      {/* ── Summary band — the headline ───────────────────────── */}
      <div className="rounded-[14px] border border-[var(--accent-line)] bg-[var(--surface)] px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
              This week · avg
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-[40px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)] @lg:text-[46px]">
                {s.avg !== null ? fmtNum(s.avg) : "—"}
              </span>
              <span className="text-[15px] text-[var(--muted)]">{s.unit}</span>
              {s.deltaVsPrevWeek !== null && (
                <span
                  className={`ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ${
                    s.direction === "down"
                      ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                      : s.direction === "up"
                        ? "bg-[var(--surface-3)] text-[var(--muted)]"
                        : "bg-[var(--surface-3)] text-[var(--faint)]"
                  }`}
                >
                  <span className="text-[10px]">
                    {s.direction === "flat" ? "→" : s.direction === "down" ? "▼" : "▲"}
                  </span>
                  {fmtDelta(s.deltaVsPrevWeek)} vs last wk
                </span>
              )}
            </div>
          </div>
        </div>

        {/* mini-stat strip */}
        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[var(--border)] pt-3">
          <Stat
            label="Streak"
            value={s.streakDays > 0 ? `${s.streakDays}` : "0"}
            unit={s.streakDays === 1 ? "day" : "days"}
            accent
          />
          <Stat label="Logged" value={`${s.loggedDays}`} unit="days" />
          <Stat
            label="To goal"
            value={s.toGoal !== null ? fmtDelta(s.toGoal) : "—"}
            unit={s.toGoal !== null ? s.unit : "set a goal"}
          />
        </div>
      </div>

      {/* ── Stripped list ─────────────────────────────────────── */}
      {days.length === 0 ? (
        <p className="mt-3 rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-5 py-8 text-center text-[13px] text-[var(--muted)]">
          No readings yet — tap Log to start your history.
        </p>
      ) : (
        <div className="mt-3 overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--faint)]">
            <span>Day</span>
            <span>Avg · change</span>
          </div>
          {days.map((d) => {
            const down = d.directionDay === "down";
            const flat = d.directionDay === "flat";
            return (
              <div
                key={d.dateKey}
                className="flex items-center justify-between border-b border-[var(--border)]/50 px-4 py-2.5 last:border-b-0"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] text-[var(--foreground)]">
                    {fmtWeekday(d.date)} {fmtDayShort(d.date)}
                  </span>
                  {d.multi && (
                    <span className="text-[10px] text-[var(--faint)]">
                      · {d.readings.length} rd ⇕{fmtDelta(d.spread)}
                    </span>
                  )}
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-[14px] font-medium tabular-nums text-[var(--foreground)]">
                    {fmtNum(d.avg)}
                    <span className="ml-1 text-[10px] text-[var(--faint)]">{d.unit}</span>
                  </span>
                  <span
                    className={`w-12 text-right text-[12px] tabular-nums ${
                      d.deltaDay === null
                        ? "text-[var(--faint)]"
                        : flat
                          ? "text-[var(--faint)]"
                          : down
                            ? "text-[var(--accent)]"
                            : "text-[var(--muted)]"
                    }`}
                  >
                    {d.deltaDay === null
                      ? "—"
                      : (flat ? "" : down ? "▼" : "▲") + fmtDelta(d.deltaDay)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--faint)]">
        {label}
      </span>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span
          className={`text-[20px] font-bold leading-none tracking-[-0.02em] tabular-nums ${
            accent ? "text-[var(--accent)]" : "text-[var(--foreground)]"
          }`}
        >
          {value}
        </span>
        <span className="text-[11px] text-[var(--muted)]">{unit}</span>
      </div>
    </div>
  );
}

function Toolbar({ goal }: { goal: Goal }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)] transition hover:opacity-90"
      >
        <PlusIcon className="h-4 w-4" />
        Log
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[13px] text-[var(--muted)] transition hover:bg-white/5"
      >
        <TargetIcon className="h-4 w-4" />
        Goal
        {goal.created_at ? (
          <span className="font-semibold tabular-nums text-[var(--foreground)]">
            {fmtNum(goal.weight)} {goal.unit}
          </span>
        ) : (
          <span className="italic">not set</span>
        )}
      </button>
    </div>
  );
}
