"use client";

import { hasMeaningfulName } from "@/components/workout-details";
import type { RunningSession, Workout } from "@/lib/api";
import type { CalendarEvent } from "@/components/calendar/types";

/**
 * One day cell of the month grid, plus the pills it stacks inside. Pulled
 * out of page.tsx so the page component stays focused on data wiring; the
 * click model and visual-state classes are unchanged.
 */

// Three pills fit comfortably and cover the realistic case of a morning
// run plus two lifts (or vice versa). Anything more rolls into "+N more"
// to keep cells from growing tall enough to deform the grid.
const MAX_VISIBLE_PILLS = 3;

export function DayCell({
  day,
  inMonth,
  isToday,
  isSelected,
  events,
  onSelectDay,
  onSelectWorkout,
  onSelectRun,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
  onSelectDay: () => void;
  onSelectWorkout: (id: string) => void;
  onSelectRun: (id: string) => void;
}) {
  const visible = events.slice(0, MAX_VISIBLE_PILLS);
  const hiddenCount = events.length - visible.length;

  // Cell skeleton: every cell has a fixed minimum height so the grid
  // rows stay visually balanced even when a day has no events. The
  // accent ring on today's cell stays inside the border to avoid
  // shifting any adjacent cells.
  //
  // Two independent visual axes stack here. "Today" gets an accent
  // border/ring; "selected" gets a filled accent background. They're
  // distinct so a selected-but-not-today day and today-but-not-selected
  // day read differently, and both at once (filled bg + accent border)
  // is unambiguous. Hover adds a faint accent border so cells feel
  // clickable without committing to a state color.
  const baseClasses =
    "flex min-h-[88px] cursor-pointer flex-col gap-1 rounded-md border p-1.5 transition hover:border-[var(--accent)]/50";
  const borderClasses = isToday ? "border-[var(--accent)]" : "border-[var(--border)]";
  const fillClasses = isSelected ? "bg-[var(--accent)]/10" : "bg-[var(--surface)]";
  const labelClasses = inMonth ? "text-[var(--foreground)]" : "text-[var(--muted)] opacity-60";

  return (
    <div
      className={`${baseClasses} ${borderClasses} ${fillClasses}`}
      aria-label={ariaLabelFor(day, events)}
      onClick={onSelectDay}
    >
      <div className={`px-1 text-xs font-medium ${labelClasses}`}>{day.getDate()}</div>
      <div className="flex flex-col gap-1">
        {visible.map((ev) =>
          ev.kind === "workout" ? (
            <WorkoutPill
              key={`w-${ev.workout.id}`}
              workout={ev.workout}
              onClick={() => onSelectWorkout(ev.workout.id)}
            />
          ) : (
            <RunPill key={`r-${ev.run.id}`} run={ev.run} onClick={() => onSelectRun(ev.run.id)} />
          ),
        )}
        {hiddenCount > 0 && (
          // Selects the day (and scrolls the digest in) so the user can see
          // the events that didn't fit as pills. Its own button so a click
          // here doesn't read as a stray whitespace click.
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDay();
            }}
            className="rounded px-1 text-left text-[10px] text-[var(--muted)] transition hover:text-[var(--foreground)] focus:text-[var(--foreground)] focus:outline-none"
          >
            +{hiddenCount} more
          </button>
        )}
      </div>
    </div>
  );
}

function ariaLabelFor(day: Date, events: CalendarEvent[]): string {
  const dateLabel = day.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (events.length === 0) return dateLabel;
  const lifts = events.filter((e) => e.kind === "workout").length;
  const runs = events.filter((e) => e.kind === "run").length;
  const parts: string[] = [];
  if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? "workout" : "workouts"}`);
  if (runs > 0) parts.push(`${runs} ${runs === 1 ? "run" : "runs"}`);
  return `${dateLabel}, ${parts.join(", ")}`;
}

function WorkoutPill({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const time = new Date(workout.performed_at).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  // Prefer the user-set workout name (e.g., "Upper 1" from a coached
  // program) as the pill label, since the name is the primary thing a
  // lifter wants to index on. The API auto-generates "Workout - <date>"
  // when no name was set; in that case the date is redundant on a
  // calendar cell so we fall back to the start time instead.
  const named = hasMeaningfulName(workout.name);
  const label = named ? (workout.name as string) : time;
  return (
    <button
      type="button"
      // stopPropagation so selecting this lift's digest banner doesn't also
      // fire the cell's whitespace-click (which would clear the auto-expand).
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={named ? `${time} · ${workout.name}` : time}
      className="truncate rounded bg-[var(--accent)] px-1.5 py-0.5 text-left text-[10px] font-medium text-[var(--accent-fg)] transition hover:opacity-90"
    >
      {label}
    </button>
  );
}

/**
 * Distinct from `WorkoutPill` by color (teal vs accent) so a stacked
 * run + lift reads as two different things at a glance, not just two
 * sessions of the same kind. Clicking selects the day and auto-expands
 * this run's banner in the digest below the grid.
 */
function RunPill({ run, onClick }: { run: RunningSession; onClick: () => void }) {
  const time = new Date(run.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = run.name?.trim() ? run.name : time;
  return (
    <button
      type="button"
      // stopPropagation so selecting this run's digest banner doesn't also
      // fire the cell's whitespace-click (which would clear the auto-expand).
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${time} · Run${run.name ? ` · ${run.name}` : ""}`}
      className="truncate rounded bg-teal-500/20 px-1.5 py-0.5 text-left text-[10px] font-medium text-teal-300 transition hover:bg-teal-500/30"
    >
      {label}
    </button>
  );
}
