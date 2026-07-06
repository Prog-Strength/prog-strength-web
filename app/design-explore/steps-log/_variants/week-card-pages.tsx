/**
 * IDIOM: week-card-pages — heroes THE WEEK CARD AS THE PAGE UNIT.
 *
 * Draws on Whoop's week-in-review cards + Apple Fitness Awards tiles: each week
 * is a self-contained card whose header is the week summary (avg in a mini-ring,
 * days-hit, total) and whose body lists that week's day rows. Cards stack
 * newest-first; only a handful appear per page with Prev / Next + page dots, so
 * the cap feels natural — one screen holds a few weeks, never thirty days. Month
 * labels ride as a whisper-small eyebrow above the first card of each month.
 *
 *  - Type scale: the card header ring is the visual anchor; the month eyebrow is
 *    whisper-small.
 *  - Color logic: the card border tints to success when the week cleared goal.
 *  - Spacing rhythm: breathable card gaps (gap-4).
 *  - Pagination: 3 WEEK CARDS per page, Prev / Next + dots.
 */
"use client";

import { useState } from "react";
import {
  ENTRIES,
  bucketByWeek,
  fmtK,
  fmtRowDate,
  fmtSteps,
  parseLocal,
  spansMultipleMonths,
  type WeekBucket,
} from "../_data";
import { ChevronIcon, DayActions, LogToolbar, MiniRing, SummaryRing } from "../_ui";

const CARDS_PER_PAGE = 3;

export function WeekCardPages({ goal }: { goal: number | null }) {
  const weeks = bucketByWeek(ENTRIES, goal);
  const showMonths = spansMultipleMonths(ENTRIES);
  const pageCount = Math.ceil(weeks.length / CARDS_PER_PAGE);
  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    // Default: current (newest) week expanded, all older weeks collapsed.
    const init: Record<string, boolean> = {};
    weeks.forEach((w, i) => (init[w.key] = i !== 0));
    return init;
  });

  const start = page * CARDS_PER_PAGE;
  const pageWeeks = weeks.slice(start, start + CARDS_PER_PAGE);

  return (
    <div className="flex flex-col gap-4">
      <LogToolbar goal={goal} />

      <div className="flex flex-col gap-4">
        {pageWeeks.map((week, i) => {
          const prev = pageWeeks[i - 1];
          const monthChanged =
            showMonths &&
            parseLocal(week.entries[0].date).getMonth() !==
              (prev ? parseLocal(prev.entries[0].date).getMonth() : -1);
          return (
            <div key={week.key}>
              {monthChanged && (
                <div className="mb-1.5 pl-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
                  {parseLocal(week.entries[0].date).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              )}
              <WeekCard
                week={week}
                goal={goal}
                open={!collapsed[week.key]}
                onToggle={() => setCollapsed((c) => ({ ...c, [week.key]: !c[week.key] }))}
              />
            </div>
          );
        })}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:opacity-80 disabled:opacity-40"
          >
            ← Prev
          </button>
          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: pageCount }).map((_, p) => (
              <span
                key={p}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: p === page ? 18 : 6,
                  background: p === page ? "var(--accent)" : "var(--surface-3)",
                }}
              />
            ))}
          </div>
          <button
            type="button"
            disabled={page === pageCount - 1}
            onClick={() => setPage(page + 1)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--muted)] transition hover:opacity-80 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function WeekCard({
  week,
  goal,
  open,
  onToggle,
}: {
  week: WeekBucket;
  goal: number | null;
  open: boolean;
  onToggle: () => void;
}) {
  const cleared = week.agg.attainmentPct !== null && week.agg.attainmentPct >= 100;
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-card)] border bg-[var(--surface)]"
      style={{ borderColor: cleared ? "var(--accent-2-line)" : "var(--border)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02]"
      >
        <SummaryRing
          pct={week.agg.attainmentPct}
          center={
            week.agg.attainmentPct !== null ? `${week.agg.attainmentPct}%` : fmtK(week.agg.avg)
          }
          cleared={cleared}
          size={52}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-[var(--foreground)]">{week.label}</div>
          <div className="mt-0.5 text-[12px] tabular-nums text-[var(--muted)]">
            avg {fmtSteps(week.agg.avg)}
            {week.agg.daysHit !== null && (
              <>
                {" "}
                ·{" "}
                <span style={{ color: cleared ? "var(--success)" : "var(--muted)" }}>
                  {week.agg.daysHit}/{week.agg.daysLogged} hit
                </span>
              </>
            )}{" "}
            · {fmtK(week.agg.total)} total
          </div>
        </div>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <ul className="flex flex-col divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {week.entries.map((e) => {
            const hit = goal !== null && e.steps >= goal;
            return (
              <li key={e.date} className="flex items-center gap-3 px-4 py-2.5">
                <MiniRing steps={e.steps} goal={goal} size={22} />
                <span className="flex-1 text-[13px] text-[var(--muted)]">{fmtRowDate(e.date)}</span>
                <span className="text-[14px] font-semibold tabular-nums">{fmtSteps(e.steps)}</span>
                {goal !== null && (
                  <span
                    className="w-11 text-right text-[12px] tabular-nums"
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
