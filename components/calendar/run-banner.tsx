"use client";

import { useId, useState } from "react";
import { runFallbackName } from "@/app/(app)/running/_components/RunListRow";
import { RunDigest } from "@/components/calendar/run-digest";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import type { RunningSession } from "@/lib/api";

/**
 * Banner row for a single run, the teal-flavored sibling of WorkoutBanner.
 * The body button navigates (via `onNavigate`) to the run detail; the
 * chevron toggles an inline {@link RunDigest} dropdown without navigating.
 * The dropdown mounts lazily — only when `open`.
 */
export function RunBanner({
  run,
  onNavigate,
  defaultOpen = false,
}: {
  run: RunningSession;
  onNavigate: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dropdownId = useId();
  const { unitLabel, formatDistance, formatPace } = useDistanceUnit();

  const time = new Date(run.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const title = run.name?.trim() || runFallbackName(run.start_time);
  const stats = `${time} · ${formatDistance(run.distance_meters)} ${unitLabel} · ${formatPace(
    run.avg_pace_sec_per_km,
  )} /${unitLabel}`;

  return (
    <div
      role="group"
      className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onNavigate}
          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset md:gap-3 md:px-3 md:py-2.5"
        >
          <span
            aria-hidden="true"
            className="h-7 w-1 shrink-0 rounded-full bg-teal-500 dark:bg-teal-300 md:h-8 md:w-1.5"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-[var(--foreground)] md:text-sm">
              {title}
            </span>
            <span className="truncate text-[11px] tabular-nums text-[var(--muted)] md:text-xs">
              {stats}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={dropdownId}
          aria-label={open ? "Collapse details" : "Expand details"}
          onClick={() => setOpen((o) => !o)}
          className="flex shrink-0 items-center justify-center px-2 text-[var(--muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset md:px-3"
        >
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && (
        <div id={dropdownId} className="border-t border-[var(--border)] px-3 py-2.5">
          <RunDigest run={run} />
        </div>
      )}
    </div>
  );
}
