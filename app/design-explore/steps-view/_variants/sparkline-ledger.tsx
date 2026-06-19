"use client";

/**
 * IDIOM: sparkline-ledger — heroes THE LOG.
 *
 * Draws on Robinhood's sparkline list rows and Linear's earned table
 * density: the spreadsheet becomes a power-user history that doubles as a
 * chart. Each row keeps the day and the number but gains an inline mini-bar
 * and a goal-delta column; hairline week grouping carries a per-week summary.
 * Because the rows now SHOW motion, the big chart shrinks to a header strip.
 *
 *  - Type scale: small functional tabular figures — the delta column does
 *    the work, not one giant number.
 *  - Color logic: accent/success spent ENTIRELY on the delta sign and the
 *    inline spark; rows are otherwise neutral ink.
 *  - Spacing rhythm: dense blotter, tight vertical rhythm.
 *
 * In-system: near-black ramp, periwinkle accent, Manrope, 14px panels.
 */

import {
  type StepsEntry,
  type Goal,
  type Period,
  type Day,
  buildAxis,
  deriveStats,
  fmt,
  fmtK,
  shortDate,
} from "../_data";
import { PencilIcon, TargetIcon } from "../_icons";

type Props = { entries: StepsEntry[]; goal: Goal; period: Period };

type Week = {
  key: string;
  start: string;
  end: string;
  days: Day[]; // logged days only, newest first
  avg: number;
  daysHit: number;
  daysLogged: number;
};

