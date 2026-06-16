"use client";

import type { CompletedSessionKind, Exercise, PlannedWorkout, RunType } from "@/lib/api";

/**
 * Banner row for a single planned (scheduled) workout in the day digest.
 * A compact, clickable row: clicking it opens the planned-workout modal —
 * the single detail / edit / start surface. The dashed border marks it as
 * forward-looking rather than logged. It surfaces status (planned /
 * completed / skipped) and a Google sync indicator with a Resync
 * affordance when the push failed; for a cross-day completed plan that
 * didn't collapse into its logged session, it links to that session.
 */
export function PlannedBanner({
  planned,
  onOpen,
  onResync,
  onNavigateSession,
  onUnlink,
}: {
  planned: PlannedWorkout;
  // Open the planned-workout modal (read-only view) for this plan.
  onOpen?: () => void;
  onResync?: () => void;
  onNavigateSession?: (kind: CompletedSessionKind, id: string) => void;
  onUnlink?: () => void;
}) {
  const time = new Date(planned.scheduled_start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const isRun = planned.activity_kind === "run";
  const kindLabel = isRun ? "Run" : "Lift";
  // Unnamed plans lead with the kind so "Run · 6:00 AM" vs "Lift · 6:00 PM"
  // reads at a glance — useful on a two-a-day.
  const title = planned.name?.trim() || `${kindLabel} · ${time}`;

  const exerciseCount = planned.exercises.length;
  // The agenda summary on the stats line: for a run it's the run type (which
  // also signals "this is a run"); for a lift it's the exercise count.
  const agendaLabel = isRun
    ? planned.run_type
      ? runTypeLabel(planned.run_type)
      : "Run"
    : exerciseCount > 0
      ? `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} planned`
      : "No agenda";
  const stats = `${time} · ${agendaLabel}`;

  const completed = planned.status === "completed";
  const skipped = planned.status === "skipped";

  // The left accent rail color tracks status so a glance reads the
  // lifecycle: accent for planned, emerald for completed, muted for
  // skipped.
  const rail = completed ? "bg-emerald-500" : skipped ? "bg-[var(--muted)]" : "bg-[var(--accent)]";

  return (
    <div
      role="group"
      data-testid="planned-banner"
      // Dashed border distinguishes a forward-looking plan from the solid
      // logged-event banners.
      className="overflow-hidden rounded-lg border border-dashed border-[var(--accent)]/50 bg-[var(--surface)]"
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open planned workout: ${title}`}
          className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-inset md:gap-3 md:px-3 md:py-2.5"
        >
          <span
            aria-hidden="true"
            className={`h-7 w-1 shrink-0 rounded-full md:h-8 md:w-1.5 ${rail}`}
          />
          <span className="flex min-w-0 flex-col">
            <span className="flex items-center gap-1.5">
              <span
                className={`truncate text-[13px] font-medium md:text-sm ${
                  skipped ? "text-[var(--muted)] line-through" : "text-[var(--foreground)]"
                }`}
              >
                {title}
              </span>
              <StatusBadge status={planned.status} />
            </span>
            <span className="truncate text-[11px] tabular-nums text-[var(--muted)] md:text-xs">
              {stats}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-1 pr-1.5">
          <SyncIndicator planned={planned} onResync={onResync} />
        </div>
      </div>

      {completed && planned.completed_session_id && (
        <div className="flex items-center gap-2 border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
          <span>Completed</span>
          {onNavigateSession && planned.completed_session_kind && (
            <button
              type="button"
              onClick={() =>
                onNavigateSession(
                  planned.completed_session_kind as CompletedSessionKind,
                  planned.completed_session_id as string,
                )
              }
              className="font-medium text-[var(--accent)] transition hover:underline"
            >
              View logged {planned.completed_session_kind === "activity" ? "run" : "workout"} →
            </button>
          )}
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              className="text-xs font-medium text-[var(--muted)] transition hover:text-[var(--danger)]"
            >
              Unlink
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * True when a plan has detail worth expanding beyond its one-line summary:
 * a lift with target exercises, or a run with free-text details. Drives
 * whether a "View plan" / expand affordance is offered.
 */
export function hasPlannedAgenda(planned: PlannedWorkout): boolean {
  return planned.activity_kind === "run"
    ? (planned.run_details?.trim() ?? "") !== ""
    : planned.exercises.length > 0;
}

/**
 * The expanded target detail for a plan: the run type + free-text notes for
 * a run, or the list of target exercises and their sets for a lift. Shared
 * by PlannedBanner and the completed-planned banner's "View plan"
 * disclosure so both render the agenda identically.
 */
export function PlannedAgenda({
  planned,
  exerciseMap,
}: {
  planned: PlannedWorkout;
  exerciseMap: Map<string, Exercise>;
}) {
  const isRun = planned.activity_kind === "run";
  const runDetails = planned.run_details?.trim() ?? "";
  return (
    <div className="flex flex-col gap-2">
      {isRun ? (
        <div className="text-xs">
          {planned.run_type && (
            <p className="font-medium text-[var(--foreground)]">{runTypeLabel(planned.run_type)}</p>
          )}
          <p className="whitespace-pre-wrap text-[var(--muted)]">{runDetails}</p>
        </div>
      ) : (
        planned.exercises
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((ex) => {
            const name = exerciseMap.get(ex.exercise_id)?.name ?? ex.exercise_id;
            return (
              <div key={ex.id} className="text-xs">
                <p className="font-medium text-[var(--foreground)]">{name}</p>
                <p className="text-[var(--muted)]">{setsLabel(ex.sets)}</p>
              </div>
            );
          })
      )}
    </div>
  );
}

/** Human label for a run type, e.g. "Threshold run". */
function runTypeLabel(rt: RunType): string {
  switch (rt) {
    case "easy":
      return "Easy run";
    case "threshold":
      return "Threshold run";
    case "intervals":
      return "Interval run";
  }
}

/** Compact summary of a planned exercise's target sets. */
function setsLabel(sets: PlannedWorkout["exercises"][number]["sets"]): string {
  if (sets.length === 0) return "No target sets";
  return sets
    .slice()
    .sort((a, b) => a.order_index - b.order_index)
    .map((s) => {
      const parts: string[] = [];
      if (s.target_reps != null) parts.push(`${s.target_reps} reps`);
      if (s.target_weight != null) parts.push(`${s.target_weight}${s.unit ?? ""}`);
      if (s.target_rpe != null) parts.push(`@${s.target_rpe} RPE`);
      return parts.length > 0 ? parts.join(" ") : "—";
    })
    .join(", ");
}

function StatusBadge({ status }: { status: PlannedWorkout["status"] }) {
  const map = {
    planned: { label: "Planned", cls: "border-[var(--accent)]/50 text-[var(--accent)]" },
    completed: { label: "Completed", cls: "border-emerald-500/50 text-emerald-400" },
    skipped: { label: "Skipped", cls: "border-[var(--border)] text-[var(--muted)]" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

/**
 * Google sync state for the plan. Synced shows a quiet glyph; a failed
 * push shows a Resync button (when the caller wired one). Pending shows a
 * muted "Syncing…" hint. Plans never pushed to Google render nothing.
 */
function SyncIndicator({ planned, onResync }: { planned: PlannedWorkout; onResync?: () => void }) {
  if (planned.google_sync_status === "synced") {
    return (
      <span
        title="Synced to Google Calendar"
        aria-label="Synced to Google Calendar"
        className="flex items-center text-[var(--muted)]"
      >
        <SyncGlyph />
      </span>
    );
  }
  if (planned.google_sync_status === "failed") {
    return (
      <button
        type="button"
        onClick={onResync}
        disabled={!onResync}
        title={planned.last_sync_error ?? "Google sync failed"}
        className="rounded border border-[var(--danger)]/40 px-1.5 py-0.5 text-[10px] font-medium text-[var(--danger)] transition hover:bg-[var(--danger)]/10 disabled:opacity-50"
      >
        Resync
      </button>
    );
  }
  if (planned.google_sync_status === "pending") {
    return <span className="text-[10px] text-[var(--muted)]">Syncing…</span>;
  }
  return null;
}

function SyncGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
