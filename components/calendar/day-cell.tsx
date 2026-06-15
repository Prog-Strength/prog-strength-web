"use client";

import { hasMeaningfulName } from "@/components/workout-details";
import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";
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
  onSelectPlanned,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
  onSelectDay: () => void;
  onSelectWorkout: (id: string) => void;
  onSelectRun: (id: string) => void;
  onSelectPlanned: (id: string) => void;
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
  // Tighter padding / smaller min-height on phone widths so the 6×7 grid
  // fits a portrait viewport without forcing the page to scroll past the
  // calendar before anything else is visible. Desktop sizing (≥md) is
  // unchanged from the original — only the small-screen ceiling moves.
  const baseClasses =
    "flex min-h-[60px] cursor-pointer flex-col gap-0.5 rounded-md border p-1 transition hover:border-[var(--accent)]/50 md:min-h-[88px] md:gap-1 md:p-1.5";
  const borderClasses = isToday ? "border-[var(--accent)]" : "border-[var(--border)]";
  const fillClasses = isSelected ? "bg-[var(--accent)]/10" : "bg-[var(--surface)]";
  const labelClasses = inMonth ? "text-[var(--foreground)]" : "text-[var(--muted)] opacity-60";

  return (
    <div
      className={`${baseClasses} ${borderClasses} ${fillClasses}`}
      aria-label={ariaLabelFor(day, events)}
      onClick={onSelectDay}
    >
      <div
        className={`px-0.5 text-[11px] font-medium leading-none md:px-1 md:text-xs ${labelClasses}`}
      >
        {day.getDate()}
      </div>
      <div className="flex flex-col gap-0.5 md:gap-1">
        {visible.map((ev) =>
          ev.kind === "workout" ? (
            <WorkoutPill
              key={`w-${ev.workout.id}`}
              workout={ev.workout}
              onClick={() => onSelectWorkout(ev.workout.id)}
            />
          ) : ev.kind === "run" ? (
            <RunPill key={`r-${ev.run.id}`} run={ev.run} onClick={() => onSelectRun(ev.run.id)} />
          ) : (
            <PlannedPill
              key={`p-${ev.planned.id}`}
              planned={ev.planned}
              onClick={() => onSelectPlanned(ev.planned.id)}
            />
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
            className="rounded px-0.5 text-left text-[9px] leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] focus:text-[var(--foreground)] focus:outline-none md:px-1 md:text-[10px]"
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
  const plans = events.filter((e) => e.kind === "planned").length;
  const parts: string[] = [];
  if (lifts > 0) parts.push(`${lifts} ${lifts === 1 ? "workout" : "workouts"}`);
  if (runs > 0) parts.push(`${runs} ${runs === 1 ? "run" : "runs"}`);
  if (plans > 0) parts.push(`${plans} planned`);
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
      className="truncate rounded bg-[var(--accent)] px-1 py-px text-left text-[9px] font-medium leading-tight text-[var(--accent-fg)] transition hover:opacity-90 md:px-1.5 md:py-0.5 md:text-[10px] md:leading-normal"
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
      className="truncate rounded bg-teal-500/20 px-1 py-px text-left text-[9px] font-medium leading-tight text-teal-300 transition hover:bg-teal-500/30 md:px-1.5 md:py-0.5 md:text-[10px] md:leading-normal"
    >
      {label}
    </button>
  );
}

/**
 * A forward-looking planned workout. Deliberately distinct from the
 * logged WorkoutPill/RunPill: a dashed outline (rather than a solid fill)
 * signals "intended, not yet done". Status decorates it — a check for
 * completed, a strikethrough+muted treatment for skipped — and a synced
 * Google event shows a small sync glyph. Clicking selects the day and
 * scrolls the digest in, same as the logged pills.
 */
function PlannedPill({ planned, onClick }: { planned: PlannedWorkout; onClick: () => void }) {
  const time = new Date(planned.scheduled_start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = planned.name?.trim() ? planned.name : time;
  const completed = planned.status === "completed";
  const skipped = planned.status === "skipped";
  const synced = planned.google_sync_status === "synced";

  // Status drives the dashed-outline tint. Planned: accent. Completed:
  // solid-ish success. Skipped: muted + strikethrough.
  const tone = completed
    ? "border-emerald-500/60 text-emerald-300"
    : skipped
      ? "border-[var(--border)] text-[var(--muted)] line-through"
      : "border-[var(--accent)]/60 text-[var(--accent)]";

  return (
    <button
      type="button"
      data-testid="planned-pill"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${time} · Planned${planned.name ? ` · ${planned.name}` : ""}${
        completed ? " (completed)" : skipped ? " (skipped)" : ""
      }`}
      className={`flex items-center gap-1 truncate rounded border border-dashed bg-transparent px-1 py-px text-left text-[9px] font-medium leading-tight transition hover:bg-[var(--surface-2)] md:px-1.5 md:py-0.5 md:text-[10px] md:leading-normal ${tone}`}
    >
      {completed ? <CheckGlyph /> : skipped ? null : <ClockGlyph />}
      <span className="truncate">{label}</span>
      {synced && <SyncGlyph />}
    </button>
  );
}

function ClockGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={9}
      height={9}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function CheckGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={9}
      height={9}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function SyncGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={9}
      height={9}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ml-auto shrink-0 opacity-80"
    >
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
