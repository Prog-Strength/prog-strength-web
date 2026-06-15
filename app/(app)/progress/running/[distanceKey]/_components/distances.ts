/**
 * The fixed v1 standard distance set, shortest first — matches the API's
 * keys and `distance_label` values (mirrors the RunningView const on the
 * personal-records side). Defined client-side so the detail route can
 * validate the `[distanceKey]` param and render the DistanceSwitcher
 * without a round trip.
 */
export const STANDARD_DISTANCES: { key: string; label: string }[] = [
  { key: "1mi", label: "1 Mile" },
  { key: "2mi", label: "2 Mile" },
  { key: "5k", label: "5K" },
  { key: "10k", label: "10K" },
  { key: "half_marathon", label: "Half Marathon" },
  { key: "marathon", label: "Marathon" },
];

/** True when `key` is one of the six standard distances. */
export function isStandardDistance(key: string): boolean {
  return STANDARD_DISTANCES.some((d) => d.key === key);
}

/** The display label for a standard key, or the raw key as a fallback. */
export function distanceLabel(key: string): string {
  return STANDARD_DISTANCES.find((d) => d.key === key)?.label ?? key;
}
