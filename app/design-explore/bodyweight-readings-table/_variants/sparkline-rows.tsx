/**
 * IDIOM: sparkline-rows — "the history that doubles as a chart."
 *
 * Draws on Robinhood's and Whoop's list rows. Each day-group row carries
 * a tiny inline sparkline beside the number — here a trailing 7-day
 * micro-trend ending on that day — so scanning the list IS glancing at
 * the trend, at row resolution. The day-average stays in a tight-tracked
 * numeral; the spark is the one place the accent is spent. Mid-dense:
 * one row per day, restrained, the inline trend doing the talking. The
 * intra-day spread on multi-reading days rides under the number as a
 * paired-dot mini-range so the morning/evening pairing stays legible.
 *
 * Differentiation axes:
 *   · type scale  — mid; a confident avg numeral, smaller than the feed's
 *   · color logic — accent spent ENTIRELY on the inline sparkline trend
 *   · spacing     — mid-dense rows, comfortable but not airy
 */
"use client";

import {
  type Goal,
  type Reading,
  type DayGroup,
  fmtDelta,
  fmtNum,
  fmtTime,
  fmtDayShort,
  fmtWeekday,
  groupByDay,
} from "../_data";
import { PlusIcon, TargetIcon } from "../_icons";

/** Trailing 7-day average series (chronological) ending at day index i. */
function trailing(days: DayGroup[], i: number): number[] {
  const window = days.slice(i, i + 7).map((d) => d.avg);
  return window.reverse(); // oldest → newest
}

function Sparkline({ values, w = 88, h = 30 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) {
    // One point — a flat seed dash so the row isn't visually broken.
    return (
      <svg width={w} height={h} className="overflow-visible" aria-hidden>
        <line
          x1={2}
          y1={h / 2}
          x2={w - 2}
          y2={h / 2}
          stroke="var(--faint)"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
      </svg>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, idx) => {
    const x = pad + (idx / (values.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (v - min) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const d = pts
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
    .join(" ");
  const last = pts[pts.length - 1];
  // Area fill under the spark, accent-soft, for the Robinhood glance.
  const area = `${d} L${last[0].toFixed(1)} ${h - pad} L${pts[0][0].toFixed(1)} ${h - pad} Z`;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <path d={area} fill="var(--accent-soft)" />
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill="var(--accent)" />
    </svg>
  );
}

export function SparklineRows({ readings, goal }: { readings: Reading[]; goal: Goal }) {
  const days = groupByDay(readings);

  return (
    <div className="@container">
      <Toolbar goal={goal} />

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)]">
          {days.map((d, i) => (
            <Row key={d.dateKey} day={d} series={trailing(days, i)} isLatest={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function Row({ day, series, isLatest }: { day: DayGroup; series: number[]; isLatest: boolean }) {
  const down = day.directionDay === "down";
  const flat = day.directionDay === "flat";
  return (
    <div
      className={`flex items-center gap-3 border-t border-[var(--border)]/60 px-4 py-3 first:border-t-0 ${
        isLatest ? "bg-[var(--accent-soft)]/40" : ""
      }`}
    >
      {/* date */}
      <div className="flex w-20 flex-col leading-tight @lg:w-24">
        <span className="text-[13px] font-semibold text-[var(--foreground)]">
          {fmtWeekday(day.date)}
        </span>
        <span className="text-[11px] text-[var(--muted)]">{fmtDayShort(day.date)}</span>
      </div>

      {/* number + intra-day mini-range */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
            {fmtNum(day.avg)}
          </span>
          <span className="text-[11px] text-[var(--muted)]">{day.unit}</span>
          {day.deltaDay !== null && (
            <span
              className={`ml-1 inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
                flat ? "text-[var(--faint)]" : down ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <span className="text-[9px]">{flat ? "→" : down ? "▼" : "▲"}</span>
              {fmtDelta(day.deltaDay)}
            </span>
          )}
        </div>
        {day.multi ? (
          <span className="mt-1 inline-flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-[var(--faint)]" />
              {fmtTime(day.readings[0].measured_at)} {fmtNum(day.readings[0].weight)}
            </span>
            <span className="text-[var(--faint)]">→</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-1 w-1 rounded-full bg-[var(--faint)]" />
              {fmtTime(day.readings[day.readings.length - 1].measured_at)}{" "}
              {fmtNum(day.readings[day.readings.length - 1].weight)}
            </span>
            <span className="text-[var(--faint)]">· ⇕{fmtDelta(day.spread)}</span>
          </span>
        ) : (
          <span className="mt-1 text-[10px] text-[var(--faint)]">
            {fmtTime(day.readings[0].measured_at)} · single reading
          </span>
        )}
      </div>

      {/* the spark — trailing 7-day trend, accent-only */}
      <div className="shrink-0">
        <Sparkline values={series} />
      </div>
    </div>
  );
}

function Toolbar({ goal }: { goal: Goal }) {
  return (
    <div className="mb-3 flex items-center justify-between">
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

function EmptyState() {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-[var(--foreground)]">Nothing to chart yet</p>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        Tap Log to add your first reading — the spark grows as you weigh in.
      </p>
    </div>
  );
}
