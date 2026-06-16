"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  createPlannedWorkout,
  updatePlannedWorkout,
  type ActivityKind,
  type CalendarDetail,
  type Exercise,
  type PlannedWorkout,
  type PlannedWorkoutPayload,
  type PlannedWorkoutStatus,
  type RunType,
} from "@/lib/api";
import { localInputToRFC3339, rfc3339ToLocalInput } from "@/lib/datetime";
import { PlannedAgendaDetails } from "@/components/calendar/planned-agenda-details";

/**
 * The planned-workout detail surface, opened from the calendar. Two modes
 * in one modal:
 *
 *  - **view** (read-only): how an existing plan opens. Shows the name,
 *    type, schedule, notes, Google-sync state, and — for a lift — its
 *    agenda formatted like a logged workout (PlannedAgendaDetails). A
 *    pencil switches to edit; "Start workout" (lift plans) hands the plan
 *    to the parent to begin a prefilled live session.
 *  - **edit**: the create/edit form. How "Plan a workout" (no plan) opens,
 *    and where the pencil leads. Reps are required per set; weight is
 *    optional (fill it in ahead, or while lifting). Google Calendar sync
 *    defaults on when connected.
 *
 * Saving keeps the modal open and returns to the read-only view (the
 * parent refreshes the calendar via `onSaved`); it no longer closes.
 */

type PlannedSetDraft = {
  target_reps: string;
  target_weight: string;
  unit: "lb" | "kg";
  target_rpe: string;
};

type PlannedExerciseDraft = {
  exercise_id: string;
  notes: string;
  sets: PlannedSetDraft[];
};

