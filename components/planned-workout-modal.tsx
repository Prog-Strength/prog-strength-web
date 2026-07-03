"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  createPlannedWorkout,
  deletePlannedWorkout,
  updatePlannedWorkout,
  type ActivityKind,
  type Exercise,
  type PlannedWorkout,
  type PlannedWorkoutPayload,
  type PlannedWorkoutStatus,
  type RunType,
} from "@/lib/api";
import {
  dateToDateValue,
  dateToTimeValue,
  rfc3339ToSchedule,
  scheduleToRFC3339,
} from "@/lib/datetime";
import { PlannedAgendaDetails } from "@/components/calendar/planned-agenda-details";
import { PlanScheduleField } from "@/components/calendar/plan-schedule-field";
import { AgendaEditor, type PlannedExerciseDraft } from "@/components/calendar/agenda-editor";

/**
 * The planned-workout detail surface, opened from the calendar. Two modes
 * in one modal:
 *
 *  - **view** (read-only): how an existing plan opens. Shows the name,
 *    type, schedule, notes, Google-sync state, and — for a lift — its
 *    agenda formatted like a logged workout (PlannedAgendaDetails). A
 *    pencil switches to edit; "Start workout" (lift plans) hands the plan
 *    to the parent to begin a prefilled live session. A footer Delete
 *    (still-planned plans only) removes the plan behind an inline confirm;
 *    the API takes its Google Calendar event with it.
 *  - **edit**: the create/edit form. How "Plan a workout" (no plan) opens,
 *    and where the pencil leads. Reps are required per set; weight is
 *    optional (fill it in ahead, or while lifting). Google Calendar sync
 *    defaults on when connected.
 *
 * Saving keeps the modal open and returns to the read-only view (the
 * parent refreshes the calendar via `onSaved`); it no longer closes.
 */

type PlannedDraft = {
  name: string;
  activity_kind: ActivityKind;
  // The schedule is modeled as a local date + start time + duration; the
  // RFC3339 window is derived at save (scheduleToRFC3339).
  date: string; // YYYY-MM-DD (local)
  start_time: string; // HH:MM (24h, local)
  duration_min: number;
  notes: string;
  calendar_sync: boolean;
  // Run agenda (used when activity_kind === "run").
  run_type: RunType;
  run_details: string;
  // Lift agenda (used when activity_kind === "lift").
  exercises: PlannedExerciseDraft[];
};

