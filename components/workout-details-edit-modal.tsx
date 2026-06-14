"use client";

import { useCallback, useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { updateWorkout, type Workout } from "@/lib/api";
import { workoutToPayload } from "@/lib/workout-payload";
import { localInputToRFC3339, rfc3339ToLocalInput } from "@/lib/datetime";

/**
 * Edits the workout-level fields that aren't tied to any exercise — name,
 * performed-at, ended-at, and notes. The detail page's "Edit details"
 * action opens this; per-exercise sets are edited separately by
 * ExerciseEditModal.
 *
 * The API's update is a full replacement, so on save we take the existing
 * workout, overlay just these four fields, and round-trip the whole thing
 * through `workoutToPayload`. The exercises ride along untouched.
 *
 * On success the parent's `onSaved(updated)` receives the API response so
 * it can replace its workout state without a refetch.
 */
export function WorkoutDetailsEditModal({
  workout,
  onClose,
  onSaved,
}: {
  workout: Workout;
  onClose: () => void;
  onSaved: (updated: Workout) => void;
}) {
  const [name, setName] = useState(workout.name ?? "");
  const [performedAt, setPerformedAt] = useState(rfc3339ToLocalInput(workout.performed_at));
  const [endedAt, setEndedAt] = useState(
    workout.ended_at ? rfc3339ToLocalInput(workout.ended_at) : "",
  );
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const save = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not signed in.");
      return;
    }
    if (!performedAt) {
      setError("Performed-at is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next: Workout = {
        ...workout,
        name: name.trim(),
        performed_at: localInputToRFC3339(performedAt),
        ended_at: endedAt ? localInputToRFC3339(endedAt) : null,
        notes: notes.trim(),
      };
      const updated = await updateWorkout(token, workout.id, workoutToPayload(next));
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [workout, name, performedAt, endedAt, notes, onClose, onSaved]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-details-edit-title"
    >
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between border-b border-[var(--border)] px-5 py-3">
          <h2 id="workout-details-edit-title" className="text-base font-semibold">
            Edit workout details
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Upper 1"
                className={inputClasses}
              />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Performed at" required>
                <input
                  type="datetime-local"
                  value={performedAt}
                  onChange={(e) => setPerformedAt(e.target.value)}
                  className={inputClasses}
                />
              </Field>
              <Field label="Ended at">
                <input
                  type="datetime-local"
                  value={endedAt}
                  onChange={(e) => setEndedAt(e.target.value)}
                  className={inputClasses}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Anything worth remembering about this session"
                className={`${inputClasses} resize-y`}
              />
            </Field>
          </div>
        </div>

        <footer className="flex flex-col gap-2 border-t border-[var(--border)] px-5 py-3">
          {error && (
            <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-2)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!performedAt || saving}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </footer>
      </div>
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
