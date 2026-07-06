/**
 * IDIOM: month-chapter — heroes THE MONTH ROLLUP.
 *
 * Draws on Copilot Money statement sections + Whoop's monthly recap: the
 * long-range story comes first. Each calendar month is a chapter opened by a
 * prominent banner (the largest figures in the whole log region — month avg,
 * total, days-hit, best day), then lightweight one-line week sub-headers nest
 * inside, then day rows at the leaf. Answers "how was July vs June?" before
 * "what happened Tuesday?". Single-month periods collapse to week sub-headers
 * with no empty month chrome.
 *
 *  - Type scale: the month avg is the biggest number on the surface; week lines
 *    are caption-sized.
 *  - Color logic: the accent claims the month avg — it is the period headline.
 *  - Spacing rhythm: airy between chapters, tight within a week.
 *  - Pagination: ONE MONTH CHAPTER per page.
 */
"use client";

import { useState } from "react";
import { ENTRIES, bucketByMonth, fmtK, fmtRowDate, fmtSteps, spansMultipleMonths } from "../_data";
import { DayActions, LogToolbar, MiniRing } from "../_ui";

export function MonthChapter({ goal }: { goal: number | null }) {
  const months = bucketByMonth(ENTRIES, goal);
  const multiMonth = spansMultipleMonths(ENTRIES);
  const [page, setPage] = useState(0);
  const month = months[page];

  return (
    <div className="flex flex-col gap-4">
      <LogToolbar goal={goal} />

      {/* Single-month period: no month chrome, week sub-headers only. */}
      {!multiMonth ? (
        <div className="flex flex-col gap-4">
          {month.weeks.map((w) => (
            <WeekBlock key={w.key} label={w.label} agg={w.agg} entries={w.entries} goal={goal} />
          ))}
        </div>
      ) : (
        <>
          <MonthBanner month={month} />
          <div className="flex flex-col gap-4 pl-1">
            {month.weeks.map((w) => (
              <WeekBlock key={w.key} label={w.label} agg={w.agg} entries={w.entries} goal={goal} />
            ))}
          </div>
          <div className="flex items-center justify-between px-1 text-xs text-[var(--muted)]">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
            >
              ← {months[page - 1]?.label ?? "Newer"}
            </button>
            <span className="tabular-nums">
              Chapter {page + 1} of {months.length}
            </span>
            <button
              type="button"
              disabled={page === months.length - 1}
              onClick={() => setPage(page + 1)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
            >
              {months[page + 1]?.label ?? "Older"} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MonthBanner({ month }: { month: ReturnType<typeof bucketByMonth>[number] }) {
  const { agg } = month;
  const cleared = agg.attainmentPct !== null && agg.attainmentPct >= 100;
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {month.label}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="text-[46px] font-semibold leading-none tracking-[-0.04em] tabular-nums"
              style={{ color: cleared ? "var(--success)" : "var(--accent)" }}
            >
              {fmtSteps(agg.avg)}
            </span>
            <span className="text-[12px] text-[var(--muted)]">avg / day</span>
          </div>
        </div>
        {agg.attainmentPct !== null && (
          <div
            className="rounded-full px-2.5 py-1 text-[12px] font-semibold tabular-nums"
            style={{
              color: cleared ? "var(--success)" : "var(--accent)",
              background: cleared ? "rgba(134,179,159,0.12)" : "var(--accent-soft)",
            }}
          >
            {agg.attainmentPct}% of goal
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--border)] text-center">
        <BannerStat label="Total" value={fmtK(agg.total)} />
        <BannerStat
          label="Days hit"
          value={
            agg.daysHit !== null ? `${agg.daysHit}/${agg.daysLogged}` : `${agg.daysLogged} logged`
          }
          tone={agg.daysHit !== null ? "success" : "default"}
        />
        <BannerStat label="Best day" value={fmtK(agg.best.steps)} sub={fmtRowDate(agg.best.date)} />
      </div>
    </div>
  );
}

function BannerStat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success";
}) {
  return (
    <div className="bg-[var(--surface)] px-3 py-3">
      <div
        className="text-[18px] font-semibold tabular-nums"
        style={{ color: tone === "success" ? "var(--success)" : "var(--foreground)" }}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </div>
      {sub && <div className="mt-0.5 text-[10px] text-[var(--muted)]">{sub}</div>}
    </div>
  );
}

function WeekBlock({
  label,
  agg,
  entries,
  goal,
}: {
  label: string;
  agg: ReturnType<typeof bucketByMonth>[number]["weeks"][number]["agg"];
  entries: { date: string; steps: number }[];
  goal: number | null;
}) {
  return (
    <div>
      {/* Caption-sized week sub-header — one quiet line. */}
      <div className="flex items-baseline justify-between border-b border-[var(--border)] pb-1.5">
        <span className="text-[12px] font-medium text-[var(--muted)]">{label}</span>
        <span className="text-[11px] tabular-nums text-[var(--faint)]">
          avg {fmtSteps(agg.avg)}
          {agg.daysHit !== null && (
            <>
              {" "}
              · {agg.daysHit}/{agg.daysLogged} hit
            </>
          )}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {entries.map((e) => {
          const hit = goal !== null && e.steps >= goal;
          return (
            <li key={e.date} className="flex items-center gap-3 px-1 py-1">
              <MiniRing steps={e.steps} goal={goal} size={20} />
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
    </div>
  );
}
