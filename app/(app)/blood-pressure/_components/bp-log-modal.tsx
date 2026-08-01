"use client";

import { useEffect, useMemo, useState } from "react";
import { BP_CATEGORIES, classify } from "@/lib/blood-pressure";

/**
 * Modal for logging (or editing) a single blood-pressure reading:
 * systolic, diastolic, an optional pulse, and a when. Clones the
 * bodyweight log modal's chrome exactly — centered card, black backdrop
 * that closes on click, Escape-to-close, body scroll lock, inline error
 * banner — so the two read as one set. Form controls use the
 * design-system tokens: `--surface-2` field fill, `--border` hairline,
 * `--accent` focus border + `--accent-line` focus ring, uppercase
 * `--faint` labels.
 *
 * Validation mirrors the API bounds (systolic 50–300, diastolic 30–200,
 * pulse 20–250) and the systolic > diastolic invariant, surfaced inline
 * rather than waiting on the server's 400. While the systolic/diastolic
 * pair is valid a live category preview (classify + BP_CATEGORIES) shows
 * the reading's AHA band. Emits `measured_at` as an RFC3339 (ISO) string.
 */

// Client-side bounds — the same numbers the API validator enforces. Kept
// here so a bad reading is caught before the round-trip; the server stays
// authoritative on the stored category.
const SYS_MIN = 50;
const SYS_MAX = 300;
const DIA_MIN = 30;
const DIA_MAX = 200;
const PULSE_MIN = 20;
const PULSE_MAX = 250;

export type BpLogModalSubmit = {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  measured_at: string; // RFC3339
};

export type BpLogModalInitial = {
  systolic: number;
  diastolic: number;
  pulse: number | null;
  measured_at: string; // RFC3339
};

