"use client";

/**
 * A visually-paginated table of the user's attempts at this distance —
 * the real efforts that fed (or sit alongside) the estimate. Columns:
 * Date, Time, Pace, Source. Most-recent-first ordering is owned by the
 * API. Pagination is client-side over the already-fetched array, reusing
 * the bodyweight page's PaginationFooter pattern (PAGE_SIZE 10).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RunningMaxEffortAttempt } from "@/lib/api";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { formatDuration } from "@/lib/format";
import { formatDate, humanizeSource } from "./format";

const PAGE_SIZE = 10;

export function AttemptsTable({ attempts }: { attempts: RunningMaxEffortAttempt[] }) {
  const { formatPace, unitLabel } = useDistanceUnit();
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(attempts.length / PAGE_SIZE));
  const pageAttempts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return attempts.slice(start, start + PAGE_SIZE);
  }, [attempts, page]);

  if (attempts.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
          Attempts
        </p>
        <p className="mt-2 text-sm text-[var(--muted)]">No attempts logged at this distance yet.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <p className="border-b border-[var(--border)] px-4 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Attempts
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[10px] uppercase tracking-wider text-[var(--muted)]">
              <th className="px-4 py-2 font-semibold">Date</th>
              <th className="px-4 py-2 font-semibold">Time</th>
              <th className="px-4 py-2 font-semibold">Pace</th>
              <th className="px-4 py-2 font-semibold">Source</th>
            </tr>
          </thead>
          <tbody>
            {pageAttempts.map((a) => (
              <tr
                key={`${a.activity_id}-${a.achieved_at}`}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-4 py-2">
                  <Link
                    href={`/running/${a.activity_id}`}
                    className="text-[var(--accent)] hover:underline"
                  >
                    {formatDate(a.achieved_at)}
                  </Link>
                </td>
                <td className="px-4 py-2 tabular-nums">{formatDuration(a.duration_seconds)}</td>
                <td className="px-4 py-2 tabular-nums">
                  {formatPace(a.pace_sec_per_km)} /{unitLabel}
                </td>
                <td className="px-4 py-2 text-[var(--muted)]">{humanizeSource(a.source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalCount={attempts.length}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  totalCount,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  totalCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--background)] px-3 py-2 text-xs text-[var(--muted)] sm:px-4">
      <p className="tabular-nums">
        Page {page} of {totalPages} · {totalCount} total
      </p>
      <div className="flex items-center gap-1">
        <PaginationBtn
          glyph="«"
          word="First"
          ariaLabel="First page"
          disabled={page === 1}
          onClick={() => onPageChange(1)}
        />
        <PaginationBtn
          glyph="‹"
          word="Prev"
          ariaLabel="Previous page"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
        />
        <PaginationBtn
          glyph="›"
          word="Next"
          ariaLabel="Next page"
          wordFirst
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
        />
        <PaginationBtn
          glyph="»"
          word="Last"
          ariaLabel="Last page"
          wordFirst
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
        />
      </div>
    </div>
  );
}

function PaginationBtn({
  glyph,
  word,
  ariaLabel,
  disabled,
  onClick,
  wordFirst,
}: {
  glyph: string;
  word: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
  wordFirst?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {wordFirst ? (
        <>
          <span className="hidden sm:inline">{word} </span>
          {glyph}
        </>
      ) : (
        <>
          {glyph}
          <span className="hidden sm:inline"> {word}</span>
        </>
      )}
    </button>
  );
}
