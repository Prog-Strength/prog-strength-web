"use client";

import { useState } from "react";
import type { Exercise, Workout } from "@/lib/api";
import { WorkoutDurationChart } from "@/components/workout-duration-chart";
import { WorkoutVolumeChart } from "@/components/workout-volume-chart";
import { MuscleGroupRadarChart } from "@/components/muscle-group-radar-chart";

/**
 * Owns the top-of-page analytics card on the Workouts page: the card
 * border + padding, a shared summary header (Total Time / Sessions /
 * PRs computed once from the same workouts array), and a three-view
 * icon switcher (Time lifting is the default). The actual chart drawing
 * is delegated to the three sibling charts — duration, volume, and the
 * muscle-group radar — each of which is deliberately chrome-less so
 * they slot under this one set of totals.
 *
 * Purely presentational. The workouts array, catalog, display unit, the
 * timeframe's `days`, and the truncation flags are passed in by the page
 * so a single fetch hydrates both this card and the paginated list below.
 */

type View = "time" | "volume" | "muscle";

export function WorkoutsAnalytics({
  workouts,
  exercises,
  displayUnit,
  days,
  truncated,
  fetchLimit,
}: {
  // `null` while the parent is still loading. Empty array = no
  // workouts in the window (each chart renders its own empty state).
  workouts: Workout[] | null;
  // The shared exercise catalog, forwarded to the radar so it can map
  // each WorkoutExercise to its muscle groups.
  exercises: Exercise[];
  // The unit weights are converted toward for the volume view.
  displayUnit: "lb" | "kg";
  // Days back from now this window covers, or null for "all".
  days: number | null;
  // True when the parent's fetch hit `fetchLimit` and may have more.
  truncated: boolean;
  fetchLimit: number;
}) {
  const [view, setView] = useState<View>("time");

  // Same minute logic as the duration chart's summarize(): completed
  // sessions only, ignoring non-positive / non-finite spans.
  let totalMinutes = 0;
  let openWorkouts = 0;
  for (const w of workouts ?? []) {
    if (!w.ended_at) {
      openWorkouts++;
      continue;
    }
    const durationMs = new Date(w.ended_at).getTime() - new Date(w.performed_at).getTime();
    if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
    totalMinutes += durationMs / 60_000;
  }
  const sessionCount = workouts?.length ?? 0;
  const prCount = workouts?.reduce((s, w) => s + w.personal_records_set.length, 0) ?? 0;

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
      <header className="flex items-baseline gap-8">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Total Time
          </p>
          <p className="mt-0.5 text-2xl font-semibold tracking-tight tabular-nums">
            {formatHours(totalMinutes)}
            {openWorkouts > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">
                + {openWorkouts} open
              </span>
            )}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            Sessions
          </p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums">{sessionCount}</p>
        </div>
        {prCount > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              PRs
            </p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums">{prCount}</p>
          </div>
        )}
      </header>

      <div className="mt-4 flex gap-2">
        <ViewButton label="Time lifting" active={view === "time"} onClick={() => setView("time")}>
          <ClockIcon />
        </ViewButton>
        <ViewButton label="Volume" active={view === "volume"} onClick={() => setView("volume")}>
          <DumbbellIcon />
        </ViewButton>
        <ViewButton label="Body parts" active={view === "muscle"} onClick={() => setView("muscle")}>
          <RadarIcon />
        </ViewButton>
      </div>

      {view === "time" && (
        <WorkoutDurationChart
          workouts={workouts}
          days={days}
          truncated={truncated}
          fetchLimit={fetchLimit}
        />
      )}
      {view === "volume" && (
        <WorkoutVolumeChart
          workouts={workouts}
          days={days}
          displayUnit={displayUnit}
          truncated={truncated}
          fetchLimit={fetchLimit}
        />
      )}
      {view === "muscle" && <MuscleGroupRadarChart workouts={workouts} exercises={exercises} />}
    </section>
  );
}

function ViewButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`rounded-md px-2 py-1 transition ${
        active
          ? "bg-[var(--accent)] text-[var(--accent-fg)]"
          : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
      }`}
    >
      {children}
    </button>
  );
}

// --- icons --------------------------------------------------------
// Hand-rolled inline SVGs in the same idiom as the page's existing
// glyphs (viewBox 0 0 24 24, currentColor stroke). No icon library.

function ClockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function DumbbellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6.5 6.5v11" />
      <path d="M3.5 9v6" />
      <path d="M17.5 6.5v11" />
      <path d="M20.5 9v6" />
      <path d="M6.5 12h11" />
    </svg>
  );
}

function RadarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </svg>
  );
}

// --- helpers ------------------------------------------------------

function formatHours(minutes: number): string {
  if (minutes <= 0) return "0h";
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
