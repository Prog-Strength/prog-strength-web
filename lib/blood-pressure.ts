/**
 * Blood-pressure classification + averaging helpers, shared by the modal,
 * the trend chart, and the dashboard card. This is the TypeScript mirror of
 * the Go `Classify` in the API (internal/bloodpressure); the two MUST agree
 * on the ladder and thresholds. The API is authoritative for stored
 * categories; these client helpers exist for optimistic UI (live preview in
 * the log modal) and for the daily-average roll-up the chart plots.
 */

/** The AHA blood-pressure categories, most→least severe when displayed. */
export type BpCategory = "normal" | "elevated" | "stage_1" | "stage_2" | "crisis";

/**
 * Display metadata per category: a human `label` and a design-system
 * status-tone token (`tone`). Tokens are CSS `var(--...)` references so
 * components read the current palette rather than baking in a hex. A
 * component renders `BP_CATEGORIES[cat].label` / `.tone`.
 */
export const BP_CATEGORIES: Record<BpCategory, { label: string; tone: string }> = {
  normal: { label: "Normal", tone: "var(--success)" },
  elevated: { label: "Elevated", tone: "var(--warning)" },
  stage_1: { label: "Stage 1", tone: "var(--warning)" },
  stage_2: { label: "Stage 2", tone: "var(--danger)" },
  crisis: { label: "Crisis", tone: "var(--danger)" },
};

/**
 * The systolic/diastolic cutoffs each category's ladder rung tests. Exported
 * so the modal/chart can draw the same reference lines the classifier uses
 * (e.g. the 130/80 stage-1 lines). `normal` has no cutoff — it's the floor.
 */
export const BP_THRESHOLDS = {
  crisis: { systolic: 180, diastolic: 120 },
  stage_2: { systolic: 140, diastolic: 90 },
  stage_1: { systolic: 130, diastolic: 80 },
  elevated: { systolic: 120 },
} as const;

/**
 * Classify a single reading. The checks form a DESCENDING ladder: a reading
 * that satisfies several rungs resolves to the most severe one, so the order
 * below is load-bearing — do not reorder. Mirrors the Go `Classify`.
 *
 *   crisis   if systolic >= 180 || diastolic >= 120
 *   stage_2  if systolic >= 140 || diastolic >= 90
 *   stage_1  if systolic >= 130 || diastolic >= 80
 *   elevated if systolic >= 120
 *   normal   otherwise
 */
export function classify(systolic: number, diastolic: number): BpCategory {
  if (systolic >= 180 || diastolic >= 120) return "crisis";
  if (systolic >= 140 || diastolic >= 90) return "stage_2";
  if (systolic >= 130 || diastolic >= 80) return "stage_1";
  if (systolic >= 120) return "elevated";
  return "normal";
}

/** The minimal reading shape `dailyAverages` needs (a `BloodPressureEntry` fits). */
type ReadingLike = { systolic: number; diastolic: number; measured_at: string };

/** One local calendar day's averaged reading. */
type DailyAverage = {
  day: string; // YYYY-MM-DD, local to the given time zone
  systolic: number; // arithmetic mean, rounded to nearest int
  diastolic: number; // arithmetic mean, rounded to nearest int
  count: number; // readings that fell on this day
  category: BpCategory; // classify(systolic, diastolic) of the rounded means
};

/**
 * Bucket readings by LOCAL calendar day in the given IANA `timeZone` and
 * average each day's systolic/diastolic (mean, rounded to nearest int). Days
 * with no readings are simply absent — gaps are NOT zero-filled. Result is
 * ordered oldest→newest by day, independent of input order.
 *
 * Local-day bucketing uses `Intl.DateTimeFormat("en-CA", ...)`, whose output
 * is YYYY-MM-DD, so a reading's UTC instant maps to the wall-clock day the
 * user experienced it (e.g. a 03:30Z reading is the prior day in US Eastern).
 */
export function dailyAverages(entries: ReadingLike[], timeZone: string): DailyAverage[] {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const buckets = new Map<string, { systolic: number; diastolic: number; count: number }>();
  for (const entry of entries) {
    const day = fmt.format(new Date(entry.measured_at));
    const bucket = buckets.get(day) ?? { systolic: 0, diastolic: 0, count: 0 };
    bucket.systolic += entry.systolic;
    bucket.diastolic += entry.diastolic;
    bucket.count += 1;
    buckets.set(day, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([day, { systolic, diastolic, count }]) => {
      const avgSystolic = Math.round(systolic / count);
      const avgDiastolic = Math.round(diastolic / count);
      return {
        day,
        systolic: avgSystolic,
        diastolic: avgDiastolic,
        count,
        category: classify(avgSystolic, avgDiastolic),
      };
    });
}
