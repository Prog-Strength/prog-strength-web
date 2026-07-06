"use client";

import { useEffect, useMemo, useState } from "react";
import type { StepsEntry } from "@/lib/api";
import { dayPct, parseLocalDate } from "@/lib/steps-stats";
import {
  aggregate,
  bucketByWeek,
  entriesInMonth,
  monthLabel,
  spansMultipleMonths,
  WEEKS_PER_PAGE,
  type WeekBucket,
} from "@/lib/steps-grouping";

export function StepsLogAccordion({
  entries,
  goal,
  onEdit,
  onDelete,
  weekPage,
  onWeekPageChange,
  pageCount,
  showPager,
  canGoOlder,
  loadingMore,
  resetKey,
}: {
  entries: StepsEntry[];
  goal: number | null;
  onEdit: (entry: StepsEntry) => void;
  onDelete: (date: string) => Promise<void>;
  weekPage: number;
  onWeekPageChange: (page: number) => void;
  pageCount: number;
  showPager: boolean;
  canGoOlder: boolean;
  loadingMore: boolean;
  resetKey: number;
}) {
  const weeks = useMemo(() => bucketByWeek(entries, goal), [entries, goal]);
  const showMonths = spansMultipleMonths(entries);
  const pageWeeks = weeks.slice(
    weekPage * WEEKS_PER_PAGE,
    weekPage * WEEKS_PER_PAGE + WEEKS_PER_PAGE,
  );

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const newest = bucketByWeek(entries, goal)[0]?.key ?? "";
    return newest ? { [newest]: true } : {};
  });

  useEffect(() => {
    const newest = bucketByWeek(entries, goal)[0]?.key ?? "";
    setOpen(newest ? { [newest]: true } : {});
    // Reset expansion only when the parent bumps resetKey after a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- entries/goal at reset time
  }, [resetKey]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col divide-y divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        {pageWeeks.map((week, i) => {
          const prev = pageWeeks[i - 1];
          const monthChanged =
            showMonths && parseLocalDate(week.entries[0].date).getMonth() !== monthOfWeek(prev);
          const monthKey = week.entries[0].date.slice(0, 7);
          return (
            <div key={week.key}>
              {monthChanged && <MonthDivider monthKey={monthKey} entries={entries} goal={goal} />}
              <WeekSection
                week={week}
                goal={goal}
                open={!!open[week.key]}
                onToggle={() => setOpen((o) => ({ ...o, [week.key]: !o[week.key] }))}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            </div>
          );
        })}
      </div>

      {showPager && (
        <Pager
          page={weekPage}
          pageCount={pageCount}
          canGoOlder={canGoOlder}
          loading={loadingMore}
          onNewer={() => onWeekPageChange(weekPage - 1)}
          onOlder={() => onWeekPageChange(weekPage + 1)}
        />
      )}
    </div>
  );
}

function monthOfWeek(week: WeekBucket | undefined): number {
  return week ? parseLocalDate(week.entries[0].date).getMonth() : -1;
}

function MonthDivider({
  monthKey,
  entries,
  goal,
}: {
  monthKey: string;
  entries: StepsEntry[];
  goal: number | null;
}) {
  const agg = aggregate(entriesInMonth(entries, monthKey), goal);
  return (
    <div className="flex items-baseline justify-between bg-[var(--surface-2)] px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {monthLabel(monthKey)}
      </span>
      <span className="text-[11px] tabular-nums text-[var(--muted)]">
        avg <span className="font-semibold text-[var(--foreground)]">{formatSteps(agg.avg)}</span>
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
  onEdit,
  onDelete,
}: {
  week: WeekBucket;
  goal: number | null;
  open: boolean;
  onToggle: () => void;
  onEdit: (entry: StepsEntry) => void;
  onDelete: (date: string) => Promise<void>;
}) {
  const cleared = week.agg.attainmentPct !== null && week.agg.attainmentPct >= 100;
  return (
    <section>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-testid={`week-header-${week.key}`}
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
            data-testid={`week-avg-${week.key}`}
            className="text-[26px] font-semibold tabular-nums tracking-[-0.03em]"
            style={{ color: cleared ? "var(--success)" : "var(--foreground)" }}
          >
            {formatSteps(week.agg.avg)}
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
            avg / day
          </div>
        </div>
      </button>

      {open && (
        <ul className="flex flex-col gap-2 px-4 pb-4 pt-1">
          {week.entries.map((e) => {
            const pct = dayPct(e.steps, goal ?? 0);
            const hit = goal !== null && e.steps >= goal;
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--background)] px-3 py-2.5"
              >
                <MiniRing pct={pct} hit={hit} />
                <span className="flex-1 text-[13px] text-[var(--muted)]">
                  {formatRowDate(e.date)}
                </span>
                <span className="text-[15px] font-semibold tabular-nums">
                  {formatSteps(e.steps)}
                </span>
                {pct !== null && (
                  <span
                    className="w-11 text-right text-[12px] font-medium tabular-nums"
                    style={{ color: hit ? "var(--success)" : "var(--muted)" }}
                  >
                    {pct}%
                  </span>
                )}
                <div className="inline-flex items-center gap-1">
                  <IconButton aria-label="Edit steps" tone="muted" onClick={() => onEdit(e)}>
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Delete steps"
                    tone="danger"
                    onClick={() => {
                      void onDelete(e.date);
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </div>
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
  canGoOlder,
  loading,
  onNewer,
  onOlder,
}: {
  page: number;
  pageCount: number;
  canGoOlder: boolean;
  loading: boolean;
  onNewer: () => void;
  onOlder: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-1 text-xs text-[var(--muted)]">
      <button
        type="button"
        disabled={page === 0 || loading}
        onClick={onNewer}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
      >
        ← Newer
      </button>
      <span className="tabular-nums">
        {loading ? "Loading…" : `Weeks · page ${page + 1} of ${Math.max(pageCount, page + 1)}`}
      </span>
      <button
        type="button"
        disabled={(!canGoOlder && page >= pageCount - 1) || loading}
        onClick={onOlder}
        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 transition hover:opacity-80 disabled:opacity-40"
      >
        Older →
      </button>
    </div>
  );
}

function MiniRing({ pct, hit }: { pct: number | null; hit: boolean }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  const frac = pct === null ? 0 : Math.min(pct, 100) / 100;
  return (
    <svg viewBox="0 0 22 22" className="h-6 w-6 -rotate-90" aria-hidden="true">
      <circle cx="11" cy="11" r={r} fill="none" stroke="var(--surface-3)" strokeWidth="3" />
      {pct !== null && (
        <circle
          cx="11"
          cy="11"
          r={r}
          fill="none"
          stroke={hit ? "var(--success)" : "var(--accent)"}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
        />
      )}
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 text-[var(--muted)] transition ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function IconButton({
  tone,
  onClick,
  "aria-label": ariaLabel,
  children,
}: {
  tone: "muted" | "danger";
  onClick: () => void;
  "aria-label": string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "danger"
      ? "text-[var(--danger)] hover:text-[var(--danger)]"
      : "text-[var(--muted)] hover:text-[var(--foreground)]";
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded p-1 transition hover:bg-white/5 ${toneClass}`}
    >
      {children}
    </button>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function formatSteps(n: number): string {
  return n.toLocaleString();
}

function formatRowDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
