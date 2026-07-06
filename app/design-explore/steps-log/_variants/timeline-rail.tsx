/**
 * IDIOM: timeline-rail — heroes CHRONOLOGY ALONG A SPINE.
 *
 * Draws on the shipped bodyweight timeline-rail idiom + GitHub's activity
 * timeline: a vertical rail runs down the left, each WEEK is a node on it
 * (labelled with the week avg + days-hit), and the day ring-rows cluster as
 * beads at the active node. Month transitions are milestone labels on the rail.
 * The connector between week nodes encodes the week-over-week avg delta — accent
 * when the week improved on the older one, muted when it fell. Reframes the log
 * as *time moving*, not a flat stack.
 *
 *  - Type scale: the node's week avg is the size anchor.
 *  - Color logic: the rail + connectors carry structural color; a node clears to
 *    success when its week cleared goal.
 *  - Spacing rhythm: generous vertical rhythm between week nodes.
 *  - Pagination: 3 WEEK-NODES per page.
 */
"use client";

import { useState } from "react";
import {
  ENTRIES,
  bucketByWeek,
  fmtRowDate,
  fmtSteps,
  parseLocal,
  spansMultipleMonths,
  type WeekBucket,
} from "../_data";
import { ChevronIcon, DayActions, LogToolbar, MiniRing } from "../_ui";

const NODES_PER_PAGE = 3;

export function TimelineRail({ goal }: { goal: number | null }) {
  const weeks = bucketByWeek(ENTRIES, goal);
  const showMonths = spansMultipleMonths(ENTRIES);
  const pageCount = Math.ceil(weeks.length / NODES_PER_PAGE);
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState<string>(weeks[0]?.key ?? "");

  const start = page * NODES_PER_PAGE;
  const pageWeeks = weeks.slice(start, start + NODES_PER_PAGE);

  return (
    <div className="flex flex-col gap-3">
      <LogToolbar goal={goal} />

      <div className="relative pl-1">
        {/* the spine */}
        <div
          className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--border-strong)]"
          aria-hidden
        />

        <div className="flex flex-col">
          {pageWeeks.map((week, i) => {
            const older = weeks[start + i + 1];
            const delta = older ? week.agg.avg - older.agg.avg : null;
            const monthMilestone =
              showMonths &&
              parseLocal(week.entries[0].date).getMonth() !==
                (pageWeeks[i - 1] ? parseLocal(pageWeeks[i - 1].entries[0].date).getMonth() : -1);
            return (
              <WeekNode
                key={week.key}
                week={week}
                goal={goal}
                delta={delta}
                open={openKey === week.key}
                onToggle={() => setOpenKey((k) => (k === week.key ? "" : week.key))}
                monthLabel={
                  monthMilestone
                    ? parseLocal(week.entries[0].date).toLocaleDateString("en-US", {
                        month: "long",
                      })
                    : null
                }
              />
            );
          })}
        </div>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-[var(--muted)]">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
          >
            ↑ Recent
          </button>
          <span className="tabular-nums">
            {pageWeeks.length} weeks · page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page === pageCount - 1}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
          >
            Back in time ↓
          </button>
        </div>
      )}
    </div>
  );
}

function WeekNode({
  week,
  goal,
  delta,
  open,
  onToggle,
  monthLabel,
}: {
  week: WeekBucket;
  goal: number | null;
  delta: number | null;
  open: boolean;
  onToggle: () => void;
  monthLabel: string | null;
}) {
  const cleared = week.agg.attainmentPct !== null && week.agg.attainmentPct >= 100;
  return (
    <div className="relative pb-6 pl-7 last:pb-0">
      {/* milestone label straddling the rail */}
      {monthLabel && (
        <div className="mb-3 -ml-7 flex items-center gap-2">
          <span className="grid h-3.5 w-3.5 place-items-center rounded-full border border-[var(--accent-line)] bg-[var(--background)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
            {monthLabel}
          </span>
        </div>
      )}

      {/* node dot on the spine */}
      <span className="absolute left-[7px] top-1.5 -translate-x-1/2" aria-hidden>
        <span
          className="block h-3 w-3 rounded-full ring-4 ring-[var(--background)]"
          style={{ background: cleared ? "var(--success)" : "var(--accent)" }}
        />
      </span>

      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full text-left">
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[var(--muted)]">{week.label}</span>
          {delta !== null && (
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums"
              style={{ color: delta >= 0 ? "var(--accent)" : "var(--faint)" }}
            >
              {delta >= 0 ? "▲" : "▼"} {fmtSteps(Math.abs(delta))}
            </span>
          )}
          <ChevronIcon open={open} />
        </div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span
            className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums"
            style={{ color: cleared ? "var(--success)" : "var(--foreground)" }}
          >
            {fmtSteps(week.agg.avg)}
          </span>
          <span className="text-[12px] text-[var(--muted)]">
            avg
            {week.agg.daysHit !== null && (
              <>
                {" "}
                · {week.agg.daysHit}/{week.agg.daysLogged} hit
              </>
            )}
          </span>
        </div>
      </button>

      {open && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {week.entries.map((e) => {
            const hit = goal !== null && e.steps >= goal;
            return (
              <li
                key={e.date}
                className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5"
              >
                <MiniRing steps={e.steps} goal={goal} size={18} />
                <span className="flex-1 text-[12px] text-[var(--muted)]">{fmtRowDate(e.date)}</span>
                <span className="text-[13px] font-semibold tabular-nums">{fmtSteps(e.steps)}</span>
                {goal !== null && (
                  <span
                    className="text-[11px] tabular-nums"
                    style={{ color: hit ? "var(--success)" : "var(--muted)" }}
                  >
                    {Math.round((e.steps / goal) * 100)}%
                  </span>
                )}
                <DayActions />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
