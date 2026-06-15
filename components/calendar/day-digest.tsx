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
  steps,
  exerciseMap,
  autoExpandId,
  onNavigateWorkout,
  onNavigateRun,
}: {
  date: Date; // the selected day
  events: CalendarEvent[]; // that day's events, already start-time sorted
  steps?: number | null; // that day's logged step count, if any
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
  // Steps are a daily total, not a timed event — they live outside the
  // event list (their own banner) but still count toward "is this day
  // empty?", so a day with only steps reads as logged rather than blank.
  const stepCount = steps != null && steps > 0 ? steps : null;

  return (
    <section className="mt-6 border-t border-[var(--border)] pt-6">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{longDate}</h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {countLine(events.length, runs, lifts, stepCount)}
        </p>
      </header>

      {events.length === 0 && stepCount == null ? (
        <EmptyState date={date} />
      ) : (
        <div className="flex flex-col gap-2">
          {stepCount != null && <StepsBanner steps={stepCount} />}
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
 * At-a-glance summary line, e.g. "2 activities · 1 run · 1 lift · 8,432
 * steps". Zero parts are omitted (no "0 runs"); every part is
 * singular/plural correct. When the only thing logged is steps, the line
 * leads with the step count instead of "0 activities".
 */
function countLine(total: number, runs: number, lifts: number, steps: number | null): string {
  const stepsPart = steps != null ? `${steps.toLocaleString("en-US")} steps` : null;
  if (total === 0) return stepsPart ?? "0 activities";

  const activityLabel = `${total} ${total === 1 ? "activity" : "activities"}`;
  const parts: string[] = [];
  if (runs > 0) parts.push(`${runs} ${runs === 1 ? "run" : "runs"}`);
  if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? "lift" : "lifts"}`);
  if (stepsPart) parts.push(stepsPart);
  return parts.length > 0 ? `${activityLabel} · ${parts.join(" · ")}` : activityLabel;
}

/**
 * The day's step total, rendered as a compact non-interactive banner that
 * sits above the timed-activity banners. Steps have no start time, so they
 * aren't part of the sorted event list — this is their home in the digest.
 */
function StepsBanner({ steps }: { steps: number }) {
  return (
    <div
      data-testid="steps-banner"
      className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm"
    >
      <FootprintsIcon />
      <span className="font-medium text-[var(--foreground)]">
        {steps.toLocaleString("en-US")} steps
      </span>
    </div>
  );
}

function FootprintsIcon() {
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
      className="text-[var(--muted)]"
    >
      <path d="M4 16c-.5-1.5-.5-3 0-5 .4-1.6 1.8-2.5 3-2 1 .4 1.3 1.8 1 3.5-.3 1.7-.5 3-1 4-.6 1.2-2.5 1-3-.5Z" />
      <path d="M5 20.5c0 .8.7 1.5 1.7 1.5s1.8-.7 1.8-1.5V19H5Z" />
      <path d="M20 11c.5-1.5.5-3 0-5-.4-1.6-1.8-2.5-3-2-1 .4-1.3 1.8-1 3.5.3 1.7.5 3 1 4 .6 1.2 2.5 1 3-.5Z" />
      <path d="M19 15.5c0 .8-.7 1.5-1.7 1.5s-1.8-.7-1.8-1.5V14H19Z" />
    </svg>
  );
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
