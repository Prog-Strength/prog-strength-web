/**
 * Static fixtures + pure helpers shared by the settings DX variants.
 *
 * DX note: this is the ONE place shared between variants, and it is
 * deliberately limited to inert data and pure functions (the realistic
 * profile snapshot, the validation rule, unit conversions). The variants
 * do NOT share UI — divergence is the point, so each variant owns its own
 * layout, save model, and components and duplicates freely.
 *
 * Nothing here is wired to a real service. Mirrors `ResolvedProfile` plus
 * the usage and calendar snapshots from dx/settings.md.
 */

export type WeightUnit = "lb" | "kg";
export type DistanceUnit = "mi" | "km";
export type CalendarDetail = "time_block" | "full_agenda";
export type CalendarStatus = "connected" | "absent" | "checking";

export type SettingsProfile = {
  display_name: string;
  username: string | null;
  bio: string;
  height_cm: number | null;
  avatar_url: string | null;
  weight_unit: WeightUnit;
  distance_unit: DistanceUnit;
  calendar_default_detail: CalendarDetail;
};

export const PROFILE_FIXTURE: SettingsProfile = {
  display_name: "Jimmy",
  username: "jwall317",
  bio: "Bigggggg hybrid athlete",
  height_cm: 175.3,
  avatar_url: null, // initials "J" by default; flip to a URL to see the image state
  weight_unit: "lb",
  distance_unit: "mi",
  calendar_default_detail: "time_block",
};

export const USAGE_FIXTURE = { percentUsed: 43, resetsInLabel: "41m", capped: false };
export const CALENDAR_FIXTURE: { status: CalendarStatus } = { status: "connected" };

export const CM_PER_INCH = 2.54;
export const BIO_MAX_RUNES = 160;

// Server username rule: 3–30 chars, start with a lowercase letter, then
// lowercase letters / digits / underscores.
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,29}$/;

// Fake reserved/taken set so the mock availability probe can show the
// "taken" and "reserved" branches without a backend.
const TAKEN_HANDLES = new Set(["jimmy", "admin", "root", "coach", "jwall"]);
const RESERVED_HANDLES = new Set(["settings", "login", "api", "me", "support"]);

export type Availability =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "reserved" };

/** Resolve a candidate handle against the fake taken/reserved sets. */
export function resolveAvailability(
  handle: string,
): Exclude<Availability, { kind: "idle" } | { kind: "checking" }> {
  if (RESERVED_HANDLES.has(handle)) return { kind: "reserved" };
  if (TAKEN_HANDLES.has(handle)) return { kind: "taken" };
  return { kind: "available" };
}

export const runeLength = (value: string): number => [...value].length;

export const clampRunes = (value: string, max: number): string =>
  runeLength(value) <= max ? value : [...value].slice(0, max).join("");

/** cm → the user's familiar unit string (inches for mi users, cm for km). */
export function heightToDisplay(cm: number | null, unit: "in" | "cm"): string {
  if (cm == null) return "";
  const v = unit === "in" ? cm / CM_PER_INCH : cm;
  return String(Math.round(v * 10) / 10);
}

/** Initials placeholder derived from a display name (matches production). */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Threshold color for the daily-allowance readout. */
export function usageColor(percentUsed: number): string {
  if (percentUsed >= 100) return "var(--danger)";
  if (percentUsed >= 80) return "var(--warning)";
  return "var(--accent)";
}
