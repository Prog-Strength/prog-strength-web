"use client";

import { useEffect, useMemo, useState } from "react";
import { getToken } from "@/lib/auth";
import { calibrateRunningSession, type RunningSession } from "@/lib/api";
import {
  METERS_PER_KM,
  METERS_PER_MILE,
  formatDistanceValue,
  formatPaceValue,
  useDistanceUnit,
} from "@/lib/distance-unit-context";
import { useToast } from "@/components/toast";

/**
 * Calibrate an indoor/treadmill run's distance. The user enters the corrected
 * total distance in their preferred unit (pre-filled with the current value);
 * on submit we convert to meters and POST to the calibrate endpoint, which
 * rescales pace and every trackpoint server-side. On success the parent
 * replaces its whole session with the response (including trackpoints) so the
 * header and derived splits stay consistent.
 *
 * Conforms to the design-system form-control specs: rounded field with a
 * hairline border, uppercase faint label, accent focus ring, primary accent
 * button + secondary surface-2 button. Mirrors the existing modal pattern
 * (`components/exercise-edit-modal.tsx`).
 */
export function CalibrateDistanceModal({
  session,
  onClose,
  onCalibrated,
}: {
  session: RunningSession;
  onClose: () => void;
  onCalibrated: (updated: RunningSession) => void;
}) {
  const toast = useToast();
  const { unit, unitLabel } = useDistanceUnit();

  // Pre-fill with the current distance in the user's unit (bare numeric).
  const [value, setValue] = useState(() => formatDistanceValue(session.distance_meters, unit));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, saving]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const parsed = Number(value);
  const isValid = value.trim() !== "" && Number.isFinite(parsed) && parsed > 0;

  // Live pace preview from the (unchanged) duration and the entered distance.
  const previewPace = useMemo(() => {
    if (!isValid) return null;
    const meters = valueToMeters(parsed, unit);
    if (meters <= 0) return null;
    const secPerKm = session.duration_seconds / (meters / 1000);
    return formatPaceValue(secPerKm, unit);
  }, [isValid, parsed, unit, session.duration_seconds]);

  async function submit() {
    if (!isValid) {
      setError("Enter a distance greater than zero.");
      return;
    }
    const token = getToken();
    if (!token) {
      setError("Not signed in.");
      return;
    }
    const meters = valueToMeters(parsed, unit);
    setSaving(true);
    setError(null);
    try {
      const updated = await calibrateRunningSession(token, session.id, meters);
      toast.success("Distance calibrated.");
      onCalibrated(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Calibration failed";
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calibrate-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !saving && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="calibrate-modal-title" className="text-base font-semibold">
            Calibrate distance
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          <p className="text-xs text-[var(--muted)]">
            Set the corrected total distance from the treadmill console. Pace and every split
            recompute from it.
          </p>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
              Corrected distance ({unitLabel})
            </span>
            <input
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid && !saving) {
                  e.preventDefault();
                  void submit();
                }
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] tabular-nums outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent-line)]"
            />
          </label>

          <p className="text-xs text-[var(--muted)]">
            New avg pace:{" "}
            <span className="font-medium tabular-nums text-[var(--foreground)]">
              {previewPace ? `${previewPace} /${unitLabel}` : "—"}
            </span>
          </p>

          {!isValid && value.trim() !== "" && (
            <p className="text-xs text-[var(--danger)]">Distance must be greater than zero.</p>
          )}
          {error && (
            <p className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-2 py-1 text-xs text-[var(--danger)]">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-1.5 text-sm font-medium transition hover:opacity-80 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!isValid || saving}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
            >
              {saving ? "Calibrating…" : "Calibrate"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Convert a distance in the active unit to meters. */
function valueToMeters(value: number, unit: "mi" | "km"): number {
  return value * (unit === "mi" ? METERS_PER_MILE : METERS_PER_KM);
}
