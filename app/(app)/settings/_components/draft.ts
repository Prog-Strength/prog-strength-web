import type { ResolvedProfile } from "@/lib/api";

export const CM_PER_INCH = 2.54;
export const BIO_MAX_RUNES = 160;
// Mirrors the server's username validator: 3–30 chars, lead letter, then
// lowercase letters / digits / underscores. The server stays authoritative.
export const USERNAME_RE = /^[a-z][a-z0-9_]{2,29}$/;

/** The editable profile fields, projected into one flat diff-able shape. */
export type Draft = {
  display_name: string;
  username: string;
  bio: string;
  // Height as the DISPLAY string in the current distance-derived unit; "" = unset.
  height: string;
  distance_unit: "mi" | "km";
  weight_unit: "lb" | "kg";
  calendar_default_detail: "time_block" | "full_agenda";
};

export type DraftKey = keyof Draft;

export type HeightUnit = "in" | "cm";

/** "mi" distance → height in inches; "km" → centimeters. */
export function heightUnitFor(distance: "mi" | "km"): HeightUnit {
  return distance === "km" ? "cm" : "in";
}

/** Avatar initials: first two of a single name, else first+last initials. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Count by code points (not UTF-16 units) so emoji count as one. */
export const runeLength = (value: string): number => [...value].length;

/** Trim to at most `max` runes without splitting a surrogate pair. */
export const clampRunes = (value: string, max: number): string =>
  runeLength(value) <= max ? value : [...value].slice(0, max).join("");

/** Canonical cm → display string in the given unit; null → "". */
export function heightToDisplay(cm: number | null, unit: HeightUnit): string {
  if (cm == null) return "";
  const v = unit === "in" ? cm / CM_PER_INCH : cm;
  return String(Math.round(v * 10) / 10);
}

/**
 * Display string in the given unit → canonical cm rounded to 0.1; "" → null.
 * Throws RangeError on a non-finite or non-positive value so the save handler
 * can surface "enter a valid height".
 */
export function displayToCm(display: string, unit: HeightUnit): number | null {
  const raw = display.trim();
  if (raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    throw new RangeError("Enter a valid height, or leave blank to clear.");
  }
  const cm = unit === "in" ? n * CM_PER_INCH : n;
  return Math.round(cm * 10) / 10;
}

/** Capture an immutable draft baseline from the resolved profile. */
export function draftFromProfile(p: ResolvedProfile): Draft {
  return {
    display_name: p.display_name ?? "",
    username: p.username ?? "",
    bio: p.bio ?? "",
    height: heightToDisplay(p.height_cm, heightUnitFor(p.distance_unit)),
    distance_unit: p.distance_unit,
    weight_unit: p.weight_unit,
    calendar_default_detail: p.calendar_default_detail,
  };
}

/** Keys whose draft value differs from the baseline. */
export function dirtyKeys(initial: Draft, draft: Draft): DraftKey[] {
  return (Object.keys(draft) as DraftKey[]).filter((k) => draft[k] !== initial[k]);
}

/** The PATCH body — only the dirty keys, mapped to the API's shape. */
export function patchFromDraft(
  initial: Draft,
  draft: Draft,
): {
  display_name?: string;
  username?: string;
  bio?: string;
  height_cm?: number | null;
  distance_unit?: "mi" | "km";
  weight_unit?: "lb" | "kg";
  calendar_default_detail?: "time_block" | "full_agenda";
} {
  const patch: ReturnType<typeof patchFromDraft> = {};
  for (const k of dirtyKeys(initial, draft)) {
    switch (k) {
      case "display_name":
        patch.display_name = draft.display_name.trim();
        break;
      case "username":
        patch.username = draft.username.trim().toLowerCase();
        break;
      case "bio":
        patch.bio = draft.bio.trim();
        break;
      case "height":
        patch.height_cm = displayToCm(draft.height, heightUnitFor(draft.distance_unit));
        break;
      case "distance_unit":
        patch.distance_unit = draft.distance_unit;
        break;
      case "weight_unit":
        patch.weight_unit = draft.weight_unit;
        break;
      case "calendar_default_detail":
        patch.calendar_default_detail = draft.calendar_default_detail;
        break;
    }
  }
  return patch;
}
