"use client";

/**
 * DX variant — idiom: unified-canvas  (draws on Linear's two-pane composer:
 * keyboard-first density, single-accent restraint, action-as-inline-act)
 *
 * Attacks the "bolted-on tabs" head-on by dissolving Log / Pantry / Recipes
 * and the Quick Add modal into ONE two-pane working surface: the day log
 * lives in the left column and a live, unified search-and-add picker
 * (pantry + recipes + custom together) lives in the right — so logging is an
 * inline act on the page, not a tab switch and a modal. The macro summary
 * compresses to a persistent header rail across the top. The spread levers,
 * all inside the design system:
 *   - type scale: crisp and functional — tight, even sizing; nothing oversized.
 *   - color logic: restrained and STRUCTURAL — violet marks the active add
 *     target and the selected picker row; macro tints stay as small figures.
 *   - spacing rhythm: two-pane, efficient, composable; keyboard-first density.
 * Re-thinks the information architecture itself, not just the skin.
 */
import { useMemo, useState } from "react";
import { MACRO_COLORS } from "@/lib/macro-colors";
import {
  DAY_TOTAL,
  GOALS,
  MEAL_LABEL,
  MEAL_ORDER,
  entriesForMeal,
  formatGrams,
  sumMacros,
  type MacroKey,
  type MealType,
} from "../_fixtures";

const TINT: Record<MacroKey, string> = {
  protein: MACRO_COLORS.protein,
  carbs: MACRO_COLORS.carbs,
  fat: MACRO_COLORS.fat,
};

type PickerItem = {
  id: string;
  name: string;
  kind: "pantry" | "recipe";
  serving: string;
  calories: number;
  protein_g: number;
};

// Unified catalog — pantry + recipes in one searchable list, the whole point
// of the idiom (no tab to switch). Static mock data.
const CATALOG: PickerItem[] = [
  { id: "p1", name: "Egg", kind: "pantry", serving: "1 egg", calories: 70, protein_g: 6 },
  {
    id: "p2",
    name: "La Favorita Flour Tortillas",
    kind: "pantry",
    serving: "1 tortilla",
    calories: 160,
    protein_g: 4,
  },
  {
    id: "p3",
    name: "1st Phorm Birthday Cake Protein Powder",
    kind: "pantry",
    serving: "1 scoop",
    calories: 120,
    protein_g: 24,
  },
  {
    id: "p4",
    name: "PBJ Grape Uncrustables",
    kind: "pantry",
    serving: "1 piece",
    calories: 260,
    protein_g: 8,
  },
  {
    id: "p5",
    name: "Elev8 — Creamy Rice (Peanut Butter Cup)",
    kind: "pantry",
    serving: "1 pouch",
    calories: 130,
    protein_g: 3,
  },
  {
    id: "r1",
    name: "Overnight Oats + Whey",
    kind: "recipe",
    serving: "1 jar",
    calories: 420,
    protein_g: 38,
  },
  {
    id: "r2",
    name: "Chicken Rice Bowl",
    kind: "recipe",
    serving: "1 bowl",
    calories: 610,
    protein_g: 52,
  },
  {
    id: "p6",
    name: "Greek Yogurt, nonfat",
    kind: "pantry",
    serving: "170 g",
    calories: 100,
    protein_g: 17,
  },
];

