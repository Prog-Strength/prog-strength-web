"use client";

/**
 * The Running view: a grid mirroring the Lifts grid that always renders all
 * six standard distances in display order. Distances the user has achieved
 * are filled from the /running/best-efforts query (matched by
 * `distance_key`); the rest render as empty-state cards, mirroring the
 * lift-side "NO RECORD YET" placeholder.
 *
 * The canonical six live here as a local const. The API returns the same
 * `distance_label` values, but defining the set on the client lets the
 * view render empty-state cards for distances the API omits (the user has
 * never covered) without a round trip.
 */

import type { RunningBestEffort } from "@/lib/api";
import { RunningPRCard } from "./RunningPRCard";

/** The fixed v1 distance set, shortest first — matches the API's keys and
 * `distance_label` values (SOW §Standard Distance Set). */
const STANDARD_DISTANCES: { key: string; label: string }[] = [
  { key: "1mi", label: "1 Mile" },
  { key: "2mi", label: "2 Mile" },
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half_marathon", label: "Half Marathon" },
  { key: "marathon", label: "Marathon" },
];

export function RunningView({
  bestEfforts,
  isPending,
  error,
}: {
  bestEfforts: RunningBestEffort[] | undefined;
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

  if (isPending || !bestEfforts) {
    return <p className="text-sm text-[var(--muted)]">Loading running best efforts…</p>;
  }

  const byKey = new Map(bestEfforts.map((e) => [e.distance_key, e]));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STANDARD_DISTANCES.map((d) => (
        <RunningPRCard
          key={d.key}
          distanceKey={d.key}
          distanceLabel={d.label}
          entry={byKey.get(d.key) ?? null}
        />
      ))}
    </div>
  );
}
