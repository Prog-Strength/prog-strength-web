/**
 * IDIOM: ledger-dense — "the power-user table, earned."
 *
 * Draws on Linear's dense issue lists + a trading blotter: keep a true
 * grid, but make it precise. Tightest vertical rhythm of the five,
 * functional micro-type in Geist_Mono tabular figures, weights
 * right-aligned and decimal-aligned so the column scans like a ledger.
 * A dedicated Δ column carries per-reading movement (▼ accent on a down
 * move toward goal, ▲ muted on an up move). Same-day readings are
 * BRACKETED into a day-group: a left hairline + a single day-average and
 * intra-day spread in the gutter, so two readings read as one day
 * without ever leaving the table form.
 *
 * Differentiation axes:
 *   · type scale  — smallest; uniform 12–13px mono figures, no hero number
 *   · color logic — structural: accent only on the down-delta caret and
 *                   the active (newest) day's gutter edge
 *   · spacing     — densest; ~28px rows, hairline grouping
 */
"use client";

import {
  type Goal,
  type Reading,
  fmtDelta,
  fmtNum,
  fmtTime,
  fmtDayShort,
  fmtWeekday,
  groupByDay,
  readingDeltas,
  PAGE_SIZE,
} from "../_data";
import { CaretIcon, PencilIcon, PlusIcon, TargetIcon, TrashIcon } from "../_icons";
import { useState } from "react";

function deltaTone(d: number | null): string {
  if (d === null || Math.abs(d) < 0.05) return "text-[var(--faint)]";
  return d < 0 ? "text-[var(--accent)]" : "text-[var(--muted)]";
}

