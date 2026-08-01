"use client";

import { useMemo, useState } from "react";
import type { BloodPressureEntry } from "@/lib/api";
import { BP_CATEGORIES, type BpCategory } from "@/lib/blood-pressure";

/** Up to this many readings fit on one page; days are never split. */
const READINGS_PER_PAGE = 20;

/**
 * Day-grouped reading rail for the blood-pressure log — the direct twin
 * of the bodyweight readings timeline. Already-fetched, already-range-
 * filtered readings render as day-nodes on a structural rail (newest
 * first), each bead showing `122/78`, its category chip (status tone
 * from BP_CATEGORIES), the pulse when present, and the time.
 *
 * Pagination packs WHOLE days into pages of up to READINGS_PER_PAGE — a
 * day is never split across a page boundary; a day that would overflow
 * the current page starts the next one intact. Edit/delete are emitted
 * as callbacks so the page owns the mutations.
 */
export function BpReadingsTimeline({
  entries,
  onEdit,
  onDelete,
}: {
  entries: BloodPressureEntry[]; // already range-filtered by the page
  onEdit: (entry: BloodPressureEntry) => void;
  onDelete: (entry: BloodPressureEntry) => void;
}) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever the data identity changes (range widened, a
  // reading added/removed). Adjusting state during render off a tracked
  // previous value is React's recommended derived-reset pattern.
  const [prevEntries, setPrevEntries] = useState(entries);
  if (entries !== prevEntries) {
    setPrevEntries(entries);
    setPage(1);
  }

  const groups = useMemo(() => groupByLocalDay(entries), [entries]);
  const pages = useMemo(() => packDaysIntoPages(groups, READINGS_PER_PAGE), [groups]);

  const totalPages = Math.max(1, pages.length);
  const currentPage = Math.min(page, totalPages);
  const visible = pages[currentPage - 1] ?? [];

  if (entries.length === 0) {
    return (
      <section className="@container">
        <p className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          No readings in this range — try widening the time range above.
        </p>
      </section>
    );
  }

  return (
    <section className="@container">
      <ol className="flex flex-col">
        {visible.map((group, index) => (
          <DayNode
            key={group.dateKey}
            group={group}
            isNewest={currentPage === 1 && index === 0}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ol>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs tabular-nums text-[var(--muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <PageButton
              label="Prev"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            <PageButton
              label="Next"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function DayNode({
  group,
  isNewest,
  onEdit,
  onDelete,
}: {
  group: DayGroup;
  isNewest: boolean;
  onEdit: (entry: BloodPressureEntry) => void;
  onDelete: (entry: BloodPressureEntry) => void;
}) {
  const multiReading = group.readings.length > 1;
  const dotRing = isNewest ? "border-[var(--accent)]" : "border-[var(--border-strong)]";

  return (
    <li className="flex gap-3">
      {/* Rail column: structural hairline + node dot. */}
      <div className="relative flex w-7 shrink-0 justify-center @[420px]:w-9">
        <span className="absolute inset-y-0 w-px bg-[var(--border-strong)]" aria-hidden="true" />
        <span
          className={`relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 bg-[var(--surface)] ${dotRing}`}
          aria-hidden="true"
        />
      </div>

      {/* Content column: day header + beads. */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs text-[var(--muted)]">{formatNodeDate(group.dateKey)}</span>
          {multiReading && (
            <span className="text-[11px] tabular-nums text-[var(--muted)]">
              {group.readings.length} readings
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          {group.readings.map((entry) => (
            <Bead key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      </div>
    </li>
  );
}

function Bead({
  entry,
  onEdit,
  onDelete,
}: {
  entry: BloodPressureEntry;
  onEdit: (entry: BloodPressureEntry) => void;
  onDelete: (entry: BloodPressureEntry) => void;
}) {
  const cat = entry.category as BpCategory;
  const meta = BP_CATEGORIES[cat] ?? BP_CATEGORIES.normal;
  const time = formatBeadTime(entry.measured_at);

  return (
    <div className="group flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition focus-within:border-[var(--accent)] @[420px]:hover:border-[var(--border-strong)]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-sm tabular-nums text-[var(--foreground)]">
          {entry.systolic}
          <span className="text-[var(--muted)]">/</span>
          {entry.diastolic}
          <span className="ml-1 text-[10px] text-[var(--muted)]">mmHg</span>
        </span>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            color: meta.tone,
            backgroundColor: `color-mix(in srgb, ${meta.tone} 14%, transparent)`,
          }}
        >
          {meta.label}
        </span>
        {entry.pulse != null && (
          <span className="text-[11px] tabular-nums text-[var(--muted)]">♥ {entry.pulse} bpm</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-[var(--muted)]">{time}</span>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
          <IconButton label="Edit reading" onClick={() => onEdit(entry)} icon={<PencilIcon />} />
          <IconButton
            label="Delete reading"
            tone="danger"
            onClick={() => onDelete(entry)}
            icon={<TrashIcon />}
          />
        </div>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  icon,
  tone,
}: {
  label: string;
  onClick: () => void;
  icon: React.ReactNode;
  tone?: "danger";
}) {
  const toneClasses =
    tone === "danger"
      ? "text-[var(--muted)] hover:text-[var(--danger)]"
      : "text-[var(--muted)] hover:text-[var(--accent)]";
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--border-strong)] focus:opacity-100 ${toneClasses}`}
    >
      {icon}
    </button>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--foreground)] transition hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-[var(--border)]"
    >
      {label}
    </button>
  );
}

function PencilIcon() {
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

// --- grouping + pagination ----------------------------------------

type DayGroup = {
  dateKey: string; // local "YYYY-MM-DD"
  readings: BloodPressureEntry[]; // chronological ascending within the day
};

/** Local "YYYY-MM-DD" for an RFC3339 timestamp, in the browser's zone. */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Group readings by local calendar day, newest day first; readings
 * within a day sorted morning→evening. */
function groupByLocalDay(entries: BloodPressureEntry[]): DayGroup[] {
  const byDay = new Map<string, BloodPressureEntry[]>();
  for (const e of entries) {
    const key = localDateKey(e.measured_at);
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }
  const ascKeys = [...byDay.keys()].sort();
  const ascGroups: DayGroup[] = ascKeys.map((key) => ({
    dateKey: key,
    readings: (byDay.get(key) ?? [])
      .slice()
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()),
  }));
  return ascGroups.reverse();
}

/** Pack day-groups into pages of up to `cap` readings, never splitting a
 * day. A day that would push the current page over the cap starts the
 * next page intact; a single day larger than the cap gets its own page.
 * Newest-first order is preserved. */
function packDaysIntoPages(groups: DayGroup[], cap: number): DayGroup[][] {
  const pages: DayGroup[][] = [];
  let current: DayGroup[] = [];
  let count = 0;
  for (const g of groups) {
    const n = g.readings.length;
    if (current.length > 0 && count + n > cap) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(g);
    count += n;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

/** `h:mm AM/PM` for a bead's measured-at, in local time. */
function formatBeadTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** `weekday, Mon D` for a local "YYYY-MM-DD" key — parsed as a LOCAL date
 * with explicit components so it doesn't shift a day in negative-offset
 * zones. */
function formatNodeDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