export function PlannedWorkoutModal({
  plan,
  catalog,
  calendarConnected,
  defaultDate,
  onClose,
  onSaved,
  onDeleted,
  onStartWorkout,
}: {
  plan: PlannedWorkout | null;
  catalog: Exercise[];
  calendarConnected: boolean;
  // When creating, the day the calendar was looking at — seeds the start
  // time to 18:00 on that day and the end to an hour later.
  defaultDate?: Date;
  onClose: () => void;
  onSaved: (saved: PlannedWorkout) => void;
  // The plan was deleted — the parent should close the modal and refresh.
  onDeleted?: () => void;
  // Begin a live workout prefilled from this plan (lift plans only). The
  // parent owns the session + navigation; omitted ⇒ no Start button.
  onStartWorkout?: (plan: PlannedWorkout) => void;
}) {
  // The plan currently being shown. Held in state so that after an edit
  // saves we can flip straight back to the read-only view of the updated
  // plan without the parent remounting us.
  const [currentPlan, setCurrentPlan] = useState<PlannedWorkout | null>(plan);
  // Existing plan opens read-only; "Plan a workout" (no plan) opens in edit.
  const [mode, setMode] = useState<"view" | "edit">(plan ? "view" : "edit");
  const [draft, setDraft] = useState<PlannedDraft>(() =>
    plan ? planToDraft(plan, calendarConnected) : freshDraft(defaultDate, calendarConnected),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Deleting is a two-step footer flow: Delete swaps the view footer for an
  // inline danger panel (Cancel / Delete), so a stray click can't destroy a
  // plan. Only reachable in view mode on a still-planned plan.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const exerciseMap = useMemo(() => new Map(catalog.map((e) => [e.id, e])), [catalog]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const canSave = useMemo(() => isDraftValid(draft), [draft]);

  // Enter edit from the read-only view: re-seed the draft from the plan as
  // it stands so unsaved edits never leak across open/close cycles.
  const enterEdit = useCallback(() => {
    setDraft(
      currentPlan
        ? planToDraft(currentPlan, calendarConnected)
        : freshDraft(defaultDate, calendarConnected),
    );
    setError(null);
    setMode("edit");
  }, [currentPlan, calendarConnected, defaultDate]);

  // Cancel an edit: back to the view for an existing plan, or close when
  // we were creating a brand-new one (nothing to return to).
  const cancelEdit = useCallback(() => {
    if (currentPlan) {
      setError(null);
      setMode("view");
    } else {
      onClose();
    }
  }, [currentPlan, onClose]);

  const save = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = draftToPayload(draft);
      const saved = currentPlan
        ? await updatePlannedWorkout(token, currentPlan.id, payload)
        : await createPlannedWorkout(token, payload);
      setCurrentPlan(saved);
      onSaved(saved);
      // Land back on the read-only view of what we just saved.
      setMode("view");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [draft, currentPlan, onSaved]);

  const confirmDelete = useCallback(async () => {
    if (!currentPlan) return;
    const token = getToken();
    if (!token) {
      setError("Not signed in.");
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      // The API also removes the plan's Google Calendar event (best-effort).
      await deletePlannedWorkout(token, currentPlan.id);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [currentPlan, onDeleted]);

  const updateField = <K extends keyof PlannedDraft>(key: K, value: PlannedDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planned-workout-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3.5">
          <h2 id="planned-workout-modal-title" className="min-w-0 truncate text-base font-semibold">
            {mode === "view" && currentPlan
              ? viewTitle(currentPlan)
              : currentPlan
                ? "Edit planned workout"
                : "Plan a workout"}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {mode === "view" && currentPlan?.status === "planned" && (
              <button
                type="button"
                onClick={enterEdit}
                aria-label="Edit planned workout"
                className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              >
                <PencilIcon />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === "view" && currentPlan ? (
            <PlannedViewBody plan={currentPlan} exerciseMap={exerciseMap} />
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Activity">
                <Segmented
                  value={draft.activity_kind}
                  options={[
                    { value: "lift", label: "Lift" },
                    { value: "run", label: "Run" },
                  ]}
                  onChange={(v) => updateField("activity_kind", v)}
                  ariaLabel="Activity type"
                />
              </Field>

              <Field label="Name">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder={draft.activity_kind === "run" ? "e.g. Tempo run" : "e.g. Upper 1"}
                  className={inputClasses}
                />
              </Field>

              <PlanScheduleField
                date={draft.date}
                time={draft.start_time}
                durationMin={draft.duration_min}
                onChange={(next) =>
                  setDraft((d) => ({
                    ...d,
                    ...(next.date !== undefined ? { date: next.date } : {}),
                    ...(next.time !== undefined ? { start_time: next.time } : {}),
                    ...(next.durationMin !== undefined ? { duration_min: next.durationMin } : {}),
                  }))
                }
              />

              <Field label="Notes">
                <textarea
                  value={draft.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={2}
                  placeholder="Anything worth noting about this session"
                  className={`${inputClasses} resize-y`}
                />
              </Field>

              {draft.activity_kind === "run" ? (
                <div className="flex flex-col gap-4">
                  <Field label="Run type">
                    <Segmented
                      value={draft.run_type}
                      options={[
                        { value: "easy", label: "Easy" },
                        { value: "threshold", label: "Threshold" },
                        { value: "intervals", label: "Intervals" },
                      ]}
                      onChange={(v) => updateField("run_type", v)}
                      ariaLabel="Run type"
                    />
                  </Field>
                  <Field label="Details (optional)">
                    <textarea
                      value={draft.run_details}
                      onChange={(e) => updateField("run_details", e.target.value)}
                      rows={2}
                      placeholder="e.g. 4x800m @ 5k pace, 90s jog recovery"
                      className={`${inputClasses} resize-y`}
                    />
                  </Field>
                </div>
              ) : (
                <AgendaEditor
                  exercises={draft.exercises}
                  catalog={catalog}
                  onChange={(next) => updateField("exercises", next)}
                />
              )}

              {/* Calendar sync is demoted to a quiet footer toggle and on by
                  default — syncing is the intended behavior, not a decision the
                  user should make up front. */}
              {calendarConnected && (
                <label className="mt-1 flex items-center gap-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={draft.calendar_sync}
                    onChange={(e) => updateField("calendar_sync", e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                  <span>Sync to Google Calendar</span>
                </label>
              )}
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && (
            <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}
          {mode === "view" && confirmingDelete && currentPlan ? (
            <div className="flex flex-col gap-3 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3">
              <p className="text-sm">
                Delete this planned activity?
                {currentPlan.google_event_id && " Its Google Calendar event will be removed too."}
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setError(null);
                  }}
                  disabled={deleting}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-1.5 text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-3)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="rounded-full border border-[var(--danger)]/40 bg-[var(--danger)] px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-80 disabled:opacity-50"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ) : mode === "view" ? (
            <div className="flex items-center justify-between gap-2">
              {currentPlan?.status === "planned" ? (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="rounded-full border border-[var(--danger)]/40 px-4 py-1.5 text-sm text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
                >
                  Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-1.5 text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-3)]"
                >
                  Close
                </button>
                {onStartWorkout &&
                  currentPlan?.activity_kind === "lift" &&
                  currentPlan.status === "planned" && (
                    <button
                      type="button"
                      onClick={() => onStartWorkout(currentPlan)}
                      className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:bg-[var(--accent-dark)]"
                    >
                      Start workout
                    </button>
                  )}
              </div>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-1.5 text-sm text-[var(--foreground)] transition hover:bg-[var(--surface-3)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saving}
                className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:bg-[var(--accent-dark)] disabled:opacity-40"
              >
                {saving ? "Saving…" : currentPlan ? "Save changes" : "Plan workout"}
              </button>
            </div>
          )}
        </footer>
      </div>
    </div>
  );
}

/**
 * Read-only body of the modal: the plan's type, schedule, notes, Google-
 * sync state, and (for a lift) its agenda formatted like a logged workout.
 */
function PlannedViewBody({
  plan,
  exerciseMap,
}: {
  plan: PlannedWorkout;
  exerciseMap: Map<string, Exercise>;
}) {
  const isRun = plan.activity_kind === "run";
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge kind={plan.activity_kind} />
        <PlannedStatusBadge status={plan.status} />
        <SyncStatus plan={plan} />
      </div>

      <ViewRow label="When">{formatSchedule(plan.scheduled_start, plan.scheduled_end)}</ViewRow>

      {plan.notes && (
        <ViewRow label="Notes">
          <span className="whitespace-pre-wrap">{plan.notes}</span>
        </ViewRow>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {isRun ? "Run" : "Agenda"}
        </h3>
        {isRun ? (
          <RunSummary runType={plan.run_type} details={plan.run_details} />
        ) : plan.exercises.length > 0 ? (
          <PlannedAgendaDetails
            exercises={plan.exercises}
            exerciseMap={exerciseMap}
            variant="calendar"
          />
        ) : (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
            No agenda yet — edit to add exercises, or start the workout and log as you go.
          </p>
        )}
      </div>
    </div>
  );
}

function ViewRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <span className="text-sm text-[var(--foreground)]">{children}</span>
    </div>
  );
}

function TypeBadge({ kind }: { kind: ActivityKind }) {
  return (
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)]">
      {kind === "run" ? "Run" : "Lift"}
    </span>
  );
}

function PlannedStatusBadge({ status }: { status: PlannedWorkoutStatus }) {
  const map = {
    planned: { label: "Planned", cls: "border-[var(--accent)]/50 text-[var(--accent)]" },
    completed: { label: "Completed", cls: "border-emerald-500/50 text-emerald-400" },
    skipped: { label: "Skipped", cls: "border-[var(--border)] text-[var(--muted)]" },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function SyncStatus({ plan }: { plan: PlannedWorkout }) {
  if (plan.google_sync_status === "synced") {
    return <span className="text-[11px] text-[var(--muted)]">· Synced to Google Calendar</span>;
  }
  if (plan.google_sync_status === "pending") {
    return <span className="text-[11px] text-[var(--muted)]">· Syncing…</span>;
  }
  if (plan.google_sync_status === "failed") {
    return <span className="text-[11px] text-[var(--danger)]">· Google sync failed</span>;
  }
  return null;
}

function RunSummary({ runType, details }: { runType: RunType | null; details: string | null }) {
  const text = details?.trim() ?? "";
  if (!runType && !text) {
    return <p className="text-sm text-[var(--muted)]">Easy time block — no details.</p>;
  }
  return (
    <div className="text-sm">
      {runType && <p className="font-medium text-[var(--foreground)]">{runTypeLabel(runType)}</p>}
      {text && <p className="whitespace-pre-wrap text-[var(--muted)]">{text}</p>}
    </div>
  );
}

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

/** "Sat, Jun 20 · 6:00 – 7:00 PM" from the plan's RFC3339 bounds. */
function formatSchedule(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const day = s.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const t = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${t(s)} – ${t(e)}`;
}

/** View-mode title: the plan's name, or a "Lift · 6:00 PM" fallback. */
function viewTitle(plan: PlannedWorkout): string {
  if (plan.name?.trim()) return plan.name.trim();
  const time = new Date(plan.scheduled_start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${plan.activity_kind === "run" ? "Run" : "Lift"} · ${time}`;
}

// --- nested components -----------------------------------------------------

/** A compact pill segmented control, matching the Settings page pattern. */
function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex w-fit rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent-line)] ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
    </label>
  );
}