function groupWeeks(axis: Day[], goal: number): Week[] {
  // Bucket by Sunday-started week. axis is oldest → newest.
  const buckets = new Map<string, Day[]>();
  axis.forEach((d, i) => {
    // week key = date of the Sunday on/before this day, approximated by index
    // grouping on dow; simplest deterministic key: subtract dow days.
    const [y, m, day] = d.date.split("-").map(Number);
    const dt = new Date(y, m - 1, day);
    dt.setDate(dt.getDate() - dt.getDay());
    const key = `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(d);
    void i;
  });
  const weeks: Week[] = [];
  for (const [key, days] of buckets) {
    const logged = days.filter((d) => d.logged);
    if (logged.length === 0) continue;
    const total = logged.reduce((s, d) => s + (d.steps ?? 0), 0);
    weeks.push({
      key,
      start: days[0].date,
      end: days[days.length - 1].date,
      days: logged.slice().reverse(),
      avg: total / logged.length,
      daysHit: goal > 0 ? logged.filter((d) => d.hit).length : 0,
      daysLogged: logged.length,
    });
  }
  // newest week first
  return weeks.sort((a, b) => b.start.localeCompare(a.start));
}

export function SparklineLedger({ entries, goal, period }: Props) {
  const hasGoal = goal.goal > 0;
  const stats = deriveStats(entries, period, goal.goal);
  const axis = buildAxis(entries, period, goal.goal);
  const weeks = groupWeeks(axis, goal.goal);

  if (stats.avg === null) return <EmptyLedger />;

  const maxSteps = Math.max(...axis.map((d) => d.steps ?? 0), goal.goal);

  return (
    <div className="@container flex flex-col gap-4 text-[var(--foreground)]">
      {/* ── Header strip: the chart, demoted to a band ──────────── */}
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 @md:flex-row @md:items-center @md:justify-between">
        <div className="flex items-baseline gap-4">
          <div>
            <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {fmt(stats.avg)}
            </span>
            <span className="ml-1.5 text-[11px] text-[var(--faint)]">avg/day</span>
          </div>
          {hasGoal && (
            <span
              className="text-[12px] font-medium tabular-nums"
              style={{ color: stats.attainmentPct! >= 100 ? "var(--success)" : "var(--muted)" }}
            >
              {stats.attainmentPct}% · {stats.daysHit}/{stats.daysLogged} hit
            </span>
          )}
        </div>
        <StripChart axis={axis} goal={hasGoal ? goal.goal : null} />
      </div>

      {/* ── Action bar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium hover:opacity-70"
        >
          <PencilIcon className="h-4 w-4" /> Log steps
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <TargetIcon className="h-4 w-4" /> {hasGoal ? fmt(goal.goal) : "Set goal"}
        </button>
      </div>

      {/* ── The ledger ──────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        {weeks.map((w) => (
          <div key={w.key}>
            {/* week header */}
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--background)]/40 px-3 py-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
                {shortDate(w.start)} – {shortDate(w.end)}
              </span>
              <span className="flex items-center gap-3 text-[10px] tabular-nums text-[var(--muted)]">
                <span>avg {fmtK(w.avg)}</span>
                {hasGoal && (
                  <span style={{ color: w.daysHit > 0 ? "var(--success)" : "var(--faint)" }}>
                    {w.daysHit}/{w.daysLogged} hit
                  </span>
                )}
              </span>
            </div>
            {/* rows */}
            {w.days.map((d) => (
              <LedgerRow key={d.date} d={d} goal={hasGoal ? goal.goal : null} maxSteps={maxSteps} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LedgerRow({ d, goal, maxSteps }: { d: Day; goal: number | null; maxSteps: number }) {
  const w = ((d.steps ?? 0) / maxSteps) * 100;
  const hit = goal !== null && (d.steps ?? 0) >= goal;
  const goalMark = goal !== null ? (goal / maxSteps) * 100 : null;
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)]/50 px-3 py-1.5 last:border-b-0 hover:bg-white/[0.02]">
      <span className="w-16 shrink-0 text-[12px] tabular-nums text-[var(--muted)]">
        {d.weekday} {shortDate(d.date).split(" ")[1]}
      </span>
      <span className="w-16 shrink-0 text-right text-[13px] font-medium tabular-nums">
        {fmt(d.steps ?? 0)}
      </span>
      {/* inline mini-bar with goal tick */}
      <div className="relative h-3 min-w-0 flex-1 overflow-hidden rounded-[2px] bg-[var(--surface-3)]">
        <div
          className="absolute inset-y-0 left-0 rounded-[2px]"
          style={{ width: `${w}%`, background: hit ? "var(--success)" : "var(--accent)" }}
        />
        {goalMark !== null && (
          <div
            className="absolute inset-y-0 w-px"
            style={{ left: `${goalMark}%`, background: "var(--border-strong)" }}
          />
        )}
      </div>
      {/* delta column */}
      <span className="w-16 shrink-0 text-right text-[12px] font-medium tabular-nums">
        {d.delta === null ? (
          <span className="text-[var(--faint)]">—</span>
        ) : (
          <span style={{ color: d.delta >= 0 ? "var(--success)" : "var(--muted)" }}>
            {d.delta >= 0 ? "▲" : "▼"} {fmt(Math.abs(d.delta))}
          </span>
        )}
      </span>
    </div>
  );
}

/** A compact full-width spark — the chart reduced to a band of mini bars. */
function StripChart({ axis, goal }: { axis: Day[]; goal: number | null }) {
  const maxY = Math.max(...axis.map((d) => d.steps ?? 0), goal ?? 0) * 1.05 || 1;
  return (
    <div className="flex h-9 items-end gap-[2px] @md:w-56">
      {axis.map((d) => {
        if (d.steps === null) {
          return (
            <div
              key={d.date}
              className="w-full flex-1 self-end"
              style={{ height: 2, background: "var(--border-strong)" }}
            />
          );
        }
        const h = (d.steps / maxY) * 100;
        const hit = goal !== null && d.steps >= goal;
        return (
          <div
            key={d.date}
            className="flex-1 rounded-[1px]"
            style={{ height: `${h}%`, background: hit ? "var(--success)" : "var(--faint)" }}
          />
        );
      })}
    </div>
  );
}

function EmptyLedger() {
  return (
    <div className="@container flex flex-col items-start gap-3 py-10">
      <p className="text-[15px] font-medium">Your step ledger is empty</p>
      <p className="max-w-[40ch] text-[13px] text-[var(--muted)]">
        Each day you log lands here as a row with its trend bar and goal delta.
      </p>
      <button
        type="button"
        className="mt-1 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-medium text-[var(--accent-fg)]"
      >
        <PencilIcon className="h-3.5 w-3.5" /> Log steps
      </button>
    </div>
  );
}
