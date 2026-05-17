"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  listExercises,
  listWorkouts,
  type Exercise,
  type Workout,
  type WorkoutSet,
} from "@/lib/api";

/**
 * Workouts overview. Lists the user's recent sessions, filtered by a
 * client-side timeframe selection. Each row is collapsed by default
 * (date + duration + truncated notes) and expands to show the per-
 * exercise sets pulled from the workout payload.
 *
 * Data is fetched once on mount: workouts (auth'd) + exercises (public)
 * in parallel. Filtering is purely client-side — the API caps results
 * at 50 and the handler doesn't yet expose since/until query params,
 * so a power user with >50 workouts in 90 days could see gaps. Document
 * that as a known limit until it actually matters in production.
 */

type Timeframe = "7d" | "30d" | "90d" | "all";

const TIMEFRAMES: { id: Timeframe; label: string; days: number | null }[] = [
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "90d", label: "Last 90 days", days: 90 },
  { id: "all", label: "All", days: null },
];

export default function WorkoutsPage() {
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [exerciseMap, setExerciseMap] = useState<Map<string, Exercise>>(
    new Map(),
  );
  const [timeframe, setTimeframe] = useState<Timeframe>("30d");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    // Parallel fetch — neither depends on the other and the exercise
    // catalog is cacheable enough that we don't worry about it on
    // every navigation.
    Promise.all([listWorkouts(token), listExercises()])
      .then(([ws, es]) => {
        setWorkouts(ws);
        setExerciseMap(new Map(es.map((e) => [e.id, e])));
      })
      .catch((err: Error) => {
        // 401 from the API means the token expired or was revoked.
        // Surface a clean re-login flow rather than a raw error.
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  const filteredWorkouts = useMemo(() => {
    if (!workouts) return null;
    const days = TIMEFRAMES.find((t) => t.id === timeframe)?.days;
    if (days === null || days === undefined) return workouts;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return workouts.filter((w) => new Date(w.performed_at).getTime() >= cutoff);
  }, [workouts, timeframe]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Workouts</h1>
        <div className="flex flex-wrap gap-2">
          {TIMEFRAMES.map((tf) => {
            const active = tf.id === timeframe;
            return (
              <button
                key={tf.id}
                type="button"
                onClick={() => setTimeframe(tf.id)}
                className={`rounded-full px-3 py-1 text-xs transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && workouts === null && (
            <p className="text-sm text-[var(--muted)]">Loading workouts…</p>
          )}

          {filteredWorkouts && filteredWorkouts.length === 0 && (
            <EmptyState />
          )}

          {filteredWorkouts && filteredWorkouts.length > 0 && (
            <ul className="flex flex-col gap-2">
              {filteredWorkouts.map((w) => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  expanded={expanded.has(w.id)}
                  onToggle={() => toggleExpanded(w.id)}
                  exerciseMap={exerciseMap}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">No workouts in this timeframe</p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Log a session from the chat by describing it in plain language —
        try &quot;log Tuesday&apos;s push day&quot;.
      </p>
    </div>
  );
}

function WorkoutRow({
  workout,
  expanded,
  onToggle,
  exerciseMap,
}: {
  workout: Workout;
  expanded: boolean;
  onToggle: () => void;
  exerciseMap: Map<string, Exercise>;
}) {
  return (
    <li className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--surface-2)]"
      >
        <ChevronIcon expanded={expanded} />
        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
          {/* Primary line: the workout's name when the user (or their
              coach's program) set one explicitly. When the name is the
              API's auto-generated "Workout - <date>" fallback, that
              text is just a tautology of the timestamp below it, so we
              use the date as the primary instead. */}
          <p className="truncate text-sm font-medium">
            {hasMeaningfulName(workout.name)
              ? workout.name
              : formatDate(workout.performed_at)}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {hasMeaningfulName(workout.name) &&
              `${formatDate(workout.performed_at)} · `}
            {formatDuration(workout.performed_at, workout.ended_at ?? null)} ·{" "}
            {workout.exercises.length}{" "}
            {workout.exercises.length === 1 ? "exercise" : "exercises"}
          </p>
          {workout.notes && (
            <p className="truncate text-xs text-[var(--muted)]">
              {workout.notes}
            </p>
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-[var(--border)] px-4 py-3">
          {workout.notes && (
            <p className="mb-3 whitespace-pre-wrap text-sm">{workout.notes}</p>
          )}
          <ul className="flex flex-col gap-3">
            {[...workout.exercises]
              .sort((a, b) => a.order - b.order)
              .map((we, i) => (
                <li key={i}>
                  <p className="text-sm font-medium">
                    {exerciseMap.get(we.exercise_id)?.name ?? we.exercise_id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {formatSets(we.sets)}
                  </p>
                  {we.notes && (
                    <p className="mt-1 text-xs italic text-[var(--muted)]">
                      {we.notes}
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-[var(--muted)] transition-transform ${
        expanded ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

// --- formatting helpers ----------------------------------------------------

/**
 * Whether the workout's name field carries information beyond what the
 * date/time already conveys.
 *
 * The API auto-generates `Workout - Jan 02, 2026` for create requests
 * with no explicit name — those literally restate the timestamp the
 * row already has. The user wants to surface real names from coached
 * programs ("Upper 1", "Push Day A") as the primary label; the
 * auto-generated ones should fall back to the date/time instead.
 *
 * The check is a prefix heuristic — a user-written workout that starts
 * with "Workout - " would collide, but that's unlikely in practice and
 * the cost is just showing the date-fallback for that one entry.
 */
function hasMeaningfulName(name: string | undefined): name is string {
  return !!name && !name.startsWith("Workout - ");
}


/**
 * Friendly date label. For very recent dates we use "Today" / "Yesterday"
 * since those are what lifters actually think in; older entries use the
 * full month + day so the timestamp is unambiguous.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThat.getTime()) / (24 * 60 * 60 * 1000),
  );

  let dayLabel: string;
  if (dayDiff === 0) dayLabel = "Today";
  else if (dayDiff === 1) dayLabel = "Yesterday";
  else if (dayDiff > 1 && dayDiff < 7)
    dayLabel = d.toLocaleDateString("en-US", { weekday: "long" });
  else
    dayLabel = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
    });

  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dayLabel}, ${time}`;
}

/**
 * Duration as `Xh Ym` or `Mm` when under an hour. Returns an em-dash
 * for in-progress workouts (no ended_at recorded).
 */
function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Sets summary. Collapses runs of identical reps×weight into "n× <reps>
 * × <weight><unit>" so a flat 5×5×185lb across three sets renders as
 * "3 × 5 × 185 lb" instead of repeating three times. Varied set ranges
 * stay listed out. Bodyweight (weight=0) shows just the rep count.
 */
function formatSets(sets: WorkoutSet[]): string {
  if (sets.length === 0) return "";

  // Compress adjacent identical sets — most common pattern in linear
  // progressions and gives a much tighter row than spelling each out.
  const groups: { count: number; set: WorkoutSet }[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && setsEqual(last.set, s)) {
      last.count += 1;
    } else {
      groups.push({ count: 1, set: s });
    }
  }

  return groups.map((g) => {
    const setPart =
      g.set.weight === 0
        ? `${g.set.reps}`
        : `${g.set.reps} × ${formatWeight(g.set.weight)} ${g.set.unit}`;
    return g.count > 1 ? `${g.count} × ${setPart}` : setPart;
  }).join(", ");
}

function setsEqual(a: WorkoutSet, b: WorkoutSet): boolean {
  return a.reps === b.reps && a.weight === b.weight && a.unit === b.unit;
}

function formatWeight(w: number): string {
  // Strip trailing .0 for whole-number weights so "185" reads cleaner
  // than "185.0", but preserve the decimal for half-plate increments.
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}
