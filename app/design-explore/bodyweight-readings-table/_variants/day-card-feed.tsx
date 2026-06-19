/**
 * IDIOM: day-card-feed — "the journal, fully realized."
 *
 * Draws on Things' soft per-day sections + Cardiogram's grouping of many
 * same-day readings under one day with a per-day summary. The grid
 * DISSOLVES into one soft 14px card per calendar day, newest first. The
 * card's hero is the day AVERAGE in a large, tight-tracked numeral;
 * morning/evening readings become paired sub-pills inside the card with
 * their times and the intra-day range; a day-over-day delta chip sits in
 * the corner. Single-reading days collapse to a slim card with no pair.
 * This is the only idiom that makes multiple-readings-per-day the
 * structure itself, not an annotation.
 *
 * Differentiation axes:
 *   · type scale  — largest hero numeral of the five; generous leading
 *   · color logic — accent spent ONLY on the down-delta chip
 *   · spacing     — airiest; full cards, 12px gaps, lots of breathing room
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
  partOfDay,
  groupByDay,
} from "../_data";
import { PencilIcon, PlusIcon, TargetIcon, TrashIcon } from "../_icons";

export function DayCardFeed({ readings, goal }: { readings: Reading[]; goal: Goal }) {
  const days = groupByDay(readings);

  return (
    <div className="@container">
      <Toolbar goal={goal} />

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-3">
          {days.map((d, i) => (
            <DayCard
              key={d.dateKey}
              day={d}
              isLatest={i === 0}
              toGoal={i === 0 && goal.created_at ? d.avg - goal.weight : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DeltaChip({ day }: { day: DayGroup }) {
  if (day.deltaDay === null) {
    return (
      <span className="rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[11px] font-medium text-[var(--faint)]">
        first day
      </span>
    );
  }
  const down = day.directionDay === "down";
  const flat = day.directionDay === "flat";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums ${
        down
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "bg-[var(--surface-3)] text-[var(--muted)]"
      }`}
    >
      <span className="text-[10px]">{flat ? "→" : down ? "▼" : "▲"}</span>
      {fmtDelta(day.deltaDay)}
      <span className="text-[10px] font-normal opacity-70">{day.unit}</span>
    </span>
  );
}

function DayCard({
  day,
  isLatest,
  toGoal,
}: {
  day: DayGroup;
  isLatest: boolean;
  toGoal: number | null;
}) {
  return (
    <article
      className={`rounded-[14px] border bg-[var(--surface)] px-5 py-4 transition ${
        isLatest ? "border-[var(--accent-line)]" : "border-[var(--border)]"
      }`}
    >
      <header className="mb-3 flex items-start justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] font-semibold text-[var(--foreground)]">
            {fmtWeekday(day.date)}
          </span>
          <span className="text-[12px] text-[var(--muted)]">{fmtDayShort(day.date)}</span>
        </div>
        <DeltaChip day={day} />
      </header>

      <div className="flex items-end justify-between gap-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[42px] font-bold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)] @lg:text-[48px]">
            {fmtNum(day.avg)}
          </span>
          <span className="text-[15px] text-[var(--muted)]">{day.unit}</span>
        </div>
        {day.multi ? (
          <span className="pb-1 text-[12px] text-[var(--muted)]">
            day avg · {day.readings.length} readings
          </span>
        ) : (
          <span className="pb-1 text-[12px] text-[var(--faint)]">
            {partOfDay(day.readings[0].measured_at)} · single reading
          </span>
        )}
      </div>

      {/* Paired sub-pills — the morning/evening structure made literal.
          A slim card (single reading) shows just one quiet pill. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {day.readings.map((r) => (
          <span
            key={r.id}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-[12px]"
          >
            <span className="text-[var(--muted)]">{fmtTime(r.measured_at)}</span>
            <span className="font-semibold tabular-nums text-[var(--foreground)]">
              {fmtNum(r.weight)}
            </span>
          </span>
        ))}
        {day.multi && (
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1.5 text-[11px] text-[var(--muted)]">
            <span className="text-[var(--faint)]">range</span>
            <span className="tabular-nums">
              {fmtDelta(day.spread)} {day.unit}
            </span>
          </span>
        )}

        <span className="ml-auto inline-flex items-center gap-1 opacity-0 transition focus-within:opacity-100 hover:opacity-100 [article:hover_&]:opacity-100">
          <button
            type="button"
            aria-label="Edit day"
            className="rounded-full p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)]"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Delete reading"
            className="rounded-full p-1.5 text-[var(--muted)] hover:bg-white/5 hover:text-[var(--danger)]"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      {toGoal !== null && (
        <p className="mt-3 border-t border-[var(--border)] pt-2 text-[11px] text-[var(--muted)]">
          <span className="text-[var(--faint)]">◎</span> {fmtDelta(toGoal)} {day.unit} to goal
        </p>
      )}
    </article>
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

function EmptyState() {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-12 text-center">
      <p className="text-[15px] font-semibold text-[var(--foreground)]">No weigh-ins yet</p>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        Tap Log to add your first reading — your daily cards start here.
      </p>
    </div>
  );
}
