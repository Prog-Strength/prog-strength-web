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
import { PRLedger } from "./_components/PRLedger";
import { PRDetail } from "./_components/PRDetail";
import {
  summarizeReadiness,
  liftsByReadiness,
  deriveReadiness,
  STANDARD_DISTANCES,
  type RunningLedgerItem,
} from "./_components/readiness";

function parseView(raw: string | null): PRView {
  return raw === "running" ? "running" : "lifts";
}

export default function PersonalRecordsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseView(searchParams.get("view"));
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Selection is independent per tab so switching tabs preserves each side's
  // choice. Lifts default to the most-due tested lift (derived below);
  // running defaults to 5k (the always-projectable distance).
  const [selLift, setSelLift] = useState<string | null>(null);
  const [selRun, setSelRun] = useState<string>("5k");

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

  // Readiness counts for the Lifts header chrome. `summarizeReadiness` is a
  // plain function (not a hook), so computing it conditionally in render is
  // fine; null on Running or before the lifts data arrives.
  const liftsSummary =
    view === "lifts" && liftsQuery.data && liftsQuery.data.length > 0
      ? summarizeReadiness(liftsQuery.data)
      : null;

  // Running ledger rows: all 6 standard distances merged with best efforts.
  const runItems: RunningLedgerItem[] = STANDARD_DISTANCES.map((d) => ({
    key: d.key,
    label: d.label,
    best: runningQuery.data?.find((e) => e.distance_key === d.key) ?? null,
  }));

  // Default lift selection = most-due tested lift, DERIVED in render (not via
  // a set-state effect, to avoid the set-state-in-effect lint rule). Once the
  // user picks a row, `selLift` overrides.
  const rankedLifts = liftsQuery.data ? liftsByReadiness(liftsQuery.data) : [];
  const firstTested = rankedLifts.find((r) => deriveReadiness(r).hasPR) ?? null;
  const effectiveSelLift = selLift ?? firstTested?.exercise_id ?? null;
  const selLiftRecord = liftsQuery.data?.find((r) => r.exercise_id === effectiveSelLift) ?? null;

  // Active-view query state for the ledger.
  const activeQuery = view === "lifts" ? liftsQuery : runningQuery;
  const ledgerState = activeQuery.isPending ? "pending" : activeQuery.isError ? "error" : "ready";
  const errorMessage = activeQuery.error instanceof Error ? activeQuery.error.message : null;

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
        {liftsSummary && (
          <p className="text-xs tabular-nums text-[var(--muted)]">
            <span className="text-[var(--foreground)]">{liftsSummary.due}</span> due ·{" "}
            <span className="text-[var(--foreground)]">
              {liftsSummary.tested}/{liftsSummary.total}
            </span>{" "}
            tested
          </p>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px_1fr]">
            <PRLedger
              view={view}
              lifts={view === "lifts" ? liftsQuery.data : undefined}
              running={view === "running" ? runItems : undefined}
              state={ledgerState}
              errorMessage={errorMessage}
              selectedId={view === "lifts" ? effectiveSelLift : selRun}
              onSelect={view === "lifts" ? setSelLift : setSelRun}
            />
            <PRDetail
              view={view}
              liftRecord={view === "lifts" ? selLiftRecord : null}
              distanceKey={view === "running" ? selRun : null}
              distanceLabel={
                view === "running"
                  ? (STANDARD_DISTANCES.find((d) => d.key === selRun)?.label ?? null)
                  : null
              }
            />
          </div>
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