// The shared field surface for every edit control: a slate input on
// --surface-2 with a real hairline border, comfortable padding, and an accent
// focus ring (border + 1px ring). This is the design-system convention every
// form field in the app should adopt.
const inputClasses =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] transition outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent-line)]";

// --- icons -----------------------------------------------------------------

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function CloseIcon() {
  return (
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
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

// --- helpers ---------------------------------------------------------------

/**
 * A fresh draft seeded to 6:00 PM on `day` (or today), 1h long. `syncDefault`
 * (the calendar-connected flag) makes Google Calendar sync the default —
 * syncing is the intended behavior whenever a calendar is connected.
 */
function freshDraft(day: Date | undefined, syncDefault: boolean): PlannedDraft {
  const base = day ? new Date(day) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 18, 0);
  return {
    name: "",
    activity_kind: "lift",
    date: dateToDateValue(start),
    start_time: dateToTimeValue(start),
    duration_min: 60,
    notes: "",
    calendar_sync: syncDefault,
    run_type: "easy",
    run_details: "",
    exercises: [],
  };
}

function planToDraft(p: PlannedWorkout, syncDefault: boolean): PlannedDraft {
  const sched = rfc3339ToSchedule(p.scheduled_start, p.scheduled_end);
  return {
    name: p.name ?? "",
    activity_kind: p.activity_kind,
    date: sched.date,
    start_time: sched.time,
    duration_min: sched.durationMin,
    notes: p.notes ?? "",
    // Syncing is the default behavior — default on (when a calendar is
    // connected) so edits propagate to Google Calendar.
    calendar_sync: syncDefault,
    run_type: p.run_type ?? "easy",
    run_details: p.run_details ?? "",
    exercises: p.exercises
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        exercise_id: ex.exercise_id,
        notes: ex.notes ?? "",
        superset_group: ex.superset_group ?? null,
        sets: ex.sets
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((s) => ({
            target_reps: s.target_reps != null ? String(s.target_reps) : "",
            target_weight: s.target_weight != null ? String(s.target_weight) : "",
            unit: s.unit ?? "lb",
            target_rpe: s.target_rpe != null ? String(s.target_rpe) : "",
            amrap: s.amrap,
          })),
      })),
  };
}