export function BpLogModal({
  busy = false,
  error = null,
  initial,
  onSubmit,
  onClose,
}: {
  busy?: boolean;
  error?: string | null;
  initial?: BpLogModalInitial;
  onSubmit: (payload: BpLogModalSubmit) => void | Promise<void>;
  onClose: () => void;
}) {
  const isEdit = initial != null;
  const [systolic, setSystolic] = useState(initial ? String(initial.systolic) : "");
  const [diastolic, setDiastolic] = useState(initial ? String(initial.diastolic) : "");
  const [pulse, setPulse] = useState(initial && initial.pulse != null ? String(initial.pulse) : "");
  const [measuredAtLocal, setMeasuredAtLocal] = useState(() =>
    // Edit: seed from the entry's timestamp. Create: default to now, so
    // the field is pre-filled (the SOW asks for "a date/time defaulting
    // to now") rather than blank.
    toLocalDatetimeInput(initial ? initial.measured_at : new Date().toISOString()),
  );
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Live category preview — only when the pair parses to a sane,
  // in-order reading. Null otherwise (so a half-typed pair shows nothing
  // rather than flickering "Crisis").
  const preview = useMemo(() => {
    const s = Number(systolic);
    const d = Number(diastolic);
    if (!Number.isFinite(s) || !Number.isFinite(d)) return null;
    if (s < SYS_MIN || s > SYS_MAX || d < DIA_MIN || d > DIA_MAX) return null;
    if (s <= d) return null;
    return classify(s, d);
  }, [systolic, diastolic]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    const s = Number(systolic);
    const d = Number(diastolic);
    if (!systolic || !Number.isFinite(s) || !Number.isInteger(s)) {
      setLocalError("Systolic must be a whole number.");
      return;
    }
    if (!diastolic || !Number.isFinite(d) || !Number.isInteger(d)) {
      setLocalError("Diastolic must be a whole number.");
      return;
    }
    if (s < SYS_MIN || s > SYS_MAX) {
      setLocalError(`Systolic must be between ${SYS_MIN} and ${SYS_MAX}.`);
      return;
    }
    if (d < DIA_MIN || d > DIA_MAX) {
      setLocalError(`Diastolic must be between ${DIA_MIN} and ${DIA_MAX}.`);
      return;
    }
    if (s <= d) {
      setLocalError("Systolic (top) must be higher than diastolic (bottom).");
      return;
    }

    let pulseValue: number | null = null;
    if (pulse.trim() !== "") {
      const p = Number(pulse);
      if (!Number.isFinite(p) || !Number.isInteger(p)) {
        setLocalError("Pulse must be a whole number.");
        return;
      }
      if (p < PULSE_MIN || p > PULSE_MAX) {
        setLocalError(`Pulse must be between ${PULSE_MIN} and ${PULSE_MAX}.`);
        return;
      }
      pulseValue = p;
    }

    if (!measuredAtLocal) {
      setLocalError("When is required.");
      return;
    }
    const when = new Date(measuredAtLocal);
    if (Number.isNaN(when.getTime())) {
      setLocalError("When couldn't be parsed.");
      return;
    }

    try {
      await onSubmit({
        systolic: s,
        diastolic: d,
        pulse: pulseValue,
        measured_at: when.toISOString(),
      });
      onClose();
    } catch {
      // Error surfaces via the `error` prop; modal stays open so the user
      // can correct + retry without losing their input.
    }
  }

  const shownError = error ?? localError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bp-log-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="bp-log-modal-title" className="text-base font-semibold">
              {isEdit ? "Edit reading" : "Log a reading"}
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Systolic over diastolic, in mmHg — pulse is optional.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <form onSubmit={submit} className="flex flex-col gap-4 px-5 py-4">
          <div className="flex items-end gap-3">
            <Field
              label="Systolic"
              value={systolic}
              onChange={setSystolic}
              placeholder="122"
              min={SYS_MIN}
              max={SYS_MAX}
              busy={busy}
              autoFocus
            />
            <span className="pb-1.5 text-lg font-semibold text-[var(--muted)]">/</span>
            <Field
              label="Diastolic"
              value={diastolic}
              onChange={setDiastolic}
              placeholder="78"
              min={DIA_MIN}
              max={DIA_MAX}
              busy={busy}
            />
          </div>

          {/* Live category preview while the pair is valid. */}
          {preview && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--muted)]">Category</span>
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold"
                style={{
                  color: BP_CATEGORIES[preview].tone,
                  backgroundColor: `color-mix(in srgb, ${BP_CATEGORIES[preview].tone} 14%, transparent)`,
                }}
              >
                {BP_CATEGORIES[preview].label}
              </span>
            </div>
          )}

          <Field
            label="Pulse (optional)"
            value={pulse}
            onChange={setPulse}
            placeholder="64"
            min={PULSE_MIN}
            max={PULSE_MAX}
            busy={busy}
            fullWidth
          />

          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[var(--faint)]">When</span>
            <input
              type="datetime-local"
              value={measuredAtLocal}
              onChange={(e) => setMeasuredAtLocal(e.target.value)}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-line)]"
            />
          </label>

          {shownError && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {shownError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] hover:opacity-80 disabled:opacity-50"
            >
              {busy ? "Saving…" : isEdit ? "Save" : "Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  min,
  max,
  busy,
  autoFocus,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  min: number;
  max: number;
  busy: boolean;
  autoFocus?: boolean;
  fullWidth?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs ${fullWidth ? "" : "flex-1"}`}>
      <span className="font-semibold uppercase tracking-wider text-[var(--faint)]">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={busy}
        autoFocus={autoFocus}
        className="rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm tabular-nums outline-none transition focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-line)]"
      />
    </label>
  );
}

/** ISO timestamp → local "YYYY-MM-DDTHH:mm" for <input type="datetime-local">,
 * using local getters so the field matches the user's wall clock — same
 * approach as the bodyweight edit modal's toLocalDatetimeInput. */
function toLocalDatetimeInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${String(d.getFullYear()).padStart(4, "0")}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
