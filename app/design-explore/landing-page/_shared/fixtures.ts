/**
 * Static fixtures for the landing-page Design Exploration.
 *
 * Throwaway data only — nothing here is wired to a live service. The chat
 * exchange mirrors the real nutrition-logging message model (see the DX
 * ticket) so the mockups read as the actual product, not lorem ipsum.
 *
 * These are *data* fixtures, deliberately shared across all five variants.
 * Layout/composition is NOT shared — that divergence is the whole point of
 * the exploration and lives in each variant component.
 */

export type MacroRow = {
  item: string;
  cal: number;
  protein: number;
  fat: number;
  carb: number;
  total?: boolean;
};

/** The lunch the user logged, as a macro table. Columns: Item · Cal · P · F · C. */
export const macroRows: MacroRow[] = [
  { item: "Columbus Turkey Burger", cal: 240, protein: 30, fat: 13, carb: 2 },
  { item: "Bibigo Sticky White Rice", cal: 310, protein: 6, fat: 1, carb: 71 },
  { item: "Total", cal: 550, protein: 36, fat: 14, carb: 73, total: true },
];

export const chatExchange = {
  userMessage: "For lunch, I just had a turkey burger and bibigo white rice",
  toolChip: { label: "Log Consumption", state: "ok" as const },
  model: "via Sonnet 4.6",
  assistantIntro: "Logged! Here's your lunch:",
  assistantOutro: "Solid macro split. 💪",
};

export type Feature = {
  key: string;
  title: string;
  blurb: string;
  /** macro/activity tint key for the showcase variant's per-row accent */
  tint: "protein" | "fat" | "carb" | "violet";
};

export const features: Feature[] = [
  {
    key: "coach",
    title: "AI coach chat",
    blurb: "Log meals and lifts in plain English, then ask anything about your training.",
    tint: "violet",
  },
  {
    key: "nutrition",
    title: "Nutrition & macros",
    blurb: "Daily macro tracking with protein, fat, and carb rings that fill as you eat.",
    tint: "protein",
  },
  {
    key: "workouts",
    title: "Workouts & PRs",
    blurb: "Log lifts, track exercises, and watch your estimated 1RMs climb over time.",
    tint: "fat",
  },
  {
    key: "calendar",
    title: "Calendar & progress",
    blurb: "A training calendar with streaks, bodyweight history, and progress charts.",
    tint: "carb",
  },
];

/** Headline copy, lightly varied per idiom in the components themselves. */
export const hero = {
  headline: "Tell it what you trained. It does the rest.",
  sub: "Log meals and workouts in plain English. Track macros, lifts, and PRs. Talk to a coach that actually knows your training.",
};

/** Maps a tint key to its CSS variables (foreground + ~13%-alpha background). */
export const tintVars: Record<Feature["tint"], { fg: string; bg: string }> = {
  protein: { fg: "var(--macro-protein)", bg: "var(--macro-protein-bg)" },
  fat: { fg: "var(--macro-fat)", bg: "var(--macro-fat-bg)" },
  carb: { fg: "var(--macro-carb)", bg: "var(--macro-carb-bg)" },
  violet: { fg: "var(--accent)", bg: "var(--accent-soft)" },
};
