/**
 * Static fixtures for the unauthenticated landing page.
 *
 * The landing page is rendered to logged-out visitors, so nothing here
 * can be live data — every visual is a fixture that *looks* real. These
 * shapes mirror the DX `_shared` spec (the `Message`/`ToolCall` shapes and
 * the macro numbers selected in `dx/landing-page.md`), reimplemented
 * locally for the login route rather than imported from the gated
 * `design-explore` tree (which never ships to production).
 *
 * The numbers are intentionally exact: the chat-proof mock is the page's
 * proof element, so the macro table — including the Total row — is the
 * literal exchange the SOW specifies, not a placeholder.
 */

/** A single row of the macro table rendered inside the chat proof. */
export type MacroRow = {
  item: string;
  /** Calories (kcal). */
  cal: number;
  /** Protein (g). */
  protein: number;
  /** Fat (g). */
  fat: number;
  /** Carbs (g). */
  carb: number;
};

/** The turkey-burger → macro-table exchange, as a static chat snippet. */
export const chatProof = {
  /** What the lifter typed — plain-English meal logging. */
  userMessage: "logged a Columbus turkey burger and some Bibigo sticky rice for lunch",
  /** The model the assistant reply is attributed to, shown as a chip. */
  model: "Sonnet 4.6",
  /** The tool the assistant invoked, shown as a ✓ chip. */
  toolName: "Log Consumption",
  /** Per-item macro rows: Item · Cal · P · F · C. */
  items: [
    { item: "Columbus Turkey Burger", cal: 240, protein: 30, fat: 13, carb: 2 },
    { item: "Bibigo Sticky White Rice", cal: 310, protein: 6, fat: 1, carb: 71 },
  ] satisfies MacroRow[],
  /** The summed Total row — rendered with emphasis under the items. */
  total: { item: "Total", cal: 550, protein: 36, fat: 14, carb: 73 } satisfies MacroRow,
  /** A coach-tone closing line after the table. */
  closing: "Logged. That's 36g of protein on the board — solid lunch.",
} as const;

/** Macro-ring fixture for the nutrition feature row (intake vs. goal). */
export const macroRings = [
  { label: "Protein", intake: 128, goal: 180, tint: "var(--macro-protein)" },
  { label: "Carbs", intake: 210, goal: 240, tint: "var(--macro-carb)" },
  { label: "Fat", intake: 52, goal: 70, tint: "var(--macro-fat)" },
] as const;

/** Personal-record / estimated-1RM fixture for the workouts feature row. */
export const prStat = {
  lift: "Back Squat",
  /** Estimated one-rep max, in lb. */
  estimatedOneRm: 315,
  unit: "lb",
  /** Change vs. the prior estimate — drives the "climbing" framing. */
  deltaLb: 20,
  /** A few recent top sets, oldest → newest, for the climbing bars. */
  recent: [275, 285, 295, 305, 315],
} as const;

/** Training-calendar streak fixture for the calendar feature row. */
export const calendarStreak = {
  /** Current consecutive-week training streak. */
  streakWeeks: 6,
  /** A 4-week × 7-day grid of trained (true) / rest (false) days. */
  weeks: [
    [true, false, true, true, false, true, false],
    [true, true, false, true, false, true, true],
    [false, true, true, false, true, true, false],
    [true, true, false, true, true, false, true],
  ],
} as const;
