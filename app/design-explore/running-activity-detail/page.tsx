"use client";

/**
 * DESIGN EXPLORATION comparison route — running-activity-detail.
 * DO NOT MERGE. Throwaway. Flag-gated; never reachable in normal navigation.
 *
 * Renders all five idiom variants stacked on one screen, each labeled with its
 * idiom name and an anchor, so a human can compare directions and pick one. The
 * value is the SPREAD — the variants deliberately diverge on composition,
 * density, and which element is the hero, while staying in-system (oura-calm
 * v0.4 tokens, the periwinkle accent as app-chrome only, the run green-teal
 * discipline hue, Manrope). See each component's header comment for its idiom.
 *
 * Gate: lives OUTSIDE the (app) auth shell and `notFound()`s unless
 * NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE=1 — dead in production, additive only,
 * touching no shipped run-detail code path.
 */

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { IntervalRepBlocks } from "./_components/IntervalRepBlocks";
import { SplitsLedgerSpine } from "./_components/SplitsLedgerSpine";
import { EffortTraceHero } from "./_components/EffortTraceHero";
import { PlanAdherenceHeadline } from "./_components/PlanAdherenceHeadline";
import { EditorialRunRecap } from "./_components/EditorialRunRecap";

const VARIANTS = [
  {
    idiom: "interval-rep-blocks",
    ref: "TrainingPeaks",
    blurb: "The workout's structure is the page — reps stacked as effort-tinted blocks.",
    Component: IntervalRepBlocks,
  },
  {
    idiom: "splits-ledger-spine",
    ref: "Runalyze",
    blurb: "The run as a ledger — a dense splits/intervals table is the backbone.",
    Component: SplitsLedgerSpine,
  },
  {
    idiom: "effort-trace-hero",
    ref: "Whoop",
    blurb: "The trace is the hero — one big fused effort chart, the dropout tamed.",
    Component: EffortTraceHero,
  },
  {
    idiom: "plan-adherence-headline",
    ref: "MacroFactor",
    blurb: "Did you hit the prescription — the verdict promoted to the headline.",
    Component: PlanAdherenceHeadline,
  },
  {
    idiom: "editorial-run-recap",
    ref: "The Athletic",
    blurb: "The run told as a short story — headline, recap, figures below.",
    Component: EditorialRunRecap,
  },
] as const;

export default function DesignExploreRunningActivityDetail() {
  if (!config.designExploreEnabled) notFound();

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      {/* Exploration chrome — not part of any variant. */}
      <header className="sticky top-0 z-20 border-b border-[var(--border-strong)] bg-[var(--background)]/90 px-6 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-sm font-semibold tracking-[-0.01em]">
              DX · running-activity-detail
            </h1>
            <p className="text-xs text-[var(--muted)]">
              5 in-system variants — compare and pick a direction. Not for merge.
            </p>
          </div>
          <nav className="flex flex-wrap gap-1.5">
            {VARIANTS.map((v) => (
              <a
                key={v.idiom}
                href={`#${v.idiom}`}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] text-[var(--muted)] transition hover:border-[var(--accent-line)] hover:text-[var(--foreground)]"
              >
                {v.idiom}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl">
        {VARIANTS.map((v, i) => (
          <section
            key={v.idiom}
            id={v.idiom}
            className="scroll-mt-20 border-b border-[var(--border)]"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-6 pt-8">
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--muted)]">
                {i + 1} / 5
              </span>
              <h2 className="text-base font-semibold tracking-[-0.01em]">{v.idiom}</h2>
              <span className="text-xs text-[var(--faint)]">draws on {v.ref}</span>
              <p className="w-full text-xs text-[var(--muted)]">{v.blurb}</p>
            </div>
            {/* Each variant is a self-contained throwaway mockup. */}
            <v.Component />
          </section>
        ))}
        <footer className="px-6 py-10 text-center text-xs text-[var(--faint)]">
          Design exploration — disposable. The chosen direction is reimplemented by a downstream
          SOW.
        </footer>
      </div>
    </main>
  );
}
