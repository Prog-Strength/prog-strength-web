/**
 * Static fixtures for the steps-tile Design Exploration.
 *
 * These mirror the shapes `lib/dashboard.ts` already returns (`StepsView`)
 * so every variant reads exactly the four fields the real tile gets — no
 * backend change for this DX round. They are hand-picked to exercise the
 * visual states the ticket calls out (over-goal today, sub-goal days, a big
 * 16k outlier, no-goal, and a brand-new/sparse user), so the degraded paths
 * — where lazy tile designs fall apart — are visible on the comparison route.
 *
 * `days` is the weekday letter for each spark index (oldest → newest, today
 * last). The real tile derives this from `today − (6 − i)` days; here it is
 * baked in so the mockup is deterministic and needs no wall clock. The
 * representative week ends on a Monday (today), which puts the two misses on
 * Thu (index 2) and Sun (index 5) exactly as the ticket narrates.
 */

import type { StepsView } from "@/lib/dashboard";

export type StepsFixture = {
  /** Weekday letters aligned to `spark`, oldest → newest (today last). */
  days: string[];
  view: StepsView;
};

/** The owner's screenshot: goal 10k, today riding well over it, two misses. */
export const FULL: StepsFixture = {
  days: ["T", "W", "T", "F", "S", "S", "M"],
  view: {
    today: 16000,
    avg: 13100, // server window figure (≈ shown "13.1k") — NOT mean(spark)
    goal: 10000,
    spark: [11200, 14800, 9400, 13000, 15100, 8700, 16000],
  },
};

/** No goal set — every goal-relative treatment must degrade, never NaN%. */
export const NO_GOAL: StepsFixture = {
  days: ["T", "W", "T", "F", "S", "S", "M"],
  view: {
    today: 12400,
    avg: 11800,
    goal: null,
    spark: [11200, 14800, 9400, 13000, 15100, 8700, 12400],
  },
};

/**
 * Brand-new / sparse — only today's count is real; the earlier days are
 * honest zeros (the data can't tell a logged 0 from an unlogged day, so we
 * render 0 as 0 and never guess "unlogged"). `avg` mirrors today because
 * there's no meaningful window yet.
 */
export const SPARSE: StepsFixture = {
  days: ["T", "W", "T", "F", "S", "S", "M"],
  view: {
    today: 7200,
    avg: 7200,
    goal: 10000,
    spark: [0, 0, 0, 0, 0, 0, 7200],
  },
};
