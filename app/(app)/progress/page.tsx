"use client";

/**
 * Progress page — pick a movement pattern, pick a timeframe, see whether
 * you're actually getting stronger.
 *
 * The chart's Y-axis is *normalized* estimated 1RM: each per-workout data
 * point is expressed as a fraction of that exercise's current
 * recency-weighted baseline (1.0 = at current capability). That
 * normalization is what lets disparate exercises within a movement pattern
 * — barbell bench, dumbbell bench, cable fly — share a single axis.
 *
 * This shell owns URL state (`?pattern=&days=`), the two TanStack Query
 * fetches (progression + raw workouts), and routing between the loading /
 * empty / error / populated states. Each render concern lives in its own
 * `_components/` file.
 */

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { clearToken, getToken } from "@/lib/auth";
import {
  getRunningMaxEffortSummary,
  listProgression,
  listWorkouts,
  type MuscleGroupProgressionPoint,
  type RunningMaxEffortSummary,
} from "@/lib/api";
import {
  MovementPatternFilter,
  type Days,
  type Pattern,
} from "./_components/MovementPatternFilter";
import { StatCards } from "./_components/StatCards";
import { ProgressChart } from "./_components/ProgressChart";
import { TablesSection } from "./_components/TablesSection";
import { EXERCISE_COLORS } from "./_components/shared";

const VALID_PATTERNS: Pattern[] = ["push", "pull", "legs", "core", "all"];
const VALID_DAYS: Days[] = [30, 60, 90];

function parsePattern(raw: string | null): Pattern {
  return VALID_PATTERNS.includes(raw as Pattern) ? (raw as Pattern) : "all";
}

function parseDays(raw: string | null): Days {
  const n = Number(raw);
  return VALID_DAYS.includes(n as Days) ? (n as Days) : 90;
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof Error && err.message.toLowerCase().includes("401");
}

