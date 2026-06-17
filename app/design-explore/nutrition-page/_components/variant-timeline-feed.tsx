/**
 * DX variant — idiom: timeline-feed  (the most direct answer to "the log
 * reads spreadsheet-y" — trades raw density for warmth and narrative)
 *
 * The day as a CHRONOLOGICAL FEED of meals, ordered by consumed_at on a
 * vertical timeline rail rather than bucketed into a four-section table.
 * Each meal is a card — a heading, a small per-card macro chip-row, and its
 * items as soft rows, not table cells — so the day reads like a journal you
 * keep, not a database you fill. The spread levers, all inside the system:
 *   - type scale: comfortable, editorial — generous leading, relaxed sizes,
 *     no cramming.
 *   - color logic: macro tints appear as small per-card CHIPS; the day total
 *     compresses to a sticky neutral summary at the top.
 *   - spacing rhythm: card-based and generous — lots of air between entries,
 *     the opposite end of the spread from dense-tracker-table.
 * The long Chipotle entry becomes a soft, readable journal line; the empty
 * Snacks bucket becomes an intentional "open" slot on the rail.
 */
import { MACRO_COLORS } from "@/lib/macro-colors";
import {
  DAY_TOTAL,
  GOALS,
  MEAL_LABEL,
  MEAL_ORDER,
  MEAL_TIME,
  entriesForMeal,
  formatGrams,
  sumMacros,
  type MacroKey,
  type Macros,
} from "../_fixtures";

const TINT: Record<MacroKey, string> = {
  protein: MACRO_COLORS.protein,
  carbs: MACRO_COLORS.carbs,
  fat: MACRO_COLORS.fat,
};

export function VariantTimelineFeed() {
  const fatOver = DAY_TOTAL.fat_g > GOALS.fat_g;

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky compact day summary — the only place the full numbers live. */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 px-5 py-3 backdrop-blur">
        <span className="text-sm font-extrabold">Tuesday, June 16</span>
        <span className="text-sm font-bold tabular-nums">
          {DAY_TOTAL.calories}
          <span className="text-[var(--faint)]"> / {GOALS.calories} kcal</span>
        </span>
        <span className="ml-auto flex items-center gap-3 text-xs font-semibold tabular-nums">
          <SummaryStat label="P" v={DAY_TOTAL.protein_g} g={GOALS.protein_g} tint={TINT.protein} />
          <SummaryStat label="C" v={DAY_TOTAL.carbs_g} g={GOALS.carbs_g} tint={TINT.carbs} />
          <SummaryStat
            label="F"
            v={DAY_TOTAL.fat_g}
            g={GOALS.fat_g}
            tint={TINT.fat}
            over={fatOver}
          />
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-fg)]">
          + Add to your day
        </button>
        <span className="text-sm text-[var(--faint)]">3 meals · 6 items logged</span>
      </div>

      {/* Timeline rail. */}
      <div className="relative pl-8">
        {/* The vertical thread. */}
        <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--border-strong)]" />

        <div className="flex flex-col gap-7">
          {MEAL_ORDER.map((meal) => {
            const items = entriesForMeal(meal);
            const sub = sumMacros(items);
            const empty = items.length === 0;
            return (
              <div key={meal} className="relative">
                {/* Rail dot. */}
                <span
                  className={
                    empty
                      ? "absolute -left-[26px] top-2 h-3.5 w-3.5 rounded-full border-2 border-dashed border-[var(--faint)] bg-[var(--background)]"
                      : "absolute -left-[27px] top-2 h-4 w-4 rounded-full border-4 border-[var(--background)] bg-[var(--accent)]"
                  }
                />
                {empty ? (
                  <div className="rounded-2xl border border-dashed border-[var(--border-strong)] px-5 py-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-bold text-[var(--muted)]">
                        {MEAL_LABEL[meal]}
                      </span>
                      <span className="text-xs text-[var(--faint)]">still open</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--faint)]">
                      Nothing here yet — a good spot for an evening snack.
                    </p>
                  </div>
                ) : (
                  <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4 shadow-[var(--shadow-raised)]">
                    {/* Heading + time. */}
                    <div className="flex items-baseline justify-between">
                      <h3 className="text-base font-extrabold tracking-tight">
                        {MEAL_LABEL[meal]}
                      </h3>
                      <time className="text-xs font-semibold uppercase tracking-wider text-[var(--faint)]">
                        {MEAL_TIME[meal]}
                      </time>
                    </div>
                    {/* Per-card macro chip-row — tints live here, small. */}
                    <CardChips sub={sub} />
                    {/* Items as soft rows — no grid, journal leading. */}
                    <ul className="mt-3 flex flex-col gap-2.5">
                      {items.map((e) => (
                        <li key={e.id} className="flex items-start gap-3">
                          <span
                            className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--faint)]"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm leading-relaxed">
                              {e.name}
                              {e.quantity > 1 && (
                                <span className="text-[var(--faint)]">
                                  {" "}
                                  · {e.quantity} servings
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-[var(--faint)] tabular-nums">
                              {e.calories} cal · P {formatGrams(e.protein_g)} · C{" "}
                              {formatGrams(e.carbs_g)} · F {formatGrams(e.fat_g)}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </article>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CardChips({ sub }: { sub: Macros }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold tabular-nums">
      <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1">{sub.calories} cal</span>
      <Chip label="P" v={sub.protein_g} tint={TINT.protein} />
      <Chip label="C" v={sub.carbs_g} tint={TINT.carbs} />
      <Chip label="F" v={sub.fat_g} tint={TINT.fat} />
    </div>
  );
}

function Chip({ label, v, tint }: { label: string; v: number; tint: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1"
      style={{ color: tint, backgroundColor: `color-mix(in srgb, ${tint} 14%, transparent)` }}
    >
      {label} {formatGrams(v)}g
    </span>
  );
}

function SummaryStat({
  label,
  v,
  g,
  tint,
  over,
}: {
  label: string;
  v: number;
  g: number;
  tint: string;
  over?: boolean;
}) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ color: over ? "var(--warning)" : tint }}>{label}</span>
      <span style={{ color: over ? "var(--warning)" : undefined }}>
        {formatGrams(v)}
        <span className="text-[var(--faint)]">/{g}</span>
      </span>
    </span>
  );
}
