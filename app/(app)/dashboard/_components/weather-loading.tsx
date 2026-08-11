/**
 * The weather tile's loading vocabulary.
 *
 * Weather is the one dashboard tile whose data comes from OUTSIDE the system,
 * and a cache miss means a real round-trip to OpenWeather that the user can
 * feel. A silent shimmer is the wrong answer there: it looks identical to a
 * tile that is stuck, and it says nothing about who is being waited on. So the
 * tile spins something — visibly, with a label — for exactly as long as the
 * backend is actually working.
 *
 * Two shapes, because there are two waits:
 *
 *   - `LoadingBody` is the FIRST load of a location, where there is nothing to
 *     show yet: skeleton lines for the layout the reading will occupy, plus a
 *     spinner and a line naming what is happening. The skeleton keeps the card
 *     from resizing when the data lands; the spinner is what says "working".
 *   - `Spinner` alone rides in the card header during a REFRESH, where a
 *     reading is already on screen. Replacing live data with a skeleton to
 *     announce a refresh takes something away from the user to tell them
 *     something they did not ask about.
 *
 * `slowMs` exists because the honest message changes with the wait. Under two
 * seconds "Checking conditions…" is the truth; past it, the fetch is a provider
 * round-trip having a bad day, and saying so is better than a label that keeps
 * promising the same imminent arrival.
 */
"use client";

import { useEffect, useState } from "react";

/** Wait after which the copy admits this is taking a while. */
const SLOW_AFTER_MS = 2000;

/** The house spinner: a 3/4 ring, currentColor, 16px unless told otherwise. */
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className={`animate-spin ${className ?? ""}`}
      role="status"
      aria-label="Loading"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

/**
 * First-load state: the shape of the reading to come, a spinner, and a line
 * that names the wait. `startedAt` is passed in rather than captured on mount
 * so the "taking a while" threshold measures the FETCH, not this component —
 * remounting the body (paging away and back) must not reset the clock on a
 * request that has genuinely been in flight for ten seconds.
 */
export function LoadingBody({ startedAt }: { startedAt: number }) {
  const slow = useElapsedPast(startedAt, SLOW_AFTER_MS);

  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <Spinner />
        <span className="text-sm">
          {slow ? "Still fetching — the forecast service is slow" : "Checking conditions…"}
        </span>
      </div>
      {/* The layout the reading will occupy, so nothing jumps when it lands. */}
      <div className="flex animate-pulse flex-col gap-2" aria-hidden="true">
        <div className="h-4 w-28 rounded bg-[var(--surface-2)]" />
        <div className="h-8 w-36 rounded bg-[var(--surface-2)]" />
        <div className="h-3 w-full rounded bg-[var(--surface-2)]" />
        <div className="h-10 w-full rounded bg-[var(--surface-2)]" />
      </div>
    </div>
  );
}

/**
 * True once `ms` has elapsed since `startedAt`. Arms a single timer for the
 * REMAINING time, so a fetch that was already slow when this mounted reports
 * slow immediately rather than waiting the full threshold all over again.
 *
 * The reset when `startedAt` changes is done DURING render rather than in an
 * effect — React's own idiom for state derived from props. An effect would
 * both cost a second pass and paint one frame of the previous fetch's verdict
 * on the new one.
 */
function useElapsedPast(startedAt: number, ms: number): boolean {
  const [past, setPast] = useState(() => Date.now() - startedAt >= ms);
  const [measuring, setMeasuring] = useState(startedAt);
  if (measuring !== startedAt) {
    setMeasuring(startedAt);
    // Reset to "not slow yet" rather than re-reading the clock: a clock read
    // is impure during render, and a `startedAt` that CHANGES is by definition
    // a fetch that just began. The already-old case is the mount case, which
    // the initializer above answers, and the effect's clamped timer catches
    // the remaining edge a tick later.
    setPast(false);
  }

  useEffect(() => {
    if (past) return;
    // Clamped at 0: a fetch already past the threshold when this mounted is
    // announced on the next tick rather than never.
    const timer = setTimeout(() => setPast(true), Math.max(0, startedAt + ms - Date.now()));
    return () => clearTimeout(timer);
  }, [past, startedAt, ms]);

  return past;
}