export default function ProgressPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pattern = parsePattern(searchParams.get("pattern"));
  const days = parseDays(searchParams.get("days"));

  // Compute the window once per (days) selection. until = now, since = now
  // - days. Memoized off `days` (not a fresh Date each render) so the query
  // keys stay stable across re-renders and the cache survives toggles.
  const { sinceISO, untilISO } = useMemo(() => {
    const until = new Date();
    const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);
    return { sinceISO: since.toISOString(), untilISO: until.toISOString() };
  }, [days]);

  const progressionQuery = useQuery({
    queryKey: ["progression", pattern, days],
    queryFn: () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.reject(new Error("not authenticated"));
      }
      return listProgression(token, { movementPattern: pattern }, sinceISO, untilISO);
    },
    staleTime: 60_000,
  });

  const workoutsQuery = useQuery({
    queryKey: ["workouts", sinceISO, untilISO],
    queryFn: () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.reject(new Error("not authenticated"));
      }
      return listWorkouts(token, { since: sinceISO, until: untilISO, limit: 100 });
    },
    staleTime: 60_000,
  });

  // Running max-effort summary — used only to pick which distance the
  // "Running max-effort estimates" entry links into. Kept lightweight and
  // non-blocking: a failure here just falls back to the 5K link.
  const maxEffortQuery = useQuery({
    queryKey: ["running-max-effort-summary"],
    queryFn: () => {
      const token = getToken();
      if (!token) {
        router.replace("/login");
        return Promise.reject(new Error("not authenticated"));
      }
      return getRunningMaxEffortSummary(token);
    },
    staleTime: 60_000,
  });

  // 401 on either query bounces to /login, clearing the dead token first.
  // Run as an effect (not in render) so navigation/token mutation stays out
  // of the render phase.
  const queryError = progressionQuery.error ?? workoutsQuery.error;
  useEffect(() => {
    if (queryError && isUnauthorized(queryError)) {
      clearToken();
      router.replace("/login");
    }
  }, [queryError, router]);

  const progression = progressionQuery.data ?? null;
  const workouts = workoutsQuery.data?.items ?? [];

  // exercise_id → color in exercise_baselines order, stable per render so
  // the chart lines, legend, table dots, and tooltip all agree.
  const exerciseColors = useMemo(() => {
    const map = new Map<string, string>();
    progression?.exercise_baselines.forEach((b, i) => {
      map.set(b.exercise_id, EXERCISE_COLORS[i % EXERCISE_COLORS.length]);
    });
    return map;
  }, [progression]);

  // Best session = highest normalized point in the window (the most
  // motivating absolute number on the page).
  const bestPoint = useMemo<MuscleGroupProgressionPoint | null>(() => {
    if (!progression) return null;
    return progression.points.reduce<MuscleGroupProgressionPoint | null>(
      (acc, p) => (acc === null || p.normalized_max > acc.normalized_max ? p : acc),
      null,
    );
  }, [progression]);

  // Pick the distance the entry links into: prefer the one with an actual
  // logged best (more data behind it), tie-broken by the slowest/longest
  // actual best (the most-run / most-meaningful effort), else the first
  // distance that has any estimate, else "5k".
  const featuredDistanceKey = useMemo(
    () => pickFeaturedDistance(maxEffortQuery.data),
    [maxEffortQuery.data],
  );

  const errorMessage =
    queryError && !isUnauthorized(queryError) && queryError instanceof Error
      ? queryError.message
      : null;

  const isLoading = progressionQuery.isPending && !progression;
  const isEmpty = progression !== null && progression.points.length === 0;

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex flex-col gap-4 border-b border-[var(--border)] px-6 py-4">
        <h1 className="text-lg font-semibold tracking-tight">Progress</h1>
        <MovementPatternFilter pattern={pattern} days={days} />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {errorMessage && (
            <div className="mb-4 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {errorMessage}
            </div>
          )}

          {isLoading && <p className="text-sm text-[var(--muted)]">Loading progression…</p>}

          {isEmpty && (
            <EmptyHint
              title={
                pattern === "all"
                  ? "No sessions in this window"
                  : `No ${pattern} sessions in this window`
              }
              body="Log a few sessions in this movement pattern via chat and come back, or extend the timeframe to look further back."
            />
          )}

          {progression && progression.points.length > 0 && (
            <div className="flex flex-col gap-4">
              <StatCards aggregate={progression.aggregate} bestPoint={bestPoint} />
              <ProgressChart
                points={progression.points}
                exerciseBaselines={progression.exercise_baselines}
                perExerciseTrends={progression.per_exercise_trends}
                muscleGroupsIncluded={progression.filter.muscle_groups_included}
                exerciseColors={exerciseColors}
              />
              <TablesSection
                points={progression.points}
                workouts={workouts}
                exerciseBaselines={progression.exercise_baselines}
                exerciseColors={exerciseColors}
              />
            </div>
          )}

          {/* Running max-effort estimates — a single labeled entry into the
              detail view, so this strength-focused page stays uncluttered.
              Always rendered (independent of the strength sections above). */}
          {!isLoading && <RunningMaxEffortEntry distanceKey={featuredDistanceKey} />}
        </div>
      </div>
    </main>
  );
}

/**
 * Choose which distance the running entry deep-links into. Distances with
 * an actual logged best win (they carry the most data); among those we
 * take the longest actual best as the "most-run" proxy. Failing any actual
 * best, the first distance that has an estimate; failing everything, "5k".
 */
function pickFeaturedDistance(summary: RunningMaxEffortSummary | undefined): string {
  if (!summary || summary.distances.length === 0) return "5k";
  const withActual = summary.distances.filter((d) => d.actual_best_seconds != null);
  if (withActual.length > 0) {
    return withActual.reduce((best, d) =>
      (d.actual_best_seconds ?? 0) > (best.actual_best_seconds ?? 0) ? d : best,
    ).distance_key;
  }
  const withEstimate = summary.distances.find((d) => d.estimate_seconds != null);
  return withEstimate?.distance_key ?? "5k";
}

function RunningMaxEffortEntry({ distanceKey }: { distanceKey: string }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-sm font-semibold tracking-tight">Running max-effort estimates</h2>
      <Link
        href={`/progress/running/${distanceKey}`}
        className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition hover:border-[var(--accent)]/50"
      >
        <span className="flex flex-col">
          <span className="text-sm font-medium text-[var(--foreground)]">
            See your projected race times
          </span>
          <span className="text-xs text-[var(--muted)]">
            Estimated max-effort times across standard distances, with confidence bands.
          </span>
        </span>
        <span className="text-sm text-[var(--accent)]">→</span>
      </Link>
    </section>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{body}</p>
    </div>
  );
}
