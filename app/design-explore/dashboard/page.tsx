"use client";

/**
 * Design Exploration (DX) comparison route — dashboard.
 *
 * THROWAWAY / DO NOT MERGE. Renders all five dashboard idiom variants on a
 * single screen so a human can compare compositions side by side and pick a
 * direction. Gated by the one shared DX flag (config.designExploreEnabled,
 * backed by NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE) — 404s in production, visible
 * only on a Vercel preview deploy. This route is purely additive: it touches
 * no production routes, components, or data paths.
 *
 * Each variant is a self-contained component under _variants/ realizing one
 * idiom from dx/dashboard.md. They deliberately duplicate layout/markup —
 * divergence is the point, not shared abstraction. All five read from the
 * same static fixtures (_fixtures/data.ts) and the same fixture-state toggle
 * (full / partial / empty / loading) so a reviewer can prove every variant
 * across the states a landing page lives or dies on.
 */

import { notFound } from "next/navigation";
import { useState } from "react";
import { config } from "@/lib/config";
import { fixtureFor, type FixtureState } from "./_fixtures/data";
import { FocusGridVariant } from "./_variants/focus-grid";
import { HeroSummaryVariant } from "./_variants/hero-summary";
import { DisciplineColumnsVariant } from "./_variants/discipline-columns";
import { FeedDigestVariant } from "./_variants/feed-digest";
import { CommandCenterVariant } from "./_variants/command-center";

const VARIANTS = [
  {
    id: "focus-grid",
    title: "focus-grid",
    blurb:
      "Garmin In Focus — an equal-weight grid of per-domain metric cards; the mosaic is the hero, chat bar a prominent strip on top. Airy, card-forward.",
    Component: FocusGridVariant,
  },
  {
    id: "hero-summary",
    title: "hero-summary",
    blurb:
      "Oura / Whoop — one consolidated status hero (streak + this-week read) with the chat bar woven in; the six domain numbers demoted to a calmer tier below.",
    Component: HeroSummaryVariant,
  },
  {
    id: "discipline-columns",
    title: "discipline-columns",
    blurb:
      "Strava multi-pane — parity columns (Running · Lifting · Health), chat bar spanning the top. Hierarchy from side-by-side structure, not one hero number.",
    Component: DisciplineColumnsVariant,
  },
  {
    id: "feed-digest",
    title: "feed-digest",
    blurb:
      "Strava feed / The Athletic — a mobile-first, relevance-ordered vertical digest; chat bar leads, then most-important-first rows. Reads like a morning briefing.",
    Component: FeedDigestVariant,
  },
  {
    id: "command-center",
    title: "command-center",
    blurb:
      "Linear's earned density — a KPI strip, the chat bar as a command bar, and tight sparkline mini-cards. Maximum signal, minimum space; calm at density.",
    Component: CommandCenterVariant,
  },
] as const;

const STATES: { id: FixtureState; label: string }[] = [
  { id: "full", label: "Full user" },
  { id: "partial", label: "Partial (lifts + steps)" },
  { id: "empty", label: "Brand-new (empty)" },
  { id: "loading", label: "Loading" },
];

export default function DashboardDesignExplore() {
  if (!config.designExploreEnabled) notFound();
  return <DashboardDesignExploreInner />;
}

function DashboardDesignExploreInner() {
  const [state, setState] = useState<FixtureState>("full");
  const data = fixtureFor(state);

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* DX harness chrome — not part of any variant, just the comparison shell. */}
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h1 className="text-base font-semibold tracking-tight">
              DX · Dashboard — 5 design variants
            </h1>
            <p className="text-xs text-[var(--faint)]">
              Throwaway comparison route · in-system · do not merge
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
              Fixture
            </span>
            {STATES.map((s) => {
              const active = s.id === state;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setState(s.id)}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--faint)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 py-10 sm:px-6">
        {VARIANTS.map(({ id, title, blurb, Component }, i) => (
          <section key={id} id={id} className="scroll-mt-28">
            <div className="mb-5 flex flex-col gap-1 border-l-2 border-[var(--accent-line)] pl-4">
              <div className="flex items-baseline gap-3">
                <span className="text-[11px] font-semibold tabular-nums text-[var(--faint)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="font-mono text-sm font-semibold tracking-tight text-[var(--foreground)]">
                  {title}
                </h2>
              </div>
              <p className="max-w-3xl text-xs leading-relaxed text-[var(--muted)]">{blurb}</p>
            </div>
            {/* Each variant frame mimics the real app viewport so density and
                reflow read honestly. The variant owns everything inside. */}
            <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--background)] shadow-[var(--shadow-soft)]">
              <Component data={data} loading={state === "loading"} />
            </div>
          </section>
        ))}

        <footer className="border-t border-[var(--border)] pt-6 text-center text-xs text-[var(--faint)]">
          Design Exploration · dashboard · 5 variants · awaiting selection — this route is never
          merged.
        </footer>
      </div>
    </main>
  );
}
