"use client";

/**
 * Distance-unit preference context for the running feature.
 *
 * Running distances/paces come off the API in metric (meters,
 * seconds-per-kilometer). This context owns the user's preferred display
 * unit ("mi" | "km") and exposes formatters that convert toward it at
 * render time, so components never do unit math themselves.
 *
 * Seeding precedence (highest first):
 *   1. localStorage "ps_distance_unit" — set on every toggle so the choice
 *      survives reloads and applies instantly before any network call.
 *   2. The server value from GET /me (`user.distance_unit`), fetched on
 *      mount when a token exists.
 *   3. "mi" — the default for a fresh, signed-out, never-toggled client.
 *
 * Formatter API (kept deliberately small so callers compose the label):
 *   - `unit` / `unitLabel`: the active unit, e.g. "mi". `unitLabel` is an
 *     alias for `unit`; render `${formatDistance(m)} ${unitLabel}`.
 *   - `formatDistance(meters)`: numeric string only (1 decimal, em-dash
 *     for non-finite), e.g. "5.0". No unit suffix — callers add it.
 *   - `formatPace(secPerKm)`: "m:ss" in the active unit, e.g. "8:12";
 *     "—" for non-finite or non-positive input.
 *
 * The pure helpers `formatDistanceValue` / `formatPaceValue` hold the
 * actual conversion + formatting so they can be unit-tested without
 * rendering; the context methods just close over the active unit.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getMe, updateMe } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatPaceClock } from "@/lib/pace-format";

export type DistanceUnit = "mi" | "km";

const STORAGE_KEY = "ps_distance_unit";
// Exported so unit→meters conversion (e.g. the calibrate modal turning a
// user-entered distance into meters for the API) shares one source of truth
// with the display formatters below.
export const METERS_PER_MILE = 1609.344;
export const METERS_PER_KM = 1000;
// secPerMile = secPerKm * (meters per mile / meters per km).
const KM_PER_MILE = METERS_PER_MILE / METERS_PER_KM; // 1.609344

/**
 * Convert a metric distance to the active unit and format it as a bare
 * numeric string with a fixed single decimal place, e.g. "5.0". Pure —
 * no React, no unit label. Non-finite input yields "—".
 *
 * Note: unlike lib/format's `formatNumber` (which strips a trailing ".0"
 * on integers), distances always keep the decimal so a list of runs
 * reads as a tidy column — "5.0 mi", "12.3 mi" — rather than "5 mi"
 * jumping out of alignment.
 */
export function formatDistanceValue(meters: number, unit: DistanceUnit): string {
  if (!Number.isFinite(meters)) return "—";
  const divisor = unit === "mi" ? METERS_PER_MILE : METERS_PER_KM;
  return (meters / divisor).toFixed(1);
}

/**
 * Convert a pace in seconds-per-kilometer to the active unit and format
 * it as "m:ss" (seconds zero-padded to two digits). Pure. Guards null,
 * non-finite, and non-positive input with "—" — useful both for missing
 * source data and for non-running activities where pace isn't defined.
 */
export function formatPaceValue(secPerKm: number | null, unit: DistanceUnit): string {
  if (secPerKm == null || !Number.isFinite(secPerKm) || secPerKm <= 0) return "—";
  return formatPaceClock(unit === "mi" ? secPerKm * KM_PER_MILE : secPerKm);
}

type DistanceUnitContextValue = {
  unit: DistanceUnit;
  unitLabel: DistanceUnit;
  setUnit: (u: DistanceUnit) => void;
  formatDistance: (meters: number) => string;
  formatPace: (secPerKm: number | null) => string;
};

const DistanceUnitContext = createContext<DistanceUnitContextValue | null>(null);

function readStoredUnit(): DistanceUnit | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === "mi" || raw === "km" ? raw : null;
}

/**
 * App-wide distance-unit provider. Seeds from localStorage immediately,
 * then (when a token exists) reconciles with the server value from GET
 * /me — but localStorage still wins so a just-made toggle isn't clobbered
 * by an in-flight fetch.
 */
export function DistanceUnitProvider({ children }: { children: React.ReactNode }) {
  // Lazy init so the very first paint already reflects a stored choice
  // (avoids a flash of the default unit on reload).
  const [unit, setUnitState] = useState<DistanceUnit>(() => readStoredUnit() ?? "mi");

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    getMe(token)
      .then((user) => {
        if (cancelled) return;
        // localStorage wins: only adopt the server value when the user
        // hasn't already expressed a local preference.
        if (
          readStoredUnit() === null &&
          (user.distance_unit === "mi" || user.distance_unit === "km")
        ) {
          setUnitState(user.distance_unit);
        }
      })
      .catch(() => {
        // Non-fatal: keep the stored/default unit if /me fails.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUnit = useCallback((u: DistanceUnit) => {
    // Optimistic: update state + storage right away so the toggle feels
    // instant, then persist to the server fire-and-forget.
    setUnitState(u);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, u);
    }
    const token = getToken();
    if (token) {
      updateMe(token, { distance_unit: u }).catch(() => {
        // Ignore: the local choice stands; we don't roll back the UI.
      });
    }
  }, []);

  const value = useMemo<DistanceUnitContextValue>(
    () => ({
      unit,
      unitLabel: unit,
      setUnit,
      formatDistance: (meters: number) => formatDistanceValue(meters, unit),
      formatPace: (secPerKm: number | null) => formatPaceValue(secPerKm, unit),
    }),
    [unit, setUnit],
  );

  return <DistanceUnitContext.Provider value={value}>{children}</DistanceUnitContext.Provider>;
}

/**
 * Returns the distance-unit context for the current tree. Throws if used
 * outside a `<DistanceUnitProvider>` so a missing provider fails loudly
 * at the call site rather than silently formatting with a default.
 */
export function useDistanceUnit(): DistanceUnitContextValue {
  const ctx = useContext(DistanceUnitContext);
  if (!ctx) {
    throw new Error("useDistanceUnit must be used within a DistanceUnitProvider");
  }
  return ctx;
}
