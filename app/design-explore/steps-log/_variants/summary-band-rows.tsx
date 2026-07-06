/**
 * IDIOM: summary-band-rows — heroes INTERSTITIAL SUMMARY BANDS.
 *
 * Draws on Linear's grouped issue lists + Robinhood's interstitial earnings
 * rows: the smallest diff from today's flat wall. Day ring-rows stay flat and
 * always visible; non-collapsible band rows are inserted at week and month
 * boundaries — a full-width week summary strip (range · avg · days-hit · total)
 * and a heavier month divider strip when the month changes. Structure without
 * hiding a single day.
 *
 *  - Type scale: bands use small-caps labels + medium tabular figures; day rows
 *    are unchanged from the shipped list.
 *  - Color logic: accent/success touches only the band's attainment figure.
 *  - Spacing rhythm: dense — bands are hairline-separated, minimal vertical gap.
 *  - Pagination: fixed ~20 rows per page, but a page break NEVER falls inside a
 *    week (the rest of the straddling week carries onto the page).
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
import { DayActions, LogToolbar, MiniRing } from "../_ui";

const ROWS_PER_PAGE = 20;

/** Pack whole weeks into pages of ~ROWS_PER_PAGE days — never splitting a week. */
function paginateByWeek(weeks: WeekBucket[]): WeekBucket[][] {
  const pages: WeekBucket[][] = [];
  let current: WeekBucket[] = [];
  let count = 0;
  for (const w of weeks) {
    if (count > 0 && count + w.entries.length > ROWS_PER_PAGE) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(w);
    count += w.entries.length;
  }
  if (current.length) pages.push(current);
  return pages;
}

export function SummaryBandRows({ goal }: { goal: number | null }) {
  const weeks = bucketByWeek(ENTRIES, goal);
  const showMonths = spansMultipleMonths(ENTRIES);
  const pages = paginateByWeek(weeks);
  const [page, setPage] = useState(0);
  const pageWeeks = pages[page];

  return (
    <div className="flex flex-col gap-3">
      <LogToolbar goal={goal} />

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
        {pageWeeks.map((week, i) => {
          const prevWeek = pageWeeks[i - 1];
          const monthChanged =
            showMonths &&
            parseLocal(week.entries[0].date).getMonth() !==
              (prevWeek ? parseLocal(prevWeek.entries[0].date).getMonth() : -1);
          return (
            <div key={week.key}>
              {monthChanged && (
                <MonthBand monthKey={week.entries[0].date.slice(0, 7)} goal={goal} />
              )}
              <WeekBand week={week} />
              <ul>
                {week.entries.map((e) => {
                  const hit = goal !== null && e.steps >= goal;
                  return (
                    <li
                      key={e.date}
                      className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2"
                    >
                      <MiniRing steps={e.steps} goal={goal} size={20} />
                      <span className="flex-1 text-[13px] text-[var(--muted)]">
                        {fmtRowDate(e.date)}
                      </span>
                      <span className="text-[14px] font-semibold tabular-nums">
                        {fmtSteps(e.steps)}
                      </span>
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
            </div>
          );
        })}
      </div>

      {pages.length > 1 && (
        <div className="flex items-center justify-between px-1 text-xs text-[var(--muted)]">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
          >
            ← Newer
          </button>
          <span className="tabular-nums">
            Page {page + 1} of {pages.length} · whole weeks only
          </span>
          <button
            type="button"
            disabled={page === pages.length - 1}
            onClick={() => setPage(page + 1)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
          >
            Older →
          </button>
        </div>
      )}
    </div>
  );
}

/** Heavier month divider strip. */
function MonthBand({ monthKey, goal }: { monthKey: string; goal: number | null }) {
  const monthEntries = ENTRIES.filter((e) => e.date.slice(0, 7) === monthKey);
  const total = monthEntries.reduce((s, e) => s + e.steps, 0);
  const avg = Math.round(total / monthEntries.length);
  const hit = goal ? monthEntries.filter((e) => e.steps >= goal).length : null;
  const [y, m] = monthKey.split("-").map(Number);
  const label = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  return (
    <div className="flex items-baseline justify-between bg-[var(--surface-3)] px-4 py-2.5">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
        {label}
      </span>
      <span className="text-[11px] tabular-nums text-[var(--muted)]">
        avg <span className="font-semibold text-[var(--foreground)]">{fmtSteps(avg)}</span>
        {hit !== null && (
          <>
            {" "}
            · {hit}/{monthEntries.length} hit
          </>
        )}{" "}
        · {fmtK(total)} total
      </span>
    </div>
  );
}

/** Full-width week summary strip — the interstitial band. */
function WeekBand({ week }: { week: WeekBucket }) {
  const cleared = week.agg.attainmentPct !== null && week.agg.attainmentPct >= 100;
  return (
    <div className="flex items-center gap-2 border-t border-[var(--border-strong)] bg-[var(--surface-2)] px-4 py-1.5 first:border-t-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
        {week.label}
      </span>
      <span className="ml-auto flex items-center gap-2 text-[11px] tabular-nums text-[var(--faint)]">
        <span>
          avg{" "}
          <span
            className="font-semibold"
            style={{ color: cleared ? "var(--success)" : "var(--accent)" }}
          >
            {fmtSteps(week.agg.avg)}
          </span>
        </span>
        {week.agg.daysHit !== null && (
          <span style={{ color: cleared ? "var(--success)" : "var(--muted)" }}>
            {week.agg.daysHit}/{week.agg.daysLogged} hit
          </span>
        )}
        <span>{fmtK(week.agg.total)} total</span>
      </span>
    </div>
  );
}
