"use client";

import { useEffect, useState } from "react";

/**
 * Returns a `Date` that re-renders the calling component on a fixed
 * interval (default 1s). Used by the live screen's duration clock and
 * rest timer to drive their tick without each owning its own
 * `setInterval`/state pair.
 *
 * Foreground-only: the browser throttles timers in background tabs, so
 * the value can lag while the tab is hidden, then jump on refocus. That's
 * fine for an elapsed clock — readers always recompute from a stored
 * timestamp, never accumulate.
 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
