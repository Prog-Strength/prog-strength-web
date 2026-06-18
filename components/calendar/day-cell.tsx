"use client";

import { hasMeaningfulName } from "@/components/workout-details";
import type { PlannedWorkout, RunningSession, Workout } from "@/lib/api";
import type { CalendarEvent } from "@/components/calendar/types";
import { disciplineOf, type Discipline } from "@/components/calendar/derivations";
import { activityColors } from "@/lib/activity-colors";

/**
 * One day cell of the `true-month-grid` month grid, plus the pills it stacks
 * inside. Cells are compact and uniform and sit flush inside the single
 * bordered grid (the grid container draws the surrounding hairline; each cell
 * carries a left hairline so the columns read as ruled). Colour is frugal:
 * violet (`--accent`) marks ONLY today and the selected cell; run vs lift is
 * carried by the cool per-discipline tonal hues as a left-bar + tint, so an
 * activity never reads as "today".
 */

// Three pills fit comfortably and cover the realistic case of a morning
// run plus two lifts (or vice versa). Anything more rolls into "+N more"
// to keep cells from growing tall enough to deform the grid.
const MAX_VISIBLE_PILLS = 3;

// Shared chip skeleton + per-discipline "done" tone, sourced from the design
// tokens so run vs lift read as distinct cool hues on dark, each with a tonal
// left-bar.
const CHIP_BASE =
  "flex items-center gap-1 truncate rounded-md border-l-2 px-1.5 py-0.5 text-left text-[9px] font-medium leading-tight transition md:px-2 md:text-[10px] md:leading-normal";

