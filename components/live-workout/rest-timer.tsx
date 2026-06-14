"use client";

/**
 * Live rest-timer card. Reads `session.restTimer` (set when a set/round
 * is logged) and counts down from `startedAt + durationSec` once a
 * second. At zero it shows "Rest complete" and, if the user has already
 * granted Notification permission, fires a single foreground
 * notification — it never prompts. The user can adjust the default
 * duration (applied to future timers) or dismiss the current timer.
 *
 * Foreground-only: no background scheduling. The countdown recomputes
 * from the stored `startedAt` on every tick, so it stays correct after a
 * backgrounded tab throttles the interval.
 */

import { useEffect, useRef } from "react";
import { useActiveWorkoutSession } from "@/lib/active-workout-session";
import { useNow } from "@/components/live-workout/use-now";

/** Whole seconds remaining (>= 0) for a timer started at `startedAt`. */
export function remainingSeconds(startedAt: string, durationSec: number, nowMs: number): number {
  const endMs = new Date(startedAt).getTime() + durationSec * 1000;
  return Math.max(0, Math.ceil((endMs - nowMs) / 1000));
}

function format(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PRESETS = [60, 90, 120, 180];

export function RestTimer() {
  const { session, clearRestTimer, setRestDefault } = useActiveWorkoutSession();
  const now = useNow(1000);

  const timer = session?.restTimer ?? null;
  const remaining = timer ? remainingSeconds(timer.startedAt, timer.durationSec, now.getTime()) : 0;
  const done = timer !== null && remaining === 0;

  // Fire the "rest complete" notification at most once per timer, and
  // only if permission was already granted (never prompt). Keyed on the
  // timer's startedAt so a new timer re-arms it.
  const notifiedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!timer || !done) return;
    if (notifiedFor.current === timer.startedAt) return;
    notifiedFor.current = timer.startedAt;
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification("Rest complete", { body: "Time for your next set." });
      } catch {
        // Some browsers throw on the constructor outside a SW context;
        // the on-screen state already conveys completion.
      }
    }
  }, [timer, done]);

  if (!session) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-60 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
      {timer ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Rest timer
            </span>
            <button
              type="button"
              onClick={clearRestTimer}
              className="text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              Dismiss
            </button>
          </div>
          {done ? (
            <p className="text-lg font-semibold text-[var(--accent)]">Rest complete</p>
          ) : (
            <p className="tabular-nums text-2xl font-semibold text-[var(--foreground)]">
              {format(remaining)}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
            Rest default · {format(session.restDefaultSec)}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setRestDefault(sec)}
                className={`rounded-full border px-2 py-0.5 text-xs transition ${
                  session.restDefaultSec === sec
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {format(sec)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