type PlannedDraft = {
  name: string;
  activity_kind: ActivityKind;
  scheduled_start: string; // datetime-local value
  scheduled_end: string; // datetime-local value
  notes: string;
  // "" → Default (null), else the literal detail level.
  calendar_detail: "" | CalendarDetail;
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

  const updateField = <K extends keyof PlannedDraft>(key: K, value: PlannedDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const updateExercise = (i: number, fn: (ex: PlannedExerciseDraft) => PlannedExerciseDraft) =>
    setDraft((d) => ({
      ...d,
      exercises: d.exercises.map((ex, idx) => (idx === i ? fn(ex) : ex)),
    }));

  const updateSet = (exIdx: number, setIdx: number, fn: (s: PlannedSetDraft) => PlannedSetDraft) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIdx ? fn(s) : s)),
    }));

  const addExercise = () =>
    setDraft((d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        { exercise_id: catalog[0]?.id ?? "", notes: "", sets: [defaultSet()] },
      ],
    }));

  const removeExercise = (i: number) =>
    setDraft((d) => ({ ...d, exercises: d.exercises.filter((_, idx) => idx !== i) }));

  const addSet = (exIdx: number) =>
    updateExercise(exIdx, (ex) => ({
      ...ex,
      sets: [...ex.sets, ex.sets[ex.sets.length - 1] ?? defaultSet()],
    }));

  const removeSet = (exIdx: number, setIdx: number) =>
    updateExercise(exIdx, (ex) => ({ ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="planned-workout-modal-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-5 py-3">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Starts at" required>
                  <input
                    type="datetime-local"
                    aria-label="Starts at"
                    value={draft.scheduled_start}
                    onChange={(e) => updateField("scheduled_start", e.target.value)}
                    className={inputClasses}
                  />
                </Field>
                <Field label="Ends at" required>
                  <input
                    type="datetime-local"
                    aria-label="Ends at"
                    value={draft.scheduled_end}
                    onChange={(e) => updateField("scheduled_end", e.target.value)}
                    className={inputClasses}
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={draft.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  rows={2}
                  placeholder="Anything worth noting about this session"
                  className={`${inputClasses} resize-y`}
                />
              </Field>

              <Field label="Calendar detail">
                <select
                  aria-label="Calendar detail"
                  value={draft.calendar_detail}
                  onChange={(e) =>
                    updateField("calendar_detail", e.target.value as "" | CalendarDetail)
                  }
                  className={inputClasses}
                >
                  <option value="">Default</option>
                  <option value="time_block">Time block</option>
                  <option value="full_agenda">Full agenda</option>
                </select>
              </Field>

              {calendarConnected && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={draft.calendar_sync}
                    onChange={(e) => updateField("calendar_sync", e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  <span>Sync to Google Calendar</span>
                </label>
              )}

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
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">Agenda (optional)</h3>
                    <button
                      type="button"
                      onClick={addExercise}
                      className="text-xs text-[var(--accent)] hover:underline"
                    >
                      + Add exercise
                    </button>
                  </div>

                  {draft.exercises.length === 0 && (
                    <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
                      No agenda — this will be a bare time block.
                    </p>
                  )}

                  {draft.exercises.map((ex, exIdx) => (
                    <ExerciseCard
                      key={exIdx}
                      exercise={ex}
                      catalog={catalog}
                      onChange={(fn) => updateExercise(exIdx, fn)}
                      onRemove={() => removeExercise(exIdx)}
                      onAddSet={() => addSet(exIdx)}
                      onRemoveSet={(setIdx) => removeSet(exIdx, setIdx)}
                      onSetChange={(setIdx, fn) => updateSet(exIdx, setIdx, fn)}
                    />
                  ))}
                </div>
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
          {mode === "view" ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
              >
                Close
              </button>
              {onStartWorkout &&
                currentPlan?.activity_kind === "lift" &&
                currentPlan.status === "planned" && (
                  <button
                    type="button"
                    onClick={() => onStartWorkout(currentPlan)}
                    className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90"
                  >
                    Start workout
                  </button>
                )}
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={!canSave || saving}
                className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
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
          <PlannedAgendaDetails exercises={plan.exercises} exerciseMap={exerciseMap} />
        ) : (
          <p className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-xs text-[var(--muted)]">
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
    <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)]">
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

function ExerciseCard({
  exercise,
  catalog,
  onChange,
  onRemove,
  onAddSet,
  onRemoveSet,
  onSetChange,
}: {
  exercise: PlannedExerciseDraft;
  catalog: Exercise[];
  onChange: (fn: (ex: PlannedExerciseDraft) => PlannedExerciseDraft) => void;
  onRemove: () => void;
  onAddSet: () => void;
  onRemoveSet: (setIdx: number) => void;
  onSetChange: (setIdx: number, fn: (s: PlannedSetDraft) => PlannedSetDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-start gap-2">
        <select
          aria-label="Exercise"
          value={exercise.exercise_id}
          onChange={(e) => onChange((ex) => ({ ...ex, exercise_id: e.target.value }))}
          className={`${inputClasses} flex-1`}
        >
          {!catalog.some((c) => c.id === exercise.exercise_id) && (
            <option value={exercise.exercise_id}>{exercise.exercise_id || "Select…"}</option>
          )}
          {catalog.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove exercise"
          className="rounded p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </div>

      <input
        type="text"
        value={exercise.notes}
        onChange={(e) => onChange((ex) => ({ ...ex, notes: e.target.value }))}
        placeholder="Notes for this exercise"
        className={`${inputClasses} text-xs`}
      />

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-2 text-[10px] uppercase tracking-wide text-[var(--muted)]">
          <span>Reps</span>
          <span>Weight</span>
          <span>Unit</span>
          <span>RPE</span>
          <span />
        </div>
        {exercise.sets.map((s, setIdx) => (
          <div key={setIdx} className="grid grid-cols-[1fr_1fr_auto_1fr_auto] items-center gap-2">
            <input
              type="number"
              min={0}
              aria-label="Target reps"
              value={s.target_reps}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, target_reps: e.target.value }))
              }
              className={inputClasses}
            />
            <input
              type="number"
              min={0}
              step={0.5}
              aria-label="Target weight"
              value={s.target_weight}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, target_weight: e.target.value }))
              }
              className={inputClasses}
            />
            <select
              aria-label="Unit"
              value={s.unit}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, unit: e.target.value as "lb" | "kg" }))
              }
              className={inputClasses}
            >
              <option value="lb">lb</option>
              <option value="kg">kg</option>
            </select>
            <input
              type="number"
              min={0}
              max={10}
              step={0.5}
              aria-label="Target RPE"
              value={s.target_rpe}
              onChange={(e) =>
                onSetChange(setIdx, (set) => ({ ...set, target_rpe: e.target.value }))
              }
              className={inputClasses}
            />
            <button
              type="button"
              onClick={() => onRemoveSet(setIdx)}
              aria-label="Remove set"
              className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
              disabled={exercise.sets.length === 1}
            >
              <TrashIcon small />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAddSet}
          className="self-start text-xs text-[var(--accent)] hover:underline"
        >
          + Add set
        </button>
      </div>
    </div>
  );
}

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
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-medium text-[var(--muted)]">
        {label}
        {required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputClasses =
  "rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none";

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

function TrashIcon({ small = false }: { small?: boolean }) {
  const size = small ? 12 : 14;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

// --- helpers ---------------------------------------------------------------

function defaultSet(): PlannedSetDraft {
  return { target_reps: "5", target_weight: "", unit: "lb", target_rpe: "" };
}

/**
 * A fresh draft seeded to 18:00 on `day` (or today), one hour long.
 * `syncDefault` (the calendar-connected flag) makes Google Calendar sync
 * the default — syncing is the intended behavior whenever a calendar is
 * connected.
 */
function freshDraft(day: Date | undefined, syncDefault: boolean): PlannedDraft {
  const base = day ? new Date(day) : new Date();
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 18, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const toInput = (d: Date) => rfc3339ToLocalInput(d.toISOString());
  return {
    name: "",
    activity_kind: "lift",
    scheduled_start: toInput(start),
    scheduled_end: toInput(end),
    notes: "",
    calendar_detail: "",
    calendar_sync: syncDefault,
    run_type: "easy",
    run_details: "",
    exercises: [],
  };
}

function planToDraft(p: PlannedWorkout, syncDefault: boolean): PlannedDraft {
  return {
    name: p.name ?? "",
    activity_kind: p.activity_kind,
    scheduled_start: rfc3339ToLocalInput(p.scheduled_start),
    scheduled_end: rfc3339ToLocalInput(p.scheduled_end),
    notes: p.notes ?? "",
    calendar_detail: p.calendar_detail ?? "",
    // Syncing is the default behavior — default the checkbox on (when a
    // calendar is connected) so edits propagate to Google Calendar.
    calendar_sync: syncDefault,
    run_type: p.run_type ?? "easy",
    run_details: p.run_details ?? "",
    exercises: p.exercises
      .slice()
      .sort((a, b) => a.order_index - b.order_index)
      .map((ex) => ({
        exercise_id: ex.exercise_id,
        notes: ex.notes ?? "",
        sets: ex.sets
          .slice()
          .sort((a, b) => a.order_index - b.order_index)
          .map((s) => ({
            target_reps: s.target_reps != null ? String(s.target_reps) : "",
            target_weight: s.target_weight != null ? String(s.target_weight) : "",
            unit: s.unit ?? "lb",
            target_rpe: s.target_rpe != null ? String(s.target_rpe) : "",
          })),
      })),
  };
}

function draftToPayload(d: PlannedDraft): PlannedWorkoutPayload {
  const payload: PlannedWorkoutPayload = {
    activity_kind: d.activity_kind,
    scheduled_start: localInputToRFC3339(d.scheduled_start),
    scheduled_end: localInputToRFC3339(d.scheduled_end),
    // null → Default (API falls back to the user's calendar_default_detail).
    calendar_detail: d.calendar_detail === "" ? null : d.calendar_detail,
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
          if (s.target_reps.trim() !== "") set.target_reps = Number(s.target_reps);
          if (s.target_weight.trim() !== "") {
            set.target_weight = Number(s.target_weight);
            set.unit = s.unit;
          }
          if (s.target_rpe.trim() !== "") set.target_rpe = Number(s.target_rpe);
          return set;
        }),
      };
      if (ex.notes.trim()) out.notes = ex.notes.trim();
      return out;
    });
  }
  return payload;
}

function isDraftValid(d: PlannedDraft): boolean {
  if (!d.scheduled_start || !d.scheduled_end) return false;
  // End must be after start.
  if (new Date(d.scheduled_end).getTime() <= new Date(d.scheduled_start).getTime()) return false;
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
        if (s.target_reps.trim() === "" || Number(s.target_reps) <= 0) return false;
      }
    }
  }
  return true;
}