export function DayCell({
  day,
  inMonth,
  isToday,
  isSelected,
  events,
  onSelectDay,
  onNavigateWorkout,
  onNavigateRun,
  onOpenPlanned,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  events: CalendarEvent[];
  onSelectDay: () => void;
  onNavigateWorkout: (id: string) => void;
  onNavigateRun: (id: string) => void;
  onOpenPlanned: (plan: PlannedWorkout) => void;
}) {
  const visible = events.slice(0, MAX_VISIBLE_PILLS);
  const hiddenCount = events.length - visible.length;

  // Compact, uniform cell. A fixed minimum height keeps the grid rows even
  // when a day has no events. Two independent visual axes stack here:
  // "selected" fills the cell with the accent-soft tint + an inset accent
  // hairline; "today" marks the day number violet. They're distinct so a
  // selected-but-not-today day and today-but-not-selected day read
  // differently. Hover adds a faint slate wash so cells feel clickable
  // without spending colour. Greyed (inMonth=false) cells stay quiet but
  // still show their day number.
  const baseClasses =
    "flex min-h-[72px] cursor-pointer flex-col gap-1 border-l border-[var(--border)] p-1.5 transition hover:bg-[var(--surface-2)]/40 md:min-h-[104px] md:gap-1.5 md:p-2";
  const fillClasses = isSelected
    ? "bg-[var(--accent-soft)] ring-1 ring-inset ring-[var(--accent-line)]"
    : inMonth
      ? "bg-[var(--surface)]"
      : "bg-[var(--surface)]/40";
  const labelClasses = inMonth ? "text-[var(--foreground)]" : "text-[var(--muted)] opacity-50";

  return (
    <div
      className={`${baseClasses} ${fillClasses}`}
      aria-label={ariaLabelFor(day, events)}
      onClick={onSelectDay}
    >
      <div className="px-0.5 leading-none md:px-1">
        {isToday ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-[var(--accent-fg)] md:h-6 md:w-6 md:text-xs">
            {day.getDate()}
          </span>
        ) : (
          <span className={`text-[11px] font-medium md:text-xs ${labelClasses}`}>
            {day.getDate()}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 md:gap-1">
        {visible.map((ev) =>
          ev.kind === "workout" ? (
            <WorkoutPill
              key={`w-${ev.workout.id}`}
              workout={ev.workout}
              onClick={() => onNavigateWorkout(ev.workout.id)}
            />
          ) : ev.kind === "run" ? (
            <RunPill key={`r-${ev.run.id}`} run={ev.run} onClick={() => onNavigateRun(ev.run.id)} />
          ) : ev.kind === "completed-planned" ? (
            // A planned session that's been completed + linked. Renders as a
            // single solid "done" pill (not the planned pill stacked on its
            // logged twin). Clicking auto-expands the LOGGED session's banner
            // in the digest, so it reuses the same select-and-expand paths as
            // a standalone logged pill.
            <CompletedPlannedPill
              key={`cp-${ev.planned.id}`}
              event={ev}
              onClick={() =>
                ev.logged.kind === "workout"
                  ? onNavigateWorkout(ev.logged.workout.id)
                  : onNavigateRun(ev.logged.run.id)
              }
            />
          ) : (
            <PlannedPill
              key={`p-${ev.planned.id}`}
              planned={ev.planned}
              discipline={disciplineOf(ev)}
              onClick={() => onOpenPlanned(ev.planned)}
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
  // A completed-planned event is a logged session (of its `logged.kind`)
  // that also fulfilled a plan — count it toward its activity kind so the
  // label reads "1 run" rather than inventing a separate category.
  const lifts = events.filter(
    (e) => e.kind === "workout" || (e.kind === "completed-planned" && e.logged.kind === "workout"),
  ).length;
  const runs = events.filter(
    (e) => e.kind === "run" || (e.kind === "completed-planned" && e.logged.kind === "run"),
  ).length;
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
  const c = activityColors("lift");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={named ? `${time} · ${workout.name}` : time}
      className={`${CHIP_BASE} hover:opacity-90`}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.dot }}
    >
      <CheckGlyph />
      <span className="truncate">{label}</span>
    </button>
  );
}

/**
 * Distinct from `WorkoutPill` by discipline tone (cool teal run hue vs the
 * cool steel-blue lift hue) so a stacked run + lift reads as two different
 * things at a glance, not just two sessions of the same kind. Clicking selects
 * the day and auto-expands this run's banner in the digest below the grid.
 */
function RunPill({ run, onClick }: { run: RunningSession; onClick: () => void }) {
  const time = new Date(run.start_time).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = run.name?.trim() ? run.name : time;
  const c = activityColors("run");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${time} · Run${run.name ? ` · ${run.name}` : ""}`}
      className={`${CHIP_BASE} hover:opacity-90`}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.dot }}
    >
      <CheckGlyph />
      <span className="truncate">{label}</span>
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
function PlannedPill({
  planned,
  discipline,
  onClick,
}: {
  planned: PlannedWorkout;
  discipline: Discipline;
  onClick: () => void;
}) {
  const time = new Date(planned.scheduled_start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const label = planned.name?.trim() ? planned.name : time;
  const completed = planned.status === "completed";
  const skipped = planned.status === "skipped";
  const synced = planned.google_sync_status === "synced";

  // Color (border + text) is always the activity-type tone; status drives only
  // shape (always dashed), the leading glyph (clock planned / check completed /
  // none skipped), and skipped's strikethrough + muting.
  const c = activityColors(discipline);
  const style: React.CSSProperties = skipped
    ? { color: "var(--muted)", borderColor: "var(--border)" }
    : { color: c.fg, borderColor: c.dot };

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
      className={`${CHIP_BASE} border border-dashed bg-transparent hover:bg-[var(--surface-2)] ${
        skipped ? "line-through" : ""
      }`}
      style={style}
    >
      {completed ? <CheckGlyph /> : skipped ? null : <ClockGlyph />}
      <span className="truncate">{label}</span>
      {synced && <SyncGlyph />}
    </button>
  );
}

/**
 * A planned session that's been completed and linked to the logged session
 * that fulfilled it. Unlike PlannedPill (dashed, forward-looking), this
 * reads as done: a SOLID fill in the logged activity's discipline tone (the
 * cool lift hue, or the cool run hue) with a leading check. The single pill
 * replaces what used to be a dashed planned pill stacked on its identical
 * logged pill.
 */
function CompletedPlannedPill({
  event,
  onClick,
}: {
  event: Extract<CalendarEvent, { kind: "completed-planned" }>;
  onClick: () => void;
}) {
  const isRun = event.logged.kind === "run";
  // Pull from the logged session, narrowing on the discriminant directly so
  // TS can see which arm we're in.
  const start = new Date(
    event.logged.kind === "run" ? event.logged.run.start_time : event.logged.workout.performed_at,
  );
  const time = start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  // Prefer the plan's name (the thing the user scheduled, e.g. "W7 D1 -
  // Easy Run"); fall back to the logged session's name, then the time.
  const loggedName =
    event.logged.kind === "run" ? event.logged.run.name : event.logged.workout.name;
  const label = event.planned.name?.trim() || loggedName?.trim() || time;
  // Match the logged-pill palettes so a completed plan is visually a logged
  // session, just carrying a check to mark that it closed out a plan. The
  // discipline comes from the centralized disciplineOf so chips agree.
  const c = activityColors(disciplineOf(event));
  return (
    <button
      type="button"
      data-testid="completed-planned-pill"
      // stopPropagation so selecting this banner doesn't also fire the cell's
      // whitespace-click (which would clear the auto-expand).
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${time} · ${label} (completed planned ${isRun ? "run" : "workout"})`}
      className={`${CHIP_BASE} hover:opacity-90`}
      style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.dot }}
    >
      <CheckGlyph />
      <span className="truncate">{label}</span>
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
