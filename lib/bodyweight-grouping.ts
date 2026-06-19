import type { BodyweightEntry } from "./api";
import { convertWeight } from "./bodyweight-trend";

/** One reading inside a day-group. Weight is in the display unit; the
 * original RFC3339 `measured_at` is retained for the bead's time label. */
export type DayReading = {
  id: string;
  weight: number;
  unit: "lb" | "kg";
  measured_at: string;
};

/** A single calendar day's worth of readings — one node on the rail. */
export type DayGroup = {
  /** Local calendar date "YYYY-MM-DD"; the node identity / grouping key. */
  dateKey: string;
  /** That day's readings, chronologically ascending (morning → evening). */
  readings: DayReading[];
  /** Mean weight for the day, in the display unit (the node headline). */
  average: number;
  /** max − min weight when the day has >1 reading; null for a single reading. */
  spread: number | null;
  /** average − previous (older) day's average; null for the oldest day.
   * Sign drives the connector color: down = accent, up = muted. */
  deltaVsPrevDay: number | null;
};

/** Local-calendar-date key ("YYYY-MM-DD") for an RFC3339 timestamp, using the
 * browser's local time — the same local-date bucketing the chart uses. */
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Group flat readings into ordered day-groups, newest day first. Weights are
 * converted to `displayUnit`; the average, spread, and day-over-day delta are
 * all computed in that unit. Bucketing is by LOCAL calendar date over
 * `measured_at`, so a late-PM and an early-AM reading across midnight land on
 * different nodes.
 */
export function groupByLocalDay(entries: BodyweightEntry[], displayUnit: "lb" | "kg"): DayGroup[] {
  const byDay = new Map<string, DayReading[]>();
  for (const e of entries) {
    const key = localDateKey(e.measured_at);
    const arr = byDay.get(key) ?? [];
    arr.push({
      id: e.id,
      weight: convertWeight(e.weight, e.unit, displayUnit),
      unit: displayUnit,
      measured_at: e.measured_at,
    });
    byDay.set(key, arr);
  }

  const ascKeys = [...byDay.keys()].sort();
  const ascGroups: DayGroup[] = [];
  let prevAverage: number | null = null;
  for (const key of ascKeys) {
    const readings = (byDay.get(key) ?? [])
      .slice()
      .sort((a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime());
    const weights = readings.map((r) => r.weight);
    const average = weights.reduce((a, b) => a + b, 0) / weights.length;
    const spread = weights.length > 1 ? Math.max(...weights) - Math.min(...weights) : null;
    const deltaVsPrevDay = prevAverage === null ? null : average - prevAverage;
    ascGroups.push({ dateKey: key, readings, average, spread, deltaVsPrevDay });
    prevAverage = average;
  }

  return ascGroups.reverse();
}

/**
 * Pack day-groups into pages of up to `readingCap` readings each, never
 * splitting a day-group across a page boundary. A day that would push the
 * current page over the cap starts the next page intact; a single day larger
 * than the cap occupies its own page. Input order (newest-first) is preserved,
 * so the most-recent day stays at the top of page 1.
 */
export function packDayGroupsIntoPages(groups: DayGroup[], readingCap: number): DayGroup[][] {
  const pages: DayGroup[][] = [];
  let current: DayGroup[] = [];
  let currentCount = 0;
  for (const g of groups) {
    const n = g.readings.length;
    if (current.length > 0 && currentCount + n > readingCap) {
      pages.push(current);
      current = [];
      currentCount = 0;
    }
    current.push(g);
    currentCount += n;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}
