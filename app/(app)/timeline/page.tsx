"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";
import { TimelineFeed } from "./_components/TimelineFeed";
import { YourWeekRail } from "./_components/YourWeekRail";
import { DiscoveryRail } from "./_components/DiscoveryRail";

/**
 * Timeline — a three-column training dashboard: a left "your week" rail
 * (streak + this-week stats), the center following feed of activity cards
 * (with reactions and comments), and a right discovery rail for finding
 * athletes to follow.
 *
 * Mirrors the activities/page.tsx shell: an outer Suspense wrapper over an
 * inner client component, a token guard that bounces signed-out users to
 * /login, and a thin header. The feed itself (fetch, pagination, empty /
 * error / loading / no-followers states) lives in <TimelineFeed>, which owns
 * its own 401 handling the same way the views under Activities do. The rails
 * are hidden below `lg`; on mobile the feed's own callouts carry the
 * discovery message.
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
        <h1 className="text-xl font-bold tracking-tight">Timeline</h1>
        <p className="text-xs text-[var(--muted)]">
          Your training and the athletes you follow — react, comment, and discover.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
          <aside className="hidden lg:block">
            <YourWeekRail />
          </aside>
          <div className="flex flex-col gap-4">
            <TimelineFeed />
          </div>
          <aside className="hidden lg:block">
            <DiscoveryRail />
          </aside>
        </div>
      </div>
    </main>
  );
}
