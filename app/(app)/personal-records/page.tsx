"use client";

/**
 * Personal Records — the "trophy case", now a two-view page.
 *
 * A segmented Lifts / Running control beside the title toggles between the
 * lifter's heaviest sets on each headline lift (Lifts) and their fastest
 * window over each standard running distance (Running). The selection is
 * URL-backed via `?view=lifts|running` so it survives reload and is
 * linkable; an invalid/missing value falls back to Lifts.
 *
 * Lifts:
 *   - Each card shows the heaviest set on a curated headline lift (weight +
 *     reps + date) alongside the current recency-weighted estimated 1RM.
 *     The gap between the two is the "ready for a max?" signal.
 *   - The "Customize" button (headline-lift selection modal) lives here.
 *
 * Running:
 *   - Each card shows the best time at a standard distance, pace, and the
 *     activity that set it. The distance set is fixed in backend Go, so
 *     there's nothing to customize — the Customize button is hidden here.
 *
 * Both views expose a per-card expandable progression chart. Data fetching
 * is TanStack Query, one query per view, lazy via `enabled` so switching
 * tabs doesn't refetch the inactive side and the active side caches across
 * switches.
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { listPersonalRecords, listRunningBestEfforts } from "@/lib/api";
import { HeadlineExercisesModal } from "@/components/headline-exercises-modal";
import { ViewSwitcher, type PRView } from "./_components/ViewSwitcher";
import { LiftsView } from "./_components/LiftsView";
import { RunningView } from "./_components/RunningView";

function parseView(raw: string | null): PRView {
  return raw === "running" ? "running" : "lifts";
}

export default function PersonalRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // One query per view, lazy via `enabled` so the inactive view is never
  // fetched and a quick back-and-forth reuses the cached snapshot.
  const liftsQuery = useQuery({
    queryKey: ["personal-records", "lifts"],
    queryFn: () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.reject(new Error("not authenticated"));
      }
      return listPersonalRecords(token);
    },
    enabled: view === "lifts",
  });

  const runningQuery = useQuery({
    queryKey: ["personal-records", "running"],
    queryFn: () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.reject(new Error("not authenticated"));
      }
      return listRunningBestEfforts(token);
    },
    enabled: view === "running",
  });

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">Personal Records</h1>
            <ViewSwitcher view={view} />
          </div>
          {view === "lifts" && (
            <button
              type="button"
              onClick={() => setCustomizeOpen(true)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium transition hover:text-[var(--foreground)]"
            >
              Customize
            </button>
          )}
        </div>
        <p className="text-xs text-[var(--muted)]">
          {view === "lifts"
            ? "Your heaviest set on each headline lift, alongside your current estimated 1RM for that exercise. A large gap is a cue to attempt a new max."
            : "Your fastest window over each standard distance, found across all your runs — including a fast segment inside a longer run."}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">
          {view === "lifts" ? (
            <LiftsView
              records={liftsQuery.data}
              isPending={liftsQuery.isPending}
              error={liftsQuery.error}
            />
          ) : (
            <RunningView
              bestEfforts={runningQuery.data}
              isPending={runningQuery.isPending}
              error={runningQuery.error}
            />
          )}
        </div>
      </div>

      {customizeOpen && (
        <HeadlineExercisesModal
          token={getToken() ?? ""}
          onSaved={() => {
            setCustomizeOpen(false);
            liftsQuery.refetch();
          }}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </main>
  );
}
