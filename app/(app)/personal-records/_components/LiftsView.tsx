"use client";

/**
 * The Lifts view: a grid of LiftPRCards from the /personal-records query.
 * Loading / error / empty states are simple inline messages matching the
 * original flat page's copy and muted styling.
 */

import type { PersonalRecord } from "@/lib/api";
import { LiftPRCard } from "./LiftPRCard";

export function LiftsView({
  records,
  isPending,
  error,
}: {
  records: PersonalRecord[] | undefined;
  isPending: boolean;
  error: Error | null;
}) {
  if (error) {
    return (
      <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
        {error.message}
      </div>
    );
  }

  if (isPending || !records) {
    return <p className="text-sm text-[var(--muted)]">Loading personal records…</p>;
  }

  if (records.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No headline lifts configured.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <LiftPRCard key={r.exercise_id} record={r} />
      ))}
    </div>
  );
}
