"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  listPersonalRecords,
  type PersonalRecord,
} from "@/lib/api";
import { HeadlineExercisesModal } from "@/components/headline-exercises-modal";

/**
 * Personal Records — the "trophy case" view.
 *
 * Each card shows the lifter's heaviest set on a curated headline
 * lift (weight + rep count + date) alongside their current
 * recency-weighted estimated 1RM. The gap between the two is the
 * load-bearing signal:
 *
 *   - Estimated 1RM well above PR weight → time to test a max.
 *   - Estimated 1RM near or below PR weight → keep training first.
 *
 * Headline lifts the user has never trained still render — as
 * empty-state cards prompting them to log a session. The backend
 * curates the headline set so future mobile + web clients stay in
 * sync without either repo having to ship a config update.
 */
export default function PersonalRecordsPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PersonalRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  // Extracted as a callback so the customize modal can re-fire it on
  // save — the new selection changes which cards appear here. Reads
  // the token at call time rather than holding it in component state,
  // which would trigger the React 19 "no sync setState in effect"
  // lint rule when the initial-load effect tried to populate it.
  const refetch = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    listPersonalRecords(token)
      .then(setRecords)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-lg font-semibold tracking-tight">
            Personal Records
          </h1>
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium transition hover:text-[var(--foreground)]"
          >
            Customize
          </button>
        </div>
        <p className="text-xs text-[var(--muted)]">
          Your heaviest set on each headline lift, alongside your current
          estimated 1RM for that exercise. A large gap is a cue to attempt
          a new max.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-4xl">
          {error && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {records === null && !error && (
            <p className="text-sm text-[var(--muted)]">
              Loading personal records…
            </p>
          )}

          {records && records.length === 0 && (
            <p className="text-sm text-[var(--muted)]">
              No headline lifts configured.
            </p>
          )}

          {records && records.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {records.map((r) => (
                <PRCard key={r.exercise_id} record={r} />
              ))}
            </div>
          )}
        </div>
      </div>

      {customizeOpen && (
        <HeadlineExercisesModal
          token={getToken() ?? ""}
          onSaved={() => {
            setCustomizeOpen(false);
            refetch();
          }}
          onClose={() => setCustomizeOpen(false)}
        />
      )}
    </main>
  );
}

function PRCard({ record }: { record: PersonalRecord }) {
  const hasPR = record.weight !== null && record.workout_id !== null;

  // Gap between estimated 1RM and PR weight — when meaningfully
  // positive, surface a "ready for a new max?" hint. Threshold
  // chosen empirically: 5% gap is noticeable to a lifter; smaller
  // gaps fall inside session-to-session noise.
  const gap = useMemo(() => {
    if (!hasPR || record.current_estimated_1rm === null) return null;
    if (record.weight === null) return null;
    return record.current_estimated_1rm - record.weight;
  }, [hasPR, record.current_estimated_1rm, record.weight]);
  const gapPct =
    gap !== null && record.weight !== null && record.weight > 0
      ? (gap / record.weight) * 100
      : null;
  const readyForAttempt = gapPct !== null && gapPct >= 5;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="truncate text-sm font-semibold tracking-tight">
          {record.exercise_name}
        </h2>
        {readyForAttempt && (
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
            Time for a max?
          </span>
        )}
      </div>

      {hasPR ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatWeight(record.weight, record.unit)}
            <span className="ml-1.5 text-base font-normal text-[var(--muted)]">
              × {record.reps}
            </span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            Set on {formatDate(record.achieved_at)}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tracking-tight text-[var(--muted)]">
            —
          </p>
          <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
            No record yet
          </p>
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-3">
        <p className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
          Current estimated 1RM
        </p>
        <p className="mt-0.5 text-sm font-medium tabular-nums">
          {record.current_estimated_1rm === null
            ? "—"
            : formatWeight(
                record.current_estimated_1rm,
                record.estimated_1rm_unit,
              )}
          {gap !== null && Math.abs(gap) >= 1 && (
            <span
              className={`ml-2 text-xs ${
                gap > 0 ? "text-emerald-300" : "text-[var(--muted)]"
              }`}
            >
              {gap > 0 ? "+" : ""}
              {gap.toFixed(1)} vs PR
            </span>
          )}
        </p>
      </div>

      {hasPR && record.workout_id && (
        <Link
          href={`/workouts/${record.workout_id}`}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          View workout →
        </Link>
      )}
    </div>
  );
}

// --- helpers --------------------------------------------------------------

function formatWeight(value: number | null, unit: string | null): string {
  if (value === null || unit === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text} ${unit}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
