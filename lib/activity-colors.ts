import type { Discipline } from "@/components/calendar/derivations";

/**
 * Single source of truth mapping an activity type to its theme color tokens.
 * The indirection is deliberate: today this is a static map onto the
 * `--discipline-*` CSS variables, but a future "let the user pick their
 * calendar colors" feature swaps the resolver's source (e.g. user-chosen
 * values) without touching any call site. Modeled on `lib/macro-colors.ts`.
 *
 * Tokens are raw `var(--…)` strings, consumed as inline `style` (fills, text,
 * rails). A Tailwind arbitrary-value class can't be built from a runtime
 * string — only inline style can carry a value chosen at runtime — so inline
 * style is what keeps the future user-color swap a one-place change.
 *
 * `disciplineOf` (the one place event → type is decided) returns the full
 * `Discipline` union; only `run`/`lift` are live today. Reserved disciplines
 * (`mobility`/`core`) and any unmapped value fall back to a neutral set.
 */
export type ActivityColorTokens = { dot: string; bg: string; fg: string };

/** The disciplines with a live color mapping today. */
type MappedDiscipline = Extract<Discipline, "run" | "lift">;

const NEUTRAL: ActivityColorTokens = {
  dot: "var(--border)",
  bg: "var(--surface-2)",
  fg: "var(--muted)",
};

const ACTIVITY_COLORS: Record<MappedDiscipline, ActivityColorTokens> = {
  run: {
    dot: "var(--discipline-run-dot)",
    bg: "var(--discipline-run-bg)",
    fg: "var(--discipline-run-fg)",
  },
  lift: {
    dot: "var(--discipline-lift-dot)",
    bg: "var(--discipline-lift-bg)",
    fg: "var(--discipline-lift-fg)",
  },
};

/** Resolve an activity type to its color tokens; neutral for reserved/unmapped. */
export function activityColors(type: Discipline): ActivityColorTokens {
  return (ACTIVITY_COLORS as Partial<Record<Discipline, ActivityColorTokens>>)[type] ?? NEUTRAL;
}

/**
 * The discipline-toned focus-ring class. A `:focus-visible` ring can't be an
 * inline style, so this is a literal Tailwind class — kept here so the ring
 * color stays sourced from the same module as the fills. Literal strings (not
 * interpolated) so Tailwind's scanner generates the utilities.
 */
const ACTIVITY_RING: Record<MappedDiscipline, string> = {
  run: "focus-visible:ring-[var(--discipline-run-dot)]",
  lift: "focus-visible:ring-[var(--discipline-lift-dot)]",
};

export function activityRingClass(type: Discipline): string {
  return (
    (ACTIVITY_RING as Partial<Record<Discipline, string>>)[type] ??
    "focus-visible:ring-[var(--border)]"
  );
}
