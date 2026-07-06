/**
 * IDIOM: week-accordion — heroes THE COLLAPSIBLE WEEK.
 *
 * Draws on Apple Fitness activity-history sections + Gentler Streak's weekly
 * recap: a tight week-header row (date range · large tabular week avg · days-hit
 * · small total · chevron) that expands to reveal that week's day ring-rows.
 * Month dividers carry a month rollup and break the scroll when the period spans
 * months. Default: current week expanded, older weeks collapsed — the list opens
 * with one week of detail, not thirty rows.
 *
 *  - Type scale: the week avg is the size anchor; day rows stay small/quiet.
 *  - Color logic: success-green claims the week header only when attainment ≥ 100%.
 *  - Spacing rhythm: airy inside an expanded week, tight on collapsed headers.
 *  - Pagination: 4 WEEKS per page, never splitting a week.
 */
"use client";

import { useState } from "react";
import {
  ENTRIES,
  aggregate,
  bucketByWeek,
  fmtRowDate,
  fmtSteps,
  parseLocal,
  spansMultipleMonths,
  type WeekBucket,
} from "../_data";
import { ChevronIcon, DayActions, LogToolbar, MiniRing } from "../_ui";

const WEEKS_PER_PAGE = 4;

export function WeekAccordion({ goal }: { goal: number | null }) {
  const weeks = bucketByWeek(ENTRIES, goal);
  const showMonths = spansMultipleMonths(ENTRIES);
  const pageCount = Math.ceil(weeks.length / WEEKS_PER_PAGE);

  const [page, setPage] = useState(0);
  // Default: only the newest (current) week is open.
  const [open, setOpen] = useState<Record<string, boolean>>({ [weeks[0]?.key ?? ""]: true });

  const pageWeeks = weeks.slice(page * WEEKS_PER_PAGE, page * WEEKS_PER_PAGE + WEEKS_PER_PAGE);

  return (
    <div className="flex flex-col gap-3">
      <LogToolbar goal={goal} />

      <div className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        {pageWeeks.map((week, i) => {
          const prev = pageWeeks[i - 1];
          const monthChanged =
            showMonths && parseLocal(week.entries[0].date).getMonth() !== monthOf(prev);
          return (
            <div key={week.key}>
              {monthChanged && (
                <MonthDivider monthKey={week.entries[0].date.slice(0, 7)} goal={goal} />
              )}
              <WeekSection
                week={week}
                goal={goal}
                open={!!open[week.key]}
                onToggle={() => setOpen((o) => ({ ...o, [week.key]: !o[week.key] }))}
              />
            </div>
          );
        })}
      </div>

      <Pager page={page} pageCount={pageCount} onPage={setPage} />
    </div>
  );
}

function monthOf(week: WeekBucket | undefined): number {
  return week ? parseLocal(week.entries[0].date).getMonth() : -1;
}

/** Month rollup divider — the sticky-ish chapter break when the log crosses months. */
function MonthDivider({ monthKey, goal }: { monthKey: string; goal: number | null }) {
  const monthEntries = ENTRIES.filter((e) => e.date.slice(0, 7) === monthKey);
  const agg = aggregate(monthEntries, goal);
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex items-baseline justify-between bg-[var(--surface-2)] px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {label}
      </span>
      <span className="text-[11px] tabular-nums text-[var(--muted)]">
        avg <span className="font-semibold text-[var(--foreground)]">{fmtSteps(agg.avg)}</span>
        {agg.daysHit !== null && (
          <>
            {" "}
            · {agg.daysHit}/{agg.daysLogged} hit
          </>
        )}
      </span>
    </div>
  );
}

function WeekSection({
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
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.02]"
      >
        <ChevronIcon open={open} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[var(--foreground)]">{week.label}</div>
          <div className="text-[11px] tabular-nums text-[var(--muted)]">
            {week.agg.total.toLocaleString()} total
            {week.agg.daysHit !== null && (
              <>
                {" "}
                · {week.agg.daysHit}/{week.agg.daysLogged} days hit
              </>
            )}
          </div>
        </div>
        <div className="text-right leading-none">
          <div
            className="text-[26px] font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: cleared ? "var(--success)" : "var(--foreground)" }}
          >
            {fmtSteps(week.agg.avg)}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
            avg / day
          </div>
        </div>
      </button>

      {open && (
        <ul className="flex flex-col gap-2 px-4 pb-4 pt-1">
          {week.entries.map((e) => {
            const hit = goal !== null && e.steps >= goal;
            return (
              <li
                key={e.date}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
              >
                <MiniRing steps={e.steps} goal={goal} />
                <span className="flex-1 text-[13px] text-[var(--muted)]">{fmtRowDate(e.date)}</span>
                <span className="text-[15px] font-semibold tabular-nums">{fmtSteps(e.steps)}</span>
                {goal !== null && (
                  <span
                    className="w-11 text-right text-[12px] font-medium tabular-nums"
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
    </section>
  );
}

function Pager({
  page,
  pageCount,
  onPage,
}: {
  page: number;
  pageCount: number;
  onPage: (p: number) => void;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between px-1 text-xs text-[var(--muted)]">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
      >
        ← Newer
      </button>
      <span className="tabular-nums">
        Weeks · page {page + 1} of {pageCount}
      </span>
      <button
        type="button"
        disabled={page === pageCount - 1}
        onClick={() => onPage(page + 1)}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
      >
        Older →
      </button>
    </div>
  );
}