export function VariantUnifiedCanvas() {
  const [query, setQuery] = useState("");
  const [meal, setMeal] = useState<MealType>("dinner");
  const [selected, setSelected] = useState<string>(CATALOG[0].id);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATALOG;
    return CATALOG.filter((c) => c.name.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="flex flex-col gap-4">
      {/* PERSISTENT HEADER RAIL — macro summary compressed to one line. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--faint)]">
          Tue Jun 16
        </span>
        <RailStat label="Cal" v={DAY_TOTAL.calories} g={GOALS.calories} />
        <RailStat label="P" v={DAY_TOTAL.protein_g} g={GOALS.protein_g} tint={TINT.protein} />
        <RailStat label="C" v={DAY_TOTAL.carbs_g} g={GOALS.carbs_g} tint={TINT.carbs} />
        <RailStat label="F" v={DAY_TOTAL.fat_g} g={GOALS.fat_g} tint={TINT.fat} />
        <span className="ml-auto hidden items-center gap-1 text-[11px] text-[var(--faint)] sm:flex">
          <Kbd>/</Kbd> to search
          <Kbd>↵</Kbd> to log
        </span>
      </div>

      {/* TWO-PANE WORKING SURFACE. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Left pane — the day log; the active add target meal is violet. */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          {MEAL_ORDER.map((m) => {
            const items = entriesForMeal(m);
            const sub = sumMacros(items);
            const active = m === meal;
            return (
              <section
                key={m}
                onClick={() => setMeal(m)}
                className={
                  active
                    ? "cursor-pointer rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3"
                    : "cursor-pointer rounded-lg border border-transparent p-3 hover:bg-[var(--surface-2)]"
                }
              >
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                    {MEAL_LABEL[m]}
                    {active && (
                      <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-fg)]">
                        ADD TARGET
                      </span>
                    )}
                  </h3>
                  <span className="text-[11px] text-[var(--faint)] tabular-nums">
                    {items.length ? `${sub.calories} cal` : "empty"}
                  </span>
                </div>
                {items.length === 0 ? (
                  <p className="mt-1.5 text-[11px] text-[var(--faint)]">
                    Search on the right and press ↵ to drop a food here.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col">
                    {items.map((e) => (
                      <li
                        key={e.id}
                        className="grid grid-cols-[minmax(0,1fr)_2.5rem_3rem] items-baseline gap-2 border-t border-[var(--border)] py-1.5 text-[13px] first:border-t-0"
                      >
                        <span className="min-w-0 break-words leading-snug">{e.name}</span>
                        <span className="text-right text-[var(--faint)] tabular-nums">
                          ×{e.quantity}
                        </span>
                        <span className="text-right font-semibold tabular-nums">{e.calories}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        {/* Right pane — unified live picker (pantry + recipes + custom). */}
        <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] p-3">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--background)] px-3 py-2">
              <SearchGlyph />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search foods, recipes, or type a custom…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--faint)]"
              />
            </div>
            <p className="mt-2 text-[11px] text-[var(--faint)]">
              Adding to <span className="font-bold text-[var(--accent)]">{MEAL_LABEL[meal]}</span> ·
              pantry, recipes & custom all here
            </p>
          </div>

          <ul className="flex max-h-[28rem] flex-col overflow-y-auto p-2">
            {results.map((c) => {
              const sel = c.id === selected;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c.id)}
                    className={
                      sel
                        ? "flex w-full items-center gap-3 rounded-lg border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-left"
                        : "flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                    }
                  >
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide"
                      style={{
                        color: c.kind === "recipe" ? "var(--accent)" : "var(--muted)",
                        backgroundColor:
                          c.kind === "recipe" ? "var(--accent-soft)" : "var(--surface-2)",
                      }}
                    >
                      {c.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold">{c.name}</span>
                      <span className="block text-[11px] text-[var(--faint)] tabular-nums">
                        {c.serving} · {c.calories} cal · {formatGrams(c.protein_g)}g P
                      </span>
                    </span>
                    {sel && <Kbd>↵</Kbd>}
                  </button>
                </li>
              );
            })}
            {query.trim() && (
              <li className="mt-1 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-2 text-[12px] text-[var(--muted)]">
                + Log “{query.trim()}” as a custom entry
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RailStat({ label, v, g, tint }: { label: string; v: number; g: number; tint?: string }) {
  const over = v > g;
  return (
    <span className="flex items-baseline gap-1.5 text-sm tabular-nums">
      <span
        className="text-[11px] font-bold"
        style={{ color: over ? "var(--warning)" : (tint ?? "var(--faint)") }}
      >
        {label}
      </span>
      <span className="font-bold" style={{ color: over ? "var(--warning)" : undefined }}>
        {formatGrams(v)}
      </span>
      <span className="text-[11px] text-[var(--faint)]">/{g}</span>
      {over && <span className="text-[10px] font-bold text-[var(--warning)]">OVER</span>}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--muted)]">
      {children}
    </kbd>
  );
}

function SearchGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-4 w-4 text-[var(--faint)]"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
