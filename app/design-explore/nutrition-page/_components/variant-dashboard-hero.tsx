/**
 * DX variant — idiom: dashboard-hero  (draws on Whoop's today screen)
 *
 * The day's macro state is the STAR. An oversized hero band dominates the
 * top: one large composite calories ring flanked by big, confident macro
 * numerals in Nunito 800, with the log demoted to a calm, small-type scroll
 * beneath. The spread levers, all inside the design system:
 *   - type scale: dramatic — hero numerals are huge (text-6xl/7xl, w800),
 *     log text is small (text-xs/sm). Hierarchy from SIZE.
 *   - color logic: the macro tints CARRY the hero (loudest thing on page);
 *     the log stays almost entirely neutral slate.
 *   - spacing rhythm: generous, breathable up top; the page opens with a
 *     "how's my day?" hit, then settles.
 * Over-goal (fat 132%) reads as an amber-flipped hero stat with an OVER tag.
 */
import { MACRO_COLORS } from "@/lib/macro-colors";
import {
  DAY_STRIP,
  DAY_TOTAL,
  GOALS,
  MEAL_LABEL,
  MEAL_ORDER,
  entriesForMeal,
  formatGrams,
  sumMacros,
  type MacroKey,
} from "../_fixtures";

const TINT: Record<MacroKey, string> = {
  protein: MACRO_COLORS.protein,
  carbs: MACRO_COLORS.carbs,
  fat: MACRO_COLORS.fat,
};

export function VariantDashboardHero() {
  const calPct = Math.round((DAY_TOTAL.calories / GOALS.calories) * 100);

  return (
    <div className="flex flex-col gap-8">
      {/* Day strip — quiet pills, deferring to the hero below. */}
      <div className="flex items-center gap-2">
        {DAY_STRIP.map((d) => (
          <div
            key={d.dom}
            className={
              d.selected
                ? "flex flex-col items-center rounded-full bg-[var(--accent)] px-4 py-1.5 text-[var(--accent-fg)]"
                : "flex flex-col items-center rounded-full px-4 py-1.5 text-[var(--faint)]"
            }
          >
            <span className="text-[10px] font-bold tracking-widest">{d.label}</span>
            <span className="text-sm font-bold tabular-nums">{d.dom}</span>
          </div>
        ))}
      </div>

      {/* HERO BAND — oversized, the loudest thing on the page. */}
      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-8 py-10 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:gap-14">
          {/* Composite calories ring — calories stays uncolored (foreground). */}
          <div className="relative shrink-0">
            <CompositeRing pct={calPct} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-extrabold leading-none tabular-nums tracking-tight">
                {DAY_TOTAL.calories}
              </span>
              <span className="mt-1 text-sm font-semibold text-[var(--muted)] tabular-nums">
                of {GOALS.calories} kcal
              </span>
              <span className="mt-3 rounded-full bg-[var(--surface-2)] px-3 py-1 text-xs font-bold text-[var(--muted)]">
                {GOALS.calories - DAY_TOTAL.calories} left
              </span>
            </div>
          </div>

          {/* Big macro numerals — the tints carry the hero. */}
          <div className="grid flex-1 grid-cols-1 gap-5 sm:grid-cols-3">
            <HeroMacro
              label="Protein"
              value={DAY_TOTAL.protein_g}
              goal={GOALS.protein_g}
              tint={TINT.protein}
            />
            <HeroMacro
              label="Carbs"
              value={DAY_TOTAL.carbs_g}
              goal={GOALS.carbs_g}
              tint={TINT.carbs}
            />
            <HeroMacro label="Fat" value={DAY_TOTAL.fat_g} goal={GOALS.fat_g} tint={TINT.fat} />
          </div>
        </div>
      </section>

      {/* Actions — the primary job (log food) is the only filled button. */}
      <div className="flex items-center gap-3">
        <button className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--accent-fg)]">
          + Quick Add
        </button>
        <button className="rounded-full border border-[var(--border-strong)] px-4 py-2.5 text-sm font-semibold text-[var(--muted)]">
          Edit Macros
        </button>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-[var(--surface)] p-1 text-xs font-semibold">
          {["Log", "Pantry", "Recipes"].map((t, i) => (
            <span
              key={t}
              className={
                i === 0
                  ? "rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[var(--foreground)]"
                  : "px-3 py-1.5 text-[var(--faint)]"
              }
            >
              {t}
            </span>
          ))}
        </div>
      </div>

      {/* Demoted log — calm, neutral, small type. The hero already answered
          "how's my day?"; this is the supporting detail. */}
      <div className="flex flex-col gap-3">
        {MEAL_ORDER.map((meal) => {
          const items = entriesForMeal(meal);
          const sub = sumMacros(items);
          return (
            <section key={meal} className="rounded-2xl bg-[var(--surface)] px-5 py-4">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold">{MEAL_LABEL[meal]}</h3>
                {items.length > 0 ? (
                  <span className="text-[11px] font-medium text-[var(--faint)] tabular-nums">
                    {sub.calories} cal · P {formatGrams(sub.protein_g)} · C{" "}
                    {formatGrams(sub.carbs_g)} · F {formatGrams(sub.fat_g)}
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--faint)]">nothing logged</span>
                )}
              </div>
              {items.length > 0 && (
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {items.map((e) => (
                    <li key={e.id} className="flex items-start justify-between gap-4 py-2">
                      <span className="min-w-0 flex-1 text-xs text-[var(--muted)]">
                        {e.name}
                        <span className="text-[var(--faint)]"> ×{e.quantity}</span>
                      </span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">
                        {e.calories} cal
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function HeroMacro({
  label,
  value,
  goal,
  tint,
}: {
  label: string;
  value: number;
  goal: number;
  tint: string;
}) {
  const pct = Math.round((value / goal) * 100);
  const over = value > goal;
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold uppercase tracking-widest text-[var(--faint)]">
        {label}
      </span>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className="text-5xl font-extrabold leading-none tabular-nums tracking-tight"
          style={{ color: over ? "var(--warning)" : tint }}
        >
          {formatGrams(value)}
        </span>
        <span className="text-base font-bold text-[var(--faint)] tabular-nums">/{goal}g</span>
      </div>
      {/* Thin progress line in the tint; over-goal flips amber + OVER tag. */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(pct, 100)}%`,
            backgroundColor: over ? "var(--warning)" : tint,
          }}
        />
      </div>
      <span
        className="mt-1.5 text-xs font-bold tabular-nums"
        style={{ color: over ? "var(--warning)" : "var(--muted)" }}
      >
        {pct}%{over ? " · OVER" : ""}
      </span>
    </div>
  );
}

/** Large composite ring for calories — geometry scaled up from the shipped
 * MacroGoalRings donut so the hero reads from across the room. */
function CompositeRing({ pct }: { pct: number }) {
  const size = 240;
  const r = 104;
  const stroke = 18;
  const c = 2 * Math.PI * r;
  const filled = Math.min(pct / 100, 1);
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Calories ${pct}% of goal`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${filled * c} ${c}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}
