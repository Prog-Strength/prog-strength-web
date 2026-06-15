"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { TimelineFeed } from "./_components/TimelineFeed";

/**
 * Timeline — the reverse-chronological feed of the user's own training
 * activity (completed workouts, imported runs, lifting PRs, running best
 * efforts) with reactions and comments per post.
 *
 * Mirrors the activities/page.tsx shell: an outer Suspense wrapper over an
 * inner client component, a token guard that bounces signed-out users to
 * /login, and a thin header. The feed itself (fetch, pagination, empty /
 * error / loading states) lives in <TimelineFeed>, which owns its own 401
 * handling the same way the views under Activities do.
 */
export default function TimelinePage() {
  return (
    <Suspense fallback={null}>
      <TimelinePageInner />
    </Suspense>
  );
}

function TimelinePageInner() {
  const router = useRouter();

  // Token guard owns the redirect; <TimelineFeed> owns the data + its own
  // 401-on-fetch handling (and skips fetching when there's no token, so the
  // redirect races cleanly). Mirrors activities/page.tsx: the effect only
  // navigates, it never sets local state.
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-1 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Timeline</h1>
        <p className="text-xs text-[var(--muted)]">
          Your recent training, as it happens — react and comment on your own milestones.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <TimelineFeed />
        </div>
      </div>
    </main>
  );
}
