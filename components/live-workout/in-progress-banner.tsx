"use client";

/**
 * App-wide "workout in progress" indicator.
 *
 * Rendered once by the authed layout so it shows on every authenticated
 * page. Visible only while a live session exists and the user has
 * navigated away from the live/review flow (`/workout/*`) — on those
 * routes the session is already on screen, so a banner would be noise.
 * Tapping it routes back to the live screen.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useActiveWorkoutSession } from "@/lib/active-workout-session";

export function InProgressBanner() {
  const { session } = useActiveWorkoutSession();
  const pathname = usePathname();

  // Tick once a second so the elapsed-duration label stays live.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session]);

  // Hide while there's nothing to log, or when we're already inside the
  // live/review flow.
  if (!session) return null;
  if (pathname.startsWith("/workout/")) return null;

  return (
    <Link
      href="/workout/live"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border border-[var(--accent)]/40 bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-fg)] shadow-lg transition hover:opacity-90"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
      </span>
      <span>Workout in progress · {formatDuration(session.performed_at)}</span>
    </Link>
  );
}

/** Elapsed time since `performed_at` as `H:MM:SS` / `M:SS`. */
function formatDuration(performedAt: string): string {
  const ms = Date.now() - new Date(performedAt).getTime();
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