function draftToPayload(d: PlannedDraft): PlannedWorkoutPayload {
  const { start, end } = scheduleToRFC3339(d.date, d.start_time, d.duration_min);
  const payload: PlannedWorkoutPayload = {
    activity_kind: d.activity_kind,
    scheduled_start: start,
    scheduled_end: end,
  };
  if (d.name.trim()) payload.name = d.name.trim();
  if (d.notes.trim()) payload.notes = d.notes.trim();
  if (d.calendar_sync) payload.calendar_sync = true;

  // A run carries run_type + free-text details (no exercises); a lift carries
  // the exercise agenda (no run fields). Sending run_type/run_details always
  // for a run lets an edit clear the details by emptying the box. Switching
  // kinds is coherent because the API drops the opposing agenda when
  // activity_kind changes.
  if (d.activity_kind === "run") {
    payload.run_type = d.run_type;
    payload.run_details = d.run_details.trim();
    return payload;
  }

  // Only send `exercises` when the user built an agenda — omitting it on
  // update preserves any existing agenda (per the API contract).
  if (d.exercises.length > 0) {
    payload.exercises = d.exercises.map((ex) => {
      const out: NonNullable<PlannedWorkoutPayload["exercises"]>[number] = {
        exercise_id: ex.exercise_id,
        sets: ex.sets.map((s) => {
          const set: NonNullable<PlannedWorkoutPayload["exercises"]>[number]["sets"][number] = {};
          // An AMRAP set carries no fixed rep target; otherwise send reps.
          if (s.amrap) set.amrap = true;
          else if (s.target_reps.trim() !== "") set.target_reps = Number(s.target_reps);
          if (s.target_weight.trim() !== "") {
            set.target_weight = Number(s.target_weight);
            set.unit = s.unit;
          }
          if (s.target_rpe.trim() !== "") set.target_rpe = Number(s.target_rpe);
          return set;
        }),
      };
      if (ex.notes.trim()) out.notes = ex.notes.trim();
      if (ex.superset_group != null) out.superset_group = ex.superset_group;
      return out;
    });
  }
  return payload;
}

function isDraftValid(d: PlannedDraft): boolean {
  // The schedule is always well-formed (date from the picker, duration from a
  // fixed list ≥ 15m), so the only failure mode is a missing date.
  if (!d.date) return false;
  if (d.duration_min <= 0) return false;
  // A run is valid with just a window — its details are optional. A lift's
  // agenda is optional too (a bare time block is fine), but any exercise the
  // user adds must name an exercise and carry at least one set, and every
  // set must specify reps. Weight stays optional — the user may fill it in
  // ahead of time or while lifting.
  if (d.activity_kind === "lift") {
    for (const ex of d.exercises) {
      if (!ex.exercise_id) return false;
      if (ex.sets.length === 0) return false;
      for (const s of ex.sets) {
        // AMRAP sets need no rep target; others require a positive reps value.
        if (!s.amrap && (s.target_reps.trim() === "" || Number(s.target_reps) <= 0)) return false;
      }
    }
  }
  return true;
}
