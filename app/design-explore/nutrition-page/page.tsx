"use client";

/**
 * Design Exploration (DX) comparison route — nutrition-page.
 *
 * THROWAWAY. This route renders five differentiated visual variants of the
 * /nutrition surface side by side so a human can compare them and pick a
 * direction at the selection gate. It is NOT production: it ships no real
 * data, lives behind the `designExploreEnabled` gate (see lib/config.ts), and
 * has no nav link anywhere. The winning variant is reimplemented for real by a
 * downstream SOW; this file is deleted when the DX closes.
 *
 * Each variant is a self-contained component under _components/ — duplication
 * between them is intentional. The spread is the point; do not refactor them
 * toward a shared abstraction.
 */
import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { VariantDashboardHero } from "./_components/variant-dashboard-hero";
import { VariantDenseTrackerTable } from "./_components/variant-dense-tracker-table";
import { VariantMacroBudgetBars } from "./_components/variant-macro-budget-bars";
import { VariantTimelineFeed } from "./_components/variant-timeline-feed";
import { VariantUnifiedCanvas } from "./_components/variant-unified-canvas";

type VariantMeta = {
  id: string;
  idiom: string;
  reference: string;
  distinct: string;
  Component: () => React.ReactNode;
};

// In ticket order. `id` is the in-page anchor referenced from the PR body.
const VARIANTS: VariantMeta[] = [
  {
    id: "dashboard-hero",
    idiom: "dashboard-hero",
    reference: "Whoop — big confident hero metric",
    distinct:
      "Dramatic type-scale contrast; macro tints carry an oversized hero, log demoted to small neutral type.",
    Component: VariantDashboardHero,
  },
  {
    id: "dense-tracker-table",
    idiom: "dense-tracker-table",
    reference: "MyFitnessPal + Cronometer — running ledger & targets panel",
    distinct:
      "Tight uniform type, hierarchy from weight & column alignment; tints reduced to thin accents; goal-remaining math inline.",
    Component: VariantDenseTrackerTable,
  },
  {
    id: "macro-budget-bars",
    idiom: "macro-budget-bars",
    reference: "MacroFactor — energy/macro budget framing",
    distinct:
      "Consumed-vs-remaining bars as the hero, 'remaining' headlined; each tint owns its bar; over-goal overflows the track.",
    Component: VariantMacroBudgetBars,
  },
  {
    id: "timeline-feed",
    idiom: "timeline-feed",
    reference: "A journal — chronological meal feed",
    distinct:
      "Comfortable editorial leading, generous card spacing; macro tints as small per-card chips; day total sticky.",
    Component: VariantTimelineFeed,
  },
  {
    id: "unified-canvas",
    idiom: "unified-canvas",
    reference: "Linear — two-pane composer, keyboard-first restraint",
    distinct:
      "Two-pane log + unified live picker dissolves the tabs/modal; crisp dense type; violet marks the active add target only.",
    Component: VariantUnifiedCanvas,
  },
];

export default function NutritionPageDesignExplore() {
  // Env gate — dead in production, reachable only on preview/dev or with the
  // explicit opt-in flag. See lib/config.ts.
  if (!config.designExploreEnabled) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* DX banner — make the throwaway nature impossible to miss. */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-strong)] bg-[var(--background)]/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
          <span className="rounded-full bg-[var(--warning)] px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider text-[#1b1206]">
            DX · do not merge
          </span>
          <h1 className="text-base font-extrabold tracking-tight">
            nutrition-page — 5 design variants
          </h1>
          <span className="text-xs text-[var(--muted)]">
            in-system · dark slate / violet / Nunito / shipped macro tints
          </span>
          <nav className="ml-auto hidden items-center gap-3 text-xs font-semibold text-[var(--muted)] lg:flex">
            {VARIANTS.map((v, i) => (
              <a key={v.id} href={`#${v.id}`} className="hover:text-[var(--foreground)]">
                {i + 1}. {v.idiom}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-10">
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
          Five genuinely different compositions of the same dark-slate / violet / Nunito surface,
          each realizing a distinct idiom and making a different element the hero. They diverge on
          layout, density, and composition — not palette, accent, or type. All render the same
          representative day (Tue Jun 16): a partially-eaten log, fat over goal at 132%, the long
          custom Chipotle entry, and an empty Snacks bucket.
        </p>

        {VARIANTS.map((v, i) => {
          const { Component } = v;
          return (
            <section key={v.id} id={v.id} className="scroll-mt-24">
              <div className="mb-5 flex flex-col gap-1 border-l-2 border-[var(--accent)] pl-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-xs font-bold tabular-nums text-[var(--faint)]">
                    VARIANT {i + 1} / {VARIANTS.length}
                  </span>
                  <h2 className="text-xl font-extrabold tracking-tight">{v.idiom}</h2>
                </div>
                <p className="text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--foreground)]">Draws on:</span>{" "}
                  {v.reference}
                </p>
                <p className="text-sm text-[var(--muted)]">
                  <span className="font-semibold text-[var(--foreground)]">Distinct because:</span>{" "}
                  {v.distinct}
                </p>
              </div>
              {/* Frame each variant on the app background so it reads as the
                  real surface rather than a slide. */}
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--background)] p-4 shadow-[var(--shadow-soft)] sm:p-6">
                <Component />
              </div>
            </section>
          );
        })}

        <footer className="border-t border-[var(--border)] pt-6 text-xs text-[var(--faint)]">
          Disposable exploration · branch <code>dx/nutrition-page</code> · never merged. The chosen
          variant is reimplemented production-quality by a downstream SOW.
        </footer>
      </div>
    </main>
  );
}
