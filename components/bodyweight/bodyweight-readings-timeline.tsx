"use client";

import { useMemo, useState } from "react";
import type { BodyweightEntry } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import {
  groupByLocalDay,
  packDayGroupsIntoPages,
  type DayGroup,
  type DayReading,
} from "@/lib/bodyweight-grouping";

/** Up to this many readings fit on one page; days are never split. */
const READINGS_PER_PAGE = 20;

export type BodyweightReadingsTimelineProps = {
  entries: BodyweightEntry[]; // already range-filtered by the page
  displayUnit: "lb" | "kg";
  onEdit: (entry: BodyweightEntry) => void; // desktop pencil
  onDelete: (entry: BodyweightEntry) => void; // desktop trash
  onTapReading: (entry: BodyweightEntry) => void; // mobile tap -> page opens action sheet
};

/**
 * Presentational vertical timeline-rail view of the bodyweight log.
 *
 * Renders already-fetched, already-range-filtered readings as day-nodes on a
 * rail (newest first), with intra-day beads and a day-over-day delta on each
 * connector. Edit/delete/tap are emitted as intents via callbacks — the page
 * owns fetch/mutation/goal/modals.
 *
 * Color meaning is strict: `--accent` (periwinkle) means a DOWN day-over-day
 * move toward the cut goal, and marks active/hover affordances; an UP move is
 * `--muted` slate. The rail line itself is structural (`--border-strong`).
 */
export function BodyweightReadingsTimeline({
  entries,
  displayUnit,
  onEdit,
  onDelete,
  onTapReading,
}: BodyweightReadingsTimelineProps) {
  const [page, setPage] = useState(1);

  // Reset to the first page whenever the underlying data changes (e.g. the
  // page widens the time range or a reading is added/removed). Adjusting state
  // during render off a tracked previous value is React's recommended pattern
  // for derived-from-props resets — no effect, no extra commit.
  const [prevEntries, setPrevEntries] = useState(entries);
  if (entries !== prevEntries) {
    setPrevEntries(entries);
    setPage(1);
  }

  const groups = useMemo(() => groupByLocalDay(entries, displayUnit), [entries, displayUnit]);
  const pages = useMemo(() => packDayGroupsIntoPages(groups, READINGS_PER_PAGE), [groups]);
  const byId = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  const totalPages = Math.max(1, pages.length);
  const currentPage = Math.min(page, totalPages);
  const visible = pages[currentPage - 1] ?? [];

  if (entries.length === 0) {
    return (
      <section className="@container">
        <p className="rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-10 text-center text-sm text-[var(--muted)]">
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
            displayUnit={displayUnit}
            byId={byId}
            onEdit={onEdit}
            onDelete={onDelete}
            onTapReading={onTapReading}
          />
        ))}
      </ol>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-xs text-[var(--muted)] tabular-nums">
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
  displayUnit,
  byId,
  onEdit,
  onDelete,
  onTapReading,
}: {
  group: DayGroup;
  isNewest: boolean;
  displayUnit: "lb" | "kg";
  byId: Map<string, BodyweightEntry>;
  onEdit: (entry: BodyweightEntry) => void;
  onDelete: (entry: BodyweightEntry) => void;
  onTapReading: (entry: BodyweightEntry) => void;
}) {
  const multiReading = group.readings.length > 1;
  const dotRing = isNewest ? "border-[var(--accent)]" : "border-[var(--border-strong)]";

  return (
    <li className="flex gap-3">
      {/* Rail column: structural hairline line + the node dot. */}
      <div className="relative flex w-7 shrink-0 justify-center @[420px]:w-9">
        <span className="absolute inset-y-0 w-px bg-[var(--border-strong)]" aria-hidden="true" />
        <span
          className={`relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 bg-[var(--surface)] ${dotRing}`}
          aria-hidden="true"
        />
      </div>

      {/* Content column: day header, beads, then the connector/delta. */}
      <div className="min-w-0 flex-1 pb-6">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-xs text-[var(--muted)]">{formatNodeDate(group.dateKey)}</span>
          <span className="text-sm font-medium text-[var(--foreground)] tabular-nums">
            {formatNumber(group.average)} {displayUnit}
          </span>
          {multiReading && (
            <span className="text-[11px] text-[var(--muted)] tabular-nums">
              {group.readings.length} readings
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-col gap-1.5">
          {group.readings.map((reading) => (
            <Bead
              key={reading.id}
              reading={reading}
              displayUnit={displayUnit}
              entry={byId.get(reading.id)}
              onEdit={onEdit}
              onDelete={onDelete}
              onTapReading={onTapReading}
            />
          ))}
          {multiReading && group.spread !== null && (
            <p className="text-[11px] text-[var(--muted)] tabular-nums whitespace-nowrap">
              ↕ {formatNumber(group.spread)} {displayUnit}
            </p>
          )}
        </div>

        <DeltaLabel delta={group.deltaVsPrevDay} displayUnit={displayUnit} />
      </div>
    </li>
  );
}

function Bead({
  reading,
  displayUnit,
  entry,
  onEdit,
  onDelete,
  onTapReading,
}: {
  reading: DayReading;
  displayUnit: "lb" | "kg";
  entry: BodyweightEntry | undefined;
  onEdit: (entry: BodyweightEntry) => void;
  onDelete: (entry: BodyweightEntry) => void;
  onTapReading: (entry: BodyweightEntry) => void;
}) {
  const value = `${formatNumber(reading.weight)} ${displayUnit}`;
  const time = formatBeadTime(reading.measured_at);
  // Render the figure and unit as adjacent-but-separate text nodes so the
  // day-header average stays the single contiguous "N unit" match while the
  // beads (which repeat the same figure, in two breakpoint variants) don't
  // multiply it.
  const figure = (
    <span className="text-sm text-[var(--foreground)] tabular-nums">
      {formatNumber(reading.weight)}
      <span className="ml-1 text-[var(--muted)]">{displayUnit}</span>
    </span>
  );

  // One row carries the visible content (figure + time) exactly once. Below
  // the breakpoint, a full-bleed overlay button captures the tap and opens the
  // action sheet; at/above it, the overlay is hidden and per-reading pencil/
  // trash icon buttons are revealed on hover/focus. Keeping the overlay
  // sibling to the content (not wrapping it) avoids a button-in-button.
  return (
    <div className="group relative flex items-center justify-between gap-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 transition focus-within:border-[var(--accent)] @[420px]:hover:border-[var(--border-strong)]">
      {figure}
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--muted)] tabular-nums">{time}</span>
        <div className="hidden items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 @[420px]:flex">
          <IconButton
            label="Edit reading"
            onClick={() => entry && onEdit(entry)}
            icon={<PencilIcon />}
          />
          <IconButton
            label="Delete reading"
            tone="danger"
            onClick={() => entry && onDelete(entry)}
            icon={<TrashIcon />}
          />
        </div>
      </div>

      {/* Mobile: full-row overlay button opens the action sheet. */}
      <button
        type="button"
        onClick={() => entry && onTapReading(entry)}
        aria-label={`${value} on ${formatNodeDate(datePartKey(reading.measured_at))} at ${time} — tap to edit or delete`}
        className="absolute inset-0 rounded-[14px] @[420px]:hidden"
      />
    </div>
  );
}