export function LedgerDense({ readings, goal }: { readings: Reading[]; goal: Goal }) {
  const [page, setPage] = useState(1);
  const days = groupByDay(readings);
  const deltas = readingDeltas(readings);

  // Pagination is by *reading* with the 20-row cap, but a day-group never
  // splits across a page: we pack whole days until the next would exceed
  // the cap. Page 1 of N shows the newest whole days that fit.
  const pages: (typeof days)[] = [];
  let cur: typeof days = [];
  let count = 0;
  for (const d of days) {
    if (count + d.readings.length > PAGE_SIZE && cur.length) {
      pages.push(cur);
      cur = [];
      count = 0;
    }
    cur.push(d);
    count += d.readings.length;
  }
  if (cur.length) pages.push(cur);
  const totalPages = Math.max(1, pages.length);
  const shown = pages[Math.min(page, totalPages) - 1] ?? [];

  return (
    <div className="@container">
      <Toolbar goal={goal} />

      {days.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* ── Desktop: a real, tight ledger table ──────────────── */}
          <div className="hidden overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] @lg:block">
            <table className="w-full border-collapse font-mono text-[12px] leading-none">
              <thead>
                <tr className="text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">
                  <th className="py-2 pl-3 pr-2 text-left font-medium">Day</th>
                  <th className="py-2 px-2 text-left font-medium">Time</th>
                  <th className="py-2 px-2 text-right font-medium">Weight</th>
                  <th className="py-2 px-2 text-right font-medium">Δ</th>
                  <th className="w-0 py-2 pr-3" />
                </tr>
              </thead>
              {shown.map((d, di) => {
                const isToday = di === 0 && page === 1;
                return (
                  <tbody key={d.dateKey} className="border-t border-[var(--border)]">
                    {d.readings
                      .slice()
                      .reverse() /* latest reading first within the day */
                      .map((r, ri) => {
                        const delta = deltas.get(r.id) ?? null;
                        return (
                          <tr
                            key={r.id}
                            className="group border-t border-[var(--border)]/40 first:border-t-0 hover:bg-white/[0.02]"
                          >
                            {ri === 0 && (
                              <td
                                rowSpan={d.readings.length}
                                className={`relative py-1.5 pl-3 pr-3 align-top ${
                                  isToday ? "bg-[var(--accent-soft)]" : ""
                                }`}
                              >
                                {/* active-day gutter edge — the only structural accent */}
                                {isToday && (
                                  <span className="absolute left-0 top-0 h-full w-[2px] bg-[var(--accent)]" />
                                )}
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[12px] text-[var(--foreground)]">
                                    {fmtWeekday(d.date)} {fmtDayShort(d.date)}
                                  </span>
                                  <span className="text-[10px] text-[var(--muted)]">
                                    avg {fmtNum(d.avg)}
                                  </span>
                                  {d.multi && (
                                    <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-sm bg-[var(--surface-3)] px-1 py-[1px] text-[9px] text-[var(--muted)]">
                                      {d.readings.length}rd · ⇕{fmtDelta(d.spread)}
                                    </span>
                                  )}
                                </div>
                              </td>
                            )}
                            <td className="py-1.5 px-2 align-middle text-[11px] text-[var(--muted)]">
                              {fmtTime(r.measured_at)}
                            </td>
                            <td className="py-1.5 px-2 text-right align-middle tabular-nums text-[var(--foreground)]">
                              {fmtNum(r.weight)}
                              <span className="ml-1 text-[10px] text-[var(--faint)]">{r.unit}</span>
                            </td>
                            <td
                              className={`py-1.5 px-2 text-right align-middle tabular-nums ${deltaTone(delta)}`}
                            >
                              {delta === null ? (
                                <span className="text-[var(--faint)]">·</span>
                              ) : (
                                <span className="inline-flex items-center justify-end gap-0.5">
                                  <CaretIcon
                                    className={`h-2.5 w-2.5 ${delta > 0 ? "rotate-180" : ""}`}
                                  />
                                  {fmtDelta(delta)}
                                </span>
                              )}
                            </td>
                            <td className="py-1.5 pr-3 text-right align-middle">
                              <RowActions />
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                );
              })}
            </table>
            <PageBar page={page} totalPages={totalPages} onPage={setPage} count={readings.length} />
          </div>

          {/* ── Mobile: same blotter DNA, stacked per day ────────── */}
          <div className="overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] @lg:hidden">
            {shown.map((d, di) => (
              <div key={d.dateKey} className="border-t border-[var(--border)] first:border-t-0">
                <div
                  className={`relative flex items-baseline justify-between px-3 py-1.5 font-mono ${
                    di === 0 && page === 1 ? "bg-[var(--accent-soft)]" : ""
                  }`}
                >
                  {di === 0 && page === 1 && (
                    <span className="absolute left-0 top-0 h-full w-[2px] bg-[var(--accent)]" />
                  )}
                  <span className="text-[12px] text-[var(--foreground)]">
                    {fmtWeekday(d.date)} {fmtDayShort(d.date)}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    avg {fmtNum(d.avg)}
                    {d.multi && (
                      <span className="ml-1 text-[var(--faint)]">· ⇕{fmtDelta(d.spread)}</span>
                    )}
                  </span>
                </div>
                {d.readings
                  .slice()
                  .reverse()
                  .map((r) => {
                    const delta = deltas.get(r.id) ?? null;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center justify-between border-t border-[var(--border)]/40 px-3 py-1.5 font-mono text-[12px]"
                      >
                        <span className="w-16 text-[11px] text-[var(--muted)]">
                          {fmtTime(r.measured_at)}
                        </span>
                        <span className="flex-1 text-right tabular-nums">
                          {fmtNum(r.weight)}
                          <span className="ml-1 text-[10px] text-[var(--faint)]">{r.unit}</span>
                        </span>
                        <span className={`w-12 text-right tabular-nums ${deltaTone(delta)}`}>
                          {delta === null ? "·" : (delta < 0 ? "▼" : "▲") + fmtDelta(delta)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ))}
            <PageBar page={page} totalPages={totalPages} onPage={setPage} count={readings.length} />
          </div>
        </>
      )}
    </div>
  );
}

function Toolbar({ goal }: { goal: Goal }) {
  return (
    <div className="mb-2 flex items-center justify-between font-mono">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent)] px-2.5 py-1 text-[12px] font-medium text-[var(--accent-fg)] transition hover:opacity-90"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Log
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-[12px] text-[var(--muted)] transition hover:bg-white/5"
      >
        <TargetIcon className="h-3.5 w-3.5" />
        {goal.created_at ? (
          <span className="tabular-nums text-[var(--foreground)]">
            {fmtNum(goal.weight)} {goal.unit}
          </span>
        ) : (
          <span className="italic">Set goal</span>
        )}
      </button>
    </div>
  );
}

function RowActions() {
  return (
    <div className="inline-flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
      <button
        type="button"
        aria-label="Edit"
        className="rounded p-1 text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <PencilIcon className="h-3 w-3" />
      </button>
      <button
        type="button"
        aria-label="Delete"
        className="rounded p-1 text-[var(--muted)] hover:text-[var(--danger)]"
      >
        <TrashIcon className="h-3 w-3" />
      </button>
    </div>
  );
}

function PageBar({
  page,
  totalPages,
  onPage,
  count,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
  count: number;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-[var(--border)] px-3 py-1.5 font-mono text-[10px] text-[var(--muted)]">
      <span>{count} readings</span>
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded px-1.5 py-0.5 enabled:hover:bg-white/5 disabled:opacity-30"
        >
          ←
        </button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded px-1.5 py-0.5 enabled:hover:bg-white/5 disabled:opacity-30"
        >
          →
        </button>
      </span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-8 text-center font-mono">
      <p className="text-[12px] text-[var(--muted)]">No readings yet.</p>
      <p className="mt-1 text-[11px] text-[var(--faint)]">Tap Log to add your first reading.</p>
    </div>
  );
}
