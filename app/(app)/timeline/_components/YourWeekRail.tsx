"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { listRunningSessions, listWorkouts } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import { Avatar } from "@/components/social/Avatar";
import { WeekBars } from "./WeekBars";
import {
  computeStreakDays,
  computeWeekStats,
  type DatedActivity,
  type WeekStats,
} from "./weekStats";

const HISTORY_DAYS = 35;

/**
 * The timeline's left "your week" rail: the viewer's profile, a consecutive-day
 * streak figure, a this-week sparkline (WeekBars), and run/lift week totals.
 * Fetches the viewer's recent workouts + runs over a ~35-day window (wide
 * enough for the streak), maps them to source-agnostic DatedActivity[], and
 * composes the pure weekStats helpers. On any fetch error it degrades to the
 * profile + zeros rather than erroring the page — the page guard + feed own
 * auth/redirect.
 */
export function YourWeekRail() {
  const { profile } = useProfile();
  const { formatDistance, unitLabel } = useDistanceUnit();
  const [acts, setActs] = useState<DatedActivity[] | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    const now = new Date();
    const since = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - HISTORY_DAYS,
    ).toISOString();
    const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
    Promise.all([
      listWorkouts(token, { since, until, limit: 100 })
        .then((p) => p.items)
        .catch(() => []),
      listRunningSessions(token, { since, until })
        .then((p) => p.activities)
        .catch(() => []),
    ])
      .then(([workouts, runs]) => {
        if (cancelled) return;
        const mapped: DatedActivity[] = [
          ...workouts.map((w) => ({ at: w.performed_at, kind: "lift" as const })),
          ...runs.map((r) => ({
            at: r.start_time,
            kind: "run" as const,
            distanceMeters: r.distance_meters,
          })),
        ];
        setActs(mapped);
      })
      .catch(() => {
        if (!cancelled) setActs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const now = new Date();
  const todayIndex = (now.getDay() + 6) % 7;
  const lifts = (acts ?? []).filter((a) => a.kind === "lift");
  const runs = (acts ?? []).filter((a) => a.kind === "run");
  const stats: WeekStats = computeWeekStats(lifts, runs, now);
  const streak = computeStreakDays(acts ?? [], now);

  return (
    <section
      aria-label="Your week"
      className="flex flex-col gap-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center gap-3">
        <Avatar url={profile?.avatar_url ?? null} name={profile?.display_name ?? "You"} size={44} />
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold text-[var(--foreground)]">
            {profile?.display_name ?? "You"}
          </p>
          <p className="text-xs text-[var(--muted)]">Your training week</p>
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl font-bold leading-none text-[var(--accent)] tabular-nums">
          {streak}
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          day streak
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          This week
        </h3>
        <WeekBars bars={stats.dayBars} todayIndex={todayIndex} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          value={String(stats.runCount)}
          label={stats.runCount === 1 ? "Run" : "Runs"}
          sub={stats.runMeters > 0 ? `${formatDistance(stats.runMeters)} ${unitLabel}` : undefined}
        />
        <StatTile
          value={String(stats.liftCount)}
          label={stats.liftCount === 1 ? "Lift" : "Lifts"}
        />
      </div>
    </section>
  );
}

function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <span className="font-display text-2xl font-bold leading-none text-[var(--foreground)] tabular-nums">
        {value}
      </span>
      <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </span>
      {sub && <span className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">{sub}</span>}
    </div>
  );
}
