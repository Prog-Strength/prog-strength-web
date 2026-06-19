/**
 * IDIOM: timeline-rail — "the history as a time spine."
 *
 * Draws on GitHub's activity timeline + Oura's day spine. A vertical rail
 * runs down the left; each DATE is a node on it. A day's readings cluster
 * at that node — two readings = two beads on one node, with the intra-day
 * spread bracketed between them. Day-over-day change reads as MOVEMENT
 * along the rail: the connector segment below each node is tinted with
 * that day's delta (accent when the body moved down toward goal, muted
 * when up) and carries a small caret. Because every calendar day is its
 * own node, the late-PM / early-AM boundary (Jun 15 11:24 PM vs the
 * Jun 12 12:44 AM reading) is visually unambiguous — separate nodes,
 * never merged.
 *
 * Differentiation axes:
 *   · type scale  — medium; a calm avg numeral, no oversized hero
 *   · color logic — the RAIL is the structural color; accent lives on the
 *                   connector segments that mark down-moves
 *   · spacing     — generous vertical rhythm, chronology over density
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

export function TimelineRail({ readings, goal }: { readings: Reading[]; goal: Goal }) {
  const days = groupByDay(readings);

  return (
    <div className="@container">
      <Toolbar goal={goal} />

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-2">
          {days.map((d, i) => (
            <DayNode key={d.dateKey} day={d} isLatest={i === 0} isOldest={i === days.length - 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function DayNode({
  day,
  isLatest,
  isOldest,
}: {
  day: DayGroup;
  isLatest: boolean;
  isOldest: boolean;
}) {
  const down = day.directionDay === "down";
  const flat = day.directionDay === "flat";
  const hasDelta = day.deltaDay !== null;
  // The connector below this node carries the move *from* the older day up
  // to this one — colour it by this day's day-over-day direction.
  const connectorColor =
    !hasDelta || flat ? "var(--border-strong)" : down ? "var(--accent)" : "var(--muted)";

  return (
    <div className="grid grid-cols-[2.25rem_1fr] gap-3">
      {/* ── Rail column ──────────────────────────────────────── */}
      <div className="relative flex justify-center">
        {/* continuous rail (faint), trimmed at the very top/bottom node */}
        <span
          className="absolute left-1/2 w-px -translate-x-1/2 bg-[var(--border-strong)]"
          style={{
            top: isLatest ? "0.65rem" : 0,
            bottom: isOldest ? "auto" : 0,
            height: isOldest ? "0.65rem" : undefined,
          }}
        />
        {/* coloured connector — the day-over-day MOVE, just below the node */}
        {!isOldest && (
          <span
            className="absolute left-1/2 top-[1.4rem] h-7 w-[2px] -translate-x-1/2 rounded-full"
            style={{ background: connectorColor, opacity: hasDelta && !flat ? 1 : 0.4 }}
          />
        )}
        {/* the day node */}
        <span
          className={`absolute top-[0.45rem] h-3 w-3 rounded-full border-2 ${
            isLatest
              ? "border-[var(--accent)] bg-[var(--accent)]"
              : "border-[var(--border-strong)] bg-[var(--surface-3)]"
          }`}
        />
      </div>

      {/* ── Content column ───────────────────────────────────── */}
      <div className={`min-w-0 pb-6 ${isOldest ? "pb-1" : ""}`}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="text-[14px] font-semibold text-[var(--foreground)]">
              {fmtWeekday(day.date)}
            </span>
            <span className="text-[12px] text-[var(--muted)]">{fmtDayShort(day.date)}</span>
          </div>
          {hasDelta && (
            <span
              className={`inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums ${
                flat ? "text-[var(--faint)]" : down ? "text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              <span className="text-[10px]">{flat ? "→" : down ? "▼" : "▲"}</span>
              {fmtDelta(day.deltaDay!)}
            </span>
          )}
        </div>

        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[22px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-[var(--foreground)]">
            {fmtNum(day.avg)}
          </span>
          <span className="text-[12px] text-[var(--muted)]">
            {day.unit}
            {day.multi && <span className="ml-1 text-[var(--faint)]">avg</span>}
          </span>
        </div>

        {/* readings cluster at the node — beads for each, bracket = spread */}
        <div className="mt-2 flex flex-col gap-1.5">
          {day.multi ? (
            <div className="flex items-stretch gap-2">
              {/* spread bracket */}
              <div className="flex flex-col items-center pt-1">
                <span className="flex-1 w-[2px] rounded-full bg-[var(--border-strong)]" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                {day.readings
                  .slice()
                  .reverse()
                  .map((r) => (
                    <Bead key={r.id} reading={r} />
                  ))}
                <span className="text-[11px] text-[var(--faint)]">
                  spread {fmtDelta(day.spread)} {day.unit} across the day
                </span>
              </div>
            </div>
          ) : (
            <Bead reading={day.readings[0]} />
          )}
        </div>
      </div>
    </div>
  );
}

function Bead({ reading }: { reading: Reading }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px]">
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" />
      <span className="w-16 text-[var(--muted)]">{fmtTime(reading.measured_at)}</span>
      <span className="font-medium tabular-nums text-[var(--foreground)]">
        {fmtNum(reading.weight)}
      </span>
      <span className="text-[10px] text-[var(--faint)]">{reading.unit}</span>
    </span>
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
      <p className="text-[15px] font-semibold text-[var(--foreground)]">Your timeline is empty</p>
      <p className="mt-1.5 text-[13px] text-[var(--muted)]">
        Tap Log to add your first reading — it becomes the first node on the rail.
      </p>
    </div>
  );
}
