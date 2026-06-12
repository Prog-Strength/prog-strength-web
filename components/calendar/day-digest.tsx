"use client";

import Link from "next/link";
import { RunBanner } from "@/components/calendar/run-banner";
import { WorkoutBanner } from "@/components/calendar/workout-banner";
import type { CalendarEvent } from "@/components/calendar/types";
import type { Exercise } from "@/lib/api";

/**
 * Expanded read-out of a single selected day's activities, shown beneath
 * the month grid. The grid surfaces terse pills; this panel unfolds the
 * same events into banners the user can expand inline or click through to
 * the full detail surface.
 */
export function DayDigest({
  date,
  events,
  exerciseMap,
  autoExpandId,
  onNavigateWorkout,
  onNavigateRun,
}: {
  date: Date; // the selected day
  events: CalendarEvent[]; // that day's events, already start-time sorted
  exerciseMap: Map<string, Exercise>;
  autoExpandId?: string | null; // id of the activity whose banner should default-open
  onNavigateWorkout: (workoutId: string) => void;
  onNavigateRun: (runId: string) => void;
}) {
  const longDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const lifts = events.filter((e) => e.kind === "workout").length;
  const runs = events.filter((e) => e.kind === "run").length;

  return (
    <section className="mt-6 border-t border-[var(--border)] pt-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{longDate}</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {countLine(events.length, runs, lifts)}
        </p>
      </header>

      {events.length === 0 ? (
        <EmptyState date={date} />
      ) : (
        <div className="flex flex-col gap-2">
          {/* Defensive sort: events should already arrive start-time
              ordered, but DayDigest re-sorts so it never depends on the
              caller getting it right. */}
          {[...events]
            .sort((a, b) => a.startMs - b.startMs)
            .map((ev) =>
              ev.kind === "workout" ? (
                // The `key` deliberately encodes whether this banner is the
                // auto-expand target. Banners hold their own open state
                // seeded from `defaultOpen`, so when `autoExpandId` changes
                // we need the banner to remount for `defaultOpen` to take
                // effect again — varying the key on the open/closed flag
                // forces that remount.
                <WorkoutBanner
                  key={`w-${ev.workout.id}-${ev.workout.id === autoExpandId ? "open" : "closed"}`}
                  workout={ev.workout}
                  exerciseMap={exerciseMap}
                  onNavigate={() => onNavigateWorkout(ev.workout.id)}
                  defaultOpen={ev.workout.id === autoExpandId}
                />
              ) : (
                <RunBanner
                  key={`r-${ev.run.id}-${ev.run.id === autoExpandId ? "open" : "closed"}`}
                  run={ev.run}
                  onNavigate={() => onNavigateRun(ev.run.id)}
                  defaultOpen={ev.run.id === autoExpandId}
                />
              ),
            )}
        </div>
      )}
    </section>
  );
}

/**
 * At-a-glance summary line, e.g. "2 activities · 1 run · 1 lift". Zero
 * parts are omitted (no "0 runs"); every part is singular/plural correct.
 */
function countLine(total: number, runs: number, lifts: number): string {
  const activityLabel = `${total} ${total === 1 ? "activity" : "activities"}`;
  const parts: string[] = [];
  if (runs > 0) parts.push(`${runs} ${runs === 1 ? "run" : "runs"}`);
  if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? "lift" : "lifts"}`);
  return parts.length > 0 ? `${activityLabel} · ${parts.join(" · ")}` : activityLabel;
}

function EmptyState({ date }: { date: Date }) {
  const shortDate = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return (
    <p className="text-sm text-[var(--muted)]">
      No activities on {shortDate}.{" "}
      {/* There's no dedicated create route — activity creation is a SOW
          non-goal — so the call-to-action links to the activities surface
          rather than a (nonexistent) "new activity" page. */}
      <Link
        href="/activities"
        className="font-medium text-[var(--accent)] transition hover:underline"
      >
        Plan one →
      </Link>
    </p>
  );
}