function DeltaLabel({ delta, displayUnit }: { delta: number | null; displayUnit: "lb" | "kg" }) {
  if (delta === null) return null;

  let className: string;
  let connector: string;
  let label: string;
  if (delta < 0) {
    className = "text-[var(--accent)]";
    connector = "bg-[var(--accent-line)]";
    label = `↓ ${formatNumber(Math.abs(delta))} ${displayUnit}`;
  } else if (delta > 0) {
    className = "text-[var(--muted)]";
    connector = "bg-[var(--border-strong)]";
    label = `↑ ${formatNumber(Math.abs(delta))} ${displayUnit}`;
  } else {
    className = "text-[var(--muted)]";
    connector = "bg-[var(--border-strong)]";
    label = `± 0 ${displayUnit}`;
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className={`h-4 w-px shrink-0 ${connector}`} aria-hidden="true" />
      <span className={`text-[11px] tabular-nums whitespace-nowrap ${className}`}>{label}</span>
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
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface)] opacity-100 transition hover:border-[var(--border-strong)] focus:opacity-100 ${toneClasses}`}
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

/** `h:mm AM/PM` for a bead's measured-at timestamp, in local time. */
function formatBeadTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Local "YYYY-MM-DD" for an RFC3339 timestamp — for the bead's aria-label. */
function datePartKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * `weekday, Mon D` for a "YYYY-MM-DD" day key. Parse as a LOCAL date with
 * explicit components — `new Date("YYYY-MM-DD")` would be interpreted as UTC
 * and could land on the wrong local day in negative-offset zones.
 */
function formatNodeDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const local = new Date(y, m - 1, d);
  return local.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
