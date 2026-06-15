"use client";

import { useId, useState } from "react";
import type { CompletedSessionKind, Exercise, PlannedWorkout } from "@/lib/api";

/**
 * Banner row for a single planned (scheduled) workout in the day digest.
 * The forward-looking sibling of WorkoutBanner/RunBanner: a dashed border
 * (rather than a solid accent bar) marks it as intended rather than
 * logged. It surfaces status (planned / completed / skipped), a Google
 * sync indicator with a Resync affordance when the push failed, an Edit
 * affordance, and — when completed — a link to the logged session that
 * fulfilled it. The agenda (target exercises + sets) expands inline.
 */
export function PlannedBanner({
  planned,
  exerciseMap,
  defaultOpen = false,
  onEdit,
  onResync,
  onNavigateSession,
}: {
  planned: PlannedWorkout;
  exerciseMap: Map<string, Exercise>;
  defaultOpen?: boolean;
  onEdit?: () => void;
  onResync?: () => void;
  onNavigateSession?: (kind: CompletedSessionKind, id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const dropdownId = useId();

  const time = new Date(planned.scheduled_start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const title = planned.name?.trim() || `Planned · ${time}`;
  const exerciseCount = planned.exercises.length;
  const agendaLabel =
    exerciseCount > 0
      ? `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"} planned`
      : "No agenda";
  const stats = `${time} · ${agendaLabel}`;

  const completed = planned.status === "completed";
  const skipped = planned.status === "skipped";

  // The left accent rail color tracks status so a glance reads the
  // lifecycle: accent for planned, emerald for completed, muted for
  // skipped.
  const rail = completed ? "bg-emerald-500" : skipped ? "bg-[var(--muted)]" : "bg-[var(--accent)]";

  const hasAgenda = exerciseCount > 0;

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
          onClick={() => (hasAgenda ? setOpen((o) => !o) : undefined)}
          aria-expanded={hasAgenda ? open : undefined}
          aria-controls={hasAgenda ? dropdownId : undefined}
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
          {onEdit && planned.status === "planned" && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit planned workout"
              className="rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <PencilIcon />
            </button>
          )}
          {hasAgenda && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={dropdownId}
              aria-label={open ? "Collapse details" : "Expand details"}
              onClick={() => setOpen((o) => !o)}
              className="flex items-center justify-center px-1.5 text-[var(--muted)] transition hover:text-[var(--foreground)]"
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
          )}
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
        </div>
      )}

      {open && hasAgenda && (
        <div
          id={dropdownId}
          className="flex flex-col gap-2 border-t border-[var(--border)] px-3 py-2.5"
        >
          {planned.exercises
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
            })}
        </div>
      )}
    </div>
  );
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

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
