"use client";

/**
 * The settings "Usage" progress bar + its copy. Reads the shared
 * `useUsage()` snapshot. Rendered inside a SettingRow-style card on the
 * settings page, above the Units section.
 *
 * Color thresholds (per the per-user-daily-usage-cap SOW):
 *   0–79%  → accent (blue)
 *   80–99% → warning (amber)
 *   100%   → danger (red)
 *
 * The "Resets in Xh Ym" subtext is computed client-side from
 * `resetsAt - Date.now()` and re-rendered on a 60s tick so the countdown
 * stays roughly current without polling the API. At 100% the subtext
 * flips to the full "you've used your allowance" sentence shared with
 * the chat banner.
 */

import { useEffect, useState } from "react";
import { useUsage } from "@/lib/usage-context";

/**
 * Humanize a millisecond duration as "Xh Ym" (e.g. "4h 12m"). Sub-hour
 * durations drop the hours segment ("12m"); non-positive / non-finite
 * input clamps to "0m" so a just-passed reset reads sensibly rather than
 * showing a negative countdown.
 */
export function formatResetCountdown(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

/**
 * The capped-state sentence, shared verbatim between the settings 100%
 * subtext, the chat banner, and the chat 429 toast so the user sees one
 * consistent message about their daily allowance.
 */
export function cappedMessage(resetsAt: Date): string {
  const countdown = formatResetCountdown(resetsAt.getTime() - Date.now());
  return `You've used your daily AI allowance. New allowance available in ${countdown}.`;
}

/**
 * Re-render hook: returns a value that changes every `intervalMs` so a
 * component that derives a countdown from `Date.now()` stays current.
 * Used by the usage bar (and the chat banner could share it) to refresh
 * the "Resets in Xh Ym" text once a minute without a network call.
 */
function useMinuteTick(intervalMs = 60_000): void {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}

function barColor(percentUsed: number): string {
  if (percentUsed >= 100) return "var(--danger)";
  if (percentUsed >= 80) return "var(--warning)";
  return "var(--accent)";
}

export function UsageBar() {
  const { percentUsed, capped, resetsAt, loading, error } = useUsage();
  // Re-render every 60s so the countdown drifts down without a refetch.
  useMinuteTick();

  if (loading) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <div className="h-2 w-full animate-pulse rounded-full bg-[var(--surface-2)]" />
        <p className="text-xs text-[var(--muted)]">Loading usage…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-2">
        {/* Disabled/hatched track — usage couldn't be fetched. */}
        <div
          aria-label="Daily AI allowance unavailable"
          data-testid="usage-bar-unavailable"
          className="h-2 w-full rounded-full border border-dashed border-[var(--border)] bg-[var(--surface-2)] opacity-60 [background-image:repeating-linear-gradient(45deg,var(--border)_0,var(--border)_1px,transparent_1px,transparent_6px)]"
        />
        <p className="text-xs text-[var(--muted)]">Usage unavailable right now.</p>
      </div>
    );
  }

  const isCapped = capped || percentUsed >= 100;
  const fill = Math.min(100, Math.max(0, percentUsed));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <div
            role="progressbar"
            aria-label="Daily AI allowance"
            aria-valuenow={percentUsed}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-full rounded-full transition-[width]"
            style={{ width: `${fill}%`, backgroundColor: barColor(percentUsed) }}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-[var(--foreground)]">
          {percentUsed}%
        </span>
      </div>
      <p className="text-xs text-[var(--muted)]">
        {isCapped
          ? cappedMessage(resetsAt)
          : `Resets in ${formatResetCountdown(resetsAt.getTime() - Date.now())}`}
      </p>
    </div>
  );
}
