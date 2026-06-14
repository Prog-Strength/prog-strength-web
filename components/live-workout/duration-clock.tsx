"use client";

/**
 * Live elapsed-time readout for the active session. Ticks once a second
 * from `performed_at` and renders `H:MM:SS` once past the hour, else
 * `M:SS`. Pure formatting (`formatElapsed`) is exported for unit tests.
 */

import { useNow } from "@/components/live-workout/use-now";

/** Elapsed `now - from` (both ms epoch) as `H:MM:SS` / `M:SS`. */
export function formatElapsed(fromMs: number, nowMs: number): string {
  const total = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function DurationClock({ performedAt }: { performedAt: string }) {
  const now = useNow(1000);
  const fromMs = new Date(performedAt).getTime();
  return (
    <span className="tabular-nums text-sm font-medium text-[var(--foreground)]">
      {formatElapsed(fromMs, now.getTime())}
    </span>
  );
}
