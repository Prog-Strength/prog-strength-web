"use client";

import { useId, useState } from "react";
import { runFallbackName } from "@/app/(app)/running/_components/RunListRow";
import { hasMeaningfulName } from "@/components/workout-details";
import { RunDigest } from "@/components/calendar/run-digest";
import { WorkoutDigest } from "@/components/calendar/workout-digest";
import { PlannedAgenda, hasPlannedAgenda } from "@/components/calendar/planned-banner";
import { useDistanceUnit } from "@/lib/distance-unit-context";
import type { Exercise, PlannedWorkout, RunningSession, Workout } from "@/lib/api";

/**
 * The collapsed form of a planned session that's been completed and linked
 * to the logged session that fulfilled it. Where the calendar used to stack
 * a dashed planned banner on top of its near-identical logged banner, this
 * single row reads as the completed activity: the logged session's stats up
 * front, the same expand-to-digest the standalone logged banners offer, and
 * a footer that names the plan it closed out with a "View plan" disclosure.
 *
 * Two independent disclosures hang off the row:
 *   - the chevron (and `defaultOpen`) toggles the LOGGED session digest
 *     (splits / sets) — same inline detail a standalone logged banner shows;
 *   - "View plan" toggles the planned target (exercises / run target),
 *     reusing {@link PlannedAgenda} so it matches the planned banner exactly.
 * The body button navigates to the full logged-session detail surface.
 */
export function CompletedPlannedBanner({
  planned,
  logged,
  exerciseMap,
  defaultOpen = false,
  onNavigate,
}: {
  planned: PlannedWorkout;
  logged: { kind: "workout"; workout: Workout } | { kind: "run"; run: RunningSession };
  exerciseMap: Map<string, Exercise>;
  defaultOpen?: boolean;
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [planOpen, setPlanOpen] = useState(false);
  const digestId = useId();
  const planId = useId();
  const { unitLabel, formatDistance, formatPace } = useDistanceUnit();

  const isRun = logged.kind === "run";
  const start = isRun ? new Date(logged.run.start_time) : new Date(logged.workout.performed_at);
  const time = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  // Title prefers the plan's name (what the user scheduled, e.g.
  // "W7 D1 - Easy Run"); falls back to the logged session's own title.
  const loggedTitle = isRun
    ? logged.run.name?.trim() || runFallbackName(logged.run.start_time)
    : hasMeaningfulName(logged.workout.name)
      ? (logged.workout.name as string)
      : time;
  const title = planned.name?.trim() || loggedTitle;

  // Stats line reads from the LOGGED session — the thing that actually
  // happened — mirroring RunBanner / WorkoutBanner.
  const stats = isRun
    ? `${time} · ${formatDistance(logged.run.distance_meters)} ${unitLabel} · ${formatPace(
        logged.run.avg_pace_sec_per_km,
      )} /${unitLabel}`
    : (() => {
        const n = logged.workout.exercises.length;
        return `${time} · ${n} ${n === 1 ? "exercise" : "exercises"}`;
      })();

  const planHasAgenda = hasPlannedAgenda(planned);
  const ringColor = isRun
    ? "ring-[var(--discipline-run-dot)]"
    : "ring-[var(--discipline-lift-dot)]";

  return (
    <div
      role="group"
      data-testid="completed-planned-banner"
      className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onNavigate}
          className={`flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 ${ringColor} focus-visible:ring-inset md:gap-3 md:px-3 md:py-2.5`}
        >
          {/* Emerald rail marks this as a completed/fulfilled session,
              distinct from the accent/teal of a plain logged banner. */}
          <span
            aria-hidden="true"
            className="h-7 w-1 shrink-0 rounded-full bg-emerald-500 md:h-8 md:w-1.5"
          />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-[var(--foreground)] md:text-sm">
                {title}
              </span>
              <span className="shrink-0 rounded-full border border-emerald-500/50 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-400">
                Completed
              </span>
            </span>
            <span className="truncate text-[11px] tabular-nums text-[var(--muted)] md:text-xs">
              {stats}
            </span>
          </span>
        </button>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={digestId}
          aria-label={open ? "Collapse details" : "Expand details"}
          onClick={() => setOpen((o) => !o)}
          className={`flex shrink-0 items-center justify-center px-2 text-[var(--muted)] transition hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 ${ringColor} focus-visible:ring-inset md:px-3`}
        >
          <svg
            viewBox="0 0 24 24"
            width={16}
            height={16}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>

      {/* Footer: names the plan this session closed out, and offers the
          "View plan" disclosure when the plan has target detail to show. */}
      <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
        <CheckGlyph />
        <span>Completed planned session</span>
        {planHasAgenda && (
          <button
            type="button"
            aria-expanded={planOpen}
            aria-controls={planId}
            onClick={() => setPlanOpen((o) => !o)}
            className="ml-auto font-medium text-[var(--accent)] transition hover:underline"
          >
            {planOpen ? "Hide plan" : "View plan →"}
          </button>
        )}
      </div>

      {planOpen && planHasAgenda && (
        <div id={planId} className="border-t border-[var(--border)] px-3 py-2.5">
          <PlannedAgenda planned={planned} exerciseMap={exerciseMap} />
        </div>
      )}

      {open && (
        <div id={digestId} className="border-t border-[var(--border)] px-3 py-2.5">
          {isRun ? (
            <RunDigest run={logged.run} />
          ) : (
            <WorkoutDigest workout={logged.workout} exerciseMap={exerciseMap} />
          )}
        </div>
      )}
    </div>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-emerald-500"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
